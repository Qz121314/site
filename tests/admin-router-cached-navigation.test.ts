import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cached admin navigation cancels any older in-flight request", async () => {
  const source = await readFile(
    new URL("../src/scripts/admin-router.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /const cached = options\.force \? null : readSnapshot\(requestedUrl\);[\s\S]*if \(cached\) \{[\s\S]*activeController\?\.abort\(\);[\s\S]*activeController = null;[\s\S]*\}[\s\S]*setLoading\(true\)/u);
  assert.match(source, /const snapshot = cached \?\? await fetchSnapshot\(requestedUrl\)/u);
});
