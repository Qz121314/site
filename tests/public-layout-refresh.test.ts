import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("catalog pages use a compact header search and footer policy links", async () => {
  const [layout, system, refresh, categoryPolish] = await Promise.all([
    readFile(new URL("../src/layouts/PublicLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-layout-refresh.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-category-polish.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /import PublicSearchForm/u);
  assert.match(layout, /headerSearchAction/u);
  assert.match(layout, /public-header-inner-catalog/u);
  assert.match(layout, /class="public-header-search"/u);
  assert.doesNotMatch(layout, /class="public-menu"/u);
  assert.match(layout, /class="public-container public-footer"/u);
  assert.match(layout, /href="\/privacy"/u);
  assert.match(layout, /href="\/disclaimer"/u);
  assert.match(system, /@import "\.\/public-layout-refresh\.css";/u);
  assert.match(system, /@import "\.\/public-gallery-rail\.css";/u);
  assert.match(system, /@import "\.\/public-category-polish\.css";/u);
  assert.match(refresh, /\.channel-search-section > \.public-search-form/u);
  assert.match(refresh, /\.directory-search-section/u);
  assert.match(categoryPolish, /\.category-mobile-directory \{[\s\S]*?gap: \.9rem/u);
  assert.match(categoryPolish, /\.category-entry-label \{[\s\S]*?color: #fff/u);
  assert.match(categoryPolish, /\.category-entry-arrow \{[\s\S]*?color: #fff/u);
});

test("product detail pages place the gallery before the title and keep thumbnails beside the main image on every viewport", async () => {
  const [refresh, rail] = await Promise.all([
    readFile(new URL("../src/styles/public-layout-refresh.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-gallery-rail.css", import.meta.url), "utf8"),
  ]);

  assert.match(refresh, /\.product-detail-media \{[\s\S]*?grid-row: 1 !important/u);
  assert.match(refresh, /\.product-detail-title \{[\s\S]*?grid-row: 2 !important/u);
  assert.match(refresh, /\.product-detail-information \{[\s\S]*?grid-row: 3 !important/u);
  assert.match(rail, /^\.product-detail \.product-gallery\.has-thumbnails \{/mu);
  assert.match(rail, /padding-right: calc\(var\(--gallery-thumbnail-size\) \+ var\(--gallery-thumbnail-gap\)\)/u);
  assert.match(rail, /position: absolute/u);
  assert.match(rail, /inset: 0 0 0 auto/u);
  assert.match(rail, /grid-auto-flow: row/u);
  assert.match(rail, /overflow-y: auto/u);
});
