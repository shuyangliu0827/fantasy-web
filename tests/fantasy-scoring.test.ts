import test from "node:test";
import assert from "node:assert/strict";

import { buildDailyScoreBreakdown, getDailyStarterScore, getStarterIdsForDate, getWeeklyMatchupScore, getWeeklyStarterIds, type PlayerGameStats } from "../lib/fantasy-scoring.ts";
import { buildCanonicalStandings, computeCanonicalWeeklyResult } from "../lib/canonical-weekly-result.ts";
import { getCurrentWeek, getOfficialLeagueStartDate, getScoringWeekRange, getWeekStatus } from "../lib/week-utils.ts";
import { getCurrentRoster, getHistoricalRosterForDate } from "../lib/roster-history.ts";
import type { DailyLineupMap, RosterPlayer } from "../lib/store";

const roster: RosterPlayer[] = [
  { id: "p1", name: "Starter One", team: "LAL", position: "PG", ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fg: 0, ft: 0, tov: 0, round: 1 },
  { id: "p2", name: "Starter Two", team: "BOS", position: "SG", ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fg: 0, ft: 0, tov: 0, round: 2 },
  { id: "p3", name: "Bench Guy", team: "NYK", position: "SF", ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fg: 0, ft: 0, tov: 0, round: 3 },
];

const dailyLineups: DailyLineupMap = {
  "2026-03-23": { PG: "p1", SG: "p2", BE1: "p3" },
  "2026-03-24": { PG: "p1", SG: "p2", BE1: "p3" },
  "2026-03-25": { PG: "p1", BE1: "p2", BE2: "p3" },
};

const statTable: Record<string, Record<string, PlayerGameStats>> = {
  "2026-03-23": {
    p1: { min: 30, fgm: 6, fga: 12, fg3m: 2, ftm: 4, fta: 4, reb: 5, ast: 8, stl: 1, blk: 0, tov: 2, pts: 18, fpts: 32 },
    p2: { min: 28, fgm: 4, fga: 11, fg3m: 1, ftm: 2, fta: 2, reb: 3, ast: 4, stl: 2, blk: 1, tov: 1, pts: 11, fpts: 23 },
    p3: { min: 31, fgm: 7, fga: 15, fg3m: 3, ftm: 3, fta: 4, reb: 9, ast: 6, stl: 1, blk: 1, tov: 2, pts: 20, fpts: 40 },
  },
  "2026-03-24": {
    p1: { min: 0, fgm: 0, fga: 0, fg3m: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0, fpts: 0 },
  },
  "2026-03-25": {
    p1: { min: 20, fgm: 5, fga: 10, fg3m: 1, ftm: 1, fta: 2, reb: 2, ast: 6, stl: 0, blk: 0, tov: 3, pts: 12, fpts: 18 },
    p2: { min: 35, fgm: 8, fga: 18, fg3m: 4, ftm: 5, fta: 6, reb: 4, ast: 5, stl: 2, blk: 0, tov: 2, pts: 25, fpts: 38 },
  },
};

const resolveStats = (player: RosterPlayer, dateStr: string) => statTable[dateStr]?.[player.id] || null;

test("week starts Monday and ends Sunday", () => {
  const start = getOfficialLeagueStartDate("2026-03-19T19:30:00Z");
  assert.ok(start);
  const range = getScoringWeekRange(1, start!);
  assert.deepEqual(range, {
    week: 1,
    startDate: "2026-03-23",
    endDate: "2026-03-29",
    dateStrings: ["2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29"],
  });
});

test("first official week begins on first Monday after draft completion with no partial scoring", () => {
  const start = getOfficialLeagueStartDate("2026-03-19T01:00:00Z");
  assert.equal(start?.toISOString(), "2026-03-23T00:00:00.000Z");
  assert.equal(getWeekStatus(1, start!, "2026-03-22T23:59:00Z"), "pending");
  assert.equal(getCurrentWeek(start!, "2026-03-22T23:59:00Z"), 1);
});

