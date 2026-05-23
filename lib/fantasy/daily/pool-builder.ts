// lib/fantasy/daily/pool-builder.ts
//
// Shared pool-building logic for daily contests. Called by:
//   - app/api/contests/create-today/route.ts
//   - app/api/contests/seed-upcoming/route.ts
//   - app/api/contests/by-date/route.ts
//
// ═══════════════════════════════════════════════════════════════
// CURRENT-ROSTER GATE (added 2026-05)
// ═══════════════════════════════════════════════════════════════
// player_stats_cache.team is the *season-stats* team and can be stale
// after mid-season trades.  It MUST NOT be used as the authority for
// current team membership.  The authoritative source is the
// nba_player_current_team table (mirrored from BDL /players/active);
// see lib/nba/current-roster.ts.
//
// The builder accepts a `currentRosterMap` allowlist keyed by
// String(bdl_id).  A player is eligible only when their player_id is in
// the allowlist AND their current_team is in `playingTeams`.  The
// team value persisted in contest_players is the current_team from the
// allowlist, NOT the stats cache value.
//
// Responsibilities:
//   1. Strict allowlist filter on current roster + game-day teams.
//   2. Drop "Out"/"Inactive" injuries (from stats cache injury column).
//   3. Drop players with no playable history (fpts_avg <= 0).
//   4. Compute last_5_avg_fp from player_day_stats for projection.
//   5. Apply salary curve + assign tier by quartile.
//
// Output rows are ready to insert into contest_players. Caller owns the
// `contest_id` foreign key — the builder doesn't touch contest_players or
// the contests table itself.

import type { SupabaseClient } from "@supabase/supabase-js";
import { calcProjectedPoints, calcSalary } from "./salary";
import { normalizeTeamCode } from "@/lib/shared/i18n";
import type { CurrentRosterEntry } from "@/lib/nba/current-roster";

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

export type ExcludedReason =
  | "stale_team"             // stats cache had team T, current roster has different team
  | "no_current_roster"      // player not in nba_player_current_team at all
  | "team_not_playing_today" // current roster team not in playingTeams
  | "out_or_inactive"        // injury starts with "out"/"inactive"
  | "missing_projection"     // fpts_avg <= 0
  | "unknown_team_in_cache"; // stats cache team is N/A or empty

export type PerPlayerTrace = {
  player_id:                string;
  name:                     string;
  stats_cache_team:         string | null;
  current_roster_team:      string | null;
  team_used_for_eligibility: string | null;
  team_normalized:          string | null;
  game_today:               boolean;
  injury_status:            string | null;
  fpts_avg:                 number;
  tier:                     1 | 2 | 3 | 4 | null;
  reason_included:          string | null;
  reason_excluded:          ExcludedReason | null;
};

export type PoolDiagnostics = {
  contest_date:                          string;
  teams_playing_today:                   string[];
  roster_source_used:                    string;
  source_updated_at:                     string | null;
  sync_attempted:                        boolean;
  sync_error:                            string | null;
  roster_players_loaded_total:           number;
  roster_players_loaded_by_team:         Record<string, number>;
  cache_players_loaded:                  number;
  included_players_count:                number;
  excluded_stale_team_count:             number;
  excluded_no_current_roster_count:      number;
  excluded_team_not_playing_count:       number;
  excluded_out_or_inactive_count:        number;
  excluded_missing_projection_count:     number;
  cache_query_error:                     string | null;
  per_player_trace:                      PerPlayerTrace[];   // verbose only — never returned to clients by default
};

export type BuildPoolResult = {
  rows:        PoolRow[];
  diagnostics: PoolDiagnostics;
};

const LAST_N = 5;
const LOOKBACK_DAYS = 30;

function emptyDiagnostics(
  contestDate: string,
  playingTeams: Set<string>,
  partial?: Partial<PoolDiagnostics>,
): PoolDiagnostics {
  return {
    contest_date:                       contestDate,
    teams_playing_today:                [...playingTeams].sort(),
    roster_source_used:                 "unavailable",
    source_updated_at:                  null,
    sync_attempted:                     false,
    sync_error:                         null,
    roster_players_loaded_total:        0,
    roster_players_loaded_by_team:      {},
    cache_players_loaded:               0,
    included_players_count:             0,
    excluded_stale_team_count:          0,
    excluded_no_current_roster_count:   0,
    excluded_team_not_playing_count:    0,
    excluded_out_or_inactive_count:     0,
    excluded_missing_projection_count:  0,
    cache_query_error:                  null,
    per_player_trace:                   [],
    ...partial,
  };
}

/**
 * A player is considered ineligible when their injury status starts with
 * "out" (e.g., "Out", "Out For Season", "Out Indefinitely") or "inactive".
 * Doubtful/Questionable/Probable players remain in the pool — fantasy
 * managers can decide whether to roster them.
 */
