// supabase/functions/refresh-nba-stats/index.ts
//
// ═══════════════════════════════════════════════════════════════
// PRIMARY SCHEDULED REFRESHER for player_stats_cache
// ═══════════════════════════════════════════════════════════════
// This is the AUTHORITATIVE source of truth writer for season-level
// player stats. It is the ONLY path that should routinely update
// player_stats_cache. API routes (app/api/nba-stats) are cache-first
// readers; they only fall back to BDL when this function has not run.
//
// Schedule: hourly via pg_cron (Supabase scheduler)
// BDL rate limit: 60 req/min.
// Strategy: process BATCH_SIZE players per run, tracking position in
//   stats_cursor table. Each run advances the cursor so invocations
//   never duplicate work. Full cycle ≈ 8 runs (~8 hours on hourly cron).
// Source label for logs: "edge-refresh" / reason: "scheduled"
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_BASE = "https://api.balldontlie.io/v1";
const API_KEY = Deno.env.get("BDL_API_KEY") ?? "";
const BATCH_SIZE = 75;       // players per run — keeps total API calls under 60/min
const REQ_DELAY_MS = 1000;   // 1 s between season_averages calls

// NOTE: mirrors ESPN_DEFAULT_WEIGHTS in lib/scoring-config.ts — must stay in sync.
// (Cannot import from lib/ here — this is a Deno edge function.)
const FANTASY_WEIGHTS = { pts: 1, fgm: 2, fga: -1, fg3m: 1, ftm: 1, fta: -1, reb: 1, ast: 2, stl: 4, blk: 4, tov: -2 };

type BDLPlayer = { id: number; first_name: string; last_name: string; position: string; team?: { abbreviation: string } };
type SeasonAvg = { player_id: number; games_played?: number; gp?: number; min?: string | number; pts?: number; fgm?: number; fga?: number; fg3m?: number; fg3a?: number; ftm?: number; fta?: number; reb?: number; ast?: number; stl?: number; blk?: number; turnover?: number; fg_pct?: number; fg3_pct?: number; ft_pct?: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchRaw(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: API_KEY } });
  if (!res.ok) throw new Error(`BDL API Error ${res.status}: ${url}`);
  return res.json();
}

// NOTE: mirrors calcFantasyPoints in lib/scoring-config.ts — must stay in sync.

function numOrNull(v: number | undefined): number | null {
  return typeof v === "number" ? v : null;
}

function withFallback(incoming: number | null, existing: number | null | undefined): number {
  if (incoming === null || Number.isNaN(incoming)) return existing ?? 0;
  return incoming;
}

