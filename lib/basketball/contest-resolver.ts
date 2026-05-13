// lib/basketball/contest-resolver.ts
//
// Get-or-create a basketball_contests row for a (league, date) pair plus
// its frozen player pool.
//
// "Today" is computed in the league's IANA timezone (basketball_leagues.timezone)
// so admins and players agree on which day a contest covers.
//
// The pool is GAME-AWARE: only players whose `team_id` is in
// {home_team_id, away_team_id} of that day's scheduled games are priced
// and inserted. Pool composition is frozen at contest creation time.
//
// Pipeline on first access for a (league, date) with at least one game:
//   1. Resolve league + timezone, compute UTC day-bounds.
//   2. Find games-of-day; collect playing team ids.
//   3. Load players whose team_id ∈ playing teams.
//   4. Compute season averages from basketball_player_game_stats.
//   5. Price via contest-salary.ts.
//   6. Insert basketball_contests + basketball_contest_players.
//
// On every non-ok outcome the resolver emits a structured console.warn
// tagged "[contest-resolver]" so failures are debuggable from logs.

import type { SupabaseClient } from "@supabase/supabase-js";
import { priceAll, type PlayerSeason } from "./contest-salary";
import { dayBoundsUtc, todayInTimezone } from "./contest-date";

export type Contest = {
  id: string;
  basketball_league_id: string;
  date: string;
  status: "pending" | "open" | "locked" | "scored";
  lineup_lock_at: string | null;
  salary_cap: number;
  lineup_size: number;
};

export type ResolveResult =
  | { kind: "ok"; contest: Contest }
  | { kind: "no_games"; date: string; timezone: string }
  | { kind: "no_teams_in_games"; date: string; timezone: string }
  | { kind: "no_players"; date: string; timezone: string }
  | { kind: "league_not_enabled" }
  | { kind: "error"; message: string };

type LeagueRow = {
  id: string;
  slug: string;
  status: string;
  visibility: string;
  is_contest_enabled: boolean;
  timezone: string;
};

function warn(payload: Record<string, unknown>) {
  console.warn("[contest-resolver]", payload);
}

export async function resolveContestForDate(
  supabase: SupabaseClient,
  leagueId: string,
  date: string,
  timezone: string,
): Promise<ResolveResult> {
  // Existing contest?
  const { data: existing, error: existingErr } = await supabase
    .from("basketball_contests")
    .select("*")
    .eq("basketball_league_id", leagueId)
    .eq("date", date)
    .maybeSingle();
  if (existingErr) return { kind: "error", message: existingErr.message };
  if (existing) return { kind: "ok", contest: existing as Contest };

  const { startUtc, endUtc } = dayBoundsUtc(date, timezone);

  // Need at least one scheduled game on that date (league-local) in this league.
  const { data: games, error: gamesErr } = await supabase
    .from("basketball_games")
    .select("id, scheduled_at, status, home_team_id, away_team_id")
    .eq("basketball_league_id", leagueId)
    .gte("scheduled_at", startUtc)
    .lte("scheduled_at", endUtc);
  if (gamesErr) return { kind: "error", message: gamesErr.message };
  if (!games || games.length === 0) {
    warn({ leagueId, date, timezone, kind: "no_games", games: 0 });
    return { kind: "no_games", date, timezone };
  }

  const teamIds = Array.from(
    new Set(
      games.flatMap((g) => [g.home_team_id, g.away_team_id]).filter(
        (x): x is string => !!x,
      ),
    ),
  );
  if (teamIds.length === 0) {
    warn({ leagueId, date, timezone, kind: "no_teams_in_games", games: games.length });
    return { kind: "no_teams_in_games", date, timezone };
  }

  // Game-aware player pool: only players whose team_id is in playing teams.
  const { data: players, error: playersErr } = await supabase
    .from("basketball_players")
    .select("id, team_id")
    .eq("basketball_league_id", leagueId)
    .in("team_id", teamIds);
  if (playersErr) return { kind: "error", message: playersErr.message };
  if (!players || players.length === 0) {
    warn({
      leagueId, date, timezone, kind: "no_players",
      games: games.length, teams: teamIds.length, players: 0,
    });
    return { kind: "no_players", date, timezone };
  }

  // Season averages across all box-score rows for this league (any date).
  // Settler uses the same source of truth.
  const { data: statRows, error: statErr } = await supabase
    .from("basketball_player_game_stats")
    .select("player_id, fantasy_points")
    .eq("basketball_league_id", leagueId);
  if (statErr) return { kind: "error", message: statErr.message };

  const playerIdSet = new Set(players.map((p) => p.id));
  const totals = new Map<string, { sum: number; gp: number }>();
  for (const r of statRows ?? []) {
    if (!playerIdSet.has(r.player_id)) continue;
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

  const lock = games
    .map((g) => g.scheduled_at)
    .filter((x): x is string => !!x)
    .sort()[0] ?? null;

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
  const { data: league, error: leagueErr } = await supabase
    .from("basketball_leagues")
    .select("id, slug, status, visibility, is_contest_enabled, timezone")
    .eq("id", leagueId)
    .maybeSingle<LeagueRow>();
  if (leagueErr) return { kind: "error", message: leagueErr.message };
  if (
    !league ||
    league.status !== "approved" ||
    league.visibility !== "public" ||
    !league.is_contest_enabled
  ) {
    return { kind: "league_not_enabled" };
  }

  const tz = league.timezone || "UTC";
  const date = todayInTimezone(tz);
  return resolveContestForDate(supabase, leagueId, date, tz);
}
