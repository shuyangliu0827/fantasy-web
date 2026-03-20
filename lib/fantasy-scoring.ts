import type { DailyLineupMap, LineupMap, RosterPlayer } from "./store";

export const CANONICAL_TIMEZONE = "UTC";
export const STARTER_SLOTS = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL1", "UTIL2", "UTIL3"] as const;
export const BENCH_SLOTS = ["BE1", "BE2", "BE3"] as const;
export const VALID_ACTIVE_STARTER_SLOTS = new Set<string>(STARTER_SLOTS);

export type PlayerGameStats = {
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

export type DateStatsMap = Record<string, PlayerGameStats>;
export type WeekDayStatsMap = Record<string, DateStatsMap>;
export type PlayerStatsResolver = (player: RosterPlayer, dateStr: string) => PlayerGameStats | null;

export function normalizeLineup(lineup?: LineupMap | null): LineupMap {
  if (!lineup || typeof lineup !== "object") return {};

  return Object.fromEntries(
    Object.entries(lineup).filter(([slot, playerId]) => Boolean(playerId) && typeof slot === "string")
  );
}

export function getStarterIdsForDate(dailyLineups: DailyLineupMap | undefined, dateStr: string): Set<string> {
  const lineup = normalizeLineup(dailyLineups?.[dateStr]);
  const starterIds = new Set<string>();

  for (const [slot, playerId] of Object.entries(lineup)) {
    if (VALID_ACTIVE_STARTER_SLOTS.has(slot) && playerId) {
      starterIds.add(playerId);
    }
  }

  return starterIds;
}


export function getWeeklyStarterIds(dailyLineups: DailyLineupMap | undefined, dateStrings: string[]): Set<string> {
  const starterIds = new Set<string>();

  for (const dateStr of dateStrings) {
    for (const playerId of getStarterIdsForDate(dailyLineups, dateStr)) {
      starterIds.add(playerId);
    }
  }

  return starterIds;
}

export function getDailyStarterScore(
  roster: RosterPlayer[],
  dailyLineups: DailyLineupMap | undefined,
  dateStr: string,
  resolvePlayerStats: PlayerStatsResolver,
): number {
  const starterIds = getStarterIdsForDate(dailyLineups, dateStr);
  if (starterIds.size === 0) return 0;

  return roster.reduce((total, player) => {
    if (!starterIds.has(player.id)) return total;
    return total + (resolvePlayerStats(player, dateStr)?.fpts ?? 0);
  }, 0);
}

export function getWeeklyMatchupScore(
  roster: RosterPlayer[],
  dailyLineups: DailyLineupMap | undefined,
  dateStrings: string[],
  resolvePlayerStats: PlayerStatsResolver,
): number {
  return dateStrings.reduce(
    (total, dateStr) => total + getDailyStarterScore(roster, dailyLineups, dateStr, resolvePlayerStats),
    0,
  );
}

export function buildDailyScoreBreakdown(
  roster: RosterPlayer[],
  dailyLineups: DailyLineupMap | undefined,
  dateStrings: string[],
  resolvePlayerStats: PlayerStatsResolver,
): Record<string, number> {
  return Object.fromEntries(
    dateStrings.map((dateStr) => [dateStr, getDailyStarterScore(roster, dailyLineups, dateStr, resolvePlayerStats)]),
  );
}

/**
 * For a past week, if a team's DailyLineupMap has no entries for any of the
 * requested weekDates (e.g. old flat-format lineup was migrated to today's
 * UTC date), fill each missing date with the nearest available lineup snapshot.
 *
 * Only call this for past/completed weeks — for current/future weeks a missing
 * lineup correctly scores 0.
 */
export function fillMissingWeekLineups(
  lineups: DailyLineupMap,
  weekDates: string[],
): DailyLineupMap {
  const hasAnyWeekEntry = weekDates.some(
    (d) => lineups[d] && Object.keys(lineups[d]).length > 0,
  );
  if (hasAnyWeekEntry) return lineups;

  const allDates = Object.keys(lineups).sort();
  if (allDates.length === 0) return lineups;

  // Prefer the latest date <= first day of the week; else use the earliest available.
  const weekStart = weekDates[0];
  const fallbackDate =
    allDates.filter((d) => d <= weekStart).pop() ?? allDates[0];
  const fallbackLineup = lineups[fallbackDate];

  const filled: DailyLineupMap = { ...lineups };
  for (const d of weekDates) {
    if (!filled[d]) filled[d] = fallbackLineup;
  }
  return filled;
}
