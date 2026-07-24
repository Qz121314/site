import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop catalog keeps navigation and advertising around one centered content screen", async () => {
  const [
    channelPage,
    categoryPage,
    sidebar,
    row,
    interaction,
    styles,
    screen,
    advertisements,
  ] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogSidebarV2.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogRow.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-desktop-workspace.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-ui-polish.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-content-screen.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/AffiliateAds.astro", import.meta.url), "utf8"),
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
  assert.match(sidebar, /class="desktop-nav-brand"/u);
  assert.match(sidebar, /class="desktop-nav-tools"/u);
  assert.match(sidebar, /const expanded = active && filters\.length > 0/u);
  assert.match(sidebar, /aria-expanded=\{expanded \? "true" : undefined\}/u);
  assert.match(sidebar, /data-desktop-filter-link/u);

  assert.match(row, /data-desktop-filter-panel/u);
  assert.match(row, /hidden=\{!active\}/u);
  assert.match(interaction, /panel\.hidden = !active/u);
  assert.match(interaction, /history\.replaceState/u);
  assert.doesNotMatch(interaction, /scrollIntoView|IntersectionObserver/u);

  assert.match(styles, /background:[\s\S]*?var\(--desktop-ink\)/u);
  assert.match(screen, /--desktop-screen-width/u);
  assert.match(screen, /grid-template-rows: auto auto/u);
  assert.match(screen, /\.desktop-nav-rail \{[\s\S]*?grid-column: 1;[\s\S]*?grid-row: 1 \/ 3;/u);
  assert.match(screen, /\.desktop-portal-banner-slot \{[\s\S]*?grid-column: 2;/u);
  assert.match(screen, /\.integrated-desktop-content,[\s\S]*?grid-column: 2;/u);
  assert.match(screen, /\.desktop-portal-ad-slot \{[\s\S]*?grid-column: 3;/u);
  assert.match(screen, /grid-template-columns: clamp\(7\.75rem, 8\.6vw, 9rem\) minmax\(0, 1fr\)/u);

  assert.match(advertisements, /data-affiliate-ad-banner-slot/u);
  assert.match(advertisements, /data-affiliate-ad-vertical-slot/u);
  assert.match(advertisements, /frame\.appendChild\(banner\)/u);
  assert.match(advertisements, /frame\.appendChild\(vertical\)/u);
});
