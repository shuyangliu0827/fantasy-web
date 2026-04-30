// lib/contest-pool-builder.ts
//
// Shared pool-building logic for daily contests. Called by:
//   - app/api/contests/create-today/route.ts
//   - app/api/contests/seed-upcoming/route.ts
//   - app/api/contests/by-date/route.ts
//
// Responsibilities:
//   1. Filter player_stats_cache by playing teams.
//   2. Drop "Out" injuries (those players can't enter the pool).
//   3. Compute last_5_avg_fp from player_day_stats (last 5 valid fpts in the
//      30 days before contest_date).
//   4. Apply the salary formula in lib/contest-salary.ts to set salary +
//      projected_points per row.
//   5. Assign tier by quartile of fpts_avg (display/filter only — tier no
//      longer constrains lineup composition).
//
// Output rows are ready to insert into contest_players. Caller owns the
// `contest_id` foreign key — the builder doesn't touch contest_players or
// the contests table itself.

import type { SupabaseClient } from "@supabase/supabase-js";
import { calcProjectedPoints, calcSalary } from "./contest-salary";

export type PoolRow = {
  player_id:        string;
  tier:             1 | 2 | 3 | 4;
  salary:           number;
  projected_points: number;
  last_5_avg_fp:    number;
  season_avg_fp:    number;
  injury_status:    string | null;
  is_available:     boolean;
};

const LAST_N = 5;
// 30 days back from contest_date is enough to find 5 valid stats even for
// players in light rotations / coming back from short injuries.
const LOOKBACK_DAYS = 30;

function tierFor(rank: number, total: number): 1 | 2 | 3 | 4 {
  const q = total / 4;
  if (rank <= q)     return 1;
  if (rank <= q * 2) return 2;
  if (rank <= q * 3) return 3;
  return 4;
}

/**
 * Compute last-N rolling fpts average per player. Only stats with fpts > 0
 * count — DNPs / zero-stat rows shouldn't drag down the projection.
 *
 * Returns Map<player_id, last_5_avg_fp>. Players with fewer than 1 valid
 * stat in the lookback window are absent from the map; the caller treats
 * them as 0 (so projection collapses to season_avg_fp * 0.4).
 */
async function computeLastNAverages(
  supabase: SupabaseClient,
  playerIds: string[],
  contestDate: string,
): Promise<Map<string, number>> {
  if (playerIds.length === 0) return new Map();

  const cutoff = new Date(contestDate + "T00:00:00Z");
  cutoff.setUTCDate(cutoff.getUTCDate() - LOOKBACK_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("player_day_stats")
    .select("player_id, date, fpts")
    .in("player_id", playerIds)
    .gte("date", cutoffStr)
    .lt("date", contestDate)
    .gt("fpts", 0)
    .order("date", { ascending: false });

  if (error) return new Map();

  // Group rows by player, take first LAST_N (already sorted DESC by date).
  const buckets = new Map<string, number[]>();
  for (const row of data ?? []) {
    const arr = buckets.get(row.player_id) ?? [];
    if (arr.length < LAST_N) {
      arr.push(Number(row.fpts));
      buckets.set(row.player_id, arr);
    }
  }

  const out = new Map<string, number>();
  for (const [pid, fptsList] of buckets) {
    if (fptsList.length === 0) continue;
    const avg = fptsList.reduce((a, b) => a + b, 0) / fptsList.length;
    out.set(pid, avg);
  }
  return out;
}

/**
 * Build a fully-priced contest pool for `contestDate` over `playingTeams`.
 *
 * Rows are sorted by fpts_avg DESC (top players first) and tiered by
 * quartile so the caller can persist them in display order.
 *
 * Returns `null` if the underlying player_stats_cache query errors.
 * Returns an empty array if no eligible players are found — the caller
 * should treat that as "no pool" (e.g., before nba-stats has populated the
 * cache for this season).
 */
export async function buildContestPool(
  supabase: SupabaseClient,
  contestDate: string,
  playingTeams: Set<string>,
): Promise<PoolRow[] | null> {
  if (playingTeams.size === 0) return [];

  const { data: cacheRows, error } = await supabase
    .from("player_stats_cache")
    .select("player_id, fpts_avg, injury, team")
    .in("team", [...playingTeams])
    .order("fpts_avg", { ascending: false });

  if (error) return null;

  // Drop "Out*" injuries and players who have never scored in the NBA
  // (fpts_avg = 0 or null means G-League / two-way / inactive — they
  // shouldn't appear in a playable contest pool).
  const eligible = (cacheRows ?? []).filter(
    (r) =>
      !r.injury?.toLowerCase().startsWith("out") &&
      Number(r.fpts_avg) > 0,
  );

  if (eligible.length === 0) return [];

  const playerIds = eligible.map((r) => String(r.player_id));
  const last5Map  = await computeLastNAverages(supabase, playerIds, contestDate);

  return eligible.map((row, idx) => {
    const seasonAvg = Number(row.fpts_avg) || 0;
    const last5     = last5Map.get(String(row.player_id)) ?? seasonAvg;
    const projected = calcProjectedPoints(last5, seasonAvg);
    const salary    = calcSalary(projected);

    return {
      player_id:        String(row.player_id),
      tier:             tierFor(idx + 1, eligible.length),
      salary,
      projected_points: Math.round(projected * 100) / 100,
      last_5_avg_fp:    Math.round(last5 * 100) / 100,
      season_avg_fp:    Math.round(seasonAvg * 100) / 100,
      injury_status:    row.injury ?? null,
      is_available:     true,
    };
  });
}
