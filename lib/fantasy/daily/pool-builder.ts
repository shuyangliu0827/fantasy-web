// lib/fantasy/daily/pool-builder.ts
//
// Shared pool-building logic for daily contests. Called by:
//   - app/api/contests/create-today/route.ts
//   - app/api/contests/seed-upcoming/route.ts
//   - app/api/contests/by-date/route.ts
//
// Responsibilities:
//   1. Filter player_stats_cache STRICTLY by playing teams (game-day eligibility).
//   2. Drop "Out"/"Inactive" injuries.
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
//
// Returns a diagnostics object alongside the rows so callers can surface
// game-day eligibility counts in API responses for debugging.

import type { SupabaseClient } from "@supabase/supabase-js";
import { calcProjectedPoints, calcSalary } from "./salary";
import { normalizeTeamCode } from "@/lib/shared/i18n";

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

export type PoolDiagnostics = {
  teams_playing_today:           string[];
  cache_rows_total:              number;  // raw player_stats_cache rows for playing teams
  eligible_after_team_filter:    number;  // after .in("team", playingTeams) — same as cache_rows_total
  eligible_after_injury_filter:  number;  // dropped "Out"/"Inactive"
  eligible_after_fpts_filter:    number;  // dropped fpts_avg <= 0 (G-League / two-way)
  excluded_out_or_inactive:      number;
  excluded_zero_fpts:            number;
  excluded_unknown_team:         number;
  cache_query_error:             string | null;
};

export type BuildPoolResult = {
  rows:        PoolRow[];
  diagnostics: PoolDiagnostics;
};

const LAST_N = 5;
// 30 days back from contest_date is enough to find 5 valid stats even for
// players in light rotations / coming back from short injuries.
const LOOKBACK_DAYS = 30;

function emptyDiagnostics(playingTeams: Set<string>, error: string | null = null): PoolDiagnostics {
  return {
    teams_playing_today:          [...playingTeams].sort(),
    cache_rows_total:             0,
    eligible_after_team_filter:   0,
    eligible_after_injury_filter: 0,
    eligible_after_fpts_filter:   0,
    excluded_out_or_inactive:     0,
    excluded_zero_fpts:           0,
    excluded_unknown_team:        0,
    cache_query_error:            error,
  };
}

/**
 * A player is considered ineligible when their injury status starts with
 * "out" (e.g., "Out", "Out For Season", "Out Indefinitely") or "inactive".
 * Doubtful/Questionable/Probable players remain in the pool — fantasy
 * managers can decide whether to roster them.
 */
function isOutOrInactive(injury: string | null | undefined): boolean {
  if (!injury) return false;
  const lc = injury.toLowerCase().trim();
  return lc.startsWith("out") || lc.startsWith("inactive");
}

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
 * STRICT eligibility: a player is included ONLY when their player_stats_cache
 * team (normalized) matches a team in `playingTeams`. There is NO fallback
 * to global top players — if `playingTeams` is empty, the result is empty.
 *
 * Rows are sorted by fpts_avg DESC (top players first) and tiered by
 * quartile so the caller can persist them in display order.
 *
 * Returns `{ rows, diagnostics }`. `rows` is empty when:
 *   - playingTeams is empty
 *   - the player_stats_cache query failed (diagnostics.cache_query_error set)
 *   - no players from playing teams pass the injury / fpts filters
 */
export async function buildContestPool(
  supabase: SupabaseClient,
  contestDate: string,
  playingTeams: Set<string>,
): Promise<BuildPoolResult> {
  if (playingTeams.size === 0) {
    return { rows: [], diagnostics: emptyDiagnostics(playingTeams) };
  }

  // Defensive: re-normalize the playingTeams set so a caller that forgot to
  // normalize doesn't silently miss rows. normalizeTeamCode is idempotent.
  const normalizedPlaying = new Set<string>();
  for (const t of playingTeams) normalizedPlaying.add(normalizeTeamCode(t));

  const { data: cacheRows, error } = await supabase
    .from("player_stats_cache")
    .select("player_id, name, fpts_avg, injury, team")
    .in("team", [...normalizedPlaying])
    .order("fpts_avg", { ascending: false });

  if (error) {
    return { rows: [], diagnostics: emptyDiagnostics(normalizedPlaying, error.message) };
  }

  const rawRows = cacheRows ?? [];
  const diagnostics = emptyDiagnostics(normalizedPlaying);
  diagnostics.cache_rows_total = rawRows.length;

  // Second pass: drop rows whose team (after normalization) isn't actually in
  // the playing-teams set. The .in() above should already enforce this, but
  // we double-check to defend against any inconsistencies between how teams
  // were written and how playingTeams was computed.
  const afterTeam = rawRows.filter((r) => {
    const norm = normalizeTeamCode(r.team);
    if (!norm || norm === "N/A") {
      diagnostics.excluded_unknown_team++;
      return false;
    }
    if (!normalizedPlaying.has(norm)) {
      diagnostics.excluded_unknown_team++;
      return false;
    }
    return true;
  });
  diagnostics.eligible_after_team_filter = afterTeam.length;

  const afterInjury = afterTeam.filter((r) => {
    if (isOutOrInactive(r.injury)) {
      diagnostics.excluded_out_or_inactive++;
      return false;
    }
    return true;
  });
  diagnostics.eligible_after_injury_filter = afterInjury.length;

  // Drop players who have never scored in the NBA (fpts_avg = 0 or null
  // means G-League / two-way / inactive — they shouldn't appear in a
  // playable contest pool).
  const eligible = afterInjury.filter((r) => {
    if (!(Number(r.fpts_avg) > 0)) {
      diagnostics.excluded_zero_fpts++;
      return false;
    }
    return true;
  });
  diagnostics.eligible_after_fpts_filter = eligible.length;

  if (eligible.length === 0) {
    return { rows: [], diagnostics };
  }

  const playerIds = eligible.map((r) => String(r.player_id));
  const last5Map  = await computeLastNAverages(supabase, playerIds, contestDate);

  const rows = eligible.map((row, idx) => {
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

  return { rows, diagnostics };
}
