import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLineupInsight,
  renderLineupPostZh,
  renderLineupPostEn,
  renderLineupPostDraft,
} from "../lib/lineup-post-insight.ts";

test("buildLineupInsight is deterministic for same input", () => {
  const input = {
    lineupDate: "2026-04-13",
    starters: [
      { name: "Luka Doncic", slot: "PG", position: "PG", projectedPoints: 48.1 },
      { name: "Jayson Tatum", slot: "SF", position: "SF", projectedPoints: 42.4 },
      { name: "Brook Lopez", slot: "C", position: "C", projectedPoints: 21.4 },
    ],
    bench: [
      { name: "Tyrese Maxey", slot: "BE1", position: "PG", projectedPoints: 40.9 },
      { name: "Deni Avdija", slot: "BE2", position: "SF", projectedPoints: 25.2 },
    ],
  };

  const first = buildLineupInsight(input);
  const second = buildLineupInsight(input);
  assert.deepEqual(first, second);
  assert.equal(first.projectedTotal, 111.9);
});

test("zh/en renderers derive different phrasing from same insight", () => {
  const insight = buildLineupInsight({
    starters: [{ name: "Shai Gilgeous-Alexander", slot: "PG", position: "PG", projectedPoints: 44.2 }],
    bench: [{ name: "Cade Cunningham", slot: "BE1", position: "PG", projectedPoints: 41.1 }],
  });

  const zh = renderLineupPostZh(insight);
  const en = renderLineupPostEn(insight);

  assert.notEqual(zh.title, en.title);
  assert.notEqual(zh.body, en.body);
  assert.equal(renderLineupPostDraft(insight, "zh").title, zh.title);
  assert.equal(renderLineupPostDraft(insight, "en").title, en.title);
});

test("gracefully omits projected total sentence when projections are missing", () => {
  const insight = buildLineupInsight({
    starters: [{ name: "Mikal Bridges", slot: "SF", position: "SF" }],
    bench: [],
  });

  const en = renderLineupPostEn(insight);
  assert.equal(en.body.includes("Projected total"), false);
  assert.equal(insight.projectedTotal, undefined);
});

test("partial lineup does not crash and still returns publishable body", () => {
  const insight = buildLineupInsight({ starters: [], bench: [] });
  const zh = renderLineupPostZh(insight);

  assert.equal(typeof zh.title, "string");
  assert.equal(typeof zh.body, "string");
  assert.equal(zh.body.length > 0, true);
});
