import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile product header uses one aligned control system", async () => {
  const [backLink, styles, system] = await Promise.all([
    readFile(new URL("../src/components/public/PublicBackLink.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-product-detail-refinement.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
  ]);

  assert.match(backLink, /label = "Back"/u);
  assert.match(backLink, /aria-label=\{label\}/u);
  assert.match(system, /public-category-navigation\.css[\s\S]*public-product-detail-refinement\.css/u);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*\.public-header \{/u);
  assert.match(styles, /background: rgba\(239, 236, 229, \.96\)/u);
  assert.match(styles, /\.public-header-leading,[\s\S]*\.public-header-trailing[\s\S]*align-items: center/u);
  assert.match(styles, /\.public-menu-trigger,[\s\S]*\.public-header-search-trigger-mobile,[\s\S]*\.public-back-link[\s\S]*height: 2\.5rem/u);
  assert.match(styles, /\.public-back-link \{[\s\S]*align-items: center[\s\S]*justify-content: center/u);
  assert.match(styles, /\.public-back-icon svg \{[\s\S]*width: \.92rem[\s\S]*height: \.92rem/u);
});

test("product gallery keeps a stable viewport for mixed upload ratios", async () => {
  const [gallery, interaction, styles] = await Promise.all([
    readFile(new URL("../src/components/public/ProductGallery.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-product-gallery.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-product-detail-refinement.css", import.meta.url), "utf8"),
  ]);

  assert.match(gallery, /class="product-gallery-stage" data-gallery-stage/u);
  assert.doesNotMatch(gallery, /width=\{firstImage\.width/u);
  assert.doesNotMatch(gallery, /height=\{firstImage\.height/u);
  assert.doesNotMatch(gallery, /data-image-width|data-image-height/u);
  assert.doesNotMatch(interaction, /mainImage\.width|mainImage\.height/u);
  assert.match(styles, /\.product-gallery-stage \{[\s\S]*height: clamp\(22rem, 112vw, 34rem\)/u);
  assert.match(styles, /\.product-gallery-stage img \{[\s\S]*object-fit: contain[\s\S]*object-position: center/u);
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 1099px\)[\s\S]*height: clamp\(30rem, 68vw, 42rem\)/u);
  assert.match(styles, /@media \(min-width: 1100px\)[\s\S]*height: clamp\(34rem, 52vw, 46rem\)/u);
  assert.match(styles, /\.product-gallery\.has-thumbnails[\s\S]*padding-right: 0/u);
  assert.match(styles, /grid-auto-flow: column/u);
  assert.match(styles, /overflow-x: auto/u);
});
