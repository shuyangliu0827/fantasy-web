import test from "node:test";
import assert from "node:assert/strict";

import type { DailyLineupMap, LeagueMember, RosterPlayer } from "../lib/store.ts";
import {
  buildWeekRosterStates,
  dedupeRosterPlayers,
  getHistoricalRosterForDate,
  getLineupSlotState,
  getRosterHistoryStateForDate,
  pruneFutureLineupsAfterRemoval,
  type RosterHistoryRecord,
} from "../lib/fantasy-roster-history-core.ts";
import { getCanonicalMatchupsForWeek, getScheduleEntriesForMember } from "../lib/fantasy-schedule.ts";
import { buildStandingsTable, getCurrentStreak, getWeeklyMatchupResult } from "../lib/fantasy-standings.ts";
import { buildPlayerStatsResolver, computeLeagueWeeklyResults } from "../lib/fantasy-results.ts";
import { getOfficialLeagueStartDate, getScoringWeekRange } from "../lib/week-utils.ts";

const playerA: RosterPlayer = { id: "A", name: "Alpha", team: "LAL", position: "PG", ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fg: 0, ft: 0, tov: 0, round: 1, acquiredAt: 100 };
const playerB: RosterPlayer = { id: "B", name: "Bravo", team: "BOS", position: "SG", ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fg: 0, ft: 0, tov: 0, round: 2, acquiredAt: 200 };
const playerC: RosterPlayer = { id: "C", name: "Charlie", team: "NYK", position: "SF", ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fg: 0, ft: 0, tov: 0, round: 3, acquiredAt: 300 };

const history: RosterHistoryRecord[] = [
  { league_id: "league-1", team_id: "team-1", player_id: "A", player_payload: playerA, effective_start_at: "2026-03-01T00:00:00Z", effective_end_at: null },
  { league_id: "league-1", team_id: "team-1", player_id: "B", player_payload: playerB, effective_start_at: "2026-03-01T00:00:00Z", effective_end_at: "2026-03-19T10:00:00Z" },
  { league_id: "league-1", team_id: "team-1", player_id: "C", player_payload: playerC, effective_start_at: "2026-03-19T10:00:00Z", effective_end_at: null },
];

const members: LeagueMember[] = [
  { id: "m1", league_id: "league-1", user_id: "u1", role: "member", joined_at: "2026-03-01", user: { id: "u1", username: "one", name: "One", email: "one@test.com" } },
  { id: "m2", league_id: "league-1", user_id: "u2", role: "member", joined_at: "2026-03-01", user: { id: "u2", username: "two", name: "Two", email: "two@test.com" } },
  { id: "m3", league_id: "league-1", user_id: "u3", role: "member", joined_at: "2026-03-01", user: { id: "u3", username: "three", name: "Three", email: "three@test.com" } },
  { id: "m4", league_id: "league-1", user_id: "u4", role: "member", joined_at: "2026-03-01", user: { id: "u4", username: "four", name: "Four", email: "four@test.com" } },
];

test("duplicate player prevention keeps a single active player row on roster", () => {
  const duplicateNewer = { ...playerA, acquiredAt: 500 };
  assert.deepEqual(dedupeRosterPlayers([playerA, duplicateNewer, playerB]).map((p) => p.id), ["A", "B"]);
  assert.equal(dedupeRosterPlayers([playerA, duplicateNewer])[0].acquiredAt, 500);
});

test("historical ownership correctness respects add/drop effective timestamps", () => {
  assert.deepEqual(getRosterHistoryStateForDate(history, "2026-03-16").map((p) => p.id).sort(), ["A", "B"]);
  assert.deepEqual(getRosterHistoryStateForDate(history, "2026-03-19").map((p) => p.id).sort(), ["A", "C"]);
  assert.deepEqual(getHistoricalRosterForDate(history, [playerA, playerC], "2026-03-16").map((p) => p.id).sort(), ["A", "B"]);
});

test("historical lineup correctness uses saved snapshot and preserves unassigned players", () => {
  const lineup: DailyLineupMap = {
    "2026-03-16": { PG: "A", BE1: "B" },
    "2026-03-20": { PG: "A", SG: "C" },
  };
  const march16Roster = getRosterHistoryStateForDate(history, "2026-03-16");
  const state = getLineupSlotState(lineup["2026-03-16"], march16Roster);
  assert.deepEqual(state.starters.map((entry) => entry.player.id), ["A"]);
  assert.deepEqual(state.bench.map((entry) => entry.player.id), ["B"]);
  assert.deepEqual(state.reserve, []);
  assert.deepEqual(Object.keys(pruneFutureLineupsAfterRemoval(lineup, ["B"], "2026-03-19")), ["2026-03-16", "2026-03-20"]);
  assert.equal(pruneFutureLineupsAfterRemoval(lineup, ["B"], "2026-03-19")["2026-03-16"].BE1, "B");
});

