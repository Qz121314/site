import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("tablet and desktop channel pages expose grouped category rows and two Hero advertisements", async () => {
  const [channel, layout, hero, styles] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/layouts/PublicLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/HeroCarousel.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop.css", import.meta.url), "utf8"),
  ]);

  assert.match(channel, /categoryGroups = filters\.map/u);
  assert.match(channel, /class="category-group-row"/u);
  assert.match(channel, /ungroupedCategories/u);
  assert.match(layout, /class="public-header-channel-name"/u);
  assert.match(hero, /\(min-width: 768px\) calc\(\(100vw - 4rem\) \/ 2\)/u);
  assert.match(styles, /@media \(min-width: 768px\)/u);
  assert.match(styles, /flex-basis: calc\(\(100% - \.9rem\) \/ 2\)/u);
  assert.match(styles, /\.category-group-items[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/u);
});

test("catalog and product detail pages use the shared tablet horizontal composition", async () => {
  const [category, product, styles] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/product/[product].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop.css", import.meta.url), "utf8"),
  ]);

  assert.match(category, /class="directory-page-layout"/u);
  assert.match(category, /class="directory-page-sidebar"/u);
  assert.match(product, /class="product-detail-media"/u);
  assert.match(product, /class="product-detail-information"/u);
  assert.match(styles, /\.directory-page-layout \{[\s\S]*?grid-template-columns:/u);
  assert.match(styles, /\.product-detail \{[\s\S]*?grid-template-columns:/u);
  assert.match(styles, /\.product-detail-media \{[\s\S]*?grid-column: 1/u);
});