function calcFpts(avg: { pts: number; fgm: number; fga: number; fg3m: number; ftm: number; fta: number; reb: number; ast: number; stl: number; blk: number; tov: number }): number {
  return (
    avg.pts  * FANTASY_WEIGHTS.pts  +
    avg.fgm  * FANTASY_WEIGHTS.fgm  +
    avg.fga  * FANTASY_WEIGHTS.fga  +
    avg.fg3m * FANTASY_WEIGHTS.fg3m +
    avg.ftm  * FANTASY_WEIGHTS.ftm  +
    avg.fta  * FANTASY_WEIGHTS.fta  +
    avg.reb  * FANTASY_WEIGHTS.reb  +
    avg.ast  * FANTASY_WEIGHTS.ast  +
    avg.stl  * FANTASY_WEIGHTS.stl  +
    avg.blk  * FANTASY_WEIGHTS.blk  +
    avg.tov  * FANTASY_WEIGHTS.tov
  );
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const r1 = (v: number) => Math.round(v * 10) / 10;

  try {
    // Dynamic: Oct–Dec → next year, Jan–Sep → this year (matches NBA season convention)
    // Evaluate at invocation time to avoid module-load season freeze.
    const runStartedAt = new Date().toISOString();
    const CURRENT_SEASON = new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear();
    console.log("[refresh-nba-stats][1] Starting active players fetch", { source: "edge-refresh", reason: "scheduled", season: CURRENT_SEASON });
    // 1. Get all active players (~6 API calls, sorted by id for stable ordering)
    const allPlayers: BDLPlayer[] = [];
    let cursor: number | undefined;
    do {
      const qs = `per_page=100${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await fetchRaw(`${API_BASE}/players/active?${qs}`);
      allPlayers.push(...(res.data || []));
      cursor = res.meta?.next_cursor;
      await new Promise(r => setTimeout(r, 300));
    } while (cursor);

    console.log(`[refresh-nba-stats][2] Got ${allPlayers.length} active players`, { source: "edge-refresh", reason: "scheduled" });
    if (allPlayers.length === 0) {
      return new Response(JSON.stringify({ status: "no_players" }), { headers: { "Content-Type": "application/json" } });
    }

    // Sort by player id for stable, consistent batching across runs
    allPlayers.sort((a, b) => a.id - b.id);
    const playerMap = new Map<number, BDLPlayer>();
    for (const p of allPlayers) playerMap.set(p.id, p);
    const playerIds = allPlayers.map(p => p.id);

    // 2. Read cursor from DB to know which batch to process this run
    console.log("[3] Reading stats_cursor");
    let startIndex = 0;
    try {
      const result = await supabase
        .from("stats_cursor")
        .select("player_index")
        .eq("id", 1)
        .single();
      console.log("[3a] cursor result:", JSON.stringify(result));
      startIndex = result.data?.player_index ?? 0;
    } catch (e) { console.log("[3b] cursor error (ok):", (e as Error)?.message); }
    const batchPlayerIds = playerIds.slice(startIndex, startIndex + BATCH_SIZE);
    const nextIndex = (startIndex + BATCH_SIZE) >= playerIds.length ? 0 : startIndex + BATCH_SIZE;

    console.log(`[4] Batch: startIndex=${startIndex}, players=${batchPlayerIds.length}`);
    // 3. Fetch season averages sequentially at 1 req/sec for this batch
    //    BDL season_averages fields: pts, reb, ast, stl, blk, min ("MM:SS"),
    //    fg3m, turnover (not tov!), fgm, fga, fg3a, ftm, fta,
    //    fg_pct, fg3_pct, ft_pct, games_played
    const seasonAvgMap = new Map<number, SeasonAvg>();
    for (const playerId of batchPlayerIds) {
      try {
        const res = await fetchRaw(`${API_BASE}/season_averages?season=${CURRENT_SEASON}&player_id=${playerId}`);
        for (const avg of res.data || []) seasonAvgMap.set(avg.player_id, avg);
      } catch { /* skip, will retry next cycle */ }
      await new Promise(r => setTimeout(r, REQ_DELAY_MS));
    }

    // 4. Fetch current injuries (1 API call)
    const injuryMap = new Map<number, string>();
    try {
      const injRes = await fetchRaw(`${API_BASE}/player_injuries?per_page=100`);
      for (const inj of injRes.data || []) injuryMap.set(inj.player.id, inj.status);
    } catch { /* non-fatal */ }

    // 5. Build rows for this batch
    const rows: Record<string, number | string | null>[] = [];

    for (const [playerId, avg] of seasonAvgMap.entries()) {
      const player = playerMap.get(playerId);
      const gp = avg.games_played || avg.gp || 0;
      if (!player || gp === 0) continue;

      const minRaw = avg.min || "0";
      const minNum = typeof minRaw === "string"
        ? parseFloat(minRaw.replace(":", ".")) || 0
        : (minRaw || 0);

      const avgObj = {
        pts: avg.pts ?? 0, fgm: avg.fgm ?? 0, fga: avg.fga ?? 0,
        fg3m: avg.fg3m ?? 0, ftm: avg.ftm ?? 0, fta: avg.fta ?? 0,
        reb: avg.reb ?? 0, ast: avg.ast ?? 0,
        stl: avg.stl ?? 0, blk: avg.blk ?? 0,
        tov: avg.turnover ?? 0,
      };
      const fptsAvg = r1(calcFpts(avgObj));

      rows.push({
        player_id: playerId,
        name: `${player.first_name} ${player.last_name}`,
        team: player.team?.abbreviation || "N/A",
        position: player.position || "N/A",
        games_played: gp,
        min_avg: minNum,            pts_avg: numOrNull(avg.pts),    reb_avg: numOrNull(avg.reb),
        ast_avg: numOrNull(avg.ast),      stl_avg: numOrNull(avg.stl),    blk_avg: numOrNull(avg.blk),
        tov_avg: numOrNull(avg.turnover), fgm_avg: numOrNull(avg.fgm),    fga_avg: numOrNull(avg.fga),
        fg3m_avg: numOrNull(avg.fg3m),    fg3a_avg: numOrNull(avg.fg3a),
        ftm_avg: numOrNull(avg.ftm),      fta_avg: numOrNull(avg.fta),
        fg_pct:  avg.fg_pct  ? r1(avg.fg_pct  * 100) : 0,
        fg3_pct: avg.fg3_pct ? r1(avg.fg3_pct * 100) : 0,
        ft_pct:  avg.ft_pct  ? r1(avg.ft_pct  * 100) : 0,
        min_total:  r1(minNum * gp),             pts_total:  r1((avg.pts || 0) * gp),
        reb_total:  r1((avg.reb || 0) * gp),     ast_total:  r1((avg.ast || 0) * gp),
        stl_total:  r1((avg.stl || 0) * gp),     blk_total:  r1((avg.blk || 0) * gp),
        tov_total:  r1((avg.turnover || 0) * gp), fgm_total: r1((avg.fgm || 0) * gp),
        fga_total:  r1((avg.fga || 0) * gp),     fg3m_total: r1((avg.fg3m || 0) * gp),
        fg3a_total: r1((avg.fg3a || 0) * gp),    ftm_total:  r1((avg.ftm || 0) * gp),
        fta_total:  r1((avg.fta || 0) * gp),
        fpts: r1(fptsAvg * gp), fpts_avg: fptsAvg,
        injury: injuryMap.get(playerId) ?? null,
        updated_at: new Date().toISOString(),
      });
    }

    console.log(`[refresh-nba-stats][5] Built ${rows.length} rows for upsert`, { source: "edge-refresh", reason: "scheduled", season: CURRENT_SEASON, batch: `${Math.floor(startIndex / BATCH_SIZE) + 1}` });

    const existingById = new Map<number, Record<string, number | string | null>>();
    if (rows.length > 0) {
      const { data: existingRows } = await supabase
        .from("player_stats_cache")
        .select("*")
        .in("player_id", rows.map((r) => Number(r.player_id)));
      for (const row of (existingRows ?? [])) existingById.set(row.player_id, row);
    }

    const mergedRows = rows
      .map((row) => {
        const existing = existingById.get(Number(row.player_id));
        if (!existing) return row;
        if (existing.updated_at && String(existing.updated_at) > runStartedAt) return null;

        return {
          ...row,
          pts_avg: withFallback((row.pts_avg as number | null), existing.pts_avg as number | null | undefined),
          reb_avg: withFallback((row.reb_avg as number | null), existing.reb_avg as number | null | undefined),
          ast_avg: withFallback((row.ast_avg as number | null), existing.ast_avg as number | null | undefined),
          stl_avg: withFallback((row.stl_avg as number | null), existing.stl_avg as number | null | undefined),
          blk_avg: withFallback((row.blk_avg as number | null), existing.blk_avg as number | null | undefined),
          tov_avg: withFallback((row.tov_avg as number | null), existing.tov_avg as number | null | undefined),
          fgm_avg: withFallback((row.fgm_avg as number | null), existing.fgm_avg as number | null | undefined),
          fga_avg: withFallback((row.fga_avg as number | null), existing.fga_avg as number | null | undefined),
          fg3m_avg: withFallback((row.fg3m_avg as number | null), existing.fg3m_avg as number | null | undefined),
          fg3a_avg: withFallback((row.fg3a_avg as number | null), existing.fg3a_avg as number | null | undefined),
          ftm_avg: withFallback((row.ftm_avg as number | null), existing.ftm_avg as number | null | undefined),
          fta_avg: withFallback((row.fta_avg as number | null), existing.fta_avg as number | null | undefined),
        };
      })
      .filter((row): row is Record<string, number | string | null> => row !== null);

    // 6. Upsert in chunks of 10 to isolate any failing rows
    let upsertErrors = 0;
    for (let i = 0; i < mergedRows.length; i += 10) {
      const chunk = mergedRows.slice(i, i + 10);
      try {
        const upsertRes = await supabase
          .from("player_stats_cache")
          .upsert(chunk, { onConflict: "player_id" })
          .select("player_id");
        if (upsertRes?.error) {
          console.error(`[6-err] chunk ${i}-${i+10}: ${JSON.stringify(upsertRes.error)}`);
          upsertErrors++;
        } else {
          console.log(`[6-ok] chunk ${i}-${i+10} upserted ${upsertRes?.data?.length} rows`);
        }
      } catch (e) {
        console.error(`[6-throw] chunk ${i}-${i+10}: ${(e as Error)?.message}`);
        upsertErrors++;
      }
    }
    console.log(`[refresh-nba-stats][7] Upsert complete`, { source: "edge-refresh", reason: "scheduled", rowsAttempted: mergedRows.length, upsertErrors });

    try {
      await supabase
        .from("stats_cursor")
        .upsert({ id: 1, player_index: nextIndex, last_run_at: new Date().toISOString() });
    } catch { /* table may not exist yet */ }

    const totalBatches = Math.ceil(playerIds.length / BATCH_SIZE);
    const batchNum = Math.floor(startIndex / BATCH_SIZE) + 1;

    return new Response(
      JSON.stringify({
        status: "success",
        batch: `${batchNum}/${totalBatches}`,
        players_in_batch: batchPlayerIds.length,
        players_updated: rows.length,
        next_index: nextIndex,
        season: CURRENT_SEASON,
        updated_at: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("refresh-nba-stats error:", err);
    return new Response(JSON.stringify({ status: "error", message: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
