import test from "node:test";
import assert from "node:assert/strict";

import { buildLineupPostDraft } from "../lib/lineup-post-draft.ts";

test("buildLineupPostDraft produces deterministic template output", () => {
  const draft = buildLineupPostDraft({
    userId: "user-1",
    leagueId: "league-1",
    lineupDate: "2026-04-13",
    generatedAt: "2026-04-13T00:00:00.000Z",
    starters: [
      { id: "p1", name: "Stephen Curry", slot: "PG", projectedPoints: 45.2 },
      { id: "p2", name: "Jayson Tatum", slot: "SF", projectedPoints: 40.3 },
    ],
    bench: [{ id: "p3", name: "Tyrese Maxey", slot: "BE1", projectedPoints: 33.1 }],
  });

  assert.equal(draft.title, "My lineup for tonight");
  assert.equal(
    draft.body,
    "Starters: PG: Stephen Curry, SF: Jayson Tatum\nBench: BE1: Tyrese Maxey\nProjected points: 85.5\nBiggest bet tonight: Stephen Curry"
  );
  assert.equal(draft.metadata.projected_points, 85.5);
  assert.equal(draft.metadata.lineup_date, "2026-04-13");
  assert.equal(draft.metadata.generated_at, "2026-04-13T00:00:00.000Z");
});

test("buildLineupPostDraft omits projected points line when absent", () => {
  const draft = buildLineupPostDraft({
    starters: [{ id: "p1", name: "Mikal Bridges", slot: "SF" }],
    bench: [],
    generatedAt: "2026-04-13T00:00:00.000Z",
  });

  assert.equal(draft.body.includes("Projected points:"), false);
  assert.equal(draft.metadata.projected_points, undefined);
});

test("buildLineupPostDraft handles partial lineup data without crashing", () => {
  const draft = buildLineupPostDraft({
    starters: [],
    generatedAt: "2026-04-13T00:00:00.000Z",
  });

  assert.equal(draft.body.includes("Starters: TBD"), true);
  assert.equal(draft.body.includes("Trusting this group to carry the matchup"), true);
});

test("buildLineupPostDraft includes week metadata and week title", () => {
  const draft = buildLineupPostDraft({
    userId: "user-1",
    leagueId: "league-1",
    lineupWeek: 22,
    generatedAt: "2026-04-13T00:00:00.000Z",
    starters: [{ name: "Nikola Jokic", slot: "C", projectedPoints: 51.1 }],
  });

  assert.equal(draft.title, "My lineup for this week");
  assert.equal(draft.metadata.lineup_week, 22);
  assert.equal(draft.metadata.league_id, "league-1");
  assert.equal(draft.metadata.user_id, "user-1");
});
