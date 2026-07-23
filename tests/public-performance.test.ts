import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("prioritizes only above-the-fold public images and defers affiliate creatives", async () => {
  const [affiliateComponent, affiliateScript, card, gallery, loadingStyles] = await Promise.all([
    readFile(new URL("../src/components/public/AffiliateAds.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-affiliate-ads.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ProductCard.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ProductGallery.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-loading.css", import.meta.url), "utf8"),
  ]);

  assert.match(affiliateComponent, /data-affiliate-ad-context/u);
  assert.doesNotMatch(affiliateComponent, /<img|<iframe|affiliate-ad-frame/u);
  assert.match(affiliateScript, /waitForAdvertisementStart/u);
  assert.match(affiliateScript, /const image = new Image\(\)/u);
  assert.match(affiliateScript, /await waitForAdvertisementStart\(\)/u);
  assert.match(card, /data-load-reveal=\{priority \? undefined : ""\}/u);
  assert.match(gallery, /loading="eager"[\s\S]*?fetchpriority="high"[\s\S]*?data-gallery-main/u);
  assert.match(gallery, /loading="lazy"[\s\S]*?fetchpriority="low"/u);
  assert.doesNotMatch(loadingStyles, /\.public-main > \* \{/u);
  assert.doesNotMatch(loadingStyles, /@keyframes public-content-enter/u);
});

test("uses stored responsive derivatives for product and site images", async () => {
  const [publicDatabase, upload, directUpload, ads] = await Promise.all([
    readFile(new URL("../src/lib/db/public.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/api/admin/images/upload.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/admin-direct-image-upload.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/admin/channels/[channelId]/ads.astro", import.meta.url), "utf8"),
  ]);

  assert.match(publicDatabase, /cover\.thumbnail_object_key AS cover_responsive_object_key/u);
  assert.match(publicDatabase, /image\.thumbnail_object_key AS responsive_object_key/u);
  assert.match(publicDatabase, /cover\.thumbnail_object_key AS object_key/u);
  assert.match(upload, /productVariant[\s\S]*logoVariant[\s\S]*faviconVariant/u);
  assert.match(directUpload, /THUMBNAIL_DIMENSION = 480/u);
  assert.match(directUpload, /LOGO_DIMENSION = 320/u);
  assert.match(directUpload, /FAVICON_DIMENSION = 128/u);
  assert.match(ads, /支持 JPG、PNG、WebP。GIF 请使用外部素材地址。/u);
  assert.doesNotMatch(ads, /heroResponsive/u);
});

test("defers third-party analytics until interaction or after the load-critical window", async () => {
  const layout = await readFile(new URL("../src/layouts/PublicLayout.astro", import.meta.url), "utf8");

  assert.doesNotMatch(layout, /<script is:inline async src=\{`https:\/\/www\.googletagmanager\.com/u);
  assert.match(layout, /\['pointerdown', 'keydown', 'scroll'\]/u);
  assert.match(layout, /window\.setTimeout\(start, 5000\)/u);
  assert.match(layout, /document\.head\.appendChild\(script\)/u);
});
