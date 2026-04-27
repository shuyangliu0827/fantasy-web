import test from "node:test";
import assert from "node:assert/strict";

import { LANGUAGE_LABELS, getLanguageDisplayLabel } from "../lib/language-labels.ts";

test("language labels are standardized to 中文/EN", () => {
  assert.equal(LANGUAGE_LABELS.zh, "中文");
  assert.equal(LANGUAGE_LABELS.en, "EN");
  assert.equal(getLanguageDisplayLabel("zh"), "中文");
  assert.equal(getLanguageDisplayLabel("en"), "EN");
});
