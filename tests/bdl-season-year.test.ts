// tests/bdl-season-year.test.ts
//
// Verifies that getCurrentBdlSeasonYear returns the NBA season STARTING year,
// which is what the Ball Don't Lie API requires for season / seasons[] params.
// The companion getCurrentSeasonYear (kept for UI/business logic) returns the
// ENDING year — these two must stay distinct.

import test from "node:test";
import assert from "node:assert/strict";

import {
  getCurrentBdlSeasonYear,
  getCurrentSeasonYear,
  getCurrentSeasonLabel,
} from "../lib/fantasy/shared/season.ts";

// Construct a date at UTC midnight on the 15th of the given month/year so the
// helper's UTC month/year reads are unambiguous regardless of where the test
// runs.
function utcMid(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 15, 12, 0, 0));
}

test("BDL season year — May 2026 maps to 2025 (the live production bug)", () => {
  // April...September of YYYY belongs to the (YYYY-1)-YYYY NBA season.
  // Production logs in May 2026 showed season=2026 with 0 rows — exactly the
  // ending-year mistake this helper fixes.
  assert.equal(getCurrentBdlSeasonYear(utcMid(2026, 4 /* May */)), 2025);
  // Ending-year helper still returns 2026 — UI is unaffected by the fix.
  assert.equal(getCurrentSeasonYear(utcMid(2026, 4)), 2026);
  assert.equal(getCurrentSeasonLabel(utcMid(2026, 4)), "2025-26");
});

test("BDL season year — Nov 2025 maps to 2025 (Oct-Dec branch)", () => {
  assert.equal(getCurrentBdlSeasonYear(utcMid(2025, 10 /* Nov */)), 2025);
  assert.equal(getCurrentSeasonYear(utcMid(2025, 10)), 2026);
});

test("BDL season year — Sep 2026 maps to 2025 (end of 2025-26 season)", () => {
  // September is still part of the prior season (offseason — playoffs end in June).
  assert.equal(getCurrentBdlSeasonYear(utcMid(2026, 8 /* Sep */)), 2025);
  assert.equal(getCurrentSeasonYear(utcMid(2026, 8)), 2026);
});

test("BDL season year — Oct 2026 maps to 2026 (rollover to new season)", () => {
  // October is the cutover month: 2026-27 season begins.
  assert.equal(getCurrentBdlSeasonYear(utcMid(2026, 9 /* Oct */)), 2026);
  assert.equal(getCurrentSeasonYear(utcMid(2026, 9)), 2027);
  assert.equal(getCurrentSeasonLabel(utcMid(2026, 9)), "2026-27");
});

test("BDL season year — Oct 1 and Sep 30 boundary days (UTC)", () => {
  // Sep 30 UTC: still in 2025-26
  assert.equal(getCurrentBdlSeasonYear(new Date(Date.UTC(2026, 8, 30))), 2025);
  // Oct 1 UTC: rolled to 2026-27
  assert.equal(getCurrentBdlSeasonYear(new Date(Date.UTC(2026, 9, 1))), 2026);
});

test("BDL season year — ending year is always exactly one more than starting", () => {
  // Invariant across every month of an arbitrary year — keeps the two helpers
  // in lockstep so future edits to one don't silently desync them.
  for (let m = 0; m < 12; m++) {
    const d = utcMid(2026, m);
    assert.equal(getCurrentSeasonYear(d) - getCurrentBdlSeasonYear(d), 1, `month ${m}`);
  }
});
