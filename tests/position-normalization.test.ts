import test from "node:test";
import assert from "node:assert/strict";

import { normalizeFantasyPosition } from "../lib/position-normalization.ts";

test("normalizeFantasyPosition uses authoritative player metadata override first", () => {
  assert.equal(normalizeFantasyPosition("G", "Stephen Curry"), "PG/SG");
  assert.equal(normalizeFantasyPosition("F", "LeBron James"), "SF/PF");
});

test("normalizeFantasyPosition removes generic G/F labels", () => {
  assert.equal(normalizeFantasyPosition("G"), "PG/SG");
  assert.equal(normalizeFantasyPosition("F"), "SF/PF");
  assert.equal(normalizeFantasyPosition("g-f"), "SG/SF");
  assert.equal(normalizeFantasyPosition("f-c"), "PF/C");
});

test("normalizeFantasyPosition preserves valid fantasy labels", () => {
  assert.equal(normalizeFantasyPosition("PG"), "PG");
  assert.equal(normalizeFantasyPosition("SG/SF"), "SG/SF");
  assert.equal(normalizeFantasyPosition("SF / PF"), "SF/PF");
});
