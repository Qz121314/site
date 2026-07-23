import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("affiliate ad schema is open, device-scoped, indexed, and default-enabled", async () => {
  const [migration, form, adminDatabase] = await Promise.all([
    readFile(new URL("../migrations/0002_affiliate_ad_system.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/admin/ad-form.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/db/ads.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /ADD COLUMN device_type TEXT NOT NULL DEFAULT 'mobile'/u);
  assert.match(migration, /display_type TEXT NOT NULL CHECK \(display_type IN \('banner', 'vertical', 'modal'\)\)/u);
  assert.match(migration, /creative_type TEXT NOT NULL CHECK \(creative_type IN \('uploaded_image', 'external_media', 'embed_code'\)\)/u);
  assert.match(migration, /status TEXT NOT NULL DEFAULT 'enabled'/u);
  assert.match(migration, /idx_ad_pools_channel_device_status/u);
  assert.match(migration, /idx_advertisements_pool_status_type/u);
  assert.doesNotMatch(migration, /weight|rotation_mode/u);

  assert.match(form, /AD_DEVICE_TYPES = \["mobile", "desktop"\]/u);
  assert.match(form, /AD_DISPLAY_TYPES = \["banner", "vertical", "modal"\]/u);
  assert.match(form, /AD_CREATIVE_TYPES = \["uploaded_image", "external_media", "embed_code"\]/u);
  assert.match(form, /readText\(form, "status"\) \|\| "enabled"/u);
  assert.match(adminDatabase, /pool\.device_type/u);
  assert.match(adminDatabase, /LEFT JOIN image_assets image ON image\.id = ad\.image_asset_id/u);
});

test("admin advertising uses dynamic creative fields and no Hero binding", async () => {
  const [adminPage, adminScript, adminLayout] = await Promise.all([
    readFile(new URL("../src/pages/admin/channels/[channelId]/ads.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/admin-ad-form.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/layouts/AdminLayout.astro", import.meta.url), "utf8"),
  ]);

  assert.match(adminPage, /新增广告组/u);
  assert.match(adminPage, /设备类型/u);
  assert.match(adminPage, /option value="enabled" selected/u);
  assert.match(adminPage, /data-ad-creative-panel="uploaded_image"/u);
  assert.match(adminPage, /data-ad-creative-panel="external_media"/u);
  assert.match(adminPage, /data-ad-creative-panel="embed_code"/u);
  assert.match(adminPage, /展示类型/u);
  assert.match(adminPage, /外部图片 \/ GIF 地址/u);
  assert.match(adminPage, /联盟代码/u);
  assert.doesNotMatch(adminPage, /设为当前|取消当前|Hero 广告池/u);

  assert.match(adminScript, /field\.disabled = !enabled/u);
  assert.match(adminScript, /target\.required = creativeType !== "embed_code"/u);
  assert.match(adminScript, /frame\.sandbox\.add/u);
  assert.match(adminScript, /allow-popups-to-escape-sandbox/u);
  assert.match(adminLayout, /label: "联盟广告"/u);
  assert.match(adminLayout, /import "@\/scripts\/admin-ad-form"/u);
});

test("public advertising defers the script request, retries uploaded media, and exposes delivery state", async () => {
  const [component, script, styles, productPage, publicAds, mediaEndpoint, candidateEndpoint] = await Promise.all([
    readFile(new URL("../src/components/public/AffiliateAds.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-affiliate-ads.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-ads.css", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/product/[product].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/db/public-ads.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/api/public/ads/[adId]/media/[imageId].ts", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/api/public/channels/[channel]/ads.ts", import.meta.url), "utf8"),
  ]);

  assert.match(component, /type="application\/json" data-affiliate-ad-context/u);
  assert.doesNotMatch(component, /placeholder|skeleton|affiliate-ad-frame/u);
  assert.match(component, /AFFILIATE_AD_REQUEST_DELAY_MS = 2500/u);
  assert.match(component, /DOMContentLoaded/u);
  assert.match(component, /import\("@\/scripts\/public-affiliate-ads"\)/u);
  assert.match(component, /affiliateAdState = "deferred"/u);
  assert.match(component, /affiliate_ad_script_load_failed/u);

  assert.match(script, /waitForAdvertisementStart/u);
  assert.match(script, /requestAnimationFrame\(\(\) => window\.requestAnimationFrame/u);
  assert.match(script, /fallbackImageUrl/u);
  assert.match(script, /waitForFirstImage/u);
  assert.match(script, /affiliateAdState/u);
  assert.match(script, /affiliate_ad_initialization_failed/u);
  assert.match(script, /loadFirstAvailable/u);
  assert.match(script, /productInterval/u);
  assert.match(script, /sessionStorage\.setItem/u);
  assert.match(script, /rel = "sponsored noopener noreferrer"/u);
  assert.doesNotMatch(script, /ORDER BY RANDOM|\.sort\(/u);

  assert.match(publicAds, /fallbackImageUrl/u);
  assert.match(publicAds, /loadPublicAdvertisementImage/u);
  assert.match(publicAds, /advertisement\.image_asset_id/u);
  assert.match(mediaEndpoint, /env\.MEDIA_BUCKET\.get\(image\.object_key\)/u);
  assert.match(mediaEndpoint, /Cloudflare-CDN-Cache-Control/u);
  assert.match(candidateEndpoint, /meta:[\s\S]*counts:/u);

  assert.match(styles, /\.affiliate-ad-inline \{[\s\S]*?grid-column: 1 \/ -1/u);
  assert.doesNotMatch(productPage, /AffiliateAds|affiliate-ad-context/u);
});
