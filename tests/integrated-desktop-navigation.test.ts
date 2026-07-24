import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop catalog keeps navigation sticky while products stay centered", async () => {
  const [
    channelPage,
    categoryPage,
    sidebar,
    row,
    interaction,
    styles,
    hierarchy,
  ] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogSidebarV2.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogRow.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-desktop-workspace.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-ui-polish.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-navigation-hierarchy.css", import.meta.url), "utf8"),
  ]);

  assert.match(channelPage, /DesktopCatalogSidebarV2/u);
  assert.match(channelPage, /integrated-desktop-catalog/u);
  assert.match(channelPage, /desktop-direct-catalog-panel/u);
  assert.doesNotMatch(channelPage, /loadPublicDesktopFilterMap/u);
  assert.match(categoryPage, /DesktopCatalogSidebarV2/u);
  assert.doesNotMatch(categoryPage, /loadPublicDesktopFilterMap/u);

  assert.match(sidebar, /site\.channels\.map/u);
  assert.match(sidebar, /longestNavigationLabel/u);
  assert.match(sidebar, /navigationStyle = `--desktop-nav-fit:/u);
  assert.match(sidebar, /const expanded = active && filters\.length > 0/u);
  assert.match(sidebar, /aria-expanded=\{expanded \? "true" : undefined\}/u);
  assert.match(sidebar, /data-desktop-filter-link/u);
  assert.doesNotMatch(sidebar, /<svg/u);

  assert.match(row, /data-desktop-filter-panel/u);
  assert.match(row, /hidden=\{!active\}/u);
  assert.match(interaction, /panel\.hidden = !active/u);
  assert.match(interaction, /history\.replaceState/u);
  assert.doesNotMatch(interaction, /scrollIntoView/u);
  assert.doesNotMatch(interaction, /IntersectionObserver/u);

  assert.match(styles, /grid-template-areas: "brand search \. navigation"/u);
  assert.match(styles, /background:[\s\S]*?var\(--desktop-ink\)/u);
  assert.match(hierarchy, /--desktop-content-width: 50rem/u);
  assert.match(hierarchy, /grid-template-columns:[\s\S]*?minmax\(var\(--desktop-side-min\), 1fr\)[\s\S]*?minmax\(0, var\(--desktop-content-width\)\)[\s\S]*?minmax\(var\(--desktop-side-min\), 1fr\)/u);
  assert.match(hierarchy, /\.desktop-nav-rail \{[\s\S]*?position: sticky;/u);
  assert.match(hierarchy, /\.integrated-desktop-content \{[\s\S]*?grid-column: 2;/u);
  assert.match(hierarchy, /\.integrated-desktop-catalog::after \{[\s\S]*?grid-column: 3;/u);
  assert.match(hierarchy, /grid-template-columns: var\(--desktop-category-width\) minmax\(0, 1fr\)/u);
  assert.match(hierarchy, /\.desktop-catalog-heading \{[\s\S]*?position: absolute/u);
});
