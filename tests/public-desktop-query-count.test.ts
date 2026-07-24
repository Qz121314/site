import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public catalog pages reuse current-channel filters in the desktop sidebar map", async () => {
  const [channelPage, categoryPage] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
  ]);

  for (const page of [channelPage, categoryPage]) {
    assert.match(page, /site\.channels\.flatMap\(\(item\) => item\.id === channel\.id \? \[\] : \[item\.id\]\)/u);
    assert.match(page, /loadPublicDesktopFilterMap\(desktopFilterChannelIds\)/u);
    assert.match(page, /\{ \.\.\.otherFiltersByChannel, \[channel\.id\]: activeFilters \}/u);
    assert.doesNotMatch(page, /loadPublicDesktopFilterMap\(site\.channels\.map/u);
  }
});
