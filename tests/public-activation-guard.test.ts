import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("double activation protection never blocks the first click", async () => {
  const source = await readFile(
    new URL("../src/scripts/public-interactions.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /lastActivation > 0 && now - lastActivation < ACTIVATION_WINDOW_MS/u);
  assert.doesNotMatch(source, /data-hero-track/u);
  assert.match(source, /control\.dataset\.lastActivation = String\(now\)/u);
});
