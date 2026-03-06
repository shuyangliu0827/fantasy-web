// app/api/nba-game-stats/route.ts
// Fetches individual player box score stats for a specific date from Ball Don't Lie API.
// Used to show actual game-day stats instead of season averages on the roster page.

import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.balldontlie.io/v1";
const API_KEY = "14fd7de0-c9c0-40d3-bbeb-e8c86a61d56a";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type PlayerGameStats = {
  min: number;
  fgm: number;
  fga: number;
  fg3m: number;
  ftm: number;
  fta: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pts: number;
  fpts: number;
};

// playerId -> stats
type DateStatsMap = Record<string, PlayerGameStats>;

// In-memory cache keyed by date
const cache = new Map<string, { data: DateStatsMap; timestamp: number }>();

const FANTASY_WEIGHTS = {
  pts: 1,
  reb: 1,
  ast: 1,
  stl: 2,
  blk: 2,
  fg3m: 1,
  tov: -1,
};

async function fetchAPI(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${API_BASE}${endpoint}`);
  if (params)
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: API_KEY },
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

async function fetchStatsForDate(date: string): Promise<DateStatsMap> {
  const cached = cache.get(date);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const map: DateStatsMap = {};
  let cursor: number | undefined;

  do {
    const params: Record<string, string> = {
      start_date: date,
      end_date: date,
      per_page: "100",
    };
    if (cursor) params.cursor = String(cursor);

    try {
      const res = await fetchAPI("/stats", params);
      for (const stat of res.data || []) {
        const minStr: string = stat.min || "0";
        const minNum =
          parseFloat(minStr.includes(":") ? minStr.replace(":", ".") : minStr) ||
          0;
        if (minNum === 0 && stat.pts === 0) continue;

        const playerId = String(stat.player.id);
        const fpts =
          (stat.pts || 0) * FANTASY_WEIGHTS.pts +
          (stat.reb || 0) * FANTASY_WEIGHTS.reb +
          (stat.ast || 0) * FANTASY_WEIGHTS.ast +
          (stat.stl || 0) * FANTASY_WEIGHTS.stl +
          (stat.blk || 0) * FANTASY_WEIGHTS.blk +
          (stat.fg3m || 0) * FANTASY_WEIGHTS.fg3m +
          (stat.turnover || 0) * FANTASY_WEIGHTS.tov;

        map[playerId] = {
          min: Math.round(minNum * 10) / 10,
          fgm: stat.fgm || 0,
          fga: stat.fga || 0,
          fg3m: stat.fg3m || 0,
          ftm: stat.ftm || 0,
          fta: stat.fta || 0,
          reb: stat.reb || 0,
          ast: stat.ast || 0,
          stl: stat.stl || 0,
          blk: stat.blk || 0,
          tov: stat.turnover || 0,
          pts: stat.pts || 0,
          fpts: Math.round(fpts * 10) / 10,
        };
      }
      cursor = res.meta?.next_cursor;
    } catch {
      cursor = undefined;
    }
  } while (cursor);

  cache.set(date, { data: map, timestamp: Date.now() });
  return map;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { status: "error", message: "date parameter is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    const stats = await fetchStatsForDate(date);
    return NextResponse.json({ status: "success", stats });
  } catch (err) {
    console.error("[nba-game-stats] Error:", err);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch game stats" },
      { status: 500 }
    );
  }
}
