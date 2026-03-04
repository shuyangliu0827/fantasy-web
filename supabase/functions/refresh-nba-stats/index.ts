// supabase/functions/refresh-nba-stats/index.ts
// Deno edge function — fetches NBA stats from Ball Don't Lie API
// and upserts into the player_stats_cache Supabase table.
// Called hourly via pg_cron + pg_net.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function getRecentDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = 1; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]);
  }
  return dates;
}

async function fetchAPI(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  const response = await fetch(url.toString(), {
    headers: { Authorization: API_KEY },
  });
  if (!response.ok) {
    throw new Error(`BDL API Error ${response.status}: ${endpoint}`);
  }
  return response.json();
}

function calculateFantasyPoints(totals: Record<string, number>): number {
  return (
    (totals.pts || 0) * FANTASY_WEIGHTS.pts +
    (totals.reb || 0) * FANTASY_WEIGHTS.reb +
    (totals.ast || 0) * FANTASY_WEIGHTS.ast +
    (totals.stl || 0) * FANTASY_WEIGHTS.stl +
    (totals.blk || 0) * FANTASY_WEIGHTS.blk +
    (totals.fg3m || 0) * FANTASY_WEIGHTS.fg3m +
    (totals.tov || 0) * FANTASY_WEIGHTS.tov
  );
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Fetch last 5 days of finished games
    const recentDates = getRecentDates(5);
    const allGames: any[] = [];

    for (const date of recentDates) {
      const res = await fetchAPI("/games", { "dates[]": date, per_page: "50" });
      const finished = (res.data || []).filter((g: any) => g.status === "Final");
      allGames.push(...finished);
      await new Promise((r) => setTimeout(r, 200));
    }

    if (allGames.length === 0) {
      return new Response(
        JSON.stringify({ status: "no_games", message: "No finished games found in last 5 days" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch per-game player stats
    const playerStatsMap = new Map<number, { player: any; games: any[] }>();

    for (const game of allGames) {
      try {
        const statsRes = await fetchAPI("/stats", {
          "game_ids[]": game.id.toString(),
          per_page: "100",
        });
        for (const stat of statsRes.data || []) {
          const pid = stat.player.id;
          if (!playerStatsMap.has(pid)) {
            playerStatsMap.set(pid, { player: stat.player, games: [] });
          }
          playerStatsMap.get(pid)!.games.push({ ...stat, team: stat.team });
        }
      } catch {
        // Skip individual game failures
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    // 3. Fetch injuries
    const injuryMap = new Map<number, string>();
    try {
      const injRes = await fetchAPI("/player_injuries", { per_page: "100" });
      for (const inj of injRes.data || []) {
        injuryMap.set(inj.player.id, inj.status);
      }
    } catch {
      // Non-fatal
    }

    // 4. Compute per-player stats
    const playersData: any[] = [];

    playerStatsMap.forEach(({ player, games }) => {
      if (games.length === 0) return;

      const totals = games.reduce(
        (acc, g) => ({
          min: acc.min + parseFloat(g.min || "0"),
          fgm: acc.fgm + (g.fgm || 0),
          fga: acc.fga + (g.fga || 0),
          fg3m: acc.fg3m + (g.fg3m || 0),
          fg3a: acc.fg3a + (g.fg3a || 0),
          ftm: acc.ftm + (g.ftm || 0),
          fta: acc.fta + (g.fta || 0),
          reb: acc.reb + (g.reb || 0),
          ast: acc.ast + (g.ast || 0),
          stl: acc.stl + (g.stl || 0),
          blk: acc.blk + (g.blk || 0),
          tov: acc.tov + (g.turnover || 0),
          pts: acc.pts + (g.pts || 0),
        }),
        { min: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0 }
      );

      const gp = games.length;
      const latestGame = games[games.length - 1];
      const fptsTotal = calculateFantasyPoints(totals);

      playersData.push({
        player_id: player.id,
        name: `${player.first_name} ${player.last_name}`,
        team: latestGame.team?.abbreviation || player.team?.abbreviation || "N/A",
        position: player.position || "N/A",
        games_played: gp,
        // totals
        min_total: totals.min,
        fgm_total: totals.fgm,
        fga_total: totals.fga,
        fg3m_total: totals.fg3m,
        fg3a_total: totals.fg3a,
        ftm_total: totals.ftm,
        fta_total: totals.fta,
        reb_total: totals.reb,
        ast_total: totals.ast,
        stl_total: totals.stl,
        blk_total: totals.blk,
        tov_total: totals.tov,
        pts_total: totals.pts,
        // averages
        min_avg: totals.min / gp,
        fgm_avg: totals.fgm / gp,
        fga_avg: totals.fga / gp,
        fg3m_avg: totals.fg3m / gp,
        fg3a_avg: totals.fg3a / gp,
        ftm_avg: totals.ftm / gp,
        fta_avg: totals.fta / gp,
        fg_pct: totals.fga > 0 ? (totals.fgm / totals.fga) * 100 : 0,
        fg3_pct: totals.fg3a > 0 ? (totals.fg3m / totals.fg3a) * 100 : 0,
        ft_pct: totals.fta > 0 ? (totals.ftm / totals.fta) * 100 : 0,
        reb_avg: totals.reb / gp,
        ast_avg: totals.ast / gp,
        stl_avg: totals.stl / gp,
        blk_avg: totals.blk / gp,
        tov_avg: totals.tov / gp,
        pts_avg: totals.pts / gp,
        // fantasy
        fpts: Math.round(fptsTotal * 10) / 10,
        fpts_avg: Math.round((fptsTotal / gp) * 10) / 10,
        injury: injuryMap.get(player.id) ?? null,
        updated_at: new Date().toISOString(),
      });
    });

    // 5. Sort by fptsAvg and assign rank
    playersData.sort((a, b) => b.fpts_avg - a.fpts_avg);
    playersData.forEach((p, i) => { p.rank = i + 1; });

    // 6. Upsert into player_stats_cache
    const { error } = await supabase
      .from("player_stats_cache")
      .upsert(playersData, { onConflict: "player_id" });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        status: "success",
        players_updated: playersData.length,
        games_processed: allGames.length,
        updated_at: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("refresh-nba-stats error:", err);
    return new Response(
      JSON.stringify({ status: "error", message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
