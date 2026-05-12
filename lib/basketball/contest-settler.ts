// lib/basketball/contest-settler.ts
//
// Closes one contest. For every submitted lineup, looks up each player's
// basketball_player_game_stats rows for games on the contest's date and
// sums fantasy_points. Updates lineup totals + ranks. Moves the contest
// to status='scored'.
//
// Idempotent — safe to re-run after late stat corrections.

import type { SupabaseClient } from "@supabase/supabase-js";

export type SettleResult =
  | { ok: true; lineups_scored: number }
  | { ok: false; error: string };

export async function settleContest(
  supabase: SupabaseClient,
  contestId: string,
): Promise<SettleResult> {
  const { data: contest, error: cErr } = await supabase
    .from("basketball_contests")
    .select("id, basketball_league_id, date")
    .eq("id", contestId)
    .maybeSingle();
  if (cErr) return { ok: false, error: cErr.message };
  if (!contest) return { ok: false, error: "contest_not_found" };

  // All games for that date in this league.
  const dayStart = `${contest.date}T00:00:00Z`;
  const dayEnd = `${contest.date}T23:59:59Z`;
  const { data: games, error: gErr } = await supabase
    .from("basketball_games")
    .select("id")
    .eq("basketball_league_id", contest.basketball_league_id)
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd);
  if (gErr) return { ok: false, error: gErr.message };
  const gameIds = (games ?? []).map((g) => g.id);

  // Map of (player_id) → fantasy_points summed across that date's games.
  const playerFp = new Map<string, number>();
  if (gameIds.length > 0) {
    const { data: stats, error: sErr } = await supabase
      .from("basketball_player_game_stats")
      .select("player_id, fantasy_points")
      .in("game_id", gameIds);
    if (sErr) return { ok: false, error: sErr.message };
    for (const row of stats ?? []) {
      const fp = Number(row.fantasy_points ?? 0);
      playerFp.set(row.player_id, (playerFp.get(row.player_id) ?? 0) + fp);
    }
  }

  // Score every submitted lineup.
  const { data: lineups, error: lErr } = await supabase
    .from("basketball_user_lineups")
    .select("id, status")
    .eq("contest_id", contestId)
    .in("status", ["submitted", "scored"]);
  if (lErr) return { ok: false, error: lErr.message };

  const now = new Date().toISOString();
  const scored: Array<{ id: string; total: number }> = [];

  for (const lineup of lineups ?? []) {
    const { data: slots, error: spErr } = await supabase
      .from("basketball_user_lineup_players")
      .select("id, player_id")
      .eq("lineup_id", lineup.id);
    if (spErr) return { ok: false, error: spErr.message };

    let total = 0;
    for (const slot of slots ?? []) {
      const fp = playerFp.get(slot.player_id) ?? 0;
      total += fp;
      await supabase
        .from("basketball_user_lineup_players")
        .update({ actual_fantasy_points: fp })
        .eq("id", slot.id);
    }
    scored.push({ id: lineup.id, total });
  }

  // Rank by total_fpts desc; ties share a rank.
  scored.sort((a, b) => b.total - a.total);
  let prevTotal = Number.POSITIVE_INFINITY;
  let prevRank = 0;
  for (let i = 0; i < scored.length; i++) {
    const item = scored[i];
    const rank = item.total < prevTotal ? i + 1 : prevRank;
    prevTotal = item.total;
    prevRank = rank;
    await supabase
      .from("basketball_user_lineups")
      .update({
        total_fpts: Math.round(item.total * 10) / 10,
        rank,
        status: "scored",
        scored_at: now,
        updated_at: now,
      })
      .eq("id", item.id);
  }

  await supabase
    .from("basketball_contests")
    .update({ status: "scored", updated_at: now })
    .eq("id", contestId);

  return { ok: true, lineups_scored: scored.length };
}
