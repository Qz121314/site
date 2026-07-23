import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildEffectiveCategoryGroups,
  hasEffectiveCategoryNavigation,
} from "../src/lib/public/category-navigation.ts";

test("public entry redirects to a configured or first published channel", async () => {
  const [home, layout, navigation, baseStyles, commerceStyles] = await Promise.all([
    readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/layouts/PublicLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ChannelNavigation.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-commerce.css", import.meta.url), "utf8"),
  ]);

  assert.match(home, /site\.defaultChannelSlug \?\? site\.channels\[0\]\?\.slug/u);
  assert.match(home, /Astro\.redirect\(`\/\$\{encodeURIComponent\(entryChannelSlug\)\}`/u);
  assert.match(home, /showChannelNavigation=\{false\}/u);
  assert.match(layout, /site\.logoUrl \? \(/u);
  assert.match(layout, /class="public-brand-logo"/u);
  assert.match(layout, /class="public-header-desktop-nav"/u);
  assert.match(layout, /aria-current=\{activeChannel === channel\.slug \? "page" : undefined\}/u);
  assert.match(layout, /<a href="\/privacy">Privacy<\/a>[\s\S]*<a href="\/disclaimer">Disclaimer<\/a>/u);
  assert.match(layout, /@media \(min-width: 768px\)[\s\S]*?\.public-header-leading \{[\s\S]*?display: none;/u);
  assert.match(navigation, /channels\.length > 0/u);
  assert.match(navigation, /@media \(min-width: 768px\)[\s\S]*?\.public-bottom-nav \{[\s\S]*?display: none;/u);
  assert.match(baseStyles, /\.public-bottom-nav-track \{[\s\S]*?display: flex;[\s\S]*?overflow: hidden;/u);
  assert.match(commerceStyles, /\.public-nav-item \{[\s\S]*?min-width: 0;[\s\S]*?flex: 1 1 0;/u);
  assert.doesNotMatch(baseStyles, /\.public-nav-item \{[\s\S]*?min-width: 6\.65rem;/u);
});

test("empty category filters do not activate category navigation", () => {
  const filters = [
    { id: "empty", name: "Empty" },
    { id: "used", name: "Used" },
  ];
  const categories = [
    { id: "ungrouped", filterIds: [] },
    { id: "grouped", filterIds: ["used"] },
  ];

  assert.equal(hasEffectiveCategoryNavigation(filters.slice(0, 1), categories), false);
  assert.equal(hasEffectiveCategoryNavigation(filters, categories), true);
  assert.deepEqual(buildEffectiveCategoryGroups(filters, categories), [
    { filter: filters[1], categories: [categories[1]] },
  ]);
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

  assert.match(channel, /buildEffectiveCategoryGroups\(filters, categories\)/u);
  assert.match(channel, /hasCategoryNavigation = categoryGroups\.length > 0/u);
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

test("channels without effective category groups degrade categories into product filters", async () => {
  const [channel, categoryPage, directory, directoryScript, styles] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ProductDirectory.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-product-directory.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-commerce.css", import.meta.url), "utf8"),
  ]);

  const categoryFilterPosition = channel.indexOf('class="filter-strip channel-category-filters"');
  const productDirectoryPosition = channel.indexOf("<ProductDirectory");

  assert.doesNotMatch(channel, /PublicSearchForm/u);
  assert.ok(categoryFilterPosition >= 0);
  assert.ok(productDirectoryPosition > categoryFilterPosition);
  assert.match(channel, /hasCategoryNavigation = categoryGroups\.length > 0/u);
  assert.match(channel, /categoryId: selectedCategory\?\.id \?\? null/u);
  assert.match(categoryPage, /hasPublicCategoryNavigation\(channel\.id\)/u);
  assert.match(categoryPage, /category && !hasCategoryNavigation/u);
  assert.match(directory, /data-preserve-category-query=/u);
  assert.match(directoryScript, /url\.searchParams\.set\("category", categorySlug\)/u);
  assert.match(directoryScript, /sessionStorage\.setItem/u);
  assert.match(styles, /\.filter-button\[aria-current="page"\]/u);
});

test("allowed list pages bootstrap the shared affiliate ad system", async () => {
  const [channel, category, search, product, publicAds, endpoint] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/search.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/product/[product].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/db/public-ads.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/api/public/channels/[channel]/ads.ts", import.meta.url), "utf8"),
  ]);

  assert.match(channel, /<AffiliateAds channelSlug=\{channel\.slug\} surface=\{adSurface\}/u);
  assert.match(category, /<AffiliateAds channelSlug=\{channel\.slug\} surface="catalog"/u);
  assert.match(search, /<AffiliateAds channelSlug=\{channel\.slug\} surface="search"/u);
  assert.doesNotMatch(product, /AffiliateAds|affiliate-ad-context/u);
  assert.match(publicAds, /PUBLIC_AD_CANDIDATE_LIMIT_PER_TYPE = 10/u);
  assert.match(publicAds, /advertisement\.id \$\{comparison\} \?4/u);
  assert.match(publicAds, /crypto\.randomUUID\(\)/u);
  assert.doesNotMatch(publicAds, /ORDER BY RANDOM\(\)|\.sort\(/u);
  assert.match(endpoint, /Cache-Control": "private, no-store"/u);
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
  assert.match(search, /const returnUrl = channel \? `\/\$\{encodeURIComponent\(channel\.slug\)\}` : null/u);
  assert.match(search, /backHref=\{returnUrl\}/u);
  assert.match(privacy, /backHref="\/"/u);
  assert.match(disclaimer, /backHref="\/"/u);
});

test("public editorial polish uses local fonts and completes empty-page composition", async () => {
  const [system, editorial, directory] = await Promise.all([
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-editorial.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/ProductDirectory.astro", import.meta.url), "utf8"),
  ]);

  assert.match(system, /@import "\.\/public-editorial\.css";/u);
  assert.match(editorial, /min-height: 100dvh/u);
  assert.match(editorial, /font-family: var\(--public-font-brand\)/u);
  assert.match(editorial, /\.public-footer \{[\s\S]*?margin-top: auto;/u);
  assert.match(editorial, /\.public-bottom-nav-track \{[\s\S]*?backdrop-filter: blur/u);
  assert.doesNotMatch(editorial, /@font-face|https?:\/\//u);
  assert.match(directory, /class="public-empty public-empty-products"/u);
  assert.match(directory, /New listings will appear here when they are published\./u);
});

test("desktop header keeps search inline while mobile retains the expandable control", async () => {
  const [layout, searchComponent, interactions, editorial] = await Promise.all([
    readFile(new URL("../src/layouts/PublicLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/PublicHeaderSearch.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-interactions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-editorial.css", import.meta.url), "utf8"),
  ]);

  const brandPosition = layout.indexOf('class="public-brand public-brand-centered"');
  const navigationPosition = layout.indexOf('class="public-header-desktop-nav"');
  const desktopSearchPosition = layout.indexOf('class="public-header-search-desktop"');
  assert.ok(brandPosition >= 0);
  assert.ok(navigationPosition > brandPosition);
  assert.ok(desktopSearchPosition > navigationPosition);

  assert.match(layout, /variant="inline"/u);
  assert.match(layout, /public-header-search-trigger-mobile/u);
  assert.match(layout, /public-header-search-trigger-mobile,[\s\S]*?public-header-search-layer[\s\S]*?display: none !important;/u);
  assert.match(searchComponent, /variant\?: "overlay" \| "inline"/u);
  assert.match(searchComponent, /inline \? "public-header-search-form-inline"/u);
  assert.match(searchComponent, /\{!inline && \(/u);
  assert.match(interactions, /querySelectorAll<HTMLFormElement>\("\[data-public-search-form\]"\)/u);
  assert.match(interactions, /desktopMedia\.addEventListener\("change"/u);
  assert.match(editorial, /\.public-header-search-form-inline \{[\s\S]*?grid-template-columns: 2\.3rem minmax\(0, 1fr\) 2\.6rem;/u);
  assert.match(editorial, /\.public-header-search-form-inline:focus-within/u);
});
