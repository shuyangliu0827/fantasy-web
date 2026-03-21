import test from "node:test";
import assert from "node:assert/strict";

import { buildDailyScoreBreakdown, getDailyStarterScore, fillMissingWeekLineups, getStarterIdsForDate, getWeeklyMatchupScore, getWeeklyStarterIds, type PlayerGameStats } from "../lib/fantasy-scoring.ts";
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

// ── Lineup change → full recompute (Rule B) ───────────────────────────────────

test("changing starter on a date removes old player contribution and adds new player (Rule B: replace-recompute)", () => {
  // Original lineup: p1=PG, p2=SG (starters); p3=bench
  const originalLineups: DailyLineupMap = {
    "2026-03-23": { PG: "p1", SG: "p2", BE1: "p3" },
  };

  // New lineup: p3 replaces p1 at PG
  const newLineups: DailyLineupMap = {
    "2026-03-23": { PG: "p3", SG: "p2", BE1: "p1" },
  };

  const scoreWithOriginal = getDailyStarterScore(roster, originalLineups, "2026-03-23", resolveStats);
  const scoreWithNew      = getDailyStarterScore(roster, newLineups,      "2026-03-23", resolveStats);

  // Original: p1(32) + p2(23) = 55
  assert.equal(scoreWithOriginal, 55);
  // New: p3(40) + p2(23) = 63 — p1's contribution is gone, p3's is added fresh
  assert.equal(scoreWithNew, 63);
  // Crucially, they are different — old contribution does not linger
  assert.notEqual(scoreWithOriginal, scoreWithNew);
});

test("no double-counting: replacing one starter with another does not count both (Rule B)", () => {
  // Both p1 and p3 are in the roster; only p3 is a starter on this date
  const lineupWithP3: DailyLineupMap = {
    "2026-03-23": { PG: "p3", BE1: "p1", BE2: "p2" },
  };

  const score = getDailyStarterScore(roster, lineupWithP3, "2026-03-23", resolveStats);
  // Only p3 (40 fpts) is a starter — p1 and p2 are bench and must NOT be counted
  assert.equal(score, 40);
});

test("getDailyStarterScore is a full recompute from zero — result equals only current starters (Rule B)", () => {
  const lineup: DailyLineupMap = {
    "2026-03-23": { PG: "p1", BE1: "p2", BE2: "p3" }, // only p1 is starter
  };
  const score = getDailyStarterScore(roster, lineup, "2026-03-23", resolveStats);
  // p1 = 32; p2 and p3 are bench and contribute 0
  assert.equal(score, 32);
});

// ── Weekly aggregation correctness (Rule C) ───────────────────────────────────

test("weekly total equals sum of all 7 daily scores — missing dates contribute 0 (Rule C)", () => {
  const fullWeekDates = ["2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29"];
  // Only 3 dates have lineup entries; the other 4 have no lineup → score 0
  const weeklyTotal   = getWeeklyMatchupScore(roster, dailyLineups, fullWeekDates, resolveStats);
  const dailyBreakdown = buildDailyScoreBreakdown(roster, dailyLineups, fullWeekDates, resolveStats);
  const sumOfDaily    = Object.values(dailyBreakdown).reduce((a, b) => a + b, 0);

  // Weekly total must exactly equal sum of individual daily scores
  assert.equal(weeklyTotal, sumOfDaily);
});

test("missing date in lineup contributes 0 to weekly total and date structure is preserved (Rule C)", () => {
  const dates = ["2026-03-23", "2026-03-26"]; // 2026-03-26 has no lineup entry
  const breakdown = buildDailyScoreBreakdown(roster, dailyLineups, dates, resolveStats);

  // 2026-03-26 has no lineup → 0, but the date key must still appear
  assert.ok("2026-03-26" in breakdown, "missing-lineup date must still appear in breakdown");
  assert.equal(breakdown["2026-03-26"], 0, "missing-lineup date must contribute 0");
  assert.equal(breakdown["2026-03-23"], 55, "date with valid lineup and stats must score correctly");
});

// ── fillMissingWeekLineups edge cases ─────────────────────────────────────────

test("fillMissingWeekLineups: does NOT fill when any week date already has a lineup entry", () => {
  // p2 has a lineup on 2026-03-24 already; the fill must not overwrite other dates
  const partialLineups: DailyLineupMap = {
    "2026-03-24": { PG: "p2" }, // intentional partial — this week has at least one entry
    "2026-02-23": { PG: "p1", SG: "p2" }, // older snapshot
  };
  const weekDates = ["2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29"];

  const filled = fillMissingWeekLineups(partialLineups, weekDates);

  // Because 2026-03-24 already has an entry, fill must not touch any other date
  assert.equal(filled["2026-03-23"], undefined, "2026-03-23 must not be filled");
  assert.deepEqual(filled["2026-03-24"], { PG: "p2" }, "existing entry must be unchanged");
});

test("fillMissingWeekLineups: fills all week dates from nearest snapshot when none exist for the week", () => {
  const noWeekLineups: DailyLineupMap = {
    "2026-03-01": { PG: "p1", SG: "p2" }, // snapshot from week before
  };
  const weekDates = ["2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29"];

  const filled = fillMissingWeekLineups(noWeekLineups, weekDates);

  // All 7 week dates must now have the snapshot lineup
  for (const date of weekDates) {
    assert.deepEqual(filled[date], { PG: "p1", SG: "p2" }, `${date} must be filled`);
  }
});

test("fillMissingWeekLineups: does NOT fill from a snapshot taken after the week ended", () => {
  // Snapshot is AFTER the week end date → user joined late, should score 0
  const lateLineups: DailyLineupMap = {
    "2026-04-01": { PG: "p1", SG: "p2" }, // after week end of 2026-03-29
  };
  const weekDates = ["2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29"];

  const filled = fillMissingWeekLineups(lateLineups, weekDates);

  // No fill should have occurred — week dates remain absent
  for (const date of weekDates) {
    assert.equal(filled[date], undefined, `${date} must NOT be filled from post-week snapshot`);
  }
});

// ── Determinism: same inputs always produce same outputs (Rule D) ──────────────

test("repeated score computation with same inputs always returns same result (determinism)", () => {
  const dates = ["2026-03-23", "2026-03-24", "2026-03-25"];
  const results = Array.from({ length: 10 }, () =>
    getWeeklyMatchupScore(roster, dailyLineups, dates, resolveStats),
  );
  const allSame = results.every(r => r === results[0]);
  assert.ok(allSame, "identical inputs must always produce identical outputs");
});
