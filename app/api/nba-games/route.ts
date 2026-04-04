export const dynamic = "force-dynamic";
// app/api/nba-games/route.ts
//
// ═══════════════════════════════════════════════════════════════
// REFRESH OWNERSHIP MODEL
// ═══════════════════════════════════════════════════════════════
// ROLE: schedule reader — always reads from BDL (no DB cache layer)
//
// Schedule data (game dates, opponents, status) changes frequently and
// is not persisted to Supabase. This route uses an in-memory TTL cache
// (10 minutes) to avoid redundant BDL calls within the same instance.
// Every cache miss goes directly to BDL (schedule_lookup).
// ═══════════════════════════════════════════════════════════════
// Fetches NBA games for a date range from Ball Don't Lie API.
// Returns games indexed by team abbreviation and date for quick roster lookups.

import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.balldontlie.io/v1";
const API_KEY = process.env.BDL_API_KEY ?? "";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

type GameInfo = {
  opponent: string;
  isHome: boolean;
  status: string;
  homeScore: number;
  visitorScore: number;
  gameId: number;
};

type TeamGamesMap = Record<string, Record<string, GameInfo>>;

// In-memory cache
let cache: { key: string; data: TeamGamesMap; timestamp: number } | null = null;

function toNbaDateKey(isoDate: string): string | null {
  const raw = new Date(isoDate);
  if (Number.isNaN(raw.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(raw);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return null;
  return `${y}-${m}-${d}`;
}

async function fetchAPI(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${API_BASE}${endpoint}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const res = await fetch(url.toString(), { headers: { Authorization: API_KEY } });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

async function fetchGamesForRange(startDate: string, endDate: string): Promise<TeamGamesMap> {
  const cacheKey = `${startDate}_${endDate}`;

  if (cache && cache.key === cacheKey && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  console.log("[nba-games] BDL fetch starting", { source: "api-nba-games", reason: "schedule_lookup", startDate, endDate });

  const map: TeamGamesMap = {};
  let cursor: number | undefined;
  let totalGames = 0;

  do {
    const params: Record<string, string> = {
      start_date: startDate,
      end_date: endDate,
      per_page: "100",
    };
    if (cursor) params.cursor = String(cursor);

    try {
      const res = await fetchAPI("/games", params);
      totalGames += (res.data || []).length;
      for (const game of res.data || []) {
        const dateStr = game.date ? toNbaDateKey(game.date) : null;
        if (!dateStr) continue;

        const home = game.home_team?.abbreviation;
        const away = game.visitor_team?.abbreviation;
        if (!home || !away) continue;

        if (!map[home]) map[home] = {};
        map[home][dateStr] = {
          opponent: away,
          isHome: true,
          status: game.status || "",
          homeScore: game.home_team_score || 0,
          visitorScore: game.visitor_team_score || 0,
          gameId: game.id,
        };

        if (!map[away]) map[away] = {};
        map[away][dateStr] = {
          opponent: home,
          isHome: false,
          status: game.status || "",
          homeScore: game.home_team_score || 0,
          visitorScore: game.visitor_team_score || 0,
          gameId: game.id,
        };
      }
      cursor = res.meta?.next_cursor;
    } catch (err) {
      console.error("[nba-games] BDL fetch error", { source: "api-nba-games", reason: "schedule_lookup", startDate, endDate, error: err });
      cursor = undefined;
    }
  } while (cursor);

  console.log("[nba-games] BDL fetch complete", { source: "api-nba-games", reason: "schedule_lookup", startDate, endDate, gamesFound: totalGames, teamsCovered: Object.keys(map).length });
  cache = { key: cacheKey, data: map, timestamp: Date.now() };
  return map;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { status: "error", message: "start_date and end_date are required" },
      { status: 400 }
    );
  }

  try {
    const games = await fetchGamesForRange(startDate, endDate);
    return NextResponse.json({ status: "success", games });
  } catch (err) {
    console.error("[nba-games] Error:", err);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch games" },
      { status: 500 }
    );
  }
}
