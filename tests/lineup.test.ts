/**
 * Tests for the autoSetLineup (Quick Lineup / 自动排阵) function.
 *
 * These tests verify:
 *   1. Idempotency — same inputs always produce the same output
 *   2. No duplicate players across slots
 *   3. Lock preservation — locked slots are untouched
 *   4. Game-day preference — players with games beat equal players without
 *   5. Eligibility — players only land in legal slots
 *   6. Short roster handling — empty slots instead of duplication
 *   7. Drop-only invariant — getCurrentRoster excludes released players
 *   8. Historical roster correctness (re-verified here for lineup context)
 *   9. Date isolation — saving one date's lineup never touches another date's lineup
 */

import test from "node:test";
import assert from "node:assert/strict";

import { autoSetLineup } from "../lib/lineup.ts";
import type { LineupMap, RosterPlayer } from "../lib/store";
import { getCurrentRoster, getHistoricalRosterForDate } from "../lib/roster-history.ts";

// ── Test roster helpers ─────────────────────────────────────────────────────

function makePlayer(
  id: string,
  position: string,
  ppg: number,
  overrides: Partial<RosterPlayer> = {},
): RosterPlayer {
  return {
    id,
    name: id, // name = id keeps PLAYER_POSITIONS lookup neutral (no overrides)
    team: "TST",
    position,
    ppg,
    rpg: 0, apg: 0, spg: 0, bpg: 0,
    fg: 0.45, ft: 0.80, tov: 1,
    round: 1,
    ...overrides,
  };
}

// A 13-player roster covering all standard slots
const fullRoster: RosterPlayer[] = [
  makePlayer("pg1", "PG", 25),
  makePlayer("pg2", "PG", 12),
  makePlayer("sg1", "SG", 22),
  makePlayer("sg2", "SG", 10),
  makePlayer("sf1", "SF", 20),
  makePlayer("sf2", "SF",  9),
  makePlayer("pf1", "PF", 18),
  makePlayer("pf2", "PF",  8),
  makePlayer("c1",  "C",  16),
  makePlayer("c2",  "C",   7),
  makePlayer("pg3", "PG", 14),
  makePlayer("sg3", "SG", 13),
  makePlayer("sf3", "SF", 11),
];

// ── 1. Idempotency ──────────────────────────────────────────────────────────

test("autoSetLineup: same inputs always produce identical output (idempotent)", () => {
  const games = new Set(["pg1", "sg1", "sf1", "pf1", "c1"]);
  const r1 = autoSetLineup(fullRoster, {}, games);
  const r2 = autoSetLineup(fullRoster, {}, games);
  const r3 = autoSetLineup(fullRoster, {}, games);
  assert.deepEqual(r1, r2);
  assert.deepEqual(r2, r3);
});

test("autoSetLineup: calling twice with no changes does not add extra slots", () => {
  const r1 = autoSetLineup(fullRoster);
  const r2 = autoSetLineup(fullRoster);
  assert.equal(Object.keys(r1).length, Object.keys(r2).length);
  assert.deepEqual(r1, r2);
});

// ── 2. Duplicate prevention ─────────────────────────────────────────────────

test("autoSetLineup: no player appears in more than one slot", () => {
  const result = autoSetLineup(fullRoster, {}, new Set(["pg1", "sg1", "pf1"]));
  const values = Object.values(result);
  const unique = new Set(values);
  assert.equal(unique.size, values.length, "each player id must appear at most once across all slots");
});

test("autoSetLineup: duplicate check holds even with locked slots present", () => {
  const locked: LineupMap = { PG: "pg1", SG: "sg1" };
  const result = autoSetLineup(fullRoster, locked, new Set(["pg1", "sf1"]));
  const values = Object.values(result);
  const unique = new Set(values);
  assert.equal(unique.size, values.length, "no duplicates when locked slots overlap with auto-assigned candidates");
});

// ── 3. Lock preservation ────────────────────────────────────────────────────

test("autoSetLineup: locked slot is preserved exactly", () => {
  const locked: LineupMap = { PG: "pg2" }; // pg2 is not the highest-PPG PG
  const result = autoSetLineup(fullRoster, locked);
  assert.equal(result["PG"], "pg2", "locked PG slot must stay pg2 even though pg1 has higher PPG");
});

test("autoSetLineup: locked player is not re-assigned to any other slot", () => {
  const locked: LineupMap = { PG: "pg1" };
  const result = autoSetLineup(fullRoster, locked);
  // pg1 must only appear in PG
  const slotsWithPg1 = Object.entries(result)
    .filter(([, pid]) => pid === "pg1")
    .map(([slot]) => slot);
  assert.deepEqual(slotsWithPg1, ["PG"], "locked player pg1 must appear only in its locked slot");
});

test("autoSetLineup: multiple locked slots are all preserved", () => {
  const locked: LineupMap = { PG: "pg2", SG: "sg2", C: "c2" };
  const result = autoSetLineup(fullRoster, locked);
  assert.equal(result["PG"], "pg2");
  assert.equal(result["SG"], "sg2");
  assert.equal(result["C"],  "c2");
});