test("week and schedule correctness use official first Monday and shared pairings", () => {
  const leagueStart = getOfficialLeagueStartDate("2026-03-12T15:00:00Z");
  assert.equal(leagueStart?.toISOString(), "2026-03-16T00:00:00.000Z");
  const weekOne = getCanonicalMatchupsForWeek(members, "league-1", 1, leagueStart);
  const weekTwo = getCanonicalMatchupsForWeek(members, "league-1", 2, leagueStart);
  assert.equal(weekOne[0].startDate, "2026-03-16");
  assert.equal(weekOne[0].endDate, "2026-03-22");
  assert.notDeepEqual(weekOne.map((m) => m.id), weekTwo.map((m) => m.id));
  const memberSchedule = getScheduleEntriesForMember(members, "league-1", "u1", leagueStart, 2);
  assert.equal(memberSchedule[0].week, 1);
  assert.equal(memberSchedule[1].week, 2);
});

test("weekly result correctness and standings aggregation follow canonical rules", () => {
  const week1 = getCanonicalMatchupsForWeek(members, "league-1", 1, getOfficialLeagueStartDate("2026-03-12T15:00:00Z"));
  const results = [
    getWeeklyMatchupResult(week1[0], 100, 90),
    getWeeklyMatchupResult(week1[1], 88, 88),
  ];
  const standings = buildStandingsTable(members, { u1: "Team One", u2: "Team Two", u3: "Team Three", u4: "Team Four" }, results);
  const leader = standings[0];
  const tieTeam = standings.find((row) => row.teamId === week1[1].home.user_id)!;
  assert.equal(leader.wins, 1);
  assert.equal(leader.losses, 0);
  assert.equal(leader.pf, 100);
  assert.equal(tieTeam.ties, 1);
  assert.equal(getCurrentStreak(["W", "W", "L", "L"]), "L2");
});

test("computeLeagueWeeklyResults aggregates completed matchup weeks from saved lineups only", () => {
  const leagueStart = getOfficialLeagueStartDate("2026-03-12T15:00:00Z");
  const week1 = getScoringWeekRange(1, leagueStart)!;
  const lineupsByUserId: Record<string, DailyLineupMap> = {
    u1: Object.fromEntries(week1.dateStrings.map((date) => [date, { PG: "A" }])),
    u2: Object.fromEntries(week1.dateStrings.map((date) => [date, { PG: "B" }])),
    u3: Object.fromEntries(week1.dateStrings.map((date) => [date, { PG: "C" }])),
    u4: Object.fromEntries(week1.dateStrings.map((date) => [date, { PG: "D" }])),
  };
  const resolver = buildPlayerStatsResolver(
    Object.fromEntries(week1.dateStrings.map((date) => [date, { A: { min: 0, fgm: 0, fga: 0, fg3m: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0, fpts: 10 }, B: { min: 0, fgm: 0, fga: 0, fg3m: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0, fpts: 8 }, C: { min: 0, fgm: 0, fga: 0, fg3m: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0, fpts: 7 }, D: { min: 0, fgm: 0, fga: 0, fg3m: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0, fpts: 7 } }])),
    new Map([ ["A", "Alpha"], ["B", "Bravo"], ["C", "Charlie"], ["D", "Delta"] ]),
  );
  const results = computeLeagueWeeklyResults({
    members,
    leagueId: "league-1",
    leagueStart,
    totalWeeks: 1,
    lineupsByUserId,
    resolvePlayerStats: resolver,
    today: "2026-03-19T00:00:00Z",
  });
  assert.equal(results.length, 0); // current week is not completed yet
  const pastResults = computeLeagueWeeklyResults({
    members,
    leagueId: "league-1",
    leagueStart,
    totalWeeks: 1,
    lineupsByUserId,
    resolvePlayerStats: resolver,
    today: "2026-03-30T00:00:00Z",
  });
  assert.equal(pastResults.length, 2);
  assert.deepEqual(pastResults.flatMap((result) => [result.homeScore, result.awayScore]).sort((a, b) => a - b), [49, 49, 56, 70]);
});

test("buildWeekRosterStates keeps later pickups out of earlier matchup views", () => {
  const weekStates = buildWeekRosterStates(history, ["2026-03-16", "2026-03-17", "2026-03-19"]);
  assert.deepEqual(weekStates["2026-03-16"].map((player) => player.id).sort(), ["A", "B"]);
  assert.deepEqual(weekStates["2026-03-19"].map((player) => player.id).sort(), ["A", "C"]);
});
