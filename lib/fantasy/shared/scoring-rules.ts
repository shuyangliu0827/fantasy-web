import type { DailyLineupMap, LineupMap, RosterPlayer } from "@/lib/shared/store";
import { calcFantasyPoints } from "./scoring-config";
import type { PointsWeights } from "./scoring-config";
export { CANONICAL_TIMEZONE, STARTER_SLOTS, BENCH_SLOTS } from "./week-utils";
import { VALID_ACTIVE_STARTER_SLOTS } from "./week-utils";

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
  weights?: PointsWeights,
): number {
  const starterIds = getStarterIdsForDate(dailyLineups, dateStr);
  if (starterIds.size === 0) return 0;

  return roster.reduce((total, player) => {
    if (!starterIds.has(player.id)) return total;
    const stats = resolvePlayerStats(player, dateStr);
    if (!stats) return total;
    return total + (weights ? calcFantasyPoints(stats, weights) : stats.fpts);
  }, 0);
}

export function getWeeklyMatchupScore(
  roster: RosterPlayer[],
  dailyLineups: DailyLineupMap | undefined,
  dateStrings: string[],
  resolvePlayerStats: PlayerStatsResolver,
  weights?: PointsWeights,
): number {
  return dateStrings.reduce(
    (total, dateStr) => total + getDailyStarterScore(roster, dailyLineups, dateStr, resolvePlayerStats, weights),
    0,
  );
}

/**
 * For a past week, recover lineups lost to flat-format migration.
 *
 * Old flat lineups (e.g. { PG: id, SG: id, ... }) were migrated to a single key for
 * today's date, so the stored map has no entries matching any historical week date.
 * When that happens, fill every week date with the nearest available snapshot so
 * scores are not silently zeroed out.
 *
 * IMPORTANT: only fills when the map has NO entries at all for the requested week.
 * If even one week date already has an entry, the team managed their lineup normally
 * and missing days are legitimate zeros — do not touch them.
 */
export function fillMissingWeekLineups(
  dailyLineups: DailyLineupMap,
  weekDates: string[],
): DailyLineupMap {
  if (weekDates.length === 0) return dailyLineups;

  // If the team has any entry for this week, their partial scores are intentional
  const hasAnyWeekEntry = weekDates.some((date) => {
    const l = dailyLineups[date];
    return l && Object.keys(l).length > 0;
  });
  if (hasAnyWeekEntry) return dailyLineups;

  // No entries for this week at all — find the closest available snapshot.
  // Only consider snapshots from on or before the week's last date: a snapshot
  // saved strictly after the week ended means the user joined/set lineups late,
  // so they should score 0 for this week (not get retroactive points).
  const weekEndDate = weekDates[weekDates.length - 1];
  const availableDates = Object.keys(dailyLineups)
    .filter((d) => {
      const l = dailyLineups[d];
      return l && Object.keys(l).length > 0 && d <= weekEndDate;
    })
    .sort();
  if (availableDates.length === 0) return dailyLineups;

  // Use the week's midpoint as the anchor for finding the nearest snapshot
  const anchor = weekDates[Math.floor(weekDates.length / 2)];
  let closest = availableDates[0];
  let minDist = Math.abs(new Date(closest).getTime() - new Date(anchor).getTime());
  for (const d of availableDates) {
    const dist = Math.abs(new Date(d).getTime() - new Date(anchor).getTime());
    if (dist < minDist) {
      minDist = dist;
      closest = d;
    }
  }

  const result: DailyLineupMap = { ...dailyLineups };
  for (const date of weekDates) {
    result[date] = dailyLineups[closest];
  }
  return result;
}

export function buildDailyScoreBreakdown(
  roster: RosterPlayer[],
  dailyLineups: DailyLineupMap | undefined,
  dateStrings: string[],
  resolvePlayerStats: PlayerStatsResolver,
  weights?: PointsWeights,
): Record<string, number> {
  return Object.fromEntries(
    dateStrings.map((dateStr) => [dateStr, getDailyStarterScore(roster, dailyLineups, dateStr, resolvePlayerStats, weights)]),
  );
}
