import test from "node:test";
import assert from "node:assert/strict";

import { buildDailyScoreBreakdown, getDailyStarterScore, getStarterIdsForDate, getWeeklyMatchupScore, type PlayerGameStats } from "../lib/fantasy-scoring.ts";
import { getCurrentWeek, getOfficialLeagueStartDate, getScoringWeekRange, getWeekStatus } from "../lib/week-utils.ts";
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
