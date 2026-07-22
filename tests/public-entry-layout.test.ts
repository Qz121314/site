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

test("configured channel navigation data remains visible without published products", async () => {
  const [channel, publicDatabase] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/db/public.ts", import.meta.url), "utf8"),
  ]);
  const categoryLoader = publicDatabase.slice(
    publicDatabase.indexOf("export async function loadPublicCategories"),
    publicDatabase.indexOf("export async function loadPublicCategory("),
  );

  assert.match(channel, /categories\.length > 0 \|\| filters\.length > 0/u);
  assert.match(channel, /<h1>\{site\.siteName\}<\/h1>/u);
  assert.match(channel, /site\.siteDescription/u);
  assert.match(publicDatabase, /category\.status != 'disabled'/u);
  assert.doesNotMatch(categoryLoader, /EXISTS|product\.status/u);
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