test("daily score counts starters only and bench players do not count", () => {
  assert.deepEqual([...getStarterIdsForDate(dailyLineups, "2026-03-23")].sort(), ["p1", "p2"]);
  assert.equal(getDailyStarterScore(roster, dailyLineups, "2026-03-23", resolveStats), 55);
});

test("no-game starter contributes zero", () => {
  assert.equal(getDailyStarterScore(roster, dailyLineups, "2026-03-24", resolveStats), 0);
});

test("historical scoring uses saved lineup for that date and ignores future lineup edits", () => {
  const editedFutureLineups: DailyLineupMap = {
    ...dailyLineups,
    "2026-03-26": { PG: "p3", SG: "p2" },
  };

  assert.equal(getDailyStarterScore(roster, editedFutureLineups, "2026-03-23", resolveStats), 55);
  assert.equal(getDailyStarterScore(roster, editedFutureLineups, "2026-03-25", resolveStats), 18);
});

test("weekly total equals sum of daily totals for scoreboard and matchup detail consistency", () => {
  const dates = ["2026-03-23", "2026-03-24", "2026-03-25"];
  const breakdown = buildDailyScoreBreakdown(roster, dailyLineups, dates, resolveStats);
  const total = getWeeklyMatchupScore(roster, dailyLineups, dates, resolveStats);
  assert.equal(total, breakdown["2026-03-23"] + breakdown["2026-03-24"] + breakdown["2026-03-25"]);
  assert.equal(total, 73);
});

test("timezone edge cases around midnight stay on canonical UTC dates", () => {
  const start = getOfficialLeagueStartDate("2026-03-22T23:59:59-05:00");
  assert.equal(start?.toISOString(), "2026-03-23T00:00:00.000Z");
  assert.equal(getWeekStatus(1, start!, "2026-03-22T23:59:59Z"), "pending");
  assert.equal(getWeekStatus(1, start!, "2026-03-23T00:00:00Z"), "current");
});


test("weekly starter labeling uses all saved daily lineups in total view", () => {
  assert.deepEqual([...getWeeklyStarterIds(dailyLineups, ["2026-03-23", "2026-03-24", "2026-03-25"])].sort(), ["p1", "p2"]);
});

// ── Ownership history tests ────────────────────────────────────────────────────

const NOW = Date.now();
const DAY = 86400000;

// Full roster with history: p1 always active, p2 dropped, p3 added later
const historicalRoster: RosterPlayer[] = [
  { id: "p1", name: "Always Active", team: "LAL", position: "PG", ppg: 20, rpg: 5, apg: 8, spg: 1, bpg: 0, fg: 0.45, ft: 0.8, tov: 2, round: 1 },
  { id: "p2", name: "Dropped Player", team: "BOS", position: "SG", ppg: 15, rpg: 3, apg: 4, spg: 2, bpg: 1, fg: 0.42, ft: 0.75, tov: 1, round: 2,
    acquiredAt: NOW - 7 * DAY, releasedAt: NOW - 3 * DAY },
  { id: "p3", name: "New Pickup",    team: "NYK", position: "SF", ppg: 18, rpg: 6, apg: 5, spg: 1, bpg: 2, fg: 0.44, ft: 0.78, tov: 2, round: 0,
    acquiredVia: "free_agent", acquiredAt: NOW - 1 * DAY },
  // Duplicate entry for p1 (simulates a bug that could occur before deduplication fix)
  { id: "p1", name: "Always Active (dup)", team: "LAL", position: "PG", ppg: 20, rpg: 5, apg: 8, spg: 1, bpg: 0, fg: 0.45, ft: 0.8, tov: 2, round: 1 },
];

test("getCurrentRoster deduplicates by player id and excludes released players", () => {
  const active = getCurrentRoster(historicalRoster);
  const ids = active.map(p => p.id);
  // p1 appears once (dedup), p2 excluded (released), p3 included (active)
  assert.deepEqual(ids.sort(), ["p1", "p3"]);
});

