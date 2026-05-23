// lib/fantasy/daily/contest-snapshot.ts
//
// Single source of truth for reading a daily contest's player snapshot.
//
// ═══════════════════════════════════════════════════════════════
// WHY THIS EXISTS
// ═══════════════════════════════════════════════════════════════
// contest_players is the authoritative per-(contest, player) pool. As of
// migration 043 it stores the frozen contest snapshot — team, name,
// position — alongside the numeric fields (tier, salary, projection).
//
// Every daily-contest read endpoint (build, my-lineup, leaderboard,
// my-lineups, settlement) MUST read contest-specific display fields from
// here so they all agree. Reading team from player_stats_cache.team (the
// season-stats team, stale after mid-season trades) is the exact bug this
// module replaces. player_stats_cache is only acceptable for stats /
// projections / live injury — never for the current contest team.
//
// Legacy rows (contests created before migration 043 and never rebuilt via
// /api/contests/create-today?force=true) have an empty snapshot team. We do
// NOT silently fall back to player_stats_cache.team — that would re-introduce
// the stale value. Instead `team` is returned empty and the snapshot debug
// row flags display_team_source = "missing_snapshot" so the operator knows
// to force-rebuild.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCanonicalPlayerPosition } from "@/lib/players/metadata";
import { normalizeTeamCode } from "@/lib/shared/i18n";

export type ContestSnapshotPlayer = {
  player_id:           string;
  display_name:        string;
  team:                string;          // CONTEST SNAPSHOT team (authoritative)
  position:            string;
  tier:                number | null;
  salary:              number;
  projected_points:    number;
  last_5_avg_fp:       number;
  season_avg_fp:       number;
  fpts_scored:         number | null;
  injury_status:       string | null;
  is_available:        boolean;
  roster_source:       string | null;
  roster_validated_at: string | null;
};

// Columns added by migration 043. Selected separately so we can degrade
// gracefully (a stale deploy may not have run the migration yet).
const SNAPSHOT_COLS =
  "player_id, tier, fpts_scored, salary, projected_points, last_5_avg_fp, season_avg_fp, injury_status, is_available, display_name, team, position, roster_source, roster_validated_at";
const BASE_COLS =
  "player_id, tier, fpts_scored, salary, projected_points, last_5_avg_fp, season_avg_fp, injury_status, is_available";

type RawContestPlayerRow = {
  player_id:            string | number;
  display_name?:        string | null;
  team?:                string | null;
  position?:            string | null;
  tier?:                number | null;
  salary?:              number | null;
  projected_points?:    number | null;
  last_5_avg_fp?:       number | null;
  season_avg_fp?:       number | null;
  fpts_scored?:         number | null;
  injury_status?:       string | null;
  is_available?:        boolean | null;
  roster_source?:       string | null;
  roster_validated_at?: string | null;
};

function shape(r: RawContestPlayerRow): ContestSnapshotPlayer {
  return {
    player_id:           String(r.player_id),
    display_name:        r.display_name ?? "",
    team:                r.team ?? "",
    position:            r.position ?? "",
    tier:                r.tier ?? null,
    salary:              Number(r.salary) || 0,
    projected_points:    Number(r.projected_points) || 0,
    last_5_avg_fp:       Number(r.last_5_avg_fp) || 0,
    season_avg_fp:       Number(r.season_avg_fp) || 0,
    fpts_scored:         r.fpts_scored != null ? Number(r.fpts_scored) : null,
    injury_status:       r.injury_status ?? null,
    is_available:        r.is_available ?? true,
    roster_source:       r.roster_source ?? null,
    roster_validated_at: r.roster_validated_at ?? null,
  };
}

/**
 * Reads the contest snapshot for a contest. Returns both an array (insertion
 * order = salary DESC) and a player_id → row map for O(1) enrichment.
 *
 * `snapshot_available` is false when migration 043 hasn't been applied (the
 * snapshot columns don't exist) — callers can surface that in debug output.
 */
export async function getContestSnapshot(
  supabase: SupabaseClient,
  contestId: string,
): Promise<{
  rows:               ContestSnapshotPlayer[];
  map:                Map<string, ContestSnapshotPlayer>;
  snapshot_available: boolean;
  error:              string | null;
}> {
  let raw: RawContestPlayerRow[] | null = null;
  let snapshot_available = true;

  const res = await supabase
    .from("contest_players")
    .select(SNAPSHOT_COLS)
    .eq("contest_id", contestId)
    .order("salary", { ascending: false });

  if (res.error) {
    // Snapshot columns missing (migration pending) → fall back to base cols.
    const msg = res.error.message ?? "";
    const isMissingColumn =
      msg.includes("display_name") || msg.includes("position") ||
      msg.includes("roster_source") || msg.includes("roster_validated_at") ||
      /column .*team.* does not exist/i.test(msg);

    if (!isMissingColumn) {
      return { rows: [], map: new Map(), snapshot_available: false, error: res.error.message };
    }
    snapshot_available = false;
    const fallback = await supabase
      .from("contest_players")
      .select(BASE_COLS)
      .eq("contest_id", contestId)
      .order("salary", { ascending: false });
    if (fallback.error) {
      return { rows: [], map: new Map(), snapshot_available: false, error: fallback.error.message };
    }
    raw = fallback.data ?? [];
  } else {
    raw = res.data ?? [];
  }

  const rows = raw.map(shape);
  const map  = new Map<string, ContestSnapshotPlayer>();
  for (const r of rows) map.set(r.player_id, r);
  return { rows, map, snapshot_available, error: null };
}

