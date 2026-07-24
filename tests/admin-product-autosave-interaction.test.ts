import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("product management autosave is immediate and remains retryable", async () => {
  const source = await readFile(
    new URL("../src/scripts/admin-product-management.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /data-product-management-autosave[\s\S]*form\.requestSubmit\(\)/u);
  assert.doesNotMatch(source, /setTimeout|AUTOSAVE_DELAY_MS|autosaveTimer/u);
  assert.doesNotMatch(source, /productManagementSubmitting/u);
  assert.doesNotMatch(source, /setAttribute\("aria-busy"/u);
});
