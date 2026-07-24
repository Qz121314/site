import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("category degradation does not permanently cache a configurable route mode", async () => {
  const source = await readFile(
    new URL("../src/pages/[channel]/category/[category].astro", import.meta.url),
    "utf8",
  );

  assert.match(source, /!hasCategoryNavigation[\s\S]*Astro\.redirect\(`\$\{target\.pathname\}\$\{target\.search\}`, 302\)/u);
  assert.doesNotMatch(source, /Astro\.redirect\(`\$\{target\.pathname\}\$\{target\.search\}`, 301\)/u);
});
