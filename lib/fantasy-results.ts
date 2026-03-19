import type { DailyLineupMap, LeagueMember } from "./store.ts";
import { getCanonicalMatchupsForWeek } from "./fantasy-schedule.ts";
import { getWeeklyMatchupScoreByIds, type DateStatsMap, type PlayerGameStats } from "./fantasy-scoring.ts";
import { getWeeklyMatchupResult, type WeeklyMatchupResult } from "./fantasy-standings.ts";
import { getScoringWeekRange, getWeekStatus } from "./week-utils.ts";

export type PlayerStatsByIdResolver = (playerId: string, dateStr: string) => PlayerGameStats | null;

export function buildPlayerStatsResolver(
  weekDayStats: Record<string, DateStatsMap>,
  playerNamesById: Map<string, string>,
): PlayerStatsByIdResolver {
  return (playerId: string, dateStr: string) => {
    const dayMap = weekDayStats[dateStr];
    if (!dayMap) return null;
    if (dayMap[playerId]) return dayMap[playerId];
    const playerName = playerNamesById.get(playerId);
    if (!playerName) return null;
    for (const [candidateId, stats] of Object.entries(dayMap)) {
      if (playerNamesById.get(candidateId) === playerName) return stats;
    }
    return null;
  };
}

export function computeLeagueWeeklyResults(input: {
  members: LeagueMember[];
  leagueId: string;
  leagueStart: Date | null;
  totalWeeks: number;
  lineupsByUserId: Record<string, DailyLineupMap>;
  resolvePlayerStats: PlayerStatsByIdResolver;
  today?: Date | string;
}): WeeklyMatchupResult[] {
  const { members, leagueId, leagueStart, totalWeeks, lineupsByUserId, resolvePlayerStats, today = new Date() } = input;
  const results: WeeklyMatchupResult[] = [];

  for (let week = 1; week <= totalWeeks; week += 1) {
    const status = getWeekStatus(week, leagueStart, today);
    if (status !== "past") continue;
    const range = getScoringWeekRange(week, leagueStart);
    if (!range) continue;
    for (const matchup of getCanonicalMatchupsForWeek(members, leagueId, week, leagueStart, today)) {
      const homeScore = getWeeklyMatchupScoreByIds(lineupsByUserId[matchup.home.user_id] || {}, range.dateStrings, resolvePlayerStats);
      const awayScore = getWeeklyMatchupScoreByIds(lineupsByUserId[matchup.away.user_id] || {}, range.dateStrings, resolvePlayerStats);
      results.push(getWeeklyMatchupResult(matchup, homeScore, awayScore));
    }
  }

  return results;
}
