export const dynamic = "force-dynamic";
// app/api/nba-stats/route.ts
//
// ═══════════════════════════════════════════════════════════════
// REFRESH OWNERSHIP MODEL
// ═══════════════════════════════════════════════════════════════
//
// PRIMARY REFRESHER:  supabase/functions/refresh-nba-stats/index.ts
//   - Runs hourly via pg_cron as a Supabase Edge Function
//   - Crawls BDL /season_averages in batches of 75 players/run
//   - Full player pool cycle ≈ 8 runs (~8 hours)
//   - This is the ONLY path that should routinely write player_stats_cache
//
// THIS ROUTE:  cache-first reader + bounded fallback
//   - Normal path: read player_stats_cache from Supabase, return it
//   - Fallback path: only entered when cache is MISSING or STALE
//     (both are abnormal conditions — edge function cron not running)
//   - Fallback is fire-and-forget background; response is still served
//     immediately (loading status for missing, stale data for stale)
//   - Fallback is rate-limited by FALLBACK_COOLDOWN_MS to prevent
//     stampede across rapid requests within the same Vercel instance
//     NOTE: this cooldown is per-instance only; a true distributed lock
//     would require Supabase advisory locks or an external cache.
//
// POST /api/nba-stats:  manual override
//   - Explicitly forces a refresh regardless of freshness
//   - Intended for admin use only, not user-triggered flows
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://api.balldontlie.io/v1";
const API_KEY = process.env.BDL_API_KEY ?? "";
import { getCurrentSeasonYear } from "@/lib/fantasy/shared/season";
import { calcFantasyPoints } from "@/lib/fantasy/shared/scoring-config";
import { parseMinutes } from "@/lib/nba/balldontlie";
import { getCanonicalPlayerPosition } from "@/lib/players/metadata";
import { normalizeTeamCode } from "@/lib/shared/i18n";
// IMPORTANT: Do NOT compute season at module scope. The module may be loaded once and
// kept alive across season boundaries on long-running edge function instances. Always
// call getCurrentSeasonYear() at request/refresh time so it re-evaluates the date.

// ── Freshness policy ──────────────────────────────────────────
//
// FRESH:   max(updated_at) across all cache rows < STALE_AFTER_MS ago
//          → serve from cache, no BDL fetch
//
// STALE:   max(updated_at) >= STALE_AFTER_MS ago, but rows exist
//          → serve stale data immediately (better than empty)
//          → trigger background fallback refresh if cooldown has passed
//          → return isUpdating: true so callers know data may be behind
//
// MISSING: player_stats_cache is empty (data.length === 0)
//          → return loading status
//          → trigger background fallback refresh if cooldown has passed
//
// The edge function runs hourly and completes a full cycle in ~8 hours.
// A 4-hour threshold means: if the newest row is 4+ hours old, the cron
// has missed at least 4 scheduled runs — treat as stale.
//
const STALE_AFTER_MS    = 4 * 60 * 60 * 1000; // 4 hours
//
// Minimum gap between fallback refresh attempts within this process.
// Prevents multiple concurrent requests from all triggering BDL fetches.
// Per-instance only — not a distributed lock.
//
const FALLBACK_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
// ─────────────────────────────────────────────────────────────

// Use anon key — RLS is open for all operations on player_stats_cache
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
);

// ──────────────────────────────────────────────
// Transform a player_stats_cache row → API shape
// fptsAvg is recomputed from per-game averages using the current ESPN_DEFAULT_WEIGHTS
// so that ranking reflects the latest scoring formula regardless of what is cached in DB.
// ──────────────────────────────────────────────
const r1 = (v: number) => Math.round(v * 10) / 10;

type CacheRow = {
  player_id: number; name: string; team: string; position: string; games_played: number;
  pts_avg: number; fgm_avg: number; fga_avg: number; fg3m_avg: number; fg3a_avg: number; ftm_avg: number; fta_avg: number; reb_avg: number; ast_avg: number; stl_avg: number; blk_avg: number; tov_avg: number; min_avg: number;
  pts_total: number; fgm_total: number; fga_total: number; fg3m_total: number; fg3a_total: number; ftm_total: number; fta_total: number; reb_total: number; ast_total: number; stl_total: number; blk_total: number; tov_total: number; min_total: number;
  fg_pct: number; ft_pct: number; fg3_pct: number; fpts_avg?: number; fpts?: number; injury?: string | null;
  rank?: number; updated_at?: string;
};