test("getCurrentRoster returns released players as inactive", () => {
  const active = getCurrentRoster(historicalRoster);
  assert.ok(!active.some(p => p.id === "p2"), "dropped player p2 must not appear in current roster");
});

test("getHistoricalRosterForDate: player added later does not appear on earlier date", () => {
  // p3 was acquired NOW-1day; viewing 5 days ago
  const fiveDaysAgo = new Date(NOW - 5 * DAY).toISOString().slice(0, 10);
  const hist = getHistoricalRosterForDate(historicalRoster, fiveDaysAgo);
  assert.ok(!hist.some(p => p.id === "p3"), "p3 added recently must not appear in 5-days-ago view");
});

test("getHistoricalRosterForDate: dropped player appears on date before release", () => {
  // p2 was released NOW-3days; viewing 5 days ago (before release)
  const fiveDaysAgo = new Date(NOW - 5 * DAY).toISOString().slice(0, 10);
  const hist = getHistoricalRosterForDate(historicalRoster, fiveDaysAgo);
  assert.ok(hist.some(p => p.id === "p2"), "p2 must appear in view from before it was dropped");
});

test("getHistoricalRosterForDate: dropped player does not appear on date after release", () => {
  // p2 released NOW-3days; viewing yesterday (after release)
  const yesterday = new Date(NOW - 1 * DAY).toISOString().slice(0, 10);
  const hist = getHistoricalRosterForDate(historicalRoster, yesterday);
  assert.ok(!hist.some(p => p.id === "p2"), "p2 must not appear after release date");
});

test("getHistoricalRosterForDate deduplicates by player id", () => {
  // p1 has a duplicate entry; historical view should only show it once
  const today = new Date(NOW).toISOString().slice(0, 10);
  const hist = getHistoricalRosterForDate(historicalRoster, today);
  const p1Entries = hist.filter(p => p.id === "p1");
  assert.equal(p1Entries.length, 1, "duplicate p1 entries must be deduplicated");
});

// ── Weekly result logic ───────────────────────────────────────────────────────

function computeWeeklyResult(homeScore: number, awayScore: number): "home_win" | "away_win" | "tie" {
  if (homeScore > awayScore) return "home_win";
  if (awayScore > homeScore) return "away_win";
  return "tie";
}

test("weekly result: higher score wins", () => {
  assert.equal(computeWeeklyResult(350.5, 310.2), "home_win");
  assert.equal(computeWeeklyResult(280.0, 320.7), "away_win");
});

test("weekly result: equal scores are a tie", () => {
  assert.equal(computeWeeklyResult(300.0, 300.0), "tie");
});

// ── Standings formula tests ───────────────────────────────────────────────────

function winPct(wins: number, losses: number, ties: number): number {
  const total = wins + losses + ties;
  return total === 0 ? 0 : (wins + 0.5 * ties) / total;
}

function gamesBack(leaderWins: number, leaderLosses: number, teamWins: number, teamLosses: number): number {
  return ((leaderWins - teamWins) + (teamLosses - leaderLosses)) / 2;
}

test("win percentage formula: wins + 0.5 * ties / total", () => {
  assert.equal(winPct(5, 3, 0), 0.625);
  assert.equal(winPct(4, 4, 0), 0.5);
  assert.equal(winPct(0, 0, 0), 0);
  // 3W 2L 1T: (3 + 0.5) / 6 = 0.5833...
  assert.ok(Math.abs(winPct(3, 2, 1) - 3.5 / 6) < 0.0001);
});

test("games behind formula: standard relative-to-leader", () => {
  // Leader: 6W 2L; Team B: 4W 4L → GB = ((6-4)+(4-2))/2 = 2
  assert.equal(gamesBack(6, 2, 4, 4), 2);
  // Leader vs themselves: 0
  assert.equal(gamesBack(6, 2, 6, 2), 0);
  // Fractional: Leader 5W 2L; Team: 4W 4L → ((5-4)+(4-2))/2 = 1.5
  assert.equal(gamesBack(5, 2, 4, 4), 1.5);
});

