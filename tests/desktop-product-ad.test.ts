import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("product detail ads stay desktop-only and mount in a dedicated column", async () => {
  const [gallery, component, script, styles] = await Promise.all([
    readFile(new URL("../src/components/public/ProductGallery.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopProductAd.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-product-detail-ad.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-product-detail.css", import.meta.url), "utf8"),
  ]);

  assert.match(gallery, /import DesktopProductAd from/u);
  assert.match(gallery, /<DesktopProductAd channelSlug=\{channelSlug\} \/>/u);
  assert.match(component, /PRODUCT_DETAIL_AD_MIN_WIDTH = 1400/u);
  assert.match(component, /if \(window\.innerWidth < PRODUCT_DETAIL_AD_MIN_WIDTH\)/u);
  assert.match(component, /data-product-detail-ad-slot/u);
  assert.match(component, /import\("@\/scripts\/public-product-detail-ad"\)/u);

  assert.match(script, /ads\?device=desktop/u);
  assert.match(script, /\.candidates/u);
  assert.match(script, /\.banners/u);
  assert.doesNotMatch(script, /device=mobile/u);
  assert.match(script, /TARGET_RATIO = 300 \/ 250/u);
  assert.match(script, /affiliate-ad-detail/u);

  assert.match(styles, /@media \(min-width: 1400px\)/u);
  assert.match(styles, /:has\(\.product-detail-ad-slot:not\(:empty\)\)/u);
  assert.match(styles, /grid-template-columns: minmax\(0, 31\.5rem\) minmax\(20rem, 23\.5rem\) minmax\(15rem, 18\.75rem\)/u);
});
