import test from "node:test";
import assert from "node:assert/strict";
import { calcPointsAwarded, assignRanks, getWeekStart, getWeekEnd, toDateStr } from "../lib/contest-points.ts";

test("calcPointsAwarded - tier thresholds", () => {
  // Rank 1 always gets top prize.
  assert.equal(calcPointsAwarded(1, 100), 500);
  // Ranks 2–3 → 400.
  assert.equal(calcPointsAwarded(2, 100), 400);
  assert.equal(calcPointsAwarded(3, 100), 400);
  // Ranks 4–10 → 300.
  assert.equal(calcPointsAwarded(4, 100), 300);
  assert.equal(calcPointsAwarded(10, 100), 300);
  // Top 10%: rank 11 / 100 = 11% → NOT top 10%, so check boundary.
  assert.equal(calcPointsAwarded(10, 100), 300);  // still rank-based ≤10
  assert.equal(calcPointsAwarded(11, 200), 200);  // 11/200 = 5.5% → top 10%
  // Top 25%: rank 20 / 100 = 20% → top 25% but not 10%.
  assert.equal(calcPointsAwarded(20, 100), 100);
  // Participation floor: rank 30/100 = 30% → outside top 25%.
  assert.equal(calcPointsAwarded(30, 100), 20);
  assert.equal(calcPointsAwarded(100, 100), 20);
});

test("calcPointsAwarded - small contest edge cases", () => {
  // 1-person contest: rank 1 always gets 500.
  assert.equal(calcPointsAwarded(1, 1), 500);
  // 5-person contest: rank 2 still hits the ≤3 tier.
  assert.equal(calcPointsAwarded(2, 5), 400);
  // rank 4 / 5: rank-based rules check first — rank 4 ≤ 10 → 300 pts.
  // (Rank-based tiers apply regardless of total entries.)
  assert.equal(calcPointsAwarded(4, 5), 300);
  // rank 11 out of 11: 11/11 = 100% → only participation floor.
  assert.equal(calcPointsAwarded(11, 11), 20);
});

test("assignRanks - no ties", () => {
  const entries = [
    { id: "a", total_fpts: 100 },
    { id: "b", total_fpts: 80 },
    { id: "c", total_fpts: 60 },
  ];
  const ranks = assignRanks(entries);
  assert.equal(ranks.get("a"), 1);
  assert.equal(ranks.get("b"), 2);
  assert.equal(ranks.get("c"), 3);
});

test("assignRanks - competition ranking with gaps on ties", () => {
  // scores: 100, 80, 80, 60 → ranks 1, 2, 2, 4 (gap after tie)
  const entries = [
    { id: "a", total_fpts: 100 },
    { id: "b", total_fpts: 80 },
    { id: "c", total_fpts: 80 },
    { id: "d", total_fpts: 60 },
  ];
  const ranks = assignRanks(entries);
  assert.equal(ranks.get("a"), 1);
  assert.equal(ranks.get("b"), 2);
  assert.equal(ranks.get("c"), 2);
  assert.equal(ranks.get("d"), 4); // gap: position 3 is occupied by the tied pair
});

test("assignRanks - all tied", () => {
  const entries = [
    { id: "x", total_fpts: 50 },
    { id: "y", total_fpts: 50 },
  ];
  const ranks = assignRanks(entries);
  assert.equal(ranks.get("x"), 1);
  assert.equal(ranks.get("y"), 1);
});

test("getWeekStart returns Monday UTC", () => {
  // 2026-04-29 is a Wednesday; Monday of that week is 2026-04-27.
  const d = new Date("2026-04-29T12:00:00Z");
  assert.equal(toDateStr(getWeekStart(d)), "2026-04-27");
});

test("getWeekEnd returns Sunday UTC", () => {
  const d = new Date("2026-04-29T12:00:00Z");
  assert.equal(toDateStr(getWeekEnd(d)), "2026-05-03");
});

test("getWeekStart handles Sunday correctly (Sun belongs to previous week's Monday)", () => {
  // 2026-04-26 is a Sunday; its week's Monday is 2026-04-20.
  const d = new Date("2026-04-26T00:00:00Z");
  assert.equal(toDateStr(getWeekStart(d)), "2026-04-20");
});

test("getWeekStart handles Monday correctly (Monday is its own week start)", () => {
  const d = new Date("2026-04-27T00:00:00Z");
  assert.equal(toDateStr(getWeekStart(d)), "2026-04-27");
});
