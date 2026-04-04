export const dynamic = "force-dynamic";
// app/api/compare-stats/route.ts
//
// ═══════════════════════════════════════════════════════════════
// REFRESH OWNERSHIP MODEL
// ═══════════════════════════════════════════════════════════════
// ROLE: on-demand BDL reader for comparison data — not a cache writer
//       for season-level stats (that is the edge function's job).
//
// This route always calls BDL for game logs. There is no scheduled
// refresher for comparison data — each request fetches what it needs.
// Season averages are read from player_stats_cache (cache-first).
// Game logs for last7/last15/stability are always fetched live from BDL.
//
// Timeframe strategies:
//   season     — reads player_stats_cache (cache-first) + BDL game logs for stability
//   last7      — BDL game logs for past 7 days (always live)
//   last15     — BDL game logs for past 15 days (always live)
//   lastSeason — ALL_PLAYERS static snapshot + heuristic stability (no BDL)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentSeasonYear } from "@/lib/season";
import { getPlayerStats, parseMinutes } from "@/lib/balldontlie";
import type { BDLGameStats } from "@/lib/balldontlie";
import { calcFantasyPoints, ESPN_DEFAULT_WEIGHTS } from "@/lib/scoring-config";
import { addUtcDays, formatDateStr } from "@/lib/week-utils";
import { getScheduleMock } from "@/lib/schedule-mock";
import { computeStabilityFromLogs, estimateStabilityHeuristic } from "@/lib/compare-engine";
import { generateCompareResult } from "@/lib/compare-engine";
import type { CompareStats, CompareApiResponse, GameLog, Timeframe } from "@/lib/compare-types";
import { getCanonicalPlayerPosition } from "@/lib/player-metadata";

// Import ALL_PLAYERS for lastSeason fallback
import { ALL_PLAYERS } from "@/lib/players-data";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"
);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function r1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Fetch all game stat entries for given player IDs + date/season range */
async function fetchGameLogs(
  playerIds: number[],
  options: { start_date?: string; end_date?: string; seasons?: number[] },
  reason: "season_stability" | "date_range"
): Promise<Map<number, GameLog[]>> {
  const logMap = new Map<number, GameLog[]>();
  playerIds.forEach(id => logMap.set(id, []));

  const context = options.seasons
    ? { seasons: options.seasons }
    : { start_date: options.start_date, end_date: options.end_date };
  console.log("[compare-stats] BDL game logs fetch starting", { source: "api-compare-stats", reason, playerIds, ...context });

  let cursor: number | undefined;
  let totalRows = 0;
  do {
    try {
      const res = await getPlayerStats({
        player_ids: playerIds,
        per_page: 100,
        cursor,
        ...options,
      });

      totalRows += (res.data as BDLGameStats[]).length;
      for (const stat of res.data as BDLGameStats[]) {
        const pid = stat.player.id;
        if (!logMap.has(pid)) continue;
        const min = parseMinutes(stat.min);
        if (min === 0 && stat.pts === 0) continue; // skip DNP stubs
        const fpts = calcFantasyPoints({
          pts:  stat.pts     || 0,
          fgm:  stat.fgm     || 0,
          fga:  stat.fga     || 0,
          fg3m: stat.fg3m    || 0,
          ftm:  stat.ftm     || 0,
          fta:  stat.fta     || 0,
          reb:  stat.reb     || 0,
          ast:  stat.ast     || 0,
          stl:  stat.stl     || 0,
          blk:  stat.blk     || 0,
          tov:  stat.turnover || 0,
        }, ESPN_DEFAULT_WEIGHTS);

        logMap.get(pid)!.push({
          date: stat.game.date.slice(0, 10),
          fpts: r1(fpts),
          pts: stat.pts || 0,
          reb: stat.reb || 0,
          ast: stat.ast || 0,
          stl: stat.stl || 0,
          blk: stat.blk || 0,
          fg3m: stat.fg3m || 0,
          tov: stat.turnover || 0,
          min: r1(min),
          fgm: stat.fgm || 0,
          fga: stat.fga || 0,
          ftm: stat.ftm || 0,
          fta: stat.fta || 0,
          played: min > 0,
        });
      }
      cursor = res.meta?.next_cursor;
    } catch (err) {
      console.error("[compare-stats] BDL game logs page error", { source: "api-compare-stats", reason, playerIds, error: err });
      cursor = undefined;
    }
  } while (cursor);

  const totalGameLogs = Array.from(logMap.values()).reduce((sum, logs) => sum + logs.length, 0);
  console.log("[compare-stats] BDL game logs fetch complete", { source: "api-compare-stats", reason, playerIds, bdlRowsFetched: totalRows, validGameLogs: totalGameLogs });

  // Sort each player's logs chronologically
  logMap.forEach(logs => logs.sort((a, b) => a.date.localeCompare(b.date)));
  return logMap;
}

