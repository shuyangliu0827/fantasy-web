// lib/nba/current-roster.ts
//
// Source of truth for *current* NBA team membership, distinct from the
// season-stats team value stored in player_stats_cache.team (which can be
// stale after mid-season trades since season averages are tied to the
// player's team at the start of the season).
//
// The authoritative source is BDL's /players/active endpoint: BDLPlayer.team
// reflects the player's *current* team. We mirror that into the local
// nba_player_current_team table so the daily-contest pool builder can use
// it as a strict allowlist without hammering BDL on every request.
//
// Refresh policy:
//   - Sync runs lazily when the cache is missing or older than STALE_AFTER_MS.
//   - Can also be forced by callers (admin route / cron).
//
// Anything that needs to decide "is player X currently on team Y?" should
// import getCurrentRosterMap from here, NOT read player_stats_cache.team.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAllActivePlayers, type BDLPlayer } from "./balldontlie";
import { normalizeTeamCode } from "@/lib/shared/i18n";

const TABLE = "nba_player_current_team";

// 12 hours: roster moves rarely happen more than once a day, and the cron
// job (see /api/admin/sync-current-rosters) will refresh well before this.
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export type CurrentRosterEntry = {
  player_id:        number;
  player_name:      string;
  current_team:     string;          // normalized abbreviation
  source:           string;
  source_updated_at: string;         // ISO timestamp
};

export type SyncResult = {
  rows_upserted:    number;
  rows_deleted:     number;
  source:           string;
  fetched_at:       string;
  bdl_active_count: number;
  error:            string | null;
};

/**
 * Fetch all BDL active players and overwrite nba_player_current_team.
 *
 * Players present in the local table but not in the latest BDL response
 * (retired / waived / G-League) are removed so a stale row can never leak
 * into the contest allowlist.
 */
export async function syncCurrentRosters(supabase: SupabaseClient): Promise<SyncResult> {
  const fetched_at = new Date().toISOString();
  let players: BDLPlayer[];
  try {
    players = await getAllActivePlayers();
  } catch (err) {
    return {
      rows_upserted: 0,
      rows_deleted:  0,
      source:        "bdl_players_active",
      fetched_at,
      bdl_active_count: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const rows = players
    .filter((p) => p?.id && p.team?.abbreviation)
    .map((p) => ({
      player_id:   p.id,
      player_name: `${p.first_name} ${p.last_name}`.trim(),
      team:        normalizeTeamCode(p.team.abbreviation),
      position:    p.position || null,
      source:      "bdl_players_active",
      updated_at:  fetched_at,
    }));

  // Replace the table contents in two phases:
  //   1) Upsert the fresh roster.
  //   2) Delete any row whose player_id isn't in the fresh set (retired /
  //      waived players). Using a sentinel updated_at lets us spot stale
  //      rows even if the BDL call later 404s on individual players.
  if (rows.length === 0) {
    // Defensive: never blow away the table if BDL returns an empty page.
    return {
      rows_upserted: 0,
      rows_deleted:  0,
      source:        "bdl_players_active",
      fetched_at,
      bdl_active_count: 0,
      error: "bdl_returned_empty",
    };
  }

  const { error: upsertErr } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: "player_id" });

  if (upsertErr) {
    return {
      rows_upserted: 0,
      rows_deleted:  0,
      source:        "bdl_players_active",
      fetched_at,
      bdl_active_count: rows.length,
      error: upsertErr.message,
    };
  }

  // Delete rows that didn't appear in the fresh fetch.
  const activeIds = rows.map((r) => r.player_id);
  const { data: existingIds } = await supabase
    .from(TABLE)
    .select("player_id");
  const stale = (existingIds ?? [])
    .map((r: { player_id: number }) => r.player_id)
    .filter((id) => !activeIds.includes(id));

  let rows_deleted = 0;
  if (stale.length > 0) {
    for (let i = 0; i < stale.length; i += 200) {
      const chunk = stale.slice(i, i + 200);
      const { error: delErr } = await supabase
        .from(TABLE)
        .delete()
        .in("player_id", chunk);
      if (!delErr) rows_deleted += chunk.length;
    }
  }

  return {
    rows_upserted: rows.length,
    rows_deleted,
    source: "bdl_players_active",
    fetched_at,
    bdl_active_count: rows.length,
    error: null,
  };
}