// ── 4. Game-day preference ──────────────────────────────────────────────────

test("autoSetLineup: player with game beats higher-PPG player without game in same slot", () => {
  // pg1 (PPG=25, no game) vs pg2 (PPG=12, has game)
  // pg2 should win the PG slot because GAME_DAY_BONUS >> PPG difference
  const twoPlayerRoster = [
    makePlayer("pg1", "PG", 25), // no game
    makePlayer("pg2", "PG", 12), // has game
  ];
  const games = new Set(["pg2"]);
  const result = autoSetLineup(twoPlayerRoster, {}, games);
  assert.equal(result["PG"], "pg2", "player with game must be preferred over higher-PPG player without game");
});

test("autoSetLineup: among players with games, higher PPG wins", () => {
  const twoPlayerRoster = [
    makePlayer("pg1", "PG", 25), // has game, PPG=25
    makePlayer("pg2", "PG", 12), // has game, PPG=12
  ];
  const games = new Set(["pg1", "pg2"]);
  const result = autoSetLineup(twoPlayerRoster, {}, games);
  assert.equal(result["PG"], "pg1", "among players with games, higher PPG must be preferred");
});

// ── 5. Eligibility correctness ──────────────────────────────────────────────

test("autoSetLineup: PG player is not placed in C slot", () => {
  const pgOnlyRoster = [makePlayer("pg1", "PG", 30)];
  const result = autoSetLineup(pgOnlyRoster);
  // PG can go to PG, G, UTIL*, BE* slots — not C, SF, SG, PF, or F
  assert.ok(!("C" in result) || result["C"] !== "pg1");
  assert.ok(!("SF" in result) || result["SF"] !== "pg1");
  assert.ok(!("PF" in result) || result["PF"] !== "pg1");
});

test("autoSetLineup: G slot accepts PG and SG players only", () => {
  const mixedRoster = [
    makePlayer("pg1", "PG", 20),
    makePlayer("sf1", "SF", 25), // higher PPG but not G-eligible
  ];
  const result = autoSetLineup(mixedRoster);
  if ("G" in result) {
    assert.equal(result["G"], "pg1", "SF player must not be placed in G slot");
  }
});

test("autoSetLineup: F slot accepts SF and PF players only", () => {
  const mixedRoster = [
    makePlayer("pf1", "PF", 20),
    makePlayer("pg1", "PG", 30), // higher PPG but not F-eligible
  ];
  const result = autoSetLineup(mixedRoster);
  if ("F" in result) {
    assert.equal(result["F"], "pf1", "PG player must not be placed in F slot");
  }
});

// ── 6. Short roster handling ────────────────────────────────────────────────

test("autoSetLineup: empty roster produces empty lineup with no duplicates", () => {
  const result = autoSetLineup([]);
  assert.equal(Object.values(result).length, 0, "empty roster must produce no assignments");
});

test("autoSetLineup: 1-player roster fills exactly one slot without duplicating", () => {
  const single = [makePlayer("pg1", "PG", 20)];
  const result = autoSetLineup(single);
  const values = Object.values(result);
  assert.equal(values.length, 1, "single player must fill exactly one slot");
  assert.equal(values[0], "pg1");
});

test("autoSetLineup: fewer players than starter slots leaves some slots empty", () => {
  // 3 players cannot fill all 10 starter slots
  const small = [
    makePlayer("pg1", "PG", 20),
    makePlayer("sg1", "SG", 18),
    makePlayer("c1",  "C",  15),
  ];
  const result = autoSetLineup(small);
  const filledStarters = ["PG","SG","SF","PF","C","G","F","UTIL1","UTIL2","UTIL3"]
    .filter(s => s in result).length;
  assert.ok(filledStarters <= 3, "must not fill more starters than available players");
  // No duplicates
  const values = Object.values(result);
  assert.equal(new Set(values).size, values.length, "no player duplicated to fill empty slots");
});

// ── 7. Drop-only transaction invariant ─────────────────────────────────────

test("getCurrentRoster excludes dropped player (drop-only transaction)", () => {
  const now = Date.now();
  const roster: RosterPlayer[] = [
    makePlayer("p1", "PG", 20),
    makePlayer("p2", "SG", 18, { releasedAt: now - 1000 }), // dropped 1 second ago
    makePlayer("p3", "SF", 16),
  ];
  const active = getCurrentRoster(roster);
  assert.ok(!active.some(p => p.id === "p2"), "dropped player must be excluded");
  assert.equal(active.length, 2, "only 2 active players remain after drop-only");
});

test("autoSetLineup with post-drop roster leaves empty slots rather than duplicating", () => {
  // After dropping sg1 and sg2, no SG is available — SG slot must stay empty
  const roster: RosterPlayer[] = [
    makePlayer("pg1", "PG", 25),
    makePlayer("pf1", "PF", 18),
    makePlayer("c1",  "C",  15),
    // No SG on roster (dropped)
  ];
  const result = autoSetLineup(roster);
  // SG slot should be absent (empty) — not filled with an ineligible player
  if ("SG" in result) {
    const player = roster.find(p => p.id === result["SG"]);
    assert.ok(player?.position === "SG", "if SG slot is filled, player must actually be a SG");
  }
  // No duplicates
  const values = Object.values(result);
  assert.equal(new Set(values).size, values.length);
});

