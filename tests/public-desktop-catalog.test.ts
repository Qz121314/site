import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop catalog gives products the dominant column while preserving mobile navigation", async () => {
  const [channel, category, sidebar, desktopStyles, mobileStyles, baseStyles, system] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogSidebar.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-catalog.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-category-navigation.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-base.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
  ]);

  assert.match(channel, /productPage = canLoadPage && channel && categorySelectionValid/u);
  assert.match(channel, /class="desktop-catalog-workspace desktop-channel-catalog"/u);
  assert.match(channel, /<DesktopCatalogSidebar/u);
  assert.match(category, /class="directory-page-layout catalog-workspace category-catalog-workspace"/u);
  assert.match(category, /activeCategoryId=\{category\.id\}/u);
  assert.match(category, /loadPublicCategoryFilters\(channel\.id\)/u);
  assert.match(category, /loadPublicCategories\(channel\.id\)/u);

  const channelSwitcherPosition = sidebar.indexOf('class="desktop-channel-switcher"');
  const filterPosition = sidebar.indexOf('class="category-filter-bar desktop-catalog-filter-bar"');
  const categoryPosition = sidebar.indexOf('class="desktop-category-groups"');
  assert.ok(channelSwitcherPosition >= 0);
  assert.ok(filterPosition > channelSwitcherPosition);
  assert.ok(categoryPosition > filterPosition);
  assert.match(sidebar, /site\.channels\.length > 1/u);
  assert.match(sidebar, /--desktop-channel-columns/u);
  assert.match(sidebar, /--category-filter-columns/u);

  assert.match(desktopStyles, /@media \(min-width: 1100px\)/u);
  assert.match(desktopStyles, /grid-template-columns: clamp\(19rem, 25vw, 24rem\) minmax\(0, 1fr\)/u);
  assert.match(desktopStyles, /\.desktop-category-grid \{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(desktopStyles, /\.desktop-category-grid \.category-entry \{[\s\S]*?height: 2\.75rem/u);
  assert.match(desktopStyles, /repeat\(auto-fill, minmax\(13rem, 1fr\)\)/u);
  assert.match(desktopStyles, /public-header-desktop-nav a:not\(\[href="\/privacy"\]\):not\(\[href="\/disclaimer"\]\)/u);

  assert.match(mobileStyles, /@media \(max-width: 767px\)/u);
  assert.match(mobileStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(mobileStyles, /height: 3\.25rem/u);
  assert.match(system, /@import "\.\/public-desktop-catalog\.css";/u);

  assert.match(baseStyles, /-webkit-tap-highlight-color: transparent/u);
  assert.match(baseStyles, /-webkit-user-drag: none/u);
  assert.doesNotMatch(baseStyles, /outline:\s*none/u);
});
