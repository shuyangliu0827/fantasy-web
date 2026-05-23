// lib/fantasy/daily/current-roster.ts
//
// Single source-of-truth facade for "what team is player X currently on?"
// used by the NBA daily-contest stack. All eligibility / display-team
// decisions in app/api/contests/* and the contest builder UI must go
// through this module, NEVER through player_stats_cache.team (which is
// the season-stats team and goes stale after mid-season trades).
//
// Source priority (only sources actually wired in this codebase are used;
// higher tiers are kept as placeholders so a richer source can slot in
// without touching call sites):
//
//   1. NBA.com /stats commonteamroster
//        Not wired — the build container has no outbound access to
//        stats.nba.com. Reserved for future use; currently never
//        consulted, so `source` will not be reported as "nba_stats".
//
//   2. BDL /players/active   (PRIMARY today)
//        Mirrored into the local nba_player_current_team table by
//        lib/nba/current-roster.ts::syncCurrentRosters. Auto-refreshed
//        when the cache is missing or >12h stale. This is the only
//        source the contest stack currently treats as authoritative.
//
//   3. nba_player_current_team_overrides  (EMERGENCY MANUAL FALLBACK)
//        Optional table for operator-set overrides (e.g. BDL hasn't
//        reflected a trade yet). Looked up after the primary source
//        and only used to *correct* an entry, never to fabricate a new
//        one. The table is not required to exist — when absent, lookup
//        is a no-op.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCurrentRosterForTeams as getRawRoster,
  type CurrentRosterEntry,
} from "@/lib/nba/current-roster";
import { normalizeTeamCode } from "@/lib/shared/i18n";

const OVERRIDE_TABLE = "nba_player_current_team_overrides";

export type RosterSource = "bdl_players_active" | "cache" | "stale_cache" | "manual_override" | "unavailable";

export type CurrentRosterRecord = {
  team_code:         string;     // normalized team code the caller asked about
  player_id:         string;     // String(bdl_integer_id)
  player_name:       string;
  current_team:      string;     // normalized — authoritative
  source:            RosterSource;
  source_updated_at: string | null;
  confidence:        "high" | "medium" | "low";
};

export type GetCurrentRosterResult = {
  records:            CurrentRosterRecord[];
  map:                Map<string, CurrentRosterRecord>;  // keyed by player_id (TEXT)
  meta: {
    roster_source_used: RosterSource;
    source_updated_at:  string | null;
    sync_attempted:     boolean;
    sync_error:         string | null;
    rows_by_team:       Record<string, number>;
    overrides_applied:  number;
  };
};

export type GetCurrentRosterArgs = {
  supabase:  SupabaseClient;
  teamCodes: Iterable<string>;
  /** Date the caller is rendering for. Kept for forward-compat; BDL's
   *  /players/active is point-in-time so the field is currently advisory.  */
  date?:     string;
  /** NBA season the caller cares about. Same forward-compat note as date. */
  season?:   number;
  /** When true, allow returning a stale cache (>12h) without forcing a sync. */
  allowStale?: boolean;
};

/**
 * Resolve current rosters for the supplied set of team codes.
 *
 * Returns one record per (team, player) pair from the authoritative source,
 * with optional manual overrides applied. Callers should treat
 * `meta.roster_source_used === "unavailable"` as a hard failure and
 * surface a 503-style error rather than silently falling back to
 * player_stats_cache.team.
 */
export async function getCurrentRosterForTeams(
  args: GetCurrentRosterArgs,
): Promise<GetCurrentRosterResult> {
  const { supabase, teamCodes, allowStale } = args;
  const normalized = new Set<string>();
  for (const t of teamCodes) {
    const n = normalizeTeamCode(t);
    if (n) normalized.add(n);
  }

  const raw = await getRawRoster(supabase, normalized, { allowStale });
  const sourceTier: RosterSource = (raw.roster_source_used as RosterSource) ?? "unavailable";
  const baseConfidence: "high" | "medium" | "low" =
      sourceTier === "bdl_players_active" ? "high"
    : sourceTier === "cache"              ? "high"
    : sourceTier === "stale_cache"        ? "medium"
                                          : "low";

  // Apply manual overrides if the override table exists. We intentionally
  // swallow errors here (the table is optional) — the primary BDL source
  // remains the floor.
  let overridesApplied = 0;
  const overridesByPid = new Map<string, { current_team: string; updated_at: string | null }>();
  try {
    const { data: overrideRows, error: overrideErr } = await supabase
      .from(OVERRIDE_TABLE)
      .select("player_id, team, updated_at")
      .in("team", [...normalized]);

    if (!overrideErr) {
      for (const r of overrideRows ?? []) {
        overridesByPid.set(String(r.player_id), {
          current_team: normalizeTeamCode(r.team),
          updated_at:   r.updated_at ?? null,
        });
      }
    }
  } catch {
    // Override table missing — ignore.
  }

  const records: CurrentRosterRecord[] = [];
  const map = new Map<string, CurrentRosterRecord>();

  for (const [pidStr, entry] of raw.map.entries()) {
    const override = overridesByPid.get(pidStr);
    const team     = override?.current_team ?? entry.current_team;
    if (!normalized.has(team)) continue;
    const rec: CurrentRosterRecord = {
      team_code:         team,
      player_id:         pidStr,
      player_name:       entry.player_name,
      current_team:      team,
      source:            override ? "manual_override" : sourceTier,
      source_updated_at: override?.updated_at ?? entry.source_updated_at ?? raw.source_updated_at,
      confidence:        override ? "high" : baseConfidence,
    };
    if (override) overridesApplied++;
    records.push(rec);
    map.set(pidStr, rec);
  }

  // Overrides that point at a today-playing team but whose player wasn't
  // in the BDL response (e.g. trade not yet reflected): include them so
  // the contest gate sees them.
  for (const [pidStr, override] of overridesByPid.entries()) {
    if (map.has(pidStr)) continue;
    if (!normalized.has(override.current_team)) continue;
    const rec: CurrentRosterRecord = {
      team_code:         override.current_team,
      player_id:         pidStr,
      player_name:       "",
      current_team:      override.current_team,
      source:            "manual_override",
      source_updated_at: override.updated_at,
      confidence:        "medium",
    };
    overridesApplied++;
    records.push(rec);
    map.set(pidStr, rec);
  }

  return {
    records,
    map,
    meta: {
      roster_source_used: sourceTier,
      source_updated_at:  raw.source_updated_at,
      sync_attempted:     raw.sync_attempted,
      sync_error:         raw.sync_error,
      rows_by_team:       raw.rows_by_team,
      overrides_applied:  overridesApplied,
    },
  };
}

/**
 * Convenience adapter: returns the underlying CurrentRosterEntry-shaped
 * map that lib/fantasy/daily/pool-builder.ts expects. Lets callers use
 * the new facade while keeping the existing builder signature untouched.
 */
export function toLegacyRosterMap(
  result: GetCurrentRosterResult,
): Map<string, CurrentRosterEntry> {
  const out = new Map<string, CurrentRosterEntry>();
  for (const [pid, rec] of result.map.entries()) {
    out.set(pid, {
      player_id:         Number(pid),
      player_name:       rec.player_name,
      current_team:      rec.current_team,
      source:            rec.source,
      source_updated_at: rec.source_updated_at ?? "",
    });
  }
  return out;
}
