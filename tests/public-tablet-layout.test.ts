import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("tablet and desktop channel pages use full-width Hero and distinct grouped category grids", async () => {
  const [channel, layout, hero, styles, commerce, ads] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/layouts/PublicLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/HeroCarousel.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-commerce.css", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/admin/channels/[channelId]/ads.astro", import.meta.url), "utf8"),
  ]);

  assert.match(channel, /categoryGroups = filters\.map/u);
  assert.match(channel, /class="category-group-row"/u);
  assert.match(channel, /class="filter-button category-group-label category-group-filter"/u);
  assert.match(channel, /data-category-group-filter=\{filter\.id\}/u);
  assert.match(channel, /ungroupedCategories/u);
  assert.doesNotMatch(layout, /public-header-channel-name/u);
  assert.match(hero, /\(min-width: 1100px\) 1344px/u);
  assert.match(hero, /\(min-width: 768px\) calc\(100vw - 3rem\)/u);
  assert.match(commerce, /\.hero-slide \{[\s\S]*?flex-basis: 100%/u);
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 1099px\)/u);
  assert.match(styles, /@media \(min-width: 1100px\)/u);
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 1099px\) \{[\s\S]*?\.hero-slide img \{[\s\S]*?aspect-ratio: 12 \/ 5/u);
  assert.match(styles, /@media \(min-width: 1100px\) \{[\s\S]*?\.hero-slide img \{[\s\S]*?aspect-ratio: 3 \/ 1/u);
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 1099px\) \{[\s\S]*?\.category-group-items \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/u);
  assert.match(styles, /@media \(min-width: 1100px\) \{[\s\S]*?\.category-group-items \{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/u);
  assert.match(ads, /1200 × 500 px（12:5）/u);
});

test("catalog and product detail layouts adapt separately for tablet and desktop", async () => {
  const [category, product, gallery, styles, commerce] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/product/[product].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ProductGallery.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-commerce.css", import.meta.url), "utf8"),
  ]);

  assert.match(category, /class="directory-page-layout"/u);
  assert.match(category, /class="directory-page-title"/u);
  assert.doesNotMatch(category, /class="directory-page-sidebar"/u);
  assert.match(product, /class="product-detail-media"/u);
  assert.match(product, /class="product-detail-information"/u);
  assert.match(gallery, /uniqueImages\.length > 1 && "has-thumbnails"/u);
  assert.match(commerce, /\.directory-page-title,[\s\S]*?text-align: center/u);
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 1099px\) \{[\s\S]*?\.product-detail \{[\s\S]*?max-width: 50rem/u);
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 1099px\) \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/u);
  assert.match(styles, /@media \(min-width: 1100px\) \{[\s\S]*?\.product-detail \{[\s\S]*?grid-template-columns:/u);
  assert.match(styles, /@media \(min-width: 1100px\) \{[\s\S]*?\.product-detail-media \{[\s\S]*?grid-column: 1/u);
  assert.match(commerce, /\.product-gallery\.has-thumbnails \{[\s\S]*?padding-right:/u);
  assert.match(commerce, /\.product-gallery\.has-thumbnails \.product-gallery-thumbnails \{[\s\S]*?grid-auto-flow: row/u);
});
