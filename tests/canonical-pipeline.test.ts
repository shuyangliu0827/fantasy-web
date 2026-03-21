import test from "node:test";
import assert from "node:assert/strict";

import { filterValidStats, computeStandingsFromMatchups } from "../lib/canonical-pipeline.ts";
import type { MatchupRecord } from "../lib/canonical-pipeline.ts";

// ── Rule A: filterValidStats ──────────────────────────────────────────────────

const FULL_STATS = { min: 30, fgm: 6, fga: 12, fg3m: 2, ftm: 4, fta: 4, reb: 5, ast: 8, stl: 1, blk: 0, tov: 2, pts: 18, fpts: 32 };
const ZERO_STATS = { min: 0,  fgm: 0, fga: 0,  fg3m: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0,  fpts: 0  };
const MIN_STATS  = { min: 5,  fgm: 0, fga: 0,  fg3m: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0,  fpts: 0  };

test("filterValidStats: keeps rows with positive fpts", () => {
  const result = filterValidStats({ p1: FULL_STATS });
  assert.ok("p1" in result, "valid player must be retained");
});

test("filterValidStats: removes rows with fpts=0 and min=0 (null-safe rule)", () => {
  const result = filterValidStats({ p1: ZERO_STATS });
  assert.equal(Object.keys(result).length, 0, "all-zero row must be filtered out");
});

test("filterValidStats: keeps rows with min>0 even if fpts=0 (DNP placeholder)", () => {
  const result = filterValidStats({ p1: MIN_STATS });
  assert.ok("p1" in result, "row with nonzero minutes must be retained");
});

test("filterValidStats: mixed map retains only valid rows", () => {
  const result = filterValidStats({ good: FULL_STATS, zero: ZERO_STATS, played: MIN_STATS });
  assert.deepEqual(Object.keys(result).sort(), ["good", "played"]);
});

test("filterValidStats: empty map returns empty map", () => {
  assert.deepEqual(filterValidStats({}), {});
});

// ── Rule D: computeStandingsFromMatchups ──────────────────────────────────────

const T1 = "team-1";
const T2 = "team-2";
const T3 = "team-3";
const T4 = "team-4";

test("computeStandingsFromMatchups: win increments winner wins and loser losses", () => {
  const matchups: MatchupRecord[] = [
    { home_team_id: T1, away_team_id: T2, winner_id: T1, home_score: 300, away_score: 250 },
  ];
  const result = computeStandingsFromMatchups([T1, T2], matchups);
  assert.equal(result[T1].wins,   1);
  assert.equal(result[T1].losses, 0);
  assert.equal(result[T2].wins,   0);
  assert.equal(result[T2].losses, 1);
});

test("computeStandingsFromMatchups: tie increments both teams ties", () => {
  const matchups: MatchupRecord[] = [
    { home_team_id: T1, away_team_id: T2, winner_id: null, home_score: 300, away_score: 300 },
  ];
  const result = computeStandingsFromMatchups([T1, T2], matchups);
  assert.equal(result[T1].ties, 1);
  assert.equal(result[T2].ties, 1);
  assert.equal(result[T1].wins, 0);
  assert.equal(result[T2].wins, 0);
});

test("computeStandingsFromMatchups: points_for and points_against are correct", () => {
  const matchups: MatchupRecord[] = [
    { home_team_id: T1, away_team_id: T2, winner_id: T1, home_score: 350, away_score: 280 },
  ];
  const result = computeStandingsFromMatchups([T1, T2], matchups);
  assert.equal(result[T1].pointsFor,     350);
  assert.equal(result[T1].pointsAgainst, 280);
  assert.equal(result[T2].pointsFor,     280);
  assert.equal(result[T2].pointsAgainst, 350);
});

test("computeStandingsFromMatchups: multiple weeks accumulate correctly", () => {
  const matchups: MatchupRecord[] = [
    { home_team_id: T1, away_team_id: T2, winner_id: T1, home_score: 300, away_score: 250 },
    { home_team_id: T3, away_team_id: T1, winner_id: T1, home_score: 270, away_score: 320 }, // T1 is away, wins
    { home_team_id: T2, away_team_id: T3, winner_id: T2, home_score: 310, away_score: 290 },
  ];
  const result = computeStandingsFromMatchups([T1, T2, T3], matchups);
  // T1: 2 wins (beat T2 as home, beat T3 as away), pf = 300+320 = 620
  assert.equal(result[T1].wins, 2);
  assert.equal(result[T1].losses, 0);
  assert.equal(result[T1].pointsFor, 300 + 320);
  // T2: 1 win (beat T3), 1 loss (to T1), pf = 250+310 = 560
  assert.equal(result[T2].wins, 1);
  assert.equal(result[T2].losses, 1);
  assert.equal(result[T2].pointsFor, 250 + 310);
});

test("computeStandingsFromMatchups: unknown team IDs are skipped without error", () => {
  const matchups: MatchupRecord[] = [
    { home_team_id: "unknown-1", away_team_id: "unknown-2", winner_id: "unknown-1", home_score: 300, away_score: 250 },
  ];
  // Only T1/T2 in teamIds; unknown teams are not in records, should be silently skipped
  const result = computeStandingsFromMatchups([T1, T2], matchups);
  assert.equal(result[T1].wins, 0);
  assert.equal(result[T2].wins, 0);
});

test("computeStandingsFromMatchups: empty matchups returns zeroed records for all teams", () => {
  const result = computeStandingsFromMatchups([T1, T2, T3, T4], []);
  for (const teamId of [T1, T2, T3, T4]) {
    const r = result[teamId];
    assert.equal(r.wins,          0);
    assert.equal(r.losses,        0);
    assert.equal(r.ties,          0);
    assert.equal(r.pointsFor,     0);
    assert.equal(r.pointsAgainst, 0);
  }
});

test("computeStandingsFromMatchups: score correction recalculates PF/PA correctly", () => {
  // Simulates what happens when a score is corrected: the matchups row has the new score,
  // and recomputing from matchups gives the correct PF/PA.
  const matchups: MatchupRecord[] = [
    { home_team_id: T1, away_team_id: T2, winner_id: T1, home_score: 310, away_score: 260 }, // corrected from 280
  ];
  const result = computeStandingsFromMatchups([T1, T2], matchups);
  assert.equal(result[T1].pointsFor, 310); // reflects corrected score
  assert.equal(result[T2].pointsFor, 260);
});