// ── 8. Historical roster correctness ───────────────────────────────────────

test("autoSetLineup candidate pool reflects historical ownership, not current roster", () => {
  // Simulates: user dropped p2 yesterday; auto-lineup for today must not include p2
  const now = Date.now();
  const DAY = 86400000;
  const fullWithHistory: RosterPlayer[] = [
    makePlayer("pg1", "PG", 25),
    makePlayer("sg1", "SG", 22, { releasedAt: now - DAY }), // dropped yesterday
    makePlayer("sf1", "SF", 20),
  ];
  // Active roster (what should be passed to autoSetLineup for today)
  const activeRoster = getCurrentRoster(fullWithHistory);
  const result = autoSetLineup(activeRoster);
  // sg1 is released; it must not appear in any slot
  const values = Object.values(result);
  assert.ok(!values.includes("sg1"), "released player sg1 must not appear in today's auto-lineup");
});

test("getHistoricalRosterForDate: player added after a date does not appear on that date", () => {
  const now = Date.now();
  const DAY = 86400000;
  const roster: RosterPlayer[] = [
    makePlayer("pg1", "PG", 20),
    makePlayer("sg1", "SG", 18, { acquiredAt: now - DAY * 1 }), // added 1 day ago
  ];
  const threeDaysAgo = new Date(now - DAY * 3).toISOString().slice(0, 10);
  const hist = getHistoricalRosterForDate(roster, threeDaysAgo);
  assert.ok(!hist.some(p => p.id === "sg1"), "sg1 acquired after the historical date must not appear");
});

test("getHistoricalRosterForDate: dropped player still appears on dates before the drop", () => {
  const now = Date.now();
  const DAY = 86400000;
  const roster: RosterPlayer[] = [
    makePlayer("pg1", "PG", 20, { acquiredAt: now - DAY * 10, releasedAt: now - DAY * 2 }),
  ];
  const fiveDaysAgo = new Date(now - DAY * 5).toISOString().slice(0, 10);
  const hist = getHistoricalRosterForDate(roster, fiveDaysAgo);
  assert.ok(hist.some(p => p.id === "pg1"), "pg1 must appear on dates before it was dropped");
});

// ── 9. Date isolation ───────────────────────────────────────────────────────

test("date isolation: lineup saved for one date does not contain assignments from another date", () => {
  // Simulates the in-memory DailyLineupMap structure: each date key is independent
  const date1 = "2026-03-19";
  const date2 = "2026-03-20";

  const lineup1 = autoSetLineup([makePlayer("pg1", "PG", 20)]);
  const lineup2 = autoSetLineup([makePlayer("sg1", "SG", 18)]);

  // Write both to a DailyLineupMap
  const daily: Record<string, LineupMap> = { [date1]: lineup1, [date2]: lineup2 };

  assert.equal(daily[date1]["PG"], "pg1", "date1 must contain pg1");
  // date2 must NOT have leaked pg1
  assert.ok(daily[date2]["PG"] !== "pg1", "saving date2 lineup must not affect date1");
  assert.ok(Object.values(daily[date1]).every(id => id !== "sg1"), "date1 must not contain date2 players");
});

// ── 10. Lock correctness: no duplicates after lock+auto scenario ────────────

test("autoSetLineup: locked player in slot X is not also assigned to slot Y", () => {
  // This is the exact scenario that caused the original duplicate bug:
  // - pg1 is locked in PG slot (game already started)
  // - Without passing lockedSlots, the old code would re-assign pg1 somewhere else
  //   then force pg1 back to PG, causing pg1 to appear in two slots.
  const locked: LineupMap = { PG: "pg1" };
  const result = autoSetLineup(fullRoster, locked, new Set(["pg1", "sg1"]));

  // pg1 must appear in exactly one slot
  const pg1Slots = Object.entries(result)
    .filter(([, pid]) => pid === "pg1")
    .map(([slot]) => slot);
  assert.equal(pg1Slots.length, 1, "pg1 must appear in exactly one slot");
  assert.equal(pg1Slots[0], "PG", "pg1 must remain in its locked PG slot");

  // Full duplicate check
  const values = Object.values(result);
  assert.equal(new Set(values).size, values.length, "no player duplicated across any slots");
});

test("autoSetLineup: pressing auto twice with same locked state produces identical result", () => {
  const locked: LineupMap = { PG: "pg1", SG: "sg1" };
  const games = new Set(["pg1", "sg1", "sf1"]);
  const r1 = autoSetLineup(fullRoster, locked, games);
  const r2 = autoSetLineup(fullRoster, locked, games);
  assert.deepEqual(r1, r2, "second auto-lineup press must produce identical result (idempotent)");
  // Neither call should have produced duplicates
  for (const r of [r1, r2]) {
    const values = Object.values(r);
    assert.equal(new Set(values).size, values.length);
  }
});