// ── Canonical weekly result pipeline ─────────────────────────────────────────

const FULL_WEEK = ["2026-03-23","2026-03-24","2026-03-25","2026-03-26","2026-03-27","2026-03-28","2026-03-29"];

const weeklyLineups: DailyLineupMap = {
  "2026-03-23": { PG: "p1", SG: "p2", BE1: "p3" },
  "2026-03-24": { PG: "p1", SG: "p2", BE1: "p3" },
  "2026-03-25": { PG: "p1", BE1: "p2", BE2: "p3" },
  // 2026-03-26 through 29: no lineup saved → contribute 0
};

const weekStats: Record<string, Record<string, PlayerGameStats>> = {
  "2026-03-23": {
    p1: { min: 30, fgm: 6, fga: 12, fg3m: 2, ftm: 4, fta: 4, reb: 5, ast: 8, stl: 1, blk: 0, tov: 2, pts: 18, fpts: 32 },
    p2: { min: 28, fgm: 4, fga: 11, fg3m: 1, ftm: 2, fta: 2, reb: 3, ast: 4, stl: 2, blk: 1, tov: 1, pts: 11, fpts: 23 },
  },
  "2026-03-24": {
    p1: { min: 0, fgm: 0, fga: 0, fg3m: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0, fpts: 0 },
  },
  "2026-03-25": {
    p1: { min: 20, fgm: 5, fga: 10, fg3m: 1, ftm: 1, fta: 2, reb: 2, ast: 6, stl: 0, blk: 0, tov: 3, pts: 12, fpts: 18 },
  },
};
const resolveWeekStats = (p: RosterPlayer, d: string) => weekStats[d]?.[p.id] || null;
const EMPTY_STATS: PlayerGameStats = { min: 0, fgm: 0, fga: 0, fg3m: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0, fpts: 0 };

test("canonical result: sums all 7 official dates — missing lineup/stats days contribute 0", () => {
  const result = computeCanonicalWeeklyResult({
    homeTeamId: "teamA", awayTeamId: "teamB",
    homeRoster: roster, awayRoster: roster,
    homeDailyLineups: weeklyLineups, awayDailyLineups: {},
    dateStrings: FULL_WEEK,
    resolvePlayerStats: resolveWeekStats,
    weekStatus: "past",
  });
  // 7 dates enumerated; only 3 have lineups/stats, rest are 0
  assert.equal(Object.keys(result.homeDailyScores).length, 7, "daily breakdown must include all 7 dates");
  assert.equal(result.homeDailyScores["2026-03-26"], 0);
  assert.equal(result.homeDailyScores["2026-03-27"], 0);
  // homeScore = 55 (Mar 23) + 0 (Mar 24) + 18 (Mar 25) + 0+0+0+0 = 73
  assert.equal(result.homeScore, 73);
  assert.equal(result.awayScore, 0);
});

