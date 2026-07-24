import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("category canonical mode is determined once per channel", async () => {
  const [channelPage, sitemapDatabase] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/db/sitemap.ts", import.meta.url), "utf8"),
  ]);

  assert.match(channelPage, /const requestedCategory = requestedCategorySlug[\s\S]*categories\.find/u);
  assert.match(channelPage, /const categorySelectionValid = !requestedCategorySlug \|\| Boolean\(requestedCategory\)/u);
  assert.match(channelPage, /hasCategoryNavigation && requestedCategory[\s\S]*\/category\/[\s\S]*Astro\.redirect[\s\S]*302/u);
  assert.match(channelPage, /desktopGroupInputs = hasCategoryNavigation && categorySelectionValid/u);

  assert.match(sitemapDatabase, /category_navigation AS \([\s\S]*GROUP BY navigation_category\.channel_id/u);
  assert.match(sitemapDatabase, /LEFT JOIN category_navigation ON category_navigation\.channel_id = category\.channel_id/u);
  assert.match(sitemapDatabase, /category_navigation\.channel_id IS NOT NULL AS hasCategoryNavigation/u);
  assert.doesNotMatch(sitemapDatabase, /relation\.category_id = category\.id/u);
});
