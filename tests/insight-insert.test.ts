import test from "node:test";
import assert from "node:assert/strict";

import { buildInsightInsertPayload } from "../lib/insight-insert.ts";

test("buildInsightInsertPayload keeps only supported insert fields", () => {
  const payload = buildInsightInsertPayload(
    {
      title: "  My lineup call  ",
      body: "  Tonight I'm betting on upside.  ",
      tags: ["lineup"],
      images: [],
      cover_url: undefined,
    },
    "user-1"
  ) as Record<string, unknown>;

  assert.deepEqual(Object.keys(payload).sort(), [
    "author_id",
    "body",
    "content_type",
    "cover_url",
    "heat",
    "images",
    "tags",
    "title",
  ]);
  assert.equal(payload.title, "My lineup call");
  assert.equal(payload.body, "Tonight I'm betting on upside.");
  assert.equal("post_type" in payload, false);
  assert.equal("lineup_context" in payload, false);
});
