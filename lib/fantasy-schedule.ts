import type { LeagueMember } from "./store.ts";
import { getScoringWeekRange, getWeekStatus } from "./week-utils.ts";

export type CanonicalMatchup = {
  id: string;
  week: number;
  matchupIndex: number;
  home: LeagueMember;
  away: LeagueMember;
  startDate: string;
  endDate: string;
  status: "pending" | "past" | "current" | "future";
};

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getSeed(leagueId: string): number {
  return leagueId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export function getCanonicalMatchupsForWeek(
  members: LeagueMember[],
  leagueId: string,
  week: number,
  leagueStart: Date | null,
  today: Date | string = new Date(),
): CanonicalMatchup[] {
  const weekRange = getScoringWeekRange(week, leagueStart);
  if (!weekRange || members.length < 2 || members.length % 2 !== 0) return [];

  const sorted = [...members].sort((a, b) => a.user_id.localeCompare(b.user_id));
  const shuffled = seededShuffle(sorted, getSeed(leagueId));
  const fixed = shuffled[0];
  const rotating = shuffled.slice(1);
  const round = (week - 1) % (members.length - 1);
  const half = (members.length - 2) / 2;

  const matchups: CanonicalMatchup[] = [
    {
      id: `${week}-0`,
      week,
      matchupIndex: 0,
      home: fixed,
      away: rotating[round],
      startDate: weekRange.startDate,
      endDate: weekRange.endDate,
      status: getWeekStatus(week, leagueStart, today),
    },
  ];

  for (let i = 1; i <= half; i += 1) {
    matchups.push({
      id: `${week}-${i}`,
      week,
      matchupIndex: i,
      home: rotating[(round + i) % (members.length - 1)],
      away: rotating[(round + members.length - 1 - i) % (members.length - 1)],
      startDate: weekRange.startDate,
      endDate: weekRange.endDate,
      status: getWeekStatus(week, leagueStart, today),
    });
  }

  return matchups;
}

export function getScheduleEntriesForMember(
  members: LeagueMember[],
  leagueId: string,
  memberUserId: string,
  leagueStart: Date | null,
  totalWeeks: number,
  today: Date | string = new Date(),
) {
  const entries: Array<CanonicalMatchup & { opponent: LeagueMember; isHome: boolean }> = [];
  for (let week = 1; week <= totalWeeks; week += 1) {
    for (const matchup of getCanonicalMatchupsForWeek(members, leagueId, week, leagueStart, today)) {
      if (matchup.home.user_id === memberUserId) {
        entries.push({ ...matchup, opponent: matchup.away, isHome: true });
      } else if (matchup.away.user_id === memberUserId) {
        entries.push({ ...matchup, opponent: matchup.home, isHome: false });
      }
    }
  }
  return entries;
}
