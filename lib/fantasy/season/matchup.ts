import type { LeagueMember } from "@/lib/shared/store";

export type GeneratedMatchup = {
  id: number;
  home: LeagueMember;
  away: LeagueMember;
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

export function generateMatchupsForWeek(members: LeagueMember[], leagueId: string, week: number): GeneratedMatchup[] {
  const teamCount = members.length;
  if (teamCount < 2 || teamCount % 2 !== 0) return [];

  const sorted = [...members].sort((a, b) => a.user_id.localeCompare(b.user_id));
  const seed = leagueId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const shuffled = seededShuffle(sorted, seed);

  const fixed = shuffled[0];
  const rotating = shuffled.slice(1);
  const round = (week - 1) % (teamCount - 1);
  const half = (teamCount - 2) / 2;

  const matchups: GeneratedMatchup[] = [{ id: 0, home: fixed, away: rotating[round] }];

  for (let i = 1; i <= half; i += 1) {
    matchups.push({
      id: i,
      home: rotating[(round + i) % (teamCount - 1)],
      away: rotating[(round + teamCount - 1 - i) % (teamCount - 1)],
    });
  }

  return matchups;
}
