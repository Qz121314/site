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

test("product pages skip the effective navigation query when no filters are enabled", async () => {
  const productPage = await readFile(
    new URL("../src/pages/[channel]/product/[product].astro", import.meta.url),
    "utf8",
  );

  assert.match(productPage, /const hasCategoryNavigation = product\?\.hasCategoryNavigation/u);
  assert.match(productPage, /\? await hasPublicCategoryNavigation\(product\.channelId\)/u);
  assert.doesNotMatch(productPage, /const hasCategoryNavigation = product\s*\? await/u);
});
