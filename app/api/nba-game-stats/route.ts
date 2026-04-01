export const dynamic = "force-dynamic";
// app/api/nba-game-stats/route.ts
//
// ═══════════════════════════════════════════════════════════════
// REFRESH OWNERSHIP MODEL
// ═══════════════════════════════════════════════════════════════
// ROLE: cache-first reader for box-score stats (per-date)
//
// This route does NOT have a scheduled refresher — it is self-healing:
//   Past dates: DB-first (player_day_stats). BDL called only if DB has no
//     rows for that date (historical_backfill). Once written, never re-fetched.
//   Today:      Always calls BDL (live_day). In-memory TTL cache (5 min) to
//     avoid hammering BDL on repeated same-minute requests.
//   Future:     Falls through to BDL (no data yet).
//
// CANONICAL PIPELINE (Rule A):
//   For past dates: check player_day_stats DB first; only call BDL if missing.
//   After BDL fetch: write valid stats to DB (null-safe — zero rows are skipped).
//   This makes past-week score computation fully deterministic across Vercel restarts.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { filterValidStats } from "@/lib/canonical-pipeline";
import { ESPN_DEFAULT_WEIGHTS, calcFantasyPoints } from "@/lib/scoring-config";

const API_BASE = "https://api.balldontlie.io/v1";
const API_KEY  = process.env.BDL_API_KEY ?? "";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (live / today only)

type PlayerGameStats = {
  min: number; fgm: number; fga: number; fg3m: number;
  ftm: number; fta: number; reb: number; ast: number;
  stl: number; blk: number; tov: number; pts: number; fpts: number;
};
type DateStatsMap = Record<string, PlayerGameStats>;

// In-memory cache for live / same-day data only
const cache = new Map<string, { data: DateStatsMap; timestamp: number }>();

// Use centralized ESPN default weights from scoring-config
const FANTASY_WEIGHTS = ESPN_DEFAULT_WEIGHTS;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function todayUtcStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── BDL API fetch ─────────────────────────────────────────────────────────────

async function fetchFromBDL(date: string, reason: "live_day" | "historical_backfill"): Promise<DateStatsMap> {
  const map: DateStatsMap = {};
  let cursor: number | undefined;
  let pagesFetched = 0;

  console.log("[nba-game-stats] BDL fetch starting", { source: "api-nba-game-stats", reason, date });

  do {
    const url = new URL(`${API_BASE}/stats`);
    url.searchParams.set("start_date", date);
    url.searchParams.set("end_date",   date);
    url.searchParams.set("per_page",   "100");
    if (cursor) url.searchParams.set("cursor", String(cursor));

    try {
      const res = await fetch(url.toString(), { headers: { Authorization: API_KEY } });
      if (!res.ok) {
        console.error("[nba-game-stats] BDL fetch failed", { source: "api-nba-game-stats", reason, date, status: res.status });
        break;
      }
      pagesFetched++;
      const payload = await res.json();

      for (const stat of payload.data || []) {
        const minStr: string = stat.min || "0";
        const minNum = parseFloat(minStr.includes(":") ? minStr.replace(":", ".") : minStr) || 0;
        if (minNum === 0 && stat.pts === 0) continue;

        const playerId = String(stat.player.id);
        // All 11 ESPN scoring terms — uses calcFantasyPoints from scoring-config
        // so this formula stays in sync with the league scoring engine.
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
        }, FANTASY_WEIGHTS);

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
      console.error("[nba-game-stats] BDL fetch page error", { source: "api-nba-game-stats", reason, date, error: err });
      break;
    }
  } while (cursor);

  console.log("[nba-game-stats] BDL fetch complete", { source: "api-nba-game-stats", reason, date, pagesFetched, playerRows: Object.keys(map).length });
  return map;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function readFromDB(supabase: ReturnType<typeof getSupabase>, date: string): Promise<DateStatsMap> {
  const { data } = await supabase
    .from("player_day_stats")
    .select("player_id,min,fgm,fga,fg3m,ftm,fta,reb,ast,stl,blk,tov,pts,fpts")
    .eq("date", date);

  if (!data || data.length === 0) return {};
  const map: DateStatsMap = {};
  for (const row of data) {
    map[row.player_id] = {
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
  // Rule A: only write rows with valid (non-zero) stats
  const valid = filterValidStats(statsMap);
  const rows = Object.entries(valid).map(([playerId, s]) => ({
    player_id: playerId,
    date,
    min: s.min, fgm: s.fgm, fga: s.fga, fg3m: s.fg3m,
    ftm: s.ftm, fta: s.fta, reb: s.reb, ast: s.ast,
    stl: s.stl, blk: s.blk, tov: s.tov, pts: s.pts, fpts: s.fpts,
    fetched_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("player_day_stats").upsert(rows, { onConflict: "player_id,date" });
  if (error) {
    console.error("[nba-game-stats] DB write failed", { source: "api-nba-game-stats", date, rowsAttempted: rows.length, error });
    throw error; // re-throw so callers can catch
  }
  console.log("[nba-game-stats] DB write complete", { source: "api-nba-game-stats", date, rowsWritten: rows.length });
}

// ── Main fetch orchestrator ───────────────────────────────────────────────────

async function fetchStatsForDate(date: string): Promise<DateStatsMap> {
  // In-memory cache check (fast path for live/today data)
  const cached = cache.get(date);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const isPastDate = date < todayUtcStr();
  const supabase   = getSupabase();

  if (isPastDate) {
    // DB-first: past dates are immutable once committed — skip BDL if we have data
    const dbStats = await readFromDB(supabase, date);
    if (Object.keys(dbStats).length > 0) {
      cache.set(date, { data: dbStats, timestamp: Date.now() });
      return dbStats;
    }
  }

  // Fetch from BDL (needed for today, future, or past dates not yet in DB)
  const bdlStats = await fetchFromBDL(date, isPastDate ? "historical_backfill" : "live_day");

  if (isPastDate && Object.keys(bdlStats).length > 0) {
    // Persist to DB (null-safe write — skips zero rows, never erases valid data)
    await writeToDB(supabase, date, bdlStats);
    // Re-read to get canonical merged result (merges any rows already in DB)
    const merged = await readFromDB(supabase, date);
    cache.set(date, { data: merged, timestamp: Date.now() });
    return merged;
  }

  // Today/future or BDL returned empty — use in-memory cache only
  // For today with valid data, still write to DB for partial persistence
  if (!isPastDate && Object.keys(bdlStats).length > 0) {
    writeToDB(supabase, date, bdlStats).catch((err) => {
      console.error("[nba-game-stats] Failed to persist today's stats to DB:", { date, error: err });
    });
  }

  cache.set(date, { data: bdlStats, timestamp: Date.now() });
  return bdlStats;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { status: "error", message: "date parameter is required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  try {
    const stats = await fetchStatsForDate(date);
    return NextResponse.json({ status: "success", stats });
  } catch (err) {
    console.error("[nba-game-stats] Error:", err);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch game stats" },
      { status: 500 },
    );
  }
}
