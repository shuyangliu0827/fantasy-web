// lib/player-game-stats.ts
//
// Shared helper for fetching per-date NBA box-score stats.
// Imported by both:
//   app/api/nba-game-stats/route.ts  (public API endpoint)
//   app/api/contests/my-lineups/route.ts  (live Daily Fantasy scores)
//
// Data source: Ball Don't Lie API (BDL), with a two-level cache:
//   1. In-memory TTL cache (5 min) — fast path, shared within the same process
//   2. player_day_stats DB table — persistent across restarts (past dates only)
//
// For past dates: DB-first. Call BDL only if DB has no rows. Once written, never re-fetched.
// For today:      Always call BDL (live data). Cache in memory for 5 min.
//
// Player IDs are TEXT = String(bdl_integer_id), matching player_day_stats.player_id
// and user_lineup_players.player_id exactly.

import { createClient } from "@supabase/supabase-js";
import { filterValidStats } from "@/lib/shared/canonical-pipeline";
import { ESPN_DEFAULT_WEIGHTS, calcFantasyPoints } from "@/lib/fantasy/shared/scoring-config";
import { parseMinutes } from "@/lib/nba/balldontlie";

const API_BASE  = "https://api.balldontlie.io/v1";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export type PlayerGameStats = {
  min: number; fgm: number; fga: number; fg3m: number;
  ftm: number; fta: number; reb: number; ast: number;
  stl: number; blk: number; tov: number; pts: number; fpts: number;
};
export type DateStatsMap = Record<string, PlayerGameStats>;

// In-memory cache shared within the same Node.js process instance.
const cache = new Map<string, { data: DateStatsMap; timestamp: number }>();

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Prefer service role so RLS doesn't block player_day_stats writes during settlement.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function todayUtcStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchFromBDL(
  date: string,
  reason: "live_day" | "historical_backfill",
): Promise<{ map: DateStatsMap; hadError: boolean }> {
  const apiKey = process.env.BDL_API_KEY ?? "";
  const map: DateStatsMap = {};
  let cursor: number | undefined;
  let hadError = false;

  console.log("[player-game-stats] BDL fetch starting", { reason, date });

  do {
    const url = new URL(`${API_BASE}/stats`);
    url.searchParams.set("start_date", date);
    url.searchParams.set("end_date",   date);
    url.searchParams.set("per_page",   "100");
    if (cursor) url.searchParams.set("cursor", String(cursor));

    try {
      const res = await fetch(url.toString(), { headers: { Authorization: apiKey } });
      if (!res.ok) {
        console.error("[player-game-stats] BDL fetch failed", { reason, date, status: res.status });
        hadError = true;
        break;
      }
      const payload = await res.json();

      for (const stat of payload.data || []) {
        const minNum = parseMinutes(stat.min);
        if (minNum === 0 && stat.pts === 0) continue;

        const playerId = String(stat.player.id);
        const fpts = calcFantasyPoints({
          pts:  stat.pts      || 0,
          fgm:  stat.fgm      || 0,
          fga:  stat.fga      || 0,
          fg3m: stat.fg3m     || 0,
          ftm:  stat.ftm      || 0,
          fta:  stat.fta      || 0,
          reb:  stat.reb      || 0,
          ast:  stat.ast      || 0,
          stl:  stat.stl      || 0,
          blk:  stat.blk      || 0,
          tov:  stat.turnover || 0,
        }, ESPN_DEFAULT_WEIGHTS);

        map[playerId] = {
          min:  Math.round(minNum * 10) / 10,
          fgm:  stat.fgm      || 0,
          fga:  stat.fga      || 0,
          fg3m: stat.fg3m     || 0,
          ftm:  stat.ftm      || 0,
          fta:  stat.fta      || 0,
          reb:  stat.reb      || 0,
          ast:  stat.ast      || 0,
          stl:  stat.stl      || 0,
          blk:  stat.blk      || 0,
          tov:  stat.turnover || 0,
          pts:  stat.pts      || 0,
          fpts: Math.round(fpts * 10) / 10,
        };
      }
      cursor = payload.meta?.next_cursor;
    } catch (err) {
      console.error("[player-game-stats] BDL fetch page error", { reason, date, error: err });
      hadError = true;
      break;
    }
  } while (cursor);

  console.log("[player-game-stats] BDL fetch complete", { reason, date, playerRows: Object.keys(map).length, hadError });
  return { map, hadError };
}