function rowToPlayer(row: CacheRow, index: number) {
  const fptsAvg = r1(calcFantasyPoints({
    pts:  row.pts_avg  || 0,
    fgm:  row.fgm_avg  || 0,
    fga:  row.fga_avg  || 0,
    fg3m: row.fg3m_avg || 0,
    ftm:  row.ftm_avg  || 0,
    fta:  row.fta_avg  || 0,
    reb:  row.reb_avg  || 0,
    ast:  row.ast_avg  || 0,
    stl:  row.stl_avg  || 0,
    blk:  row.blk_avg  || 0,
    tov:  row.tov_avg  || 0,
  }));
  const fpts = r1(fptsAvg * (row.games_played || 0));

  return {
    id: row.player_id,
    name: row.name,
    team: normalizeTeamCode(row.team),
    position: getCanonicalPlayerPosition(row.name, row.position),
    gamesPlayed: row.games_played,
    totals: {
      min:  row.min_total,
      fgm:  row.fgm_total,
      fga:  row.fga_total,
      fg3m: row.fg3m_total,
      fg3a: row.fg3a_total,
      ftm:  row.ftm_total,
      fta:  row.fta_total,
      reb:  row.reb_total,
      ast:  row.ast_total,
      stl:  row.stl_total,
      blk:  row.blk_total,
      tov:  row.tov_total,
      pts:  row.pts_total,
    },
    averages: {
      min:     row.min_avg,
      fgm:     row.fgm_avg,
      fga:     row.fga_avg,
      fg3m:    row.fg3m_avg,
      fg3a:    row.fg3a_avg,
      ftm:     row.ftm_avg,
      fta:     row.fta_avg,
      fg_pct:  row.fg_pct,
      fg3_pct: row.fg3_pct,
      ft_pct:  row.ft_pct,
      reb:     row.reb_avg,
      ast:     row.ast_avg,
      stl:     row.stl_avg,
      blk:     row.blk_avg,
      tov:     row.tov_avg,
      pts:     row.pts_avg,
    },
    fpts,
    fptsAvg,
    rank:     index + 1,
    injury:   row.injury,
  };
}

// ──────────────────────────────────────────────
// Fallback: fetch full-season averages from BDL + persist to DB
// Only enters when cache is MISSING or STALE (abnormal — edge cron not running).
// Not the normal data refresh path; that is the Supabase Edge Function.
// ──────────────────────────────────────────────

// Per-instance refresh guard (not distributed — see ownership model comment above)
let isRefreshing = false;
let lastFallbackAttemptAt = 0;

