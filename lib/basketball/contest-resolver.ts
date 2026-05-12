// lib/basketball/contest-resolver.ts
//
// Get-or-create a basketball_contests row for a (league, date) pair, plus
// the frozen player pool. The first request for a given date that has at
// least one scheduled basketball_games row builds the contest:
//   1. Compute season averages per player.
//   2. Price via lib/basketball/contest-salary.ts.
//   3. Insert basketball_contests + basketball_contest_players.
//   4. Set lineup_lock_at to the earliest scheduled_at of that day.

import type { SupabaseClient } from "@supabase/supabase-js";
import { priceAll, type PlayerSeason } from "./contest-salary";

export type Contest = {
  id: string;
  basketball_league_id: string;
  date: string;
  status: "pending" | "open" | "locked" | "scored";
  lineup_lock_at: string | null;
  salary_cap: number;
  lineup_size: number;
};

type ResolveResult =
  | { kind: "ok"; contest: Contest }
  | { kind: "no_games"; date: string }
  | { kind: "league_not_enabled" }
  | { kind: "error"; message: string };

function todayUtcIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfDayUtc(date: string): string {
  return `${date}T00:00:00Z`;
}
function endOfDayUtc(date: string): string {
  return `${date}T23:59:59Z`;
}

export async function resolveContestForDate(
  supabase: SupabaseClient,
  leagueId: string,
  date: string,
): Promise<ResolveResult> {
  // Confirm league is contest-enabled (and approved + public per the spec).
  const { data: league, error: leagueErr } = await supabase
    .from("basketball_leagues")
    .select("id, status, visibility, is_contest_enabled")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueErr) return { kind: "error", message: leagueErr.message };
  if (
    !league ||
    league.status !== "approved" ||
    league.visibility !== "public" ||
    !league.is_contest_enabled
  ) {
    return { kind: "league_not_enabled" };
  }

  // Existing contest?
  const { data: existing, error: existingErr } = await supabase
    .from("basketball_contests")
    .select("*")
    .eq("basketball_league_id", leagueId)
    .eq("date", date)
    .maybeSingle();
  if (existingErr) return { kind: "error", message: existingErr.message };
  if (existing) return { kind: "ok", contest: existing as Contest };

  // Need at least one scheduled game on that date in this league.
  const { data: games, error: gamesErr } = await supabase
    .from("basketball_games")
    .select("id, scheduled_at, status")
    .eq("basketball_league_id", leagueId)
    .gte("scheduled_at", startOfDayUtc(date))
    .lte("scheduled_at", endOfDayUtc(date));
  if (gamesErr) return { kind: "error", message: gamesErr.message };
  if (!games || games.length === 0) return { kind: "no_games", date };

  const lock = games
    .map((g) => g.scheduled_at)
    .filter((x): x is string => !!x)
    .sort()[0] ?? null;

  // Compute season averages from existing box-score rows.
  const { data: players, error: playersErr } = await supabase
    .from("basketball_players")
    .select("id, team_id")
    .eq("basketball_league_id", leagueId);
  if (playersErr) return { kind: "error", message: playersErr.message };
  if (!players || players.length === 0) return { kind: "no_games", date };

  const { data: statRows, error: statErr } = await supabase
    .from("basketball_player_game_stats")
    .select("player_id, fantasy_points")
    .eq("basketball_league_id", leagueId);
  if (statErr) return { kind: "error", message: statErr.message };

  const totals = new Map<string, { sum: number; gp: number }>();
  for (const r of statRows ?? []) {
    const cur = totals.get(r.player_id) ?? { sum: 0, gp: 0 };
    cur.sum += Number(r.fantasy_points ?? 0);
    cur.gp += 1;
    totals.set(r.player_id, cur);
  }

  const seasons: PlayerSeason[] = players.map((p) => {
    const agg = totals.get(p.id) ?? { sum: 0, gp: 0 };
    return {
      player_id: p.id,
      games_played: agg.gp,
      avg_fp: agg.gp > 0 ? agg.sum / agg.gp : 0,
    };
  });
  const priced = priceAll(seasons);
  const teamById = new Map(players.map((p) => [p.id, p.team_id]));

  // Insert contest.
  const { data: newContest, error: insertErr } = await supabase
    .from("basketball_contests")
    .insert({
      basketball_league_id: leagueId,
      date,
      status: lock && new Date(lock).getTime() <= Date.now() ? "locked" : "open",
      lineup_lock_at: lock,
    })
    .select()
    .single();
  if (insertErr) return { kind: "error", message: insertErr.message };

  // Insert player pool.
  const poolRows = priced.map((p) => ({
    contest_id: newContest.id,
    player_id: p.player_id,
    team_id: teamById.get(p.player_id) ?? null,
    salary: p.salary,
    tier: p.tier,
    projected_points: p.projected_points,
    season_avg_fp: p.season_avg_fp,
    games_played: p.games_played,
  }));
  if (poolRows.length > 0) {
    const { error: poolErr } = await supabase
      .from("basketball_contest_players")
      .insert(poolRows);
    if (poolErr) {
      // Roll back the contest row to keep state consistent.
      await supabase.from("basketball_contests").delete().eq("id", newContest.id);
      return { kind: "error", message: poolErr.message };
    }
  }

  return { kind: "ok", contest: newContest as Contest };
}

export async function resolveTodayContest(
  supabase: SupabaseClient,
  leagueId: string,
): Promise<ResolveResult> {
  return resolveContestForDate(supabase, leagueId, todayUtcIso());
}
