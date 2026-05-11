// lib/nba-games.ts
//
// Shared helper for fetching NBA game schedule / opponent info from BDL.
// Imported by:
//   app/api/nba-games/route.ts  (public schedule endpoint)
//   app/api/contests/my-lineups/route.ts  (opponent display in lineup cards)
//
// In-memory 10-min TTL cache (same as original nba-games route).

const API_BASE = "https://api.balldontlie.io/v1";
const CACHE_TTL = 10 * 60 * 1000;

export type GameInfo = {
  opponent: string;
  isHome: boolean;
  status: string;
  homeScore: number;
  visitorScore: number;
  gameId: number;
};

export type TeamGamesMap = Record<string, Record<string, GameInfo>>;

let cache: { key: string; data: TeamGamesMap; timestamp: number } | null = null;

export async function fetchGamesForRange(startDate: string, endDate: string): Promise<TeamGamesMap> {
  const cacheKey = `${startDate}_${endDate}`;
  if (cache && cache.key === cacheKey && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  const apiKey = process.env.BDL_API_KEY ?? "";
  const map: TeamGamesMap = {};
  let cursor: number | undefined;
  let hadError = false;

  do {
    const url = new URL(`${API_BASE}/games`);
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);
    url.searchParams.set("per_page", "100");
    if (cursor) url.searchParams.set("cursor", String(cursor));

    try {
      const res = await fetch(url.toString(), { headers: { Authorization: apiKey } });
      if (!res.ok) { hadError = true; break; }
      const payload = await res.json();

      for (const game of payload.data || []) {
        const dateStr = game.date?.split("T")[0];
        if (!dateStr) continue;
        const home = game.home_team?.abbreviation;
        const away = game.visitor_team?.abbreviation;
        if (!home || !away) continue;

        if (!map[home]) map[home] = {};
        map[home][dateStr] = {
          opponent: away, isHome: true,
          status: game.status || "",
          homeScore: game.home_team_score || 0,
          visitorScore: game.visitor_team_score || 0,
          gameId: game.id,
        };

        if (!map[away]) map[away] = {};
        map[away][dateStr] = {
          opponent: home, isHome: false,
          status: game.status || "",
          homeScore: game.home_team_score || 0,
          visitorScore: game.visitor_team_score || 0,
          gameId: game.id,
        };
      }
      cursor = payload.meta?.next_cursor;
    } catch {
      hadError = true;
      break;
    }
  } while (cursor);

  if (!hadError) cache = { key: cacheKey, data: map, timestamp: Date.now() };
  return map;
}
