import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public catalog pages load only the active channel filters for the desktop navigation rail", async () => {
  const [channelPage, categoryPage] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
  ]);

  for (const page of [channelPage, categoryPage]) {
    assert.match(page, /loadPublicCategoryFilters\(channel\.id\)/u);
    assert.match(page, /loadPublicCategories\(channel\.id\)/u);
    assert.doesNotMatch(page, /loadPublicDesktopFilterMap/u);
    assert.doesNotMatch(page, /desktopFilterChannelIds|otherFiltersByChannel|filtersByChannel/u);
  }
});
