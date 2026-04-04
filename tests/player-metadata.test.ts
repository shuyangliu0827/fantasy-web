import test from "node:test";
import assert from "node:assert/strict";

import { getCanonicalPlayerPosition, normalizePosition } from "../lib/player-metadata.ts";

test("normalizePosition expands generic single-letter positions", () => {
  assert.equal(normalizePosition("G"), "PG/SG");
  assert.equal(normalizePosition("F"), "SF/PF");
});

test("normalizePosition expands generic combo positions with hyphen or slash", () => {
  assert.equal(normalizePosition("G-F"), "SG/SF");
  assert.equal(normalizePosition("G/F"), "SG/SF");
  assert.equal(normalizePosition("F-C"), "PF/C");
  assert.equal(normalizePosition("F/C"), "PF/C");
});

test("getCanonicalPlayerPosition applies player override map before raw API position", () => {
  assert.equal(getCanonicalPlayerPosition("Stephen Curry", "G"), "PG/SG");
});

test("canonical output never returns bare G or F", () => {
  const samples = ["G", "F", "G/F", "F/C", "PG", "SG/SF"];
  const outputs = samples.map((p) => normalizePosition(p));
  for (const output of outputs) {
    assert.notEqual(output, "G");
    assert.notEqual(output, "F");
  }
});
