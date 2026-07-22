import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public entry redirects to a configured or first published channel", async () => {
  const [home, layout, navigation] = await Promise.all([
    readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/layouts/PublicLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ChannelNavigation.astro", import.meta.url), "utf8"),
  ]);

  assert.match(home, /site\.defaultChannelSlug \?\? site\.channels\[0\]\?\.slug/u);
  assert.match(home, /Astro\.redirect\(`\/\$\{encodeURIComponent\(entryChannelSlug\)\}`/u);
  assert.match(home, /showChannelNavigation=\{false\}/u);
  assert.match(layout, /site\.logoUrl \? \(/u);
  assert.match(layout, /class="public-brand-logo"/u);
  assert.match(navigation, /channels\.length > 0/u);
});

test("channel category buttons only expose published categories with published products", async () => {
  const [channel, publicDatabase, settings] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/db/public.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/admin/settings.astro", import.meta.url), "utf8"),
  ]);
  const categoryLoader = publicDatabase.slice(
    publicDatabase.indexOf("export async function loadPublicCategories"),
    publicDatabase.indexOf("export async function loadPublicCategory("),
  );

  assert.match(channel, /hasCategoryNavigation = filters\.length > 0/u);
  assert.match(channel, /!hasCategoryNavigation && categories\.length > 0/u);
  assert.match(channel, /class="filter-strip channel-category-filters"/u);
  assert.match(channel, /category=\$\{encodeURIComponent\(category\.slug\)\}/u);
  assert.match(channel, /aria-current=\{active \? "page" : undefined\}/u);
  assert.match(channel, /categoryId: selectedCategory\?\.id \?\? null/u);
  assert.match(channel, /preserveCategoryQuery=\{Boolean\(selectedCategory\)\}/u);
  assert.match(channel, /description=\{pageAvailable && channel \? site\.siteDescription \|\|/u);
  assert.doesNotMatch(channel, /<h1>\{site\.siteName\}<\/h1>/u);
  assert.match(publicDatabase, /category\.status = 'published'/u);
  assert.match(categoryLoader, /EXISTS[\s\S]*product\.status = 'published'/u);
  assert.match(settings, /<div class="admin-field admin-span-6">\s*<label for="r2-public-base-url">/u);
  assert.match(settings, /<div class="admin-field admin-span-3">\s*<label for="ga4-id">/u);
  assert.match(settings, /<div class="admin-field admin-span-3">\s*<label for="meta-pixel-id">/u);
  assert.match(settings, /\.settings-form \.admin-field \{ align-content: start; \}/u);
});

test("channels without category filters degrade categories into product filters", async () => {
  const [channel, directory, directoryScript, styles] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ProductDirectory.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-product-directory.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-design-system.css", import.meta.url), "utf8"),
  ]);

  const searchPosition = channel.indexOf("<PublicSearchForm");
  const categoryFilterPosition = channel.indexOf('class="filter-strip channel-category-filters"');
  const productDirectoryPosition = channel.indexOf("<ProductDirectory");

  assert.ok(searchPosition >= 0 && categoryFilterPosition > searchPosition);
  assert.ok(productDirectoryPosition > categoryFilterPosition);
  assert.match(channel, /hasCategoryNavigation = filters\.length > 0/u);
  assert.match(channel, /categoryId: selectedCategory\?\.id \?\? null/u);
  assert.match(directory, /data-preserve-category-query=/u);
  assert.match(directoryScript, /url\.searchParams\.set\("category", categorySlug\)/u);
  assert.match(styles, /\.filter-button\[aria-current="page"\]/u);
});

test("Hero data displays all enabled advertisements unless a current pool is explicitly selected", async () => {
  const publicDatabase = await readFile(new URL("../src/lib/db/public.ts", import.meta.url), "utf8");
  const heroLoader = publicDatabase.slice(
    publicDatabase.indexOf("export async function loadPublicHeroAdvertisements"),
    publicDatabase.indexOf("export async function loadPublicCategoryFilters"),
  );

  assert.match(heroLoader, /p\.channel_id = c\.id/u);
  assert.match(heroLoader, /p\.status = 'enabled'/u);
  assert.match(heroLoader, /ad\.status = 'enabled'/u);
  assert.match(heroLoader, /c\.hero_ad_pool_id IS NULL OR p\.id = c\.hero_ad_pool_id/u);
});

test("only pages with a parent route provide back navigation", async () => {
  const [channel, category, product, search, privacy, disclaimer] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/product/[product].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/search.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/privacy.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/disclaimer.astro", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(channel, /backHref=/u);
  assert.match(category, /backHref=\{returnUrl\}/u);
  assert.match(product, /backHref=\{product \? returnUrl : null\}/u);
  assert.match(search, /<PublicPageHeader[\s\S]*?href=\{`\/\$\{encodeURIComponent\(channel\.slug\)\}`\}/u);
  assert.match(privacy, /backHref="\/"/u);
  assert.match(disclaimer, /backHref="\/"/u);
});