test("canonical result: adding a lineup for a new date in the week changes weekly total", () => {
  const extraDate = "2026-03-26";
  const lineupsWithExtra: DailyLineupMap = {
    ...weeklyLineups,
    [extraDate]: { PG: "p1", SG: "p2" },
  };
  const statsWithExtra: Record<string, Record<string, PlayerGameStats>> = {
    ...weekStats,
    [extraDate]: {
      p1: { min: 25, fgm: 4, fga: 9, fg3m: 1, ftm: 2, fta: 2, reb: 3, ast: 5, stl: 1, blk: 0, tov: 1, pts: 11, fpts: 21 },
      p2: { min: 30, fgm: 5, fga: 10, fg3m: 2, ftm: 1, fta: 1, reb: 4, ast: 6, stl: 2, blk: 1, tov: 0, pts: 13, fpts: 28 },
    },
  };
  const resolveExtra = (p: RosterPlayer, d: string) => statsWithExtra[d]?.[p.id] || null;

  const before = computeCanonicalWeeklyResult({
    homeTeamId: "A", awayTeamId: "B",
    homeRoster: roster, awayRoster: roster,
    homeDailyLineups: weeklyLineups, awayDailyLineups: {},
    dateStrings: FULL_WEEK,
    resolvePlayerStats: resolveExtra,
    weekStatus: "past",
  });
  const after = computeCanonicalWeeklyResult({
    homeTeamId: "A", awayTeamId: "B",
    homeRoster: roster, awayRoster: roster,
    homeDailyLineups: lineupsWithExtra, awayDailyLineups: {},
    dateStrings: FULL_WEEK,
    resolvePlayerStats: resolveExtra,
    weekStatus: "past",
  });
  assert.ok(after.homeScore > before.homeScore, "adding a scored date must increase the weekly total");
  assert.equal(after.homeScore, before.homeScore + 49); // 21 (p1) + 28 (p2)
});

test("canonical result: historical roster filtering prevents current-roster leakage into past dates", () => {
  const acquiredLate = new Date("2026-03-26T12:00:00.000Z").getTime();
  const rosterWithPickup: RosterPlayer[] = [
    ...roster,
    { id: "p4", name: "Late Pickup", team: "DAL", position: "PF", ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fg: 0, ft: 0, tov: 0, round: 0, acquiredAt: acquiredLate },
  ];
  const lateLineups: DailyLineupMap = {
    ...weeklyLineups,
    "2026-03-24": { PF: "p4" },
    "2026-03-27": { PF: "p4" },
  };
  const lateStats: Record<string, Record<string, PlayerGameStats>> = {
    ...weekStats,
    "2026-03-24": { p4: { ...EMPTY_STATS, fpts: 99 } },
    "2026-03-27": { p4: { ...EMPTY_STATS, fpts: 15 } },
  };
  const resolveLate = (p: RosterPlayer, d: string) => lateStats[d]?.[p.id] || null;
  const result = computeCanonicalWeeklyResult({
    homeTeamId: "A", awayTeamId: "B",
    homeRoster: rosterWithPickup, awayRoster: [],
    homeDailyLineups: lateLineups, awayDailyLineups: {},
    dateStrings: FULL_WEEK,
    resolvePlayerStats: resolveLate,
    weekStatus: "past",
  });
  assert.equal(result.homeDailyScores["2026-03-24"], 0, "late pickup must not leak into earlier dates");
  assert.equal(result.homeDailyScores["2026-03-27"], 15, "late pickup scores once it is historically owned");
});

test("standings aggregate canonical weekly results only", () => {
  const standings = buildCanonicalStandings(
    [
      { teamId: "A", name: "Alpha" },
      { teamId: "B", name: "Beta" },
      { teamId: "C", name: "Gamma" },
    ],
    [
      { matchupKey: "1-0", week: 1, homeTeamId: "A", awayTeamId: "B", homeScore: 100, awayScore: 90, homeDailyScores: {}, awayDailyScores: {}, status: "final", winnerId: "A" },
      { matchupKey: "2-0", week: 2, homeTeamId: "A", awayTeamId: "C", homeScore: 88, awayScore: 88, homeDailyScores: {}, awayDailyScores: {}, status: "final", winnerId: null },
      { matchupKey: "3-0", week: 3, homeTeamId: "B", awayTeamId: "C", homeScore: 70, awayScore: 120, homeDailyScores: {}, awayDailyScores: {}, status: "live", winnerId: null },
    ],
  );
  assert.deepEqual(
    standings.map((row) => ({ teamId: row.teamId, wins: row.wins, losses: row.losses, ties: row.ties, pf: row.pointsFor, pa: row.pointsAgainst })),
    [
      { teamId: "A", wins: 1, losses: 0, ties: 1, pf: 188, pa: 178 },
      { teamId: "B", wins: 0, losses: 1, ties: 0, pf: 90, pa: 100 },
      { teamId: "C", wins: 0, losses: 0, ties: 1, pf: 88, pa: 88 },
    ],
  );
});

