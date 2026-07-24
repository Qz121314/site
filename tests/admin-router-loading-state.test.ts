import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("overlapping admin operations keep the route loading state active", async () => {
  const source = await readFile(
    new URL("../src/scripts/admin-router.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /let loadingOperations = 0/u);
  assert.match(source, /loadingOperations = Math\.max\(0, loadingOperations \+ \(loading \? 1 : -1\)\)/u);
  assert.match(source, /const active = loadingOperations > 0/u);
  assert.match(source, /progress\.hidden = !active/u);
  assert.match(source, /if \(active\) main\.setAttribute\("aria-busy", "true"\)/u);
  assert.equal((source.match(/setLoading\(true\)/gu) ?? []).length, 2);
  assert.equal((source.match(/setLoading\(false\)/gu) ?? []).length, 2);
});