/** Aggregate raw game logs into per-game averages */
function aggregateLogs(logs: GameLog[]): {
  gp: number;
  totalFpts: number;
  fptsPerGame: number;
  ppg: number; rpg: number; apg: number; spg: number; bpg: number;
  fg3mPg: number; fgmPg: number; fgaPg: number; ftmPg: number; ftaPg: number;
  tov: number; mpg: number;
  fgPct: number; ftPct: number; fg3Pct: number;
} {
  const played = logs.filter(l => l.played);
  const gp = played.length;
  if (gp === 0) {
    return { gp: 0, totalFpts: 0, fptsPerGame: 0, ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fg3mPg: 0, fgmPg: 0, fgaPg: 0, ftmPg: 0, ftaPg: 0, tov: 0, mpg: 0, fgPct: 0, ftPct: 0, fg3Pct: 0 };
  }

  let totFpts = 0, totPts = 0, totReb = 0, totAst = 0, totStl = 0, totBlk = 0;
  let totFg3m = 0, totTov = 0, totMin = 0;
  let totFgm = 0, totFga = 0, totFtm = 0, totFta = 0, totFg3a = 0;

  for (const l of played) {
    totFpts += l.fpts; totPts += l.pts; totReb += l.reb; totAst += l.ast;
    totStl += l.stl;   totBlk += l.blk; totFg3m += l.fg3m; totTov += l.tov;
    totMin += l.min;   totFgm += l.fgm; totFga += l.fga;   totFtm += l.ftm;
    totFta += l.fta;   totFg3a += (l as any).fg3a || 0;
  }

  return {
    gp,
    totalFpts: r1(totFpts),
    fptsPerGame: r1(totFpts / gp),
    ppg: r1(totPts / gp),
    rpg: r1(totReb / gp),
    apg: r1(totAst / gp),
    spg: r1(totStl / gp),
    bpg: r1(totBlk / gp),
    fg3mPg: r1(totFg3m / gp),
    fgmPg: r1(totFgm / gp),
    fgaPg: r1(totFga / gp),
    ftmPg: r1(totFtm / gp),
    ftaPg: r1(totFta / gp),
    tov: r1(totTov / gp),
    mpg: r1(totMin / gp),
    fgPct: totFga > 0 ? Math.round((totFgm / totFga) * 1000) / 10 : 0,
    ftPct: totFta > 0 ? Math.round((totFtm / totFta) * 1000) / 10 : 0,
    fg3Pct: totFg3a > 0 ? Math.round((totFg3m / totFg3a) * 1000) / 10 : 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Strategy: season — read from player_stats_cache
// ─────────────────────────────────────────────────────────────

async function buildSeasonStats(playerIds: number[], timeframe: Timeframe): Promise<CompareStats[]> {
  const { data: rows, error } = await supabase
    .from("player_stats_cache")
    .select("*")
    .in("player_id", playerIds);

  if (error || !rows || rows.length === 0) {
    throw new Error("player_stats_cache unavailable");
  }

  // Resolve season at request time (never at module scope — avoids freeze on long-running instances)
  const CURRENT_SEASON = getCurrentSeasonYear();
  // Fetch game logs for stability (season games) — parallel for both players
  const logMap = await fetchGameLogs(playerIds, { seasons: [CURRENT_SEASON] }, "season_stability");

  return rows.map((row: any) => {
    const logs = logMap.get(row.player_id) ?? [];
    const stability = logs.length >= 3
      ? computeStabilityFromLogs(logs, row.fpts_avg ?? 0)
      : estimateStabilityHeuristic(row.fpts_avg ?? 0, row.min_avg ?? 30);

    const gp = row.games_played ?? 0;
    const schedule = getScheduleMock(row.team ?? "");

    return {
      playerId: String(row.player_id),
      playerName: row.name,
      team: row.team,
      position: getCanonicalPlayerPosition(row.name, row.position),
      timeframe,
      dataSource: 'cache' as const,

      fptsPerGame: r1(row.fpts_avg ?? 0),
      totalFpts: r1(row.fpts ?? 0),
      ppg: r1(row.pts_avg ?? 0),
      rpg: r1(row.reb_avg ?? 0),
      apg: r1(row.ast_avg ?? 0),
      spg: r1(row.stl_avg ?? 0),
      bpg: r1(row.blk_avg ?? 0),
      fg3mPg: r1(row.fg3m_avg ?? 0),
      fgmPg: r1(row.fgm_avg ?? 0),
      fgaPg: r1(row.fga_avg ?? 0),
      ftmPg: r1(row.ftm_avg ?? 0),
      ftaPg: r1(row.fta_avg ?? 0),
      tov: r1(row.tov_avg ?? 0),
      mpg: r1(row.min_avg ?? 0),
      gp,
      fgPct: row.fg_pct ?? 0,
      ftPct: row.ft_pct ?? 0,
      fg3Pct: row.fg3_pct ?? 0,

      recentTrend: stability.recentTrend,
      last5FptsAvg: stability.last5FptsAvg,
      trendDelta: stability.trendDelta,

      consistencyScore: stability.consistencyScore,
      stdDev: stability.stdDev,
      floor: stability.floor,
      ceiling: stability.ceiling,
      boomRate: stability.boomRate,
      bustRate: stability.bustRate,

      gamesPlayed: gp,
      gamesAvailable: gp,          // for season, gamesAvailable = gamesPlayed
      playRate: 1,                  // full season participants all played
      injuryStatus: row.injury ?? null,

      next7Games: schedule.games,
      scheduleRating: schedule.rating,
      gameLogs: logs,
    } satisfies CompareStats;
  });
}

// ─────────────────────────────────────────────────────────────
// Strategy: last7 / last15 — BDL date range
// ─────────────────────────────────────────────────────────────

async function buildDateRangeStats(playerIds: number[], timeframe: 'last7' | 'last15', referenceDate: string): Promise<CompareStats[]> {
  const days = timeframe === 'last7' ? 7 : 15;
  const startDate = formatDateStr(addUtcDays(referenceDate, -days));

  const logMap = await fetchGameLogs(playerIds, { start_date: startDate, end_date: referenceDate }, "date_range");

  // We need player identity from player_stats_cache (team, position, injury, name)
  const { data: cacheRows } = await supabase
    .from("player_stats_cache")
    .select("player_id, name, team, position, injury")
    .in("player_id", playerIds);

  const identityMap = new Map<number, { name: string; team: string; position: string; injury: string | null }>();
  for (const row of (cacheRows ?? [])) {
    identityMap.set(row.player_id, { name: row.name, team: row.team, position: row.position, injury: row.injury ?? null });
  }

  return playerIds.map(pid => {
    const logs = logMap.get(pid) ?? [];
    const agg = aggregateLogs(logs);
    const stability = computeStabilityFromLogs(logs, agg.fptsPerGame);
    const identity = identityMap.get(pid);
    const schedule = getScheduleMock(identity?.team ?? "");

    const gamesAvailable = days; // rough estimate; real value would need team schedule API

    return {
      playerId: String(pid),
      playerName: identity?.name ?? `Player ${pid}`,
      team: identity?.team ?? "N/A",
      position: getCanonicalPlayerPosition(identity?.name ?? `Player ${pid}`, identity?.position ?? "N/A"),
      timeframe,
      dataSource: 'live' as const,

      fptsPerGame: agg.fptsPerGame,
      totalFpts: agg.totalFpts,
      ppg: agg.ppg,
      rpg: agg.rpg,
      apg: agg.apg,
      spg: agg.spg,
      bpg: agg.bpg,
      fg3mPg: agg.fg3mPg,
      fgmPg: agg.fgmPg,
      fgaPg: agg.fgaPg,
      ftmPg: agg.ftmPg,
      ftaPg: agg.ftaPg,
      tov: agg.tov,
      mpg: agg.mpg,
      gp: agg.gp,
      fgPct: agg.fgPct,
      ftPct: agg.ftPct,
      fg3Pct: agg.fg3Pct,

      recentTrend: stability.recentTrend,
      last5FptsAvg: stability.last5FptsAvg,
      trendDelta: stability.trendDelta,

      consistencyScore: stability.consistencyScore,
      stdDev: stability.stdDev,
      floor: stability.floor,
      ceiling: stability.ceiling,
      boomRate: stability.boomRate,
      bustRate: stability.bustRate,

      gamesPlayed: agg.gp,
      gamesAvailable,
      playRate: gamesAvailable > 0 ? r1(agg.gp / gamesAvailable) : 0,
      injuryStatus: identity?.injury ?? null,

      next7Games: schedule.games,
      scheduleRating: schedule.rating,
      gameLogs: logs,
    } satisfies CompareStats;
  });
}

// ─────────────────────────────────────────────────────────────
// Strategy: lastSeason — ALL_PLAYERS static data
// ─────────────────────────────────────────────────────────────

function buildLastSeasonStats(playerIds: number[], cacheNames: Map<number, string>): CompareStats[] {
  return playerIds.map(pid => {
    // Try name lookup: match by BDL numeric ID if stored, or fall back to name
    const cachedName = cacheNames.get(pid) ?? "";
    const staticPlayer = ALL_PLAYERS.find(p =>
      p.name.toLowerCase() === cachedName.toLowerCase()
    ) ?? ALL_PLAYERS[0]; // ultimate fallback

    const fptsPerGame = r1(
      staticPlayer.ppg                  * ESPN_DEFAULT_WEIGHTS.pts  +
      staticPlayer.rpg                  * ESPN_DEFAULT_WEIGHTS.reb  +
      staticPlayer.apg                  * ESPN_DEFAULT_WEIGHTS.ast  +
      staticPlayer.spg                  * ESPN_DEFAULT_WEIGHTS.stl  +
      staticPlayer.bpg                  * ESPN_DEFAULT_WEIGHTS.blk  +
      ((staticPlayer as any).fg3m || 0) * ESPN_DEFAULT_WEIGHTS.fg3m +
      staticPlayer.tov                  * ESPN_DEFAULT_WEIGHTS.tov
      // fgm/fga/ftm/fta not available in static lastSeason data → 0
    );

    const stability = estimateStabilityHeuristic(fptsPerGame, (staticPlayer as any).mpg ?? 32);
    const schedule = getScheduleMock(staticPlayer.team);

    return {
      playerId: String(pid),
      playerName: staticPlayer.name,
      team: staticPlayer.team,
      position: getCanonicalPlayerPosition(staticPlayer.name, staticPlayer.position),
      timeframe: 'lastSeason',
      dataSource: 'static' as const,

      fptsPerGame,
      totalFpts: r1(fptsPerGame * staticPlayer.gp),
      ppg: staticPlayer.ppg,
      rpg: staticPlayer.rpg,
      apg: staticPlayer.apg,
      spg: staticPlayer.spg,
      bpg: staticPlayer.bpg,
      fg3mPg: (staticPlayer as any).fg3m ?? 0,
      fgmPg: 0,
      fgaPg: 0,
      ftmPg: 0,
      ftaPg: 0,
      tov: staticPlayer.tov,
      mpg: (staticPlayer as any).mpg ?? 0,
      gp: staticPlayer.gp,
      fgPct: staticPlayer.fg,
      ftPct: staticPlayer.ft,
      fg3Pct: (staticPlayer as any).fg3pct ?? 0,

      recentTrend: stability.recentTrend,
      last5FptsAvg: stability.last5FptsAvg,
      trendDelta: stability.trendDelta,

      consistencyScore: stability.consistencyScore,
      stdDev: stability.stdDev,
      floor: stability.floor,
      ceiling: stability.ceiling,
      boomRate: stability.boomRate,
      bustRate: stability.bustRate,

      gamesPlayed: staticPlayer.gp,
      gamesAvailable: 82,
      playRate: r1(staticPlayer.gp / 82),
      injuryStatus: staticPlayer.injury ?? null,

      next7Games: schedule.games,
      scheduleRating: schedule.rating,
      gameLogs: [],
    } satisfies CompareStats;
  });
}

// ─────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse<CompareApiResponse>> {
  const { searchParams } = request.nextUrl;
  const playersParam = searchParams.get("players") ?? "";
  const timeframe = (searchParams.get("timeframe") ?? "season") as Timeframe;
  const dateParam = searchParams.get("date") ?? formatDateStr(new Date());

  const rawIds = playersParam.split(",").map(s => s.trim()).filter(Boolean);
  if (rawIds.length < 2) {
    return NextResponse.json({ status: "error", message: "Provide at least 2 player IDs via ?players=id1,id2" }, { status: 400 });
  }

  const playerIds = rawIds.map(Number).filter(n => !isNaN(n) && n > 0);

  let players: CompareStats[];
  let fromCache = false;

  try {
    if (timeframe === 'lastSeason') {
      // Look up cached names for identity matching
      const { data: cacheRows } = await supabase
        .from("player_stats_cache")
        .select("player_id, name")
        .in("player_id", playerIds);
      const cacheNames = new Map<number, string>((cacheRows ?? []).map((r: any) => [r.player_id, r.name]));
      players = buildLastSeasonStats(playerIds, cacheNames);
      fromCache = false;
    } else if (timeframe === 'last7' || timeframe === 'last15') {
      players = await buildDateRangeStats(playerIds, timeframe, dateParam);
    } else {
      // season
      players = await buildSeasonStats(playerIds, timeframe);
      fromCache = true;
    }
  } catch (err) {
    // Fallback: try season cache
    console.warn("[compare-stats] Primary fetch failed, falling back to season cache:", err);
    try {
      players = await buildSeasonStats(playerIds, timeframe);
      fromCache = true;
    } catch (fallbackErr) {
      console.error("[compare-stats] Fallback also failed:", fallbackErr);
      return NextResponse.json({ status: "error", message: "Unable to fetch player stats. Please try again." }, { status: 500 });
    }
  }

  // Ensure we have stats for all requested players (fill gaps with static fallback)
  if (players.length < playerIds.length) {
    const { data: cacheRows } = await supabase
      .from("player_stats_cache")
      .select("player_id, name")
      .in("player_id", playerIds);
    const cacheNames = new Map<number, string>((cacheRows ?? []).map((r: any) => [r.player_id, r.name]));
    const foundIds = new Set(players.map(p => Number(p.playerId)));
    const missingIds = playerIds.filter(id => !foundIds.has(id));
    const fallback = buildLastSeasonStats(missingIds, cacheNames);
    players.push(...fallback);
  }

  const analysis = generateCompareResult(players);

  const result = {
    ...analysis,
    players,
    meta: { timeframe, date: dateParam, fromCache },
  };

  return NextResponse.json({ status: "success", result });
}
