import test from "node:test";
import assert from "node:assert/strict";

import {
  calcProjectedPoints,
  calcSalary,
  calcValue,
  computeCapState,
  SALARY_CAP,
  SALARY_MIN,
  SALARY_MAX,
  ROSTER_SIZE,
} from "../lib/contest-salary.ts";

test("projected points weights last-5 at 60% and season at 40%", () => {
  // Equal inputs collapse to the input.
  assert.equal(calcProjectedPoints(20, 20), 20);
  // Last-5 hot streak pulls the projection up over the season mean.
  assert.equal(calcProjectedPoints(40, 20), 0.6 * 40 + 0.4 * 20);
  // Slumping recent form drags below season mean.
  assert.equal(calcProjectedPoints(10, 30), 0.6 * 10 + 0.4 * 30);
  // NaN / undefined fall back to 0 so a missing recent average doesn't
  // poison the salary curve.
  assert.equal(calcProjectedPoints(NaN, 25), 10); // 0.6*0 + 0.4*25
  assert.equal(calcProjectedPoints(15, NaN), 9);  // 0.6*15 + 0.4*0
});

test("salary follows raw curve, rounds to $100, clamps to [3000, 12000]", () => {
  // 30 fpt projection: raw = 30*220 + 1500 = 8100, round-to-100 = 8100.
  assert.equal(calcSalary(30), 8100);
  // 10 fpt projection: raw = 10*220 + 1500 = 3700, round-to-100 = 3700.
  assert.equal(calcSalary(10), 3700);
  // 0 fpt projection clamps to the floor.
  assert.equal(calcSalary(0), SALARY_MIN);
  // 5 fpt projection: raw = 5*220 + 1500 = 2600 → clamped to floor.
  assert.equal(calcSalary(5), SALARY_MIN);
  // 50 fpt projection: raw = 50*220 + 1500 = 12500 → clamped to ceiling.
  assert.equal(calcSalary(50), SALARY_MAX);
  // 100 fpt projection: way above ceiling, clamped.
  assert.equal(calcSalary(100), SALARY_MAX);
  // Negative / NaN coerced to 0 → floor.
  assert.equal(calcSalary(-5), SALARY_MIN);
  assert.equal(calcSalary(NaN), SALARY_MIN);
});

test("salary always rounds to a multiple of $100", () => {
  for (const proj of [12.3, 17.7, 24.4, 31.9, 40.0]) {
    const s = calcSalary(proj);
    assert.equal(s % 100, 0, `salary ${s} for proj ${proj} is not a multiple of 100`);
    assert.ok(s >= SALARY_MIN && s <= SALARY_MAX);
  }
});

test("value scales projected points per $1k of salary", () => {
  // 30 fpts at $8000 → 3.75 value.
  assert.equal(calcValue(30, 8000), 3.75);
  // Higher salary at same projection → lower value.
  assert.ok(calcValue(30, 10000) < calcValue(30, 8000));
  // Zero / non-positive salary returns 0 (no division blow-up).
  assert.equal(calcValue(30, 0), 0);
  assert.equal(calcValue(30, -100), 0);
  assert.equal(calcValue(NaN, 8000), 0);
});

test("cap state aggregates totals and remaining budget per empty slot", () => {
  // Empty lineup.
  const empty = computeCapState([0, 0, 0, 0, 0]);
  assert.equal(empty.totalSalary, 0);
  assert.equal(empty.filled, 0);
  assert.equal(empty.emptySlots, ROSTER_SIZE);
  assert.equal(empty.remaining, SALARY_CAP);
  assert.equal(empty.avgPerEmptySlot, Math.floor(SALARY_CAP / ROSTER_SIZE));
  assert.equal(empty.overCap, false);

  // Two filled, three empty — remaining budget is divided across the empty slots.
  const partial = computeCapState([10000, 8000, 0, 0, 0]);
  assert.equal(partial.totalSalary, 18000);
  assert.equal(partial.filled, 2);
  assert.equal(partial.emptySlots, 3);
  assert.equal(partial.remaining, SALARY_CAP - 18000);
  assert.equal(partial.avgPerEmptySlot, Math.floor((SALARY_CAP - 18000) / 3));
  assert.equal(partial.overCap, false);

  // Full lineup right at the cap.
  const atCap = computeCapState([8400, 8400, 8400, 8400, 8400]);
  assert.equal(atCap.totalSalary, SALARY_CAP);
  assert.equal(atCap.filled, ROSTER_SIZE);
  assert.equal(atCap.emptySlots, 0);
  assert.equal(atCap.avgPerEmptySlot, 0); // no empty slots → no per-slot avg
  assert.equal(atCap.overCap, false);

  // Over the cap.
  const over = computeCapState([12000, 12000, 12000, 12000, 12000]);
  assert.equal(over.totalSalary, 60000);
  assert.equal(over.remaining, -18000);
  assert.equal(over.overCap, true);
});
