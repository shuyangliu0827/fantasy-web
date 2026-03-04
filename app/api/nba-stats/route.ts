// app/api/nba-stats/route.ts
// Reads persisted player stats from Supabase player_stats_cache.
// Falls back to fetching from BDL API directly (and persisting) if the table is empty.
// The table is kept fresh by the refresh-nba-stats Supabase Edge Function (runs hourly via pg_cron).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://api.balldontlie.io/v1";
const API_KEY = "14fd7de0-c9c0-40d3-bbeb-e8c86a61d56a";

const FANTASY_WEIGHTS = {
  pts: 1,
  reb: 1,
  ast: 1,
  stl: 2,
  blk: 2,
  fg3m: 1,
  tov: -1,
};

// Use service-role key for writes; anon key is fine for reads.
// We use the anon key here since RLS is open for all operations.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ──────────────────────────────────────────────
// Transform a player_stats_cache row → API shape
// ──────────────────────────────────────────────
function rowToPlayer(row: any) {
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
    rank:     row.rank,
    injury:   row.injury,
  };
}

// ──────────────────────────────────────────────
// Fallback: fetch from BDL API + persist to DB
// (used when the table is empty on first boot)
// ──────────────────────────────────────────────
let isRefreshing = false;

function getRecentDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

async function fetchAPI(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${API_BASE}${endpoint}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const res = await fetch(url.toString(), { headers: { Authorization: API_KEY } });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

function calcFpts(totals: any): number {
  return (
    (totals.pts  || 0) * FANTASY_WEIGHTS.pts  +
    (totals.reb  || 0) * FANTASY_WEIGHTS.reb  +
    (totals.ast  || 0) * FANTASY_WEIGHTS.ast  +
    (totals.stl  || 0) * FANTASY_WEIGHTS.stl  +
    (totals.blk  || 0) * FANTASY_WEIGHTS.blk  +
    (totals.fg3m || 0) * FANTASY_WEIGHTS.fg3m +
    (totals.tov  || 0) * FANTASY_WEIGHTS.tov
  );
}

async function refreshAndPersist() {
  if (isRefreshing) return;
  isRefreshing = true;
  console.log("[nba-stats] Starting fallback refresh...");

  try {
    const recentDates = getRecentDates(5);
    const allGames: any[] = [];

    for (const date of recentDates) {
      const res = await fetchAPI("/games", { "dates[]": date, per_page: "50" });
      allGames.push(...(res.data || []).filter((g: any) => g.status === "Final"));
      await new Promise((r) => setTimeout(r, 200));
    }

    if (allGames.length === 0) {
      console.log("[nba-stats] No finished games found");
      return;
    }

    const playerStatsMap = new Map<number, { player: any; games: any[] }>();
    for (const game of allGames) {
      try {
        const statsRes = await fetchAPI("/stats", { "game_ids[]": game.id.toString(), per_page: "100" });
        for (const stat of statsRes.data || []) {
          const pid = stat.player.id;
          if (!playerStatsMap.has(pid)) playerStatsMap.set(pid, { player: stat.player, games: [] });
          playerStatsMap.get(pid)!.games.push({ ...stat, team: stat.team });
        }
      } catch { /* skip individual failures */ }
      await new Promise((r) => setTimeout(r, 300));
    }

    const injuryMap = new Map<number, string>();
    try {
      const injRes = await fetchAPI("/player_injuries", { per_page: "100" });
      for (const inj of injRes.data || []) injuryMap.set(inj.player.id, inj.status);
    } catch { /* non-fatal */ }

    const rows: any[] = [];
    playerStatsMap.forEach(({ player, games }) => {
      if (!games.length) return;
      const totals = games.reduce(
        (acc, g) => ({
          min:  acc.min  + parseFloat(g.min || "0"),
          fgm:  acc.fgm  + (g.fgm  || 0),
          fga:  acc.fga  + (g.fga  || 0),
          fg3m: acc.fg3m + (g.fg3m || 0),
          fg3a: acc.fg3a + (g.fg3a || 0),
          ftm:  acc.ftm  + (g.ftm  || 0),
          fta:  acc.fta  + (g.fta  || 0),
          reb:  acc.reb  + (g.reb  || 0),
          ast:  acc.ast  + (g.ast  || 0),
          stl:  acc.stl  + (g.stl  || 0),
          blk:  acc.blk  + (g.blk  || 0),
          tov:  acc.tov  + (g.turnover || 0),
          pts:  acc.pts  + (g.pts  || 0),
        }),
        { min: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0 }
      );
      const gp = games.length;
      const latestGame = games[games.length - 1];
      const fptsTotal = calcFpts(totals);

      rows.push({
        player_id: player.id,
        name: `${player.first_name} ${player.last_name}`,
        team: latestGame.team?.abbreviation || player.team?.abbreviation || "N/A",
        position: player.position || "N/A",
        games_played: gp,
        min_total: totals.min,  fgm_total: totals.fgm,  fga_total: totals.fga,
        fg3m_total: totals.fg3m, fg3a_total: totals.fg3a,
        ftm_total: totals.ftm,  fta_total: totals.fta,
        reb_total: totals.reb,  ast_total: totals.ast,
        stl_total: totals.stl,  blk_total: totals.blk,
        tov_total: totals.tov,  pts_total: totals.pts,
        min_avg: totals.min / gp,  fgm_avg: totals.fgm / gp, fga_avg: totals.fga / gp,
        fg3m_avg: totals.fg3m / gp, fg3a_avg: totals.fg3a / gp,
        ftm_avg: totals.ftm / gp,  fta_avg: totals.fta / gp,
        fg_pct:  totals.fga  > 0 ? (totals.fgm  / totals.fga)  * 100 : 0,
        fg3_pct: totals.fg3a > 0 ? (totals.fg3m / totals.fg3a) * 100 : 0,
        ft_pct:  totals.fta  > 0 ? (totals.ftm  / totals.fta)  * 100 : 0,
        reb_avg: totals.reb / gp,  ast_avg: totals.ast / gp,
        stl_avg: totals.stl / gp,  blk_avg: totals.blk / gp,
        tov_avg: totals.tov / gp,  pts_avg: totals.pts / gp,
        fpts: Math.round(fptsTotal * 10) / 10,
        fpts_avg: Math.round((fptsTotal / gp) * 10) / 10,
        injury: injuryMap.get(player.id) ?? null,
        updated_at: new Date().toISOString(),
      });
    });

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
    .order("rank", { ascending: true });

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

  const players = data.map(rowToPlayer);
  const lastUpdated = data[0]?.updated_at ?? null;

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
