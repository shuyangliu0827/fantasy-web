import type { LeagueMember } from "./store.ts";
import type { CanonicalMatchup } from "./fantasy-schedule.ts";

export type WeeklyMatchupResult = {
  matchupId: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  result: "home_win" | "away_win" | "tie";
};

export type StandingsRow = {
  rank: number;
  member: LeagueMember;
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pct: number;
  gb: number;
  pf: number;
  pa: number;
  streak: string;
};

export function getWeeklyMatchupResult(matchup: CanonicalMatchup, homeScore: number, awayScore: number): WeeklyMatchupResult {
  const roundedHome = Number(homeScore.toFixed(2));
  const roundedAway = Number(awayScore.toFixed(2));
  let result: WeeklyMatchupResult["result"] = "tie";
  if (roundedHome > roundedAway) result = "home_win";
  if (roundedHome < roundedAway) result = "away_win";
  return {
    matchupId: matchup.id,
    week: matchup.week,
    homeTeamId: matchup.home.user_id,
    awayTeamId: matchup.away.user_id,
    homeScore: roundedHome,
    awayScore: roundedAway,
    result,
  };
}

export function buildStandingsTable(
  members: LeagueMember[],
  teamNames: Record<string, string>,
  results: WeeklyMatchupResult[],
): StandingsRow[] {
  const rows = new Map<string, Omit<StandingsRow, "rank" | "gb"> & { resultTrail: Array<"W" | "L" | "T"> }>();

  for (const member of members) {
    rows.set(member.user_id, {
      member,
      teamId: member.user_id,
      teamName: teamNames[member.user_id] || member.user?.username || member.user?.name || "Anonymous",
      wins: 0,
      losses: 0,
      ties: 0,
      pct: 0,
      pf: 0,
      pa: 0,
      streak: "-",
      resultTrail: [],
    });
  }

  const orderedResults = [...results].sort((a, b) => a.week - b.week);
  for (const result of orderedResults) {
    const home = rows.get(result.homeTeamId);
    const away = rows.get(result.awayTeamId);
    if (!home || !away) continue;

    home.pf += result.homeScore;
    home.pa += result.awayScore;
    away.pf += result.awayScore;
    away.pa += result.homeScore;

    if (result.result === "home_win") {
      home.wins += 1;
      away.losses += 1;
      home.resultTrail.push("W");
      away.resultTrail.push("L");
    } else if (result.result === "away_win") {
      home.losses += 1;
      away.wins += 1;
      home.resultTrail.push("L");
      away.resultTrail.push("W");
    } else {
      home.ties += 1;
      away.ties += 1;
      home.resultTrail.push("T");
      away.resultTrail.push("T");
    }
  }

  const computed = [...rows.values()].map((row) => {
    const games = row.wins + row.losses + row.ties;
    const pct = games > 0 ? (row.wins + row.ties * 0.5) / games : 0;
    const streak = getCurrentStreak(row.resultTrail);
    return { ...row, pct, streak };
  });

  computed.sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pf - a.pf;
  });

  const leader = computed[0] || null;
  return computed.map((row, index) => ({
    ...row,
    rank: index + 1,
    gb: leader ? ((leader.wins - row.wins) + (row.losses - leader.losses)) / 2 : 0,
  }));
}

export function getCurrentStreak(results: Array<"W" | "L" | "T">): string {
  if (results.length === 0) return "-";
  const last = results[results.length - 1];
  let count = 0;
  for (let i = results.length - 1; i >= 0; i -= 1) {
    if (results[i] !== last) break;
    count += 1;
  }
  return `${last}${count}`;
}
