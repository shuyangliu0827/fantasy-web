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
export type PlayerIdStatsResolver = (playerId: string, dateStr: string) => PlayerGameStats | null;

export function normalizeLineup(lineup?: LineupMap | null): LineupMap {
  if (!lineup || typeof lineup !== "object") return {};
  return Object.fromEntries(Object.entries(lineup).filter(([slot, playerId]) => Boolean(playerId) && typeof slot === "string"));
}

export function getStarterIdsForDate(dailyLineups: DailyLineupMap | undefined, dateStr: string): Set<string> {
  const lineup = normalizeLineup(dailyLineups?.[dateStr]);
  const starterIds = new Set<string>();
  for (const [slot, playerId] of Object.entries(lineup)) {
    if (VALID_ACTIVE_STARTER_SLOTS.has(slot) && playerId) starterIds.add(playerId);
  }
  return starterIds;
}

export function getWeeklyStarterIds(dailyLineups: DailyLineupMap | undefined, dateStrings: string[]): Set<string> {
  const starterIds = new Set<string>();
  for (const dateStr of dateStrings) {
    for (const playerId of getStarterIdsForDate(dailyLineups, dateStr)) starterIds.add(playerId);
  }
  return starterIds;
}

export function getDailyStarterScoreByIds(
  dailyLineups: DailyLineupMap | undefined,
  dateStr: string,
  resolvePlayerStats: PlayerIdStatsResolver,
): number {
  let total = 0;
  for (const playerId of getStarterIdsForDate(dailyLineups, dateStr)) {
    total += resolvePlayerStats(playerId, dateStr)?.fpts ?? 0;
  }
  return total;
}

export function getDailyStarterScore(
  roster: RosterPlayer[],
  dailyLineups: DailyLineupMap | undefined,
  dateStr: string,
  resolvePlayerStats: PlayerStatsResolver,
): number {
  const rosterById = new Map(roster.map((player) => [player.id, player]));
  return getDailyStarterScoreByIds(dailyLineups, dateStr, (playerId, day) => {
    const player = rosterById.get(playerId);
    return player ? resolvePlayerStats(player, day) : null;
  });
}

export function getWeeklyMatchupScoreByIds(
  dailyLineups: DailyLineupMap | undefined,
  dateStrings: string[],
  resolvePlayerStats: PlayerIdStatsResolver,
): number {
  return dateStrings.reduce((total, dateStr) => total + getDailyStarterScoreByIds(dailyLineups, dateStr, resolvePlayerStats), 0);
}

export function getWeeklyMatchupScore(
  roster: RosterPlayer[],
  dailyLineups: DailyLineupMap | undefined,
  dateStrings: string[],
  resolvePlayerStats: PlayerStatsResolver,
): number {
  return dateStrings.reduce((total, dateStr) => total + getDailyStarterScore(roster, dailyLineups, dateStr, resolvePlayerStats), 0);
}

export function buildDailyScoreBreakdownByIds(
  dailyLineups: DailyLineupMap | undefined,
  dateStrings: string[],
  resolvePlayerStats: PlayerIdStatsResolver,
): Record<string, number> {
  return Object.fromEntries(dateStrings.map((dateStr) => [dateStr, getDailyStarterScoreByIds(dailyLineups, dateStr, resolvePlayerStats)]));
}

export function buildDailyScoreBreakdown(
  roster: RosterPlayer[],
  dailyLineups: DailyLineupMap | undefined,
  dateStrings: string[],
  resolvePlayerStats: PlayerStatsResolver,
): Record<string, number> {
  return Object.fromEntries(dateStrings.map((dateStr) => [dateStr, getDailyStarterScore(roster, dailyLineups, dateStr, resolvePlayerStats)]));
}
