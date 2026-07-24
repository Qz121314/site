import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("product management autosave remains retryable after request failures", async () => {
  const source = await readFile(
    new URL("../src/scripts/admin-product-management.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /const AUTOSAVE_DELAY_MS = 180/u);
  assert.match(source, /window\.setTimeout\([\s\S]*form\.requestSubmit\(\)/u);
  assert.match(source, /form\.isConnected/u);
  assert.doesNotMatch(source, /productManagementSubmitting/u);
  assert.doesNotMatch(source, /setAttribute\("aria-busy"/u);
});