/**
 * Returns the freshness of the local roster cache.
 *   - max_updated_at: ISO of the most recent updated_at, or null if empty
 *   - is_stale:       true when missing or older than STALE_AFTER_MS
 */
export async function getRosterFreshness(supabase: SupabaseClient): Promise<{
  max_updated_at: string | null;
  is_stale:       boolean;
  row_count:      number;
}> {
  const { data, count } = await supabase
    .from(TABLE)
    .select("updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .limit(1);

  const max_updated_at = data?.[0]?.updated_at ?? null;
  const row_count      = count ?? 0;
  const is_stale = !max_updated_at
    || (Date.now() - new Date(max_updated_at).getTime()) > STALE_AFTER_MS;

  return { max_updated_at, is_stale, row_count };
}

/**
 * Returns Map<player_id_as_string, CurrentRosterEntry> for all players whose
 * normalized current_team is in `teams`. The key is the BDL integer id
 * stringified so callers can compare directly against contest_players.player_id
 * (which is TEXT) and player_day_stats.player_id (also TEXT).
 *
 * If the local cache is empty/stale, this function triggers a sync first.
 * If the sync fails AND there is no cached data at all, returns an empty
 * map with `roster_source_used = "unavailable"` so callers can fail loudly
 * instead of silently falling back to player_stats_cache.team.
 */
export async function getCurrentRosterForTeams(
  supabase: SupabaseClient,
  teams: Set<string>,
  options?: { allowStale?: boolean },
): Promise<{
  map:                 Map<string, CurrentRosterEntry>;
  roster_source_used:  string;        // "bdl_players_active" | "cache" | "stale_cache" | "unavailable"
  source_updated_at:   string | null;
  sync_attempted:      boolean;
  sync_error:          string | null;
  total_players:       number;
  rows_by_team:        Record<string, number>;
}> {
  const allowStale = options?.allowStale ?? false;
  const normalized = new Set<string>();
  for (const t of teams) normalized.add(normalizeTeamCode(t));

  const fresh = await getRosterFreshness(supabase);
  let sync_attempted = false;
  let sync_error: string | null = null;
  let source = fresh.row_count > 0 ? "cache" : "unavailable";
  let source_updated_at = fresh.max_updated_at;

  // Sync when missing or stale (unless caller explicitly wants stale cache).
  if (fresh.row_count === 0 || (fresh.is_stale && !allowStale)) {
    sync_attempted = true;
    const result = await syncCurrentRosters(supabase);
    if (result.error) {
      sync_error = result.error;
      // Fall back to whatever cache we have, but mark it stale.
      source = fresh.row_count > 0 ? "stale_cache" : "unavailable";
    } else {
      source = "bdl_players_active";
      source_updated_at = result.fetched_at;
    }
  }

  if (source === "unavailable") {
    return {
      map:                new Map(),
      roster_source_used: source,
      source_updated_at:  null,
      sync_attempted,
      sync_error,
      total_players:      0,
      rows_by_team:       {},
    };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("player_id, player_name, team, source, updated_at")
    .in("team", [...normalized]);

  if (error) {
    return {
      map:                new Map(),
      roster_source_used: source,
      source_updated_at,
      sync_attempted,
      sync_error:         error.message,
      total_players:      0,
      rows_by_team:       {},
    };
  }

  const map = new Map<string, CurrentRosterEntry>();
  const rows_by_team: Record<string, number> = {};
  for (const row of data ?? []) {
    const norm = normalizeTeamCode(row.team);
    if (!normalized.has(norm)) continue;
    rows_by_team[norm] = (rows_by_team[norm] ?? 0) + 1;
    map.set(String(row.player_id), {
      player_id:         row.player_id,
      player_name:       row.player_name,
      current_team:      norm,
      source:            row.source,
      source_updated_at: row.updated_at,
    });
  }

  return {
    map,
    roster_source_used: source,
    source_updated_at,
    sync_attempted,
    sync_error,
    total_players: map.size,
    rows_by_team,
  };
}
