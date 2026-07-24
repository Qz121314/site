import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("paginated category breadcrumbs separate the category entity from the current page", async () => {
  const source = await readFile(
    new URL("../src/pages/[channel]/category/[category].astro", import.meta.url),
    "utf8",
  );

  assert.match(source, /const categoryUrl = pageAvailable[\s\S]*\/category\//u);
  assert.match(source, /const canonical = categoryUrl[\s\S]*publicPageCanonical\(new URL\(categoryUrl\), pageInput\.page\)/u);
  assert.match(source, /name: category\.name,\s*item: categoryUrl/u);
  assert.match(source, /pageInput\.page > 1[\s\S]*name: `Page \$\{pageInput\.page\}`[\s\S]*item: canonical/u);
});
