import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLineupInsight,
  renderLineupPostZh,
  renderLineupPostEn,
  renderLineupPostDraft,
} from "../lib/lineup-post-insight.ts";

test("filters active starters before selecting highlights", () => {
  const insight = buildLineupInsight({
    starters: [
      { name: "Active A", slot: "PG", position: "PG", projectedPoints: 42, hasGame: true },
      { name: "Inactive Star", slot: "SG", position: "SG", projectedPoints: 49, hasGame: false },
      { name: "Active B", slot: "SF", position: "SF", projectedPoints: 38, hasGame: true },
      { name: "Active C", slot: "PF", position: "PF", projectedPoints: 31, hasGame: true },
    ],
  });

  assert.deepEqual(insight.activeStarters.map((p) => p.name), ["Active A", "Active B", "Active C"]);
  assert.deepEqual(insight.inactiveStarters.map((p) => p.name), ["Inactive Star"]);
  assert.equal(insight.topPlayers.some((p) => p.name === "Inactive Star"), false);
});

test("top 2 and watch player are selected from active starters when >=3", () => {
  const insight = buildLineupInsight({
    starters: [
      { name: "A", projectedPoints: 41.2, hasGame: true },
      { name: "B", projectedPoints: 36.5, hasGame: true },
      { name: "C", projectedPoints: 29.1, hasGame: true },
      { name: "D", projectedPoints: 50.2, hasGame: false },
    ],
  });

  assert.equal(insight.highlightStrategy, "active_top2_watch1");
  assert.deepEqual(insight.topPlayers.map((p) => p.name), ["A", "B"]);
  assert.equal(insight.watchPlayer?.name, "C");
});

test("graceful fallback when active starters are fewer than 3", () => {
  const twoActive = buildLineupInsight({
    starters: [
      { name: "A", projectedPoints: 30, hasGame: true },
      { name: "B", projectedPoints: 28, hasGame: true },
    ],
  });
  assert.equal(twoActive.highlightStrategy, "active_two_simple");
  assert.equal(twoActive.watchPlayer, undefined);

  const oneActive = buildLineupInsight({
    starters: [{ name: "Solo", projectedPoints: 27, hasGame: true }],
  });
  assert.equal(oneActive.highlightStrategy, "active_one_focus");
  assert.equal(oneActive.topPlayers.length, 1);

  const zeroActive = buildLineupInsight({
    starters: [{ name: "Idle", projectedPoints: 45, hasGame: false }],
  });
  assert.equal(zeroActive.highlightStrategy, "no_active");
  assert.equal(zeroActive.topPlayers.length, 0);
});

test("graceful fallback when active starters have no valid projections", () => {
  const insight = buildLineupInsight({
    starters: [
      { name: "A", hasGame: true },
      { name: "B", hasGame: true },
      { name: "C", hasGame: true },
    ],
  });

  assert.equal(insight.highlightStrategy, "active_no_scores");
  assert.equal(insight.topPlayers.length, 2);
  assert.equal(insight.watchPlayer, undefined);
});

test("zh/en rendering are generated from same insight and watch tone stays positive", () => {
  const insight = buildLineupInsight({
    starters: [
      { name: "Brunson", projectedPoints: 43, hasGame: true },
      { name: "Edwards", projectedPoints: 39, hasGame: true },
      { name: "Butler", projectedPoints: 31, hasGame: true },
    ],
  });

  const zh = renderLineupPostZh(insight);
  const en = renderLineupPostEn(insight);

  assert.notEqual(zh.body, en.body);
  assert.equal(renderLineupPostDraft(insight, "zh").title, zh.title);
  assert.equal(renderLineupPostDraft(insight, "en").title, en.title);

  assert.equal(/不行|拉胯|糟糕/.test(zh.body), false);
  assert.equal(/bad|weak|terrible/.test(en.body.toLowerCase()), false);
  assert.equal(/值得关注|超过预期|worth watching|beat expectation/i.test(`${zh.body} ${en.body}`), true);
});

test("no crashes on partial lineup data", () => {
  const insight = buildLineupInsight({ starters: [], bench: [] });
  const zh = renderLineupPostZh(insight);

  assert.equal(typeof zh.title, "string");
  assert.equal(typeof zh.body, "string");
  assert.equal(zh.body.length > 0, true);
});
