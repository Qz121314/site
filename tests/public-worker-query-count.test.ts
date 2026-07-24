import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("category pages reuse the loaded category list instead of querying the current category twice", async () => {
  const categoryPage = await readFile(
    new URL("../src/pages/[channel]/category/[category].astro", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(categoryPage, /loadPublicCategory\b/u);
  assert.match(categoryPage, /loadPublicCategories\(channel\.id\)/u);
  assert.match(categoryPage, /categories\.find\(\(item\) => item\.slug === categorySlug\) \?\? null/u);
});
