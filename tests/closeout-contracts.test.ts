import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const source = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("database read failures cannot become cacheable empty public or admin data", async () => {
  const [publicDatabase, siteDatabase, productDatabase, middleware] = await Promise.all([
    source("src/lib/db/public.ts"),
    source("src/lib/db/site.ts"),
    source("src/lib/db/products.ts"),
    source("src/middleware.ts"),
  ]);

  assert.match(publicDatabase, /public_site_shell_read_failed[\s\S]*throw error/u);
  assert.doesNotMatch(publicDatabase, /return defaultSiteShell/u);
  assert.doesNotMatch(siteDatabase, /admin_channels_read_failed[\s\S]*return \[\]/u);
  assert.doesNotMatch(productDatabase, /admin_products_read_failed[\s\S]*products: \[\]/u);
  assert.match(middleware, /SELECT thumbnail_object_key FROM image_assets/u);
  assert.match(middleware, /SELECT cover_asset_id FROM products/u);
});

test("publishing requires a public image origin and updates category and product atomically", async () => {
  const [settingsApi, productForm, manageApi, updateApi, deleteApi] = await Promise.all([
    source("src/pages/api/admin/settings/update.ts"),
    source("src/lib/admin/product-form.ts"),
    source("src/pages/api/admin/channels/[channelId]/products/[productId]/manage.ts"),
    source("src/pages/api/admin/channels/[channelId]/products/[productId]/update.ts"),
    source("src/pages/api/admin/channels/[channelId]/products/[productId]/delete.ts"),
  ]);

  assert.match(settingsApi, /if \(!r2PublicBaseUrl\)/u);
  assert.match(settingsApi, /status = 'published'/u);
  assert.match(productForm, /return "r2-url"/u);
  assert.match(manageApi, /UPDATE categories[\s\S]*UPDATE products[\s\S]*env\.DB\.batch/u);
  assert.match(updateApi, /DELETE FROM categories[\s\S]*NOT EXISTS/u);
  assert.match(deleteApi, /DELETE FROM categories[\s\S]*NOT EXISTS/u);
});

test("category degradation uses one canonical route and product back target", async () => {
  const [channelPage, categoryPage, productPage, sitemap] = await Promise.all([
    source("src/pages/[channel]/index.astro"),
    source("src/pages/[channel]/category/[category].astro"),
    source("src/pages/[channel]/product/[product].astro"),
    source("src/pages/sitemap.xml.ts"),
  ]);

  assert.match(channelPage, /value\.searchParams\.set\("category", selectedCategory\.slug\)/u);
  assert.match(categoryPage, /categoryFilters\.length === 0[\s\S]*Astro\.redirect/u);
  assert.match(productPage, /product\.hasCategoryNavigation[\s\S]*\?category=/u);
  assert.match(sitemap, /entry\.hasCategoryNavigation[\s\S]*\?category=/u);
});

test("public image and interaction closeout removes avoidable load and click delays", async () => {
  const [uploader, uploadApi, directory, cta, hero] = await Promise.all([
    source("src/components/admin/DirectImageUpload.astro"),
    source("src/pages/api/admin/images/upload.ts"),
    source("src/components/public/ProductDirectory.astro"),
    source("src/scripts/public-product-cta.ts"),
    source("src/scripts/public-hero-carousel.ts"),
  ]);

  assert.match(uploader, /HERO_RESPONSIVE_DIMENSION = 960/u);
  assert.match(uploader, /LOGO_DIMENSION = 320/u);
  assert.match(uploader, /FAVICON_DIMENSION = 128/u);
  assert.match(uploadApi, /logoVariant[\s\S]*faviconVariant/u);
  assert.match(directory, /priorityCount/u);
  assert.doesNotMatch(cta, /setTimeout\(resolve, 220\)/u);
  assert.match(hero, /maxIndex\(\) > 0/u);
});

test("legacy catalog branches and redirect-only category admin route are removed", async () => {
  const [directory, directoryScript, productsApi] = await Promise.all([
    source("src/components/public/ProductDirectory.astro"),
    source("src/scripts/public-product-directory.ts"),
    source("src/pages/api/public/channels/[channel]/products.ts"),
  ]);

  assert.doesNotMatch(directory, /uncategorizedOnly|data-query/u);
  assert.doesNotMatch(directoryScript, /uncategorized|dataset\.query/u);
  assert.doesNotMatch(productsApi, /public-availability|normalizePublicSearchQuery/u);
  await assert.rejects(access(new URL("../src/lib/db/public-availability.ts", import.meta.url)));
  await assert.rejects(access(new URL("../src/pages/admin/channels/[channelId]/categories.astro", import.meta.url)));
});
