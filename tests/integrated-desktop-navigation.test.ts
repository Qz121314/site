import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop catalog uses an integrated logo, section, category, and product frame", async () => {
  const [
    channelPage,
    categoryPage,
    sidebar,
    row,
    interaction,
    styles,
  ] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogSidebarV2.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogRow.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-desktop-workspace.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-ui-polish.css", import.meta.url), "utf8"),
  ]);

  assert.match(channelPage, /DesktopCatalogSidebarV2/u);
  assert.match(channelPage, /integrated-desktop-catalog/u);
  assert.match(channelPage, /desktop-direct-catalog-panel/u);
  assert.doesNotMatch(channelPage, /loadPublicDesktopFilterMap/u);
  assert.match(categoryPage, /DesktopCatalogSidebarV2/u);
  assert.doesNotMatch(categoryPage, /loadPublicDesktopFilterMap/u);

  assert.match(sidebar, /active && filters\.length > 0/u);
  assert.match(sidebar, /data-desktop-filter-link/u);
  assert.doesNotMatch(sidebar, /<svg/u);

  assert.match(row, /data-desktop-filter-panel/u);
  assert.match(row, /hidden=!\{active\}/u);
  assert.match(interaction, /panel\.hidden = !active/u);
  assert.match(interaction, /history\.replaceState/u);
  assert.doesNotMatch(interaction, /scrollIntoView/u);
  assert.doesNotMatch(interaction, /IntersectionObserver/u);

  assert.match(styles, /--desktop-nav-width/u);
  assert.match(styles, /grid-template-areas: "brand search \. navigation"/u);
  assert.match(styles, /\.desktop-nav-rail/u);
  assert.match(styles, /grid-template-columns: var\(--desktop-nav-width\) minmax\(0, 1fr\)/u);
  assert.match(styles, /\.desktop-catalog-panel/u);
  assert.match(styles, /grid-template-columns: clamp\(8\.5rem, 10vw, 10\.5rem\) minmax\(0, 1fr\)/u);
});