// ── Read-time display fallback ────────────────────────────────────
// Legacy contest_players rows (created before migration 043, or before the
// repair/backfill ran) have an empty snapshot display block — display_name /
// team / position are null even though tier / salary / projection are present.
// Those rows would otherwise render as a raw player_id + a blank "?" avatar.
//
// To keep the UI usable until the snapshot is backfilled, read endpoints
// resolve a *display* fallback from canonical sources — WITHOUT re-introducing
// the stale-team bug:
//   - name:     player_stats_cache.name (names never go stale)
//   - position: canonical position from player_stats_cache
//   - team:     authoritative current-roster team (nba_player_current_team)
//               first; player_stats_cache.team only as a flagged last resort.
//
// This is a *display* aid only. The authoritative fix is to backfill/rebuild
// the snapshot so contest_players itself carries these fields.

export type SnapshotFallback = {
  name:        string;
  team:        string;
  position:    string;
  team_source: "current_roster" | "stats_cache" | "none";
  resolved:    boolean; // true when at least a name was found
};

export async function resolveSnapshotFallback(
  supabase: SupabaseClient,
  playerIds: string[],
): Promise<Map<string, SnapshotFallback>> {
  const out = new Map<string, SnapshotFallback>();
  const ids = [...new Set(playerIds.map(String))];
  if (ids.length === 0) return out;

  const intIds = ids.map((p) => parseInt(p, 10)).filter(Number.isFinite);
  const inList = intIds.length > 0 ? intIds : [-1];

  const [pscRes, nctRes] = await Promise.all([
    supabase
      .from("player_stats_cache")
      .select("player_id, name, team, position")
      .in("player_id", inList),
    supabase
      .from("nba_player_current_team")
      .select("player_id, player_name, team")
      .in("player_id", inList),
  ]);

  type NctRow = { player_id: string | number; player_name: string | null; team: string | null };
  type PscRow = { player_id: string | number; name: string | null; team: string | null; position: string | null };

  const nctByPid = new Map<string, { name: string; team: string }>();
  for (const r of (nctRes.data as NctRow[] | null) ?? []) {
    nctByPid.set(String(r.player_id), {
      name: r.player_name ?? "",
      team: r.team ? normalizeTeamCode(r.team) : "",
    });
  }

  const seen = new Set<string>();
  for (const r of (pscRes.data as PscRow[] | null) ?? []) {
    const pid = String(r.player_id);
    seen.add(pid);
    const nct  = nctByPid.get(pid);
    const name = r.name || nct?.name || "";
    const cacheTeam = r.team ? normalizeTeamCode(r.team) : "";
    const team = nct?.team || cacheTeam || "";
    const team_source: SnapshotFallback["team_source"] =
      nct?.team ? "current_roster" : (cacheTeam ? "stats_cache" : "none");
    out.set(pid, {
      name,
      team,
      position: getCanonicalPlayerPosition(name, r.position ?? "N/A"),
      team_source,
      resolved: !!name,
    });
  }

  // Players present only in the current-roster table (not in the stats cache).
  for (const [pid, nct] of nctByPid) {
    if (seen.has(pid)) continue;
    out.set(pid, {
      name:        nct.name,
      team:        nct.team,
      position:    "N/A",
      team_source: nct.team ? "current_roster" : "none",
      resolved:    !!nct.name,
    });
  }

  return out;
}

// ── Debug source comparison ──────────────────────────────────────
// Per the daily-contest-consistency spec, debug endpoints expose every
// candidate source for a player so mismatches are visible at a glance.
// player_profile_team is intentionally null for NBA daily contests — there
// is no separate NBA player-profile table (player_stats_cache IS the cache;
// the `players` table is fantasy-league only).

export type SnapshotDebugRow = {
  player_id:            string;
  name:                 string;
  contest_snapshot_team: string | null;
  display_team:          string | null;
  display_team_source:   string;
  stats_cache_team:      string | null;
  player_profile_team:   string | null;
  contest_snapshot_tier: number | null;
  display_tier:          number | null;
  display_tier_source:   string;
  salary:                number;
  projected_fpts:        number;
  position:              string | null;
  roster_source:         string | null;
  roster_validated_at:   string | null;
};

export function buildSnapshotDebugRow(
  p: ContestSnapshotPlayer,
  opts?: { stats_cache_team?: string | null; player_profile_team?: string | null },
): SnapshotDebugRow {
  const hasSnapshotTeam = !!p.team;
  return {
    player_id:             p.player_id,
    name:                  p.display_name,
    contest_snapshot_team: p.team || null,
    display_team:          p.team || null,
    display_team_source:   hasSnapshotTeam ? "contest_players" : "missing_snapshot",
    stats_cache_team:      opts?.stats_cache_team ?? null,
    player_profile_team:   opts?.player_profile_team ?? null,
    contest_snapshot_tier: p.tier,
    display_tier:          p.tier,
    display_tier_source:   p.tier != null ? "contest_players" : "missing_snapshot",
    salary:                p.salary,
    projected_fpts:        p.projected_points,
    position:              p.position || null,
    roster_source:         p.roster_source,
    roster_validated_at:   p.roster_validated_at,
  };
}