async function readFromDB(supabase: ReturnType<typeof getSupabase>, date: string): Promise<DateStatsMap> {
  const { data } = await supabase
    .from("player_day_stats")
    .select("player_id,min,fgm,fga,fg3m,ftm,fta,reb,ast,stl,blk,tov,pts,fpts")
    .eq("date", date);

  if (!data || data.length === 0) return {};
  const map: DateStatsMap = {};
  for (const row of data) {
    map[String(row.player_id)] = {
      min: row.min, fgm: row.fgm, fga: row.fga, fg3m: row.fg3m,
      ftm: row.ftm, fta: row.fta, reb: row.reb, ast: row.ast,
      stl: row.stl, blk: row.blk, tov: row.tov, pts: row.pts, fpts: row.fpts,
    };
  }
  return map;
}

async function writeToDB(
  supabase: ReturnType<typeof getSupabase>,
  date: string,
  statsMap: DateStatsMap,
): Promise<void> {
  const valid = filterValidStats(statsMap);
  const rows = Object.entries(valid).map(([playerId, s]) => ({
    player_id: playerId, date,
    min: s.min, fgm: s.fgm, fga: s.fga, fg3m: s.fg3m,
    ftm: s.ftm, fta: s.fta, reb: s.reb, ast: s.ast,
    stl: s.stl, blk: s.blk, tov: s.tov, pts: s.pts, fpts: s.fpts,
    fetched_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("player_day_stats")
    .upsert(rows, { onConflict: "player_id,date" });
  if (error) {
    console.error("[player-game-stats] DB write failed", { date, rowsAttempted: rows.length, error });
    throw error;
  }
}

/**
 * Returns box-score stats (including fpts) for all players on a given date.
 * Uses in-memory cache → DB → BDL API in that order.
 * Safe to call from any server-side context.
 *
 * Pass `{ forceRefresh: true }` to bypass all caches and re-fetch from BDL.
 * Required before final settlement so stale mid-game data is not used.
 */
export async function fetchStatsForDate(
  date: string,
  options?: { forceRefresh?: boolean },
): Promise<DateStatsMap> {
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh) {
    const cached = cache.get(date);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
  }

  const isPastDate = date < todayUtcStr();
  const supabase   = getSupabase();

  // DB-first for past dates only when not force-refreshing.
  if (isPastDate && !forceRefresh) {
    const dbStats = await readFromDB(supabase, date);
    if (Object.keys(dbStats).length > 0) {
      cache.set(date, { data: dbStats, timestamp: Date.now() });
      return dbStats;
    }
  }

  const { map: bdlStats, hadError } = await fetchFromBDL(
    date,
    isPastDate ? "historical_backfill" : "live_day",
  );

  if (Object.keys(bdlStats).length > 0) {
    // Write synchronously for past dates; fire-and-forget for today.
    if (isPastDate) {
      await writeToDB(supabase, date, bdlStats);
    } else {
      writeToDB(supabase, date, bdlStats).catch((err) => {
        console.error("[player-game-stats] Failed to persist today stats:", { date, error: err });
      });
    }
    const merged = await readFromDB(supabase, date);
    if (!hadError) cache.set(date, { data: merged, timestamp: Date.now() });
    return merged;
  }

  if (!hadError) cache.set(date, { data: bdlStats, timestamp: Date.now() });
  return bdlStats;
}
