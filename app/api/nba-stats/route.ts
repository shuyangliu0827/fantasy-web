export const dynamic = "force-dynamic";
// app/api/nba-stats/route.ts
// Reads persisted player stats from Supabase player_stats_cache.
// Falls back to fetching full-season averages from BDL API (and persisting) if the table is empty.
// The table is kept fresh by the refresh-nba-stats Supabase Edge Function (runs hourly via pg_cron).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://api.balldontlie.io/v1";
const API_KEY = "14fd7de0-c9c0-40d3-bbeb-e8c86a61d56a";
import { getCurrentSeasonYear } from "@/lib/season";
import { ESPN_DEFAULT_WEIGHTS } from "@/lib/scoring-config";
const CURRENT_SEASON = getCurrentSeasonYear();

// Use anon key — RLS is open for all operations on player_stats_cache
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
);

// ──────────────────────────────────────────────
// Transform a player_stats_cache row → API shape
// ──────────────────────────────────────────────
function rowToPlayer(row: any, index: number) {
  return {
    id: row.player_id,
    name: row.name,
    team: row.team,
    position: row.position,
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
    fpts:     row.fpts,
    fptsAvg:  row.fpts_avg,
    rank:     index + 1,
    injury:   row.injury,
  };
}

// ──────────────────────────────────────────────
// Fallback: fetch full-season averages from BDL + persist to DB
// (used when the table is empty on first boot)
// ──────────────────────────────────────────────
let isRefreshing = false;

async function fetchAPI(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${API_BASE}${endpoint}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const res = await fetch(url.toString(), { headers: { Authorization: API_KEY } });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

async function refreshAndPersist() {
  if (isRefreshing) return;
  isRefreshing = true;
  console.log("[nba-stats] Starting fallback refresh (full season stats)...");

  try {
    // 1. Fetch all stats for the current season (cursor-paginated)
    type Entry = {
      player: any; team: any; gp: number;
      totals: { min: number; fgm: number; fga: number; fg3m: number; fg3a: number; ftm: number; fta: number; reb: number; ast: number; stl: number; blk: number; tov: number; pts: number };
    };

    const playerMap = new Map<number, Entry>();
    let cursor: number | undefined;

    do {
      const params: Record<string, string> = { per_page: "100", "seasons[]": String(CURRENT_SEASON) };
      if (cursor) params.cursor = String(cursor);
      try {
        const res = await fetchAPI("/stats", params);
        for (const stat of (res.data || [])) {
          const minNum = parseFloat((stat.min || "0").replace(":", ".")) || 0;
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

    // 2. Fetch current injuries
    const injuryMap = new Map<number, string>();
    try {
      const injRes = await fetchAPI("/player_injuries", { per_page: "100" });
      for (const inj of injRes.data || []) injuryMap.set(inj.player.id, inj.status);
    } catch { /* non-fatal */ }

    // 3. Build cache rows
    const r1 = (v: number) => Math.round(v * 10) / 10;
    const rows: any[] = [];

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
      const fptsAvg = r1(
        avg.pts  * ESPN_DEFAULT_WEIGHTS.pts  + avg.fgm  * ESPN_DEFAULT_WEIGHTS.fgm  +
        avg.fga  * ESPN_DEFAULT_WEIGHTS.fga  + avg.fg3m * ESPN_DEFAULT_WEIGHTS.fg3m +
        avg.ftm  * ESPN_DEFAULT_WEIGHTS.ftm  + avg.fta  * ESPN_DEFAULT_WEIGHTS.fta  +
        avg.reb  * ESPN_DEFAULT_WEIGHTS.reb  + avg.ast  * ESPN_DEFAULT_WEIGHTS.ast  +
        avg.stl  * ESPN_DEFAULT_WEIGHTS.stl  + avg.blk  * ESPN_DEFAULT_WEIGHTS.blk  +
        avg.tov  * ESPN_DEFAULT_WEIGHTS.tov
      );
      rows.push({
        player_id: playerId,
        name: `${player.first_name} ${player.last_name}`,
        team: team?.abbreviation || player.team?.abbreviation || "N/A",
        position: player.position || "N/A",
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

    rows.sort((a, b) => b.fpts_avg - a.fpts_avg);
    rows.forEach((r, i) => { r.rank = i + 1; });

    const { error } = await supabase
      .from("player_stats_cache")
      .upsert(rows, { onConflict: "player_id" });

    if (error) console.error("[nba-stats] Supabase upsert error:", error);
    else console.log(`[nba-stats] Persisted ${rows.length} players to player_stats_cache`);
  } catch (err) {
    console.error("[nba-stats] Fallback refresh error:", err);
  } finally {
    isRefreshing = false;
  }
}

// ──────────────────────────────────────────────
// GET — read from Supabase
// ──────────────────────────────────────────────
export async function GET() {
  const { data, error } = await supabase
    .from("player_stats_cache")
    .select("*")
    .order("fpts_avg", { ascending: false });

  if (error) {
    console.error("[nba-stats] Supabase read error:", error);
  }

  if (!data || data.length === 0) {
    // Table is empty — trigger a background fetch+persist and return loading status
    refreshAndPersist();
    return NextResponse.json({
      status: "loading",
      message: "Stats are being loaded for the first time, please wait...",
      players: [],
      gamesLoaded: 0,
      lastUpdated: null,
      isUpdating: true,
    });
  }

  const players = data.map((row, i) => rowToPlayer(row, i));
  const lastUpdated = data.reduce((max: string | null, row) =>
    !max || row.updated_at > max ? row.updated_at : max, null);

  return NextResponse.json({
    status: "success",
    players,
    gamesLoaded: data.length,
    lastUpdated,
    isUpdating: isRefreshing,
  });
}

// ──────────────────────────────────────────────
// POST — manual trigger (re-fetches + persists)
// ──────────────────────────────────────────────
export async function POST() {
  if (isRefreshing) {
    return NextResponse.json({ status: "already_updating", message: "Refresh already in progress" });
  }
  refreshAndPersist();
  return NextResponse.json({ status: "refresh_started", message: "Data refresh started in background" });
}
