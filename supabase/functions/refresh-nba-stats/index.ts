// supabase/functions/refresh-nba-stats/index.ts
// Fetches full-season averages from Ball Don't Lie API
// and upserts into player_stats_cache. Called hourly via pg_cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_BASE = "https://api.balldontlie.io/v1";
const API_KEY = "14fd7de0-c9c0-40d3-bbeb-e8c86a61d56a";
const CURRENT_SEASON = 2025; // 2025-26 NBA season

const FANTASY_WEIGHTS = { pts: 1, reb: 1, ast: 1, stl: 2, blk: 2, fg3m: 1, tov: -1 };

// Use raw URL strings to keep [] brackets unencoded (BDL API requires this)
async function fetchRaw(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: API_KEY } });
  if (!res.ok) throw new Error(`BDL API Error ${res.status}: ${url}`);
  return res.json();
}

function calcFpts(avg: { pts: number; reb: number; ast: number; stl: number; blk: number; fg3m: number; tov: number }): number {
  return (
    avg.pts  * FANTASY_WEIGHTS.pts  +
    avg.reb  * FANTASY_WEIGHTS.reb  +
    avg.ast  * FANTASY_WEIGHTS.ast  +
    avg.stl  * FANTASY_WEIGHTS.stl  +
    avg.blk  * FANTASY_WEIGHTS.blk  +
    avg.fg3m * FANTASY_WEIGHTS.fg3m +
    avg.tov  * FANTASY_WEIGHTS.tov
  );
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const r1 = (v: number) => Math.round(v * 10) / 10;

  try {
    // 1. Get all active players (paginated)
    const allPlayers: any[] = [];
    let cursor: number | undefined;
    do {
      const qs = `per_page=100${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await fetchRaw(`${API_BASE}/players/active?${qs}`);
      allPlayers.push(...(res.data || []));
      cursor = res.meta?.next_cursor;
      await new Promise(r => setTimeout(r, 200));
    } while (cursor);

    if (allPlayers.length === 0) {
      return new Response(JSON.stringify({ status: "no_players" }), { headers: { "Content-Type": "application/json" } });
    }

    const playerMap = new Map<number, any>();
    for (const p of allPlayers) playerMap.set(p.id, p);
    const playerIds = allPlayers.map(p => p.id);

    // 2. Fetch season averages — use raw [] brackets so BDL parses them correctly
    const seasonAvgMap = new Map<number, any>();
    for (let i = 0; i < playerIds.length; i += 100) {
      const batch = playerIds.slice(i, i + 100);
      const idsQs = batch.map(id => `player_ids[]=${id}`).join("&");
      try {
        const res = await fetchRaw(`${API_BASE}/season_averages?season=${CURRENT_SEASON}&${idsQs}`);
        for (const avg of res.data || []) {
          seasonAvgMap.set(avg.player_id, avg);
        }
      } catch { /* skip batch */ }
      await new Promise(r => setTimeout(r, 300));
    }

    // 3. If season_averages returned data, use it; otherwise fall back to paginated /stats
    let method = "season_averages";

    type Entry = {
      player: any; team: any; gp: number;
      totals: { min: number; fgm: number; fga: number; fg3m: number; fg3a: number; ftm: number; fta: number; reb: number; ast: number; stl: number; blk: number; tov: number; pts: number };
    };
    const statsMap = new Map<number, Entry>();

    if (seasonAvgMap.size === 0) {
      // Fall back: fetch all stats for this season using raw seasons[] param
      method = "stats_paginated";
      let statCursor: number | undefined;
      do {
        const qs = `per_page=100&seasons[]=${CURRENT_SEASON}${statCursor ? `&cursor=${statCursor}` : ""}`;
        try {
          const res = await fetchRaw(`${API_BASE}/stats?${qs}`);
          for (const stat of (res.data || [])) {
            const minNum = parseFloat((stat.min || "0").replace(":", ".")) || 0;
            if (minNum === 0) continue;
            const pid = stat.player.id;
            if (!statsMap.has(pid)) {
              statsMap.set(pid, {
                player: stat.player, team: stat.team, gp: 0,
                totals: { min: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0 },
              });
            }
            const e = statsMap.get(pid)!;
            e.team = stat.team;
            e.gp++;
            e.totals.min  += minNum;
            e.totals.fgm  += stat.fgm  || 0;  e.totals.fga  += stat.fga  || 0;
            e.totals.fg3m += stat.fg3m || 0;  e.totals.fg3a += stat.fg3a || 0;
            e.totals.ftm  += stat.ftm  || 0;  e.totals.fta  += stat.fta  || 0;
            e.totals.reb  += stat.reb  || 0;  e.totals.ast  += stat.ast  || 0;
            e.totals.stl  += stat.stl  || 0;  e.totals.blk  += stat.blk  || 0;
            e.totals.tov  += stat.turnover || 0; e.totals.pts += stat.pts || 0;
          }
          statCursor = res.meta?.next_cursor;
        } catch { statCursor = undefined; }
        await new Promise(r => setTimeout(r, 200));
      } while (statCursor);
    }

    // 4. Fetch current injuries
    const injuryMap = new Map<number, string>();
    try {
      const injRes = await fetchRaw(`${API_BASE}/player_injuries?per_page=100`);
      for (const inj of injRes.data || []) injuryMap.set(inj.player.id, inj.status);
    } catch { /* non-fatal */ }

    // 5. Build cache rows
    const rows: any[] = [];

    if (seasonAvgMap.size > 0) {
      // Build from season_averages
      for (const [playerId, avg] of seasonAvgMap.entries()) {
        const player = playerMap.get(playerId);
        if (!player || !avg.games_played) continue;
        const gp = avg.games_played;
        const avgObj = {
          pts: avg.ppg || 0, reb: avg.rpg || 0, ast: avg.apg || 0,
          stl: avg.spg || 0, blk: avg.bpg || 0, fg3m: avg.fg3m || 0, tov: avg.tov || 0,
        };
        const fptsAvg = r1(calcFpts(avgObj));
        rows.push({
          player_id: playerId,
          name: `${player.first_name} ${player.last_name}`,
          team: player.team?.abbreviation || "N/A",
          position: player.position || "N/A",
          games_played: gp,
          min_avg: avg.mpg || 0,    pts_avg: avg.ppg || 0,   reb_avg: avg.rpg || 0,
          ast_avg: avg.apg || 0,    stl_avg: avg.spg || 0,   blk_avg: avg.bpg || 0,
          tov_avg: avg.tov || 0,    fgm_avg: avg.fgm || 0,   fga_avg: avg.fga || 0,
          fg3m_avg: avg.fg3m || 0,  fg3a_avg: avg.fg3a || 0,
          ftm_avg: avg.ftm || 0,    fta_avg: avg.fta || 0,
          fg_pct:  avg.fg_pct  ? r1(avg.fg_pct  * 100) : 0,
          fg3_pct: avg.fg3_pct ? r1(avg.fg3_pct * 100) : 0,
          ft_pct:  avg.ft_pct  ? r1(avg.ft_pct  * 100) : 0,
          min_total: r1((avg.mpg || 0) * gp),  pts_total: r1((avg.ppg || 0) * gp),
          reb_total: r1((avg.rpg || 0) * gp),  ast_total: r1((avg.apg || 0) * gp),
          stl_total: r1((avg.spg || 0) * gp),  blk_total: r1((avg.bpg || 0) * gp),
          tov_total: r1((avg.tov || 0) * gp),  fgm_total: r1((avg.fgm || 0) * gp),
          fga_total: r1((avg.fga || 0) * gp),  fg3m_total: r1((avg.fg3m || 0) * gp),
          fg3a_total: r1((avg.fg3a || 0) * gp), ftm_total: r1((avg.ftm || 0) * gp),
          fta_total: r1((avg.fta || 0) * gp),
          fpts: r1(fptsAvg * gp), fpts_avg: fptsAvg,
          injury: injuryMap.get(playerId) ?? null,
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      // Build from aggregated stats
      for (const [playerId, { player, team, gp, totals }] of statsMap.entries()) {
        if (gp < 1) continue;
        const avg = {
          pts:  r1(totals.pts  / gp), reb: r1(totals.reb / gp), ast: r1(totals.ast / gp),
          stl:  r1(totals.stl  / gp), blk: r1(totals.blk / gp), fg3m: r1(totals.fg3m / gp), tov: r1(totals.tov / gp),
        };
        const fptsAvg = r1(calcFpts(avg));
        rows.push({
          player_id: playerId,
          name: `${player.first_name} ${player.last_name}`,
          team: team?.abbreviation || player.team?.abbreviation || "N/A",
          position: player.position || "N/A",
          games_played: gp,
          min_avg:  r1(totals.min  / gp), pts_avg:  r1(totals.pts  / gp),
          reb_avg:  r1(totals.reb  / gp), ast_avg:  r1(totals.ast  / gp),
          stl_avg:  r1(totals.stl  / gp), blk_avg:  r1(totals.blk  / gp),
          tov_avg:  r1(totals.tov  / gp), fgm_avg:  r1(totals.fgm  / gp),
          fga_avg:  r1(totals.fga  / gp), fg3m_avg: r1(totals.fg3m / gp),
          fg3a_avg: r1(totals.fg3a / gp), ftm_avg:  r1(totals.ftm  / gp),
          fta_avg:  r1(totals.fta  / gp),
          fg_pct:  totals.fga  > 0 ? Math.round(totals.fgm  / totals.fga  * 1000) / 10 : 0,
          fg3_pct: totals.fg3a > 0 ? Math.round(totals.fg3m / totals.fg3a * 1000) / 10 : 0,
          ft_pct:  totals.fta  > 0 ? Math.round(totals.ftm  / totals.fta  * 1000) / 10 : 0,
          min_total: r1(totals.min),  pts_total: r1(totals.pts),  reb_total: r1(totals.reb),
          ast_total: r1(totals.ast),  stl_total: r1(totals.stl),  blk_total: r1(totals.blk),
          tov_total: r1(totals.tov),  fgm_total: r1(totals.fgm),  fga_total: r1(totals.fga),
          fg3m_total: r1(totals.fg3m), fg3a_total: r1(totals.fg3a),
          ftm_total: r1(totals.ftm),  fta_total: r1(totals.fta),
          fpts: r1(fptsAvg * gp), fpts_avg: fptsAvg,
          injury: injuryMap.get(playerId) ?? null,
          updated_at: new Date().toISOString(),
        });
      }
    }

    rows.sort((a, b) => b.fpts_avg - a.fpts_avg);
    rows.forEach((r, i) => { r.rank = i + 1; });

    const { error } = await supabase
      .from("player_stats_cache")
      .upsert(rows, { onConflict: "player_id" });

    if (error) throw error;

    return new Response(
      JSON.stringify({ status: "success", players_updated: rows.length, method, season: CURRENT_SEASON, updated_at: new Date().toISOString() }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("refresh-nba-stats error:", err);
    return new Response(JSON.stringify({ status: "error", message: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