async function fetchAPI(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${API_BASE}${endpoint}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const res = await fetch(url.toString(), { headers: { Authorization: API_KEY } });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

async function refreshAndPersist(reason: "cache_miss" | "stale" | "manual") {
  if (isRefreshing) {
    console.log("[nba-stats] fallback refresh skipped: already in progress", { source: "api-nba-stats", reason });
    return;
  }
  isRefreshing = true;
  lastFallbackAttemptAt = Date.now();
  const CURRENT_SEASON = getCurrentSeasonYear();
  console.log("[nba-stats] BDL fallback refresh starting", { source: "api-nba-stats", reason, season: CURRENT_SEASON });

  try {
    // 1. Fetch all stats for the current season (cursor-paginated)
    type Entry = {
      player: { id: number; first_name: string; last_name: string; position: string; team?: { abbreviation: string } }; team: { abbreviation: string }; gp: number;
      totals: { min: number; fgm: number; fga: number; fg3m: number; fg3a: number; ftm: number; fta: number; reb: number; ast: number; stl: number; blk: number; tov: number; pts: number };
    };

    const playerMap = new Map<number, Entry>();
    let cursor: number | undefined;
    let pagesFetched = 0;

    do {
      const params: Record<string, string> = { per_page: "100", "seasons[]": String(CURRENT_SEASON) };
      if (cursor) params.cursor = String(cursor);
      try {
        const res = await fetchAPI("/stats", params);
        pagesFetched++;
        for (const stat of (res.data || [])) {
          const minNum = parseMinutes(stat.min);
          if (minNum === 0) continue;
          const pid = stat.player.id;
          if (!playerMap.has(pid)) {
            playerMap.set(pid, {
              player: stat.player, team: stat.team, gp: 0,
              totals: { min: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0 },
            });
          }
          const e = playerMap.get(pid)!;
          e.team = stat.team;
          e.gp++;
          e.totals.min  += minNum;
          e.totals.fgm  += stat.fgm  || 0;
          e.totals.fga  += stat.fga  || 0;
          e.totals.fg3m += stat.fg3m || 0;
          e.totals.fg3a += stat.fg3a || 0;
          e.totals.ftm  += stat.ftm  || 0;
          e.totals.fta  += stat.fta  || 0;
          e.totals.reb  += stat.reb  || 0;
          e.totals.ast  += stat.ast  || 0;
          e.totals.stl  += stat.stl  || 0;
          e.totals.blk  += stat.blk  || 0;
          e.totals.tov  += stat.turnover || 0;
          e.totals.pts  += stat.pts  || 0;
        }
        cursor = res.meta?.next_cursor;
      } catch { cursor = undefined; }
      await new Promise(r => setTimeout(r, 200));
    } while (cursor);

    console.log("[nba-stats] BDL /stats fetch complete", { source: "api-nba-stats", reason, season: CURRENT_SEASON, pagesFetched, uniquePlayers: playerMap.size });

    // 2. Fetch current injuries (cursor-paginated — the endpoint can return
    //    more than 100 rows during a busy injury period; missing entries would
    //    leave injured players with injury=null and allow them into the pool).
    const injuryMap = new Map<number, string>();
    let injFetchOk = false;
    try {
      let injCursor: number | undefined;
      do {
        const injParams: Record<string, string> = { per_page: "100" };
        if (injCursor) injParams.cursor = String(injCursor);
        const injRes = await fetchAPI("/player_injuries", injParams);
        for (const inj of injRes.data || []) injuryMap.set(inj.player.id, inj.status);
        injCursor = injRes.meta?.next_cursor;
      } while (injCursor);
      injFetchOk = true;
    } catch { /* non-fatal */ }

    console.log("[nba-stats] injuries fetched", {
      source: "api-nba-stats",
      injuriesFetched: injuryMap.size,
      injFetchOk,
    });

    // 2b. Stale injury clearing — only when the full injury list was fetched
    //     successfully.  Any player_stats_cache row with injury != null whose
    //     player_id is absent from the current BDL list has recovered; clear it
    //     so they become available for future contest pools.
    let staleInjuriesCleared = 0;
    if (injFetchOk) {
      const { data: staleRows } = await supabase
        .from("player_stats_cache")
        .select("player_id")
        .not("injury", "is", null);

      const staleIds = (staleRows ?? [])
        .map((r: { player_id: number }) => r.player_id)
        .filter((pid: number) => !injuryMap.has(pid));

      if (staleIds.length > 0) {
        for (let i = 0; i < staleIds.length; i += 50) {
          const chunk = staleIds.slice(i, i + 50);
          await supabase
            .from("player_stats_cache")
            .update({ injury: null, updated_at: new Date().toISOString() })
            .in("player_id", chunk);
        }
        staleInjuriesCleared = staleIds.length;
      }

      console.log("[nba-stats] stale injuries cleared", {
        source: "api-nba-stats",
        staleInjuriesCleared,
        staleIds,
      });
    }

    // 3. Build cache rows
    const rows: CacheRow[] = [];

    for (const [playerId, { player, team, gp, totals }] of playerMap.entries()) {
      if (gp < 1) continue;
      const avg = {
        min:  r1(totals.min  / gp), fgm:  r1(totals.fgm  / gp), fga:  r1(totals.fga  / gp),
        fg3m: r1(totals.fg3m / gp), fg3a: r1(totals.fg3a / gp),
        ftm:  r1(totals.ftm  / gp), fta:  r1(totals.fta  / gp),
        reb:  r1(totals.reb  / gp), ast:  r1(totals.ast  / gp),
        stl:  r1(totals.stl  / gp), blk:  r1(totals.blk  / gp),
        tov:  r1(totals.tov  / gp), pts:  r1(totals.pts  / gp),
      };
      const fptsAvg = r1(calcFantasyPoints(avg));
      rows.push({
        player_id: playerId,
        name: `${player.first_name} ${player.last_name}`,
        team: normalizeTeamCode(team?.abbreviation || player.team?.abbreviation || "N/A"),
        position: getCanonicalPlayerPosition(`${player.first_name} ${player.last_name}`, player.position || "N/A"),
        games_played: gp,
        min_avg: avg.min,   pts_avg: avg.pts,   reb_avg: avg.reb,   ast_avg: avg.ast,
        stl_avg: avg.stl,   blk_avg: avg.blk,   tov_avg: avg.tov,
        fgm_avg: avg.fgm,   fga_avg: avg.fga,   fg3m_avg: avg.fg3m, fg3a_avg: avg.fg3a,
        ftm_avg: avg.ftm,   fta_avg: avg.fta,
        fg_pct:  totals.fga  > 0 ? Math.round(totals.fgm  / totals.fga  * 1000) / 10 : 0,
        fg3_pct: totals.fg3a > 0 ? Math.round(totals.fg3m / totals.fg3a * 1000) / 10 : 0,
        ft_pct:  totals.fta  > 0 ? Math.round(totals.ftm  / totals.fta  * 1000) / 10 : 0,
        min_total: r1(totals.min),  pts_total: r1(totals.pts),  reb_total: r1(totals.reb),
        ast_total: r1(totals.ast),  stl_total: r1(totals.stl),  blk_total: r1(totals.blk),
        tov_total: r1(totals.tov),  fgm_total: r1(totals.fgm),  fga_total: r1(totals.fga),
        fg3m_total: r1(totals.fg3m), fg3a_total: r1(totals.fg3a),
        ftm_total: r1(totals.ftm),  fta_total: r1(totals.fta),
        fpts:     r1(fptsAvg * gp),
        fpts_avg: fptsAvg,
        injury:   injuryMap.get(playerId) ?? null,
        updated_at: new Date().toISOString(),
      });
    }

    rows.sort((a, b) => (b.fpts_avg ?? 0) - (a.fpts_avg ?? 0));
    rows.forEach((r, i) => { r.rank = i + 1; });

    const { error } = await supabase
      .from("player_stats_cache")
      .upsert(rows, { onConflict: "player_id" });

    if (error) {
      console.error("[nba-stats] fallback upsert failed", { source: "api-nba-stats", reason, rowsAttempted: rows.length, error });
    } else {
      console.log("[nba-stats] fallback refresh complete", {
        source: "api-nba-stats",
        reason,
        season: CURRENT_SEASON,
        rowsWritten: rows.length,
        injuriesFetched: injuryMap.size,
        staleInjuriesCleared,
      });
    }
  } catch (err) {
    console.error("[nba-stats] fallback refresh error", { source: "api-nba-stats", reason, error: err });
  } finally {
    isRefreshing = false;
  }
}

// ──────────────────────────────────────────────
// GET — cache-first reader
// Normal path: read player_stats_cache, return it.
// Fallback path (abnormal): only when cache is missing or stale.
// ──────────────────────────────────────────────
export async function GET() {
  const { data, error } = await supabase
    .from("player_stats_cache")
    .select("*")
    .order("fpts_avg", { ascending: false });

  if (error) {
    console.error("[nba-stats] Supabase read error:", error);
  }

  // ── MISSING: cache is empty ──────────────────────────────────
  if (!data || data.length === 0) {
    const cooldownRemaining = FALLBACK_COOLDOWN_MS - (Date.now() - lastFallbackAttemptAt);
    if (cooldownRemaining <= 0) {
      console.warn("[nba-stats] cache MISSING — triggering fallback refresh", { source: "api-nba-stats", reason: "cache_miss" });
      refreshAndPersist("cache_miss");
    } else {
      console.warn("[nba-stats] cache MISSING — fallback skipped (cooldown active)", { source: "api-nba-stats", cooldownRemainingMs: cooldownRemaining });
    }
    return NextResponse.json({
      status: "loading",
      message: "Stats are being loaded for the first time, please wait...",
      players: [],
      gamesLoaded: 0,
      lastUpdated: null,
      isUpdating: true,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  // ── Compute cache age ────────────────────────────────────────
  const lastUpdated = data.reduce((max: string | null, row) =>
    !max || row.updated_at > max ? row.updated_at : max, null);
  const cacheAgeMs = lastUpdated ? Date.now() - new Date(lastUpdated).getTime() : Infinity;
  const isStale = cacheAgeMs > STALE_AFTER_MS;

  // ── STALE: rows exist but edge function has not run in 4+ hours ──
  if (isStale) {
    const cooldownRemaining = FALLBACK_COOLDOWN_MS - (Date.now() - lastFallbackAttemptAt);
    if (cooldownRemaining <= 0) {
      console.warn("[nba-stats] cache STALE — triggering fallback refresh", {
        source: "api-nba-stats", reason: "stale",
        cacheAgeHours: (cacheAgeMs / 3_600_000).toFixed(1),
        lastUpdated,
      });
      refreshAndPersist("stale");
    } else {
      console.warn("[nba-stats] cache STALE — fallback skipped (cooldown active)", {
        source: "api-nba-stats",
        cacheAgeHours: (cacheAgeMs / 3_600_000).toFixed(1),
        cooldownRemainingMs: cooldownRemaining,
      });
    }
    // Serve stale data immediately — better than empty
  }

  // ── FRESH (or stale-but-served): build response from cache ───
  const unsorted = data.map((row) => rowToPlayer(row, 0));
  unsorted.sort((a, b) => b.fptsAvg - a.fptsAvg);
  unsorted.forEach((p, i) => { p.rank = i + 1; });
  const players = unsorted;

  return NextResponse.json({
    status: "success",
    players,
    gamesLoaded: data.length,
    lastUpdated,
    isUpdating: isRefreshing,
    isStale,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

// ──────────────────────────────────────────────
// POST — manual override (admin use only)
// Forces a refresh regardless of freshness/cooldown.
// ──────────────────────────────────────────────
export async function POST() {
  if (isRefreshing) {
    return NextResponse.json({ status: "already_updating", message: "Refresh already in progress" });
  }
  console.log("[nba-stats] manual refresh triggered", { source: "api-nba-stats", reason: "manual" });
  refreshAndPersist("manual");
  return NextResponse.json({ status: "refresh_started", message: "Data refresh started in background" });
}
