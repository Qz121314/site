import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("prioritizes only above-the-fold public images", async () => {
  const [hero, card, gallery, loadingStyles] = await Promise.all([
    readFile(new URL("../src/components/public/HeroCarousel.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ProductCard.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ProductGallery.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-loading.css", import.meta.url), "utf8"),
  ]);

  assert.match(hero, /loading=\{index === 0 \? "eager" : "lazy"\}/u);
  assert.match(hero, /fetchpriority=\{index === 0 \? "high" : "low"\}/u);
  assert.match(hero, /data-load-reveal=\{index === 0 \? undefined : ""\}/u);
  assert.match(hero, /srcset=\{sourceSet\(advertisement\)\}/u);
  assert.match(card, /data-load-reveal=\{priority \? undefined : ""\}/u);
  assert.match(gallery, /loading="eager"[\s\S]*?fetchpriority="high"[\s\S]*?data-gallery-main/u);
  assert.match(gallery, /loading="lazy"[\s\S]*?fetchpriority="low"/u);
  assert.doesNotMatch(loadingStyles, /\.public-main > \* \{/u);
  assert.doesNotMatch(loadingStyles, /@keyframes public-content-enter/u);
});

test("uses stored responsive derivatives for Hero and product detail images", async () => {
  const [publicDatabase, upload, directUpload, ads, scan] = await Promise.all([
    readFile(new URL("../src/lib/db/public.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/api/admin/images/upload.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/DirectImageUpload.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/admin/channels/[channelId]/ads.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/api/admin/images/scan.ts", import.meta.url), "utf8"),
  ]);

  assert.match(publicDatabase, /a\.thumbnail_object_key AS responsive_object_key/u);
  assert.match(publicDatabase, /image\.thumbnail_object_key AS responsive_object_key/u);
  assert.match(upload, /heroVariant \? "hero-responsive" : "directory-thumbnail"/u);
  assert.match(directUpload, /HERO_RESPONSIVE_DIMENSION = 720/u);
  assert.match(ads, /compact heroResponsive/u);
  assert.match(scan, /"directory-thumbnail", "hero-responsive"/u);
});

test("defers third-party analytics until interaction or after the load-critical window", async () => {
  const layout = await readFile(new URL("../src/layouts/PublicLayout.astro", import.meta.url), "utf8");

  assert.doesNotMatch(layout, /<script is:inline async src=\{`https:\/\/www\.googletagmanager\.com/u);
  assert.match(layout, /\['pointerdown', 'keydown', 'scroll'\]/u);
  assert.match(layout, /window\.setTimeout\(start, 5000\)/u);
  assert.match(layout, /document\.head\.appendChild\(script\)/u);
});