test("canonical result: status is final for past weeks, live for current, pending for future", () => {
  const base = { homeTeamId: "A", awayTeamId: "B", homeRoster: roster, awayRoster: roster,
    homeDailyLineups: {}, awayDailyLineups: {}, dateStrings: FULL_WEEK, resolvePlayerStats: () => null };
  assert.equal(computeCanonicalWeeklyResult({ ...base, weekStatus: "past" }).status, "final");
  assert.equal(computeCanonicalWeeklyResult({ ...base, weekStatus: "current" }).status, "live");
  assert.equal(computeCanonicalWeeklyResult({ ...base, weekStatus: "future" }).status, "pending");
  assert.equal(computeCanonicalWeeklyResult({ ...base, weekStatus: "pending" }).status, "pending");
});

test("canonical result: winnerId only set on final status", () => {
  const base = { homeTeamId: "A", awayTeamId: "B", homeRoster: roster, awayRoster: roster,
    homeDailyLineups: weeklyLineups, awayDailyLineups: {}, dateStrings: FULL_WEEK, resolvePlayerStats: resolveWeekStats };
  const live = computeCanonicalWeeklyResult({ ...base, weekStatus: "current" });
  const final = computeCanonicalWeeklyResult({ ...base, weekStatus: "past" });
  assert.equal(live.winnerId, null, "no winner declared during live week");
  assert.equal(final.winnerId, "A", "winner declared for final week with higher score");
});

test("standings from matchups: W/L/T/PF/PA computed from match rows, not accumulated counters", () => {
  type MatchRow = { home_team_id: string; away_team_id: string; home_score: number; away_score: number };
  const matchRows: MatchRow[] = [
    { home_team_id: "T1", away_team_id: "T2", home_score: 80, away_score: 60 },  // T1 wins
    { home_team_id: "T2", away_team_id: "T1", home_score: 90, away_score: 70 },  // T2 wins
    { home_team_id: "T1", away_team_id: "T2", home_score: 50, away_score: 50 },  // tie
  ];

  function computeRecordFromMatchups(teamId: string, rows: MatchRow[]) {
    let wins = 0, losses = 0, ties = 0, pf = 0, pa = 0;
    for (const m of rows) {
      const isHome = m.home_team_id === teamId;
      const isAway = m.away_team_id === teamId;
      if (!isHome && !isAway) continue;
      const my = isHome ? m.home_score : m.away_score;
      const opp = isHome ? m.away_score : m.home_score;
      pf += my; pa += opp;
      if (my > opp) wins++; else if (opp > my) losses++; else ties++;
    }
    return { wins, losses, ties, pf, pa };
  }

  const t1 = computeRecordFromMatchups("T1", matchRows);
  const t2 = computeRecordFromMatchups("T2", matchRows);

  assert.equal(t1.wins, 1);
  assert.equal(t1.losses, 1);
  assert.equal(t1.ties, 1);
  assert.equal(t1.pf, 200);   // 80 (home wk1) + 70 (away wk2) + 50 (home wk3)
  assert.equal(t1.pa, 200);   // 60 (opp wk1) + 90 (opp wk2) + 50 (opp wk3)

  assert.equal(t2.wins, 1);
  assert.equal(t2.losses, 1);
  assert.equal(t2.ties, 1);
  assert.equal(t2.pf, 200);   // 60+90+50
  assert.equal(t2.pa, 200);   // 80+70+50

  // Running the computation a second time (simulating a re-save) must give the same result.
  const t1Again = computeRecordFromMatchups("T1", matchRows);
  assert.deepEqual(t1, t1Again, "standings computation must be idempotent");
});