export function isOutOrInactive(injury: string | null | undefined): boolean {
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

export type BuildPoolOptions = {
  /**
   * Authoritative current-roster allowlist. Map<String(bdl_id), entry>.
   * REQUIRED for strict eligibility. When omitted, the builder treats the
   * roster source as "unavailable" and returns an empty pool — never falls
   * back to player_stats_cache.team. Callers that legitimately have no
   * roster (e.g., a probe/script) can pass an empty map to opt out
   * explicitly via `allowEmptyRoster`.
   */
  currentRosterMap?: Map<string, CurrentRosterEntry>;

  /**
   * Metadata from getCurrentRosterForTeams — surfaced in diagnostics.
   */
  rosterMeta?: {
    roster_source_used: string;
    source_updated_at:  string | null;
    sync_attempted:     boolean;
    sync_error:         string | null;
    rows_by_team:       Record<string, number>;
  };

  /**
   * If true, the builder will run even when currentRosterMap is missing.
   * Used only by callers that explicitly want a degraded pool — never by
   * the create-today / seed-upcoming production paths.
   */
  allowEmptyRoster?: boolean;
};

/**
 * Build a fully-priced contest pool for `contestDate` over `playingTeams`.
 *
 * STRICT eligibility:
 *   - Player must appear in `currentRosterMap` (allowlist).
 *   - Player's current_team must be in `playingTeams`.
 *   - Player's injury must NOT start with "out"/"inactive".
 *   - Player must have fpts_avg > 0 in player_stats_cache.
 *
 * Players whose player_stats_cache.team is "stale" (different from the
 * allowlist's current_team) are NOT included — current_team wins. The
 * persisted contest_players row reflects current_team, not the cache.
 */
export async function buildContestPool(
  supabase: SupabaseClient,
  contestDate: string,
  playingTeams: Set<string>,
  options: BuildPoolOptions = {},
): Promise<BuildPoolResult> {
  const { currentRosterMap, rosterMeta, allowEmptyRoster } = options;

  // Re-normalize defensively so a caller that forgot doesn't silently miss rows.
  const normalizedPlaying = new Set<string>();
  for (const t of playingTeams) normalizedPlaying.add(normalizeTeamCode(t));

  const diagnostics = emptyDiagnostics(contestDate, normalizedPlaying, {
    roster_source_used:           rosterMeta?.roster_source_used ?? "unavailable",
    source_updated_at:            rosterMeta?.source_updated_at  ?? null,
    sync_attempted:               rosterMeta?.sync_attempted     ?? false,
    sync_error:                   rosterMeta?.sync_error         ?? null,
    roster_players_loaded_by_team: rosterMeta?.rows_by_team      ?? {},
    roster_players_loaded_total:  currentRosterMap?.size ?? 0,
  });

  if (normalizedPlaying.size === 0) {
    return { rows: [], diagnostics };
  }

  // ── Guard: roster source must be available unless explicitly waived ──
  if (!currentRosterMap && !allowEmptyRoster) {
    diagnostics.cache_query_error = "current_roster_unavailable";
    return { rows: [], diagnostics };
  }
  const roster = currentRosterMap ?? new Map<string, CurrentRosterEntry>();

  // ── Pull season stats (for fpts_avg + injury) ──────────────────────
  // We pull only the player_ids we care about: those in the roster
  // allowlist AND on teams playing today. This bounds the query and
  // avoids loading the whole league.
  const allowlistPlayerIds = [...roster.entries()]
    .filter(([, entry]) => normalizedPlaying.has(entry.current_team))
    .map(([pid]) => Number(pid))
    .filter(Number.isFinite);

  if (allowlistPlayerIds.length === 0 && !allowEmptyRoster) {
    // Roster source available but no current-roster matches for today's
    // teams. This usually means BDL hasn't seen any active players on those
    // teams (extremely rare; offseason/all-star slate). Return empty rather
    // than fall back to stats_cache.team.
    diagnostics.cache_query_error = "no_roster_matches_for_playing_teams";
    return { rows: [], diagnostics };
  }

  const { data: cacheRows, error } = await supabase
    .from("player_stats_cache")
    .select("player_id, name, fpts_avg, injury, team")
    .in("player_id", allowlistPlayerIds.length > 0 ? allowlistPlayerIds : [-1])
    .order("fpts_avg", { ascending: false });

  if (error) {
    diagnostics.cache_query_error = error.message;
    return { rows: [], diagnostics };
  }

  const rawRows = cacheRows ?? [];
  diagnostics.cache_players_loaded = rawRows.length;

  // ── Build per-player trace + filter ─────────────────────────────────
  const trace: PerPlayerTrace[] = [];
  const eligible: { player_id: number; name: string; current_team: string; injury: string | null; fpts_avg: number }[] = [];

  // Track which roster-allowlist players don't show up in the stats cache
  // — they're excluded as "missing_projection" so operators can see them.
  const cacheIds = new Set<number>(rawRows.map((r) => r.player_id));

  for (const r of rawRows) {
    const pidStr      = String(r.player_id);
    const cacheTeam   = normalizeTeamCode(r.team);
    const rosterEntry = roster.get(pidStr);
    const currentTeam = rosterEntry?.current_team ?? null;
    const fptsAvg     = Number(r.fpts_avg) || 0;

    // Eligibility decisions, in priority order:
    let reason_excluded: ExcludedReason | null = null;
    let reason_included: string | null = null;

    if (!rosterEntry) {
      reason_excluded = "no_current_roster";
      diagnostics.excluded_no_current_roster_count++;
    } else if (!normalizedPlaying.has(rosterEntry.current_team)) {
      reason_excluded = "team_not_playing_today";
      diagnostics.excluded_team_not_playing_count++;
    } else if (cacheTeam && cacheTeam !== "N/A" && cacheTeam !== rosterEntry.current_team) {
      // Stats cache says one team, current roster says another — current wins,
      // but we ALSO count this as stale-team telemetry so operators can see
      // how often it happens. The player IS still included since they're on
      // a playing team per the authoritative source.
      diagnostics.excluded_stale_team_count++;
      reason_included = "current_roster_overrides_stale_stats_cache_team";
    } else if (isOutOrInactive(r.injury)) {
      reason_excluded = "out_or_inactive";
      diagnostics.excluded_out_or_inactive_count++;
    } else if (!(fptsAvg > 0)) {
      reason_excluded = "missing_projection";
      diagnostics.excluded_missing_projection_count++;
    } else {
      reason_included = reason_included ?? "current_roster_match";
    }

    // The stale-team case also needs injury + fpts gating, since reason_included
    // was set early.  Apply them here so we don't slip a stale-team Out player
    // through.
    if (!reason_excluded && isOutOrInactive(r.injury)) {
      reason_excluded = "out_or_inactive";
      diagnostics.excluded_out_or_inactive_count++;
      reason_included = null;
    }
    if (!reason_excluded && !(fptsAvg > 0)) {
      reason_excluded = "missing_projection";
      diagnostics.excluded_missing_projection_count++;
      reason_included = null;
    }

    const teamUsed = rosterEntry?.current_team ?? null;
    trace.push({
      player_id:                 pidStr,
      name:                      rosterEntry?.player_name ?? r.name ?? "",
      stats_cache_team:          cacheTeam || null,
      current_roster_team:       currentTeam,
      team_used_for_eligibility: teamUsed,
      team_normalized:           teamUsed,
      game_today:                !!(currentTeam && normalizedPlaying.has(currentTeam)),
      injury_status:             r.injury ?? null,
      fpts_avg:                  fptsAvg,
      tier:                      null, // filled in below for included rows
      reason_included,
      reason_excluded,
    });

    if (!reason_excluded) {
      eligible.push({
        player_id:    r.player_id,
        name:         rosterEntry?.player_name ?? r.name ?? "",
        current_team: rosterEntry!.current_team,
        injury:       r.injury ?? null,
        fpts_avg:     fptsAvg,
      });
    }
  }

  // Track roster-allowlist players who weren't in the stats cache at all.
  for (const [pidStr, entry] of roster.entries()) {
    if (!normalizedPlaying.has(entry.current_team)) continue;
    const idNum = Number(pidStr);
    if (Number.isFinite(idNum) && cacheIds.has(idNum)) continue;
    diagnostics.excluded_missing_projection_count++;
    trace.push({
      player_id:                 pidStr,
      name:                      entry.player_name,
      stats_cache_team:          null,
      current_roster_team:       entry.current_team,
      team_used_for_eligibility: entry.current_team,
      team_normalized:           entry.current_team,
      game_today:                true,
      injury_status:             null,
      fpts_avg:                  0,
      tier:                      null,
      reason_included:           null,
      reason_excluded:           "missing_projection",
    });
  }

  diagnostics.included_players_count = eligible.length;
  diagnostics.per_player_trace       = trace;

  if (eligible.length === 0) {
    return { rows: [], diagnostics };
  }

  const playerIdStrs = eligible.map((r) => String(r.player_id));
  const last5Map     = await computeLastNAverages(supabase, playerIdStrs, contestDate);

  const rows: PoolRow[] = eligible.map((row, idx) => {
    const seasonAvg = row.fpts_avg;
    const last5     = last5Map.get(String(row.player_id)) ?? seasonAvg;
    const projected = calcProjectedPoints(last5, seasonAvg);
    const salary    = calcSalary(projected);
    const tier      = tierFor(idx + 1, eligible.length);

    // Backfill tier into the trace entry so debug consumers see it.
    const traceRow = trace.find((t) => t.player_id === String(row.player_id) && !t.reason_excluded);
    if (traceRow) traceRow.tier = tier;

    return {
      player_id:        String(row.player_id),
      tier,
      salary,
      projected_points: Math.round(projected * 100) / 100,
      last_5_avg_fp:    Math.round(last5 * 100) / 100,
      season_avg_fp:    Math.round(seasonAvg * 100) / 100,
      injury_status:    row.injury,
      is_available:     true,
    };
  });

  return { rows, diagnostics };
}
