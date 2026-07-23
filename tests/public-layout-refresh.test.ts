import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public pages use a centered three-control header with an inline expanding search", async () => {
  const [layout, headerSearch, interactions, categoryPage, searchPage, system, headerStyles, desktop, categoryPolish] = await Promise.all([
    readFile(new URL("../src/layouts/PublicLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/PublicHeaderSearch.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-interactions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/search.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-header-refinement.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-category-polish.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /import PublicHeaderSearch/u);
  assert.match(layout, /const hasBack = Boolean\(backHref\)/u);
  assert.match(layout, /data-public-header/u);
  assert.match(layout, /class="public-menu"/u);
  assert.match(layout, /<PublicBackLink href=/u);
  assert.match(layout, /class="public-brand public-brand-centered"/u);
  assert.match(layout, /data-header-search-open/u);
  assert.match(layout, /data-header-search-layer/u);
  assert.doesNotMatch(layout, /class="public-container public-footer"/u);

  assert.match(headerSearch, /data-header-search-form/u);
  assert.match(headerSearch, /data-header-search-close/u);
  assert.match(headerSearch, /data-header-search-input/u);
  assert.match(interactions, /const setSearchOpen = \(nextOpen: boolean\)/u);
  assert.match(interactions, /searchLayer\.inert = !nextOpen/u);
  assert.match(interactions, /event\.key !== "Escape"/u);
  assert.match(interactions, /Please enter a search term\./u);
  assert.match(interactions, /const syncSearchValidity = \(\) =>/u);
  assert.match(interactions, /searchInput\.setCustomValidity\(searchInput\.value\.trim\(\) \? "" : SEARCH_REQUIRED_MESSAGE\)/u);
  assert.match(interactions, /syncSearchValidity\(\);[\s\S]*?searchOpen\.addEventListener/u);
  assert.match(interactions, /searchInput\.addEventListener\("invalid", syncSearchValidity\)/u);
  assert.match(interactions, /searchInput\.reportValidity\(\)/u);

  assert.match(system, /@import "\.\/public-header-refinement\.css";/u);
  assert.match(headerStyles, /grid-template-columns: minmax\(5\.25rem, 1fr\) minmax\(0, auto\) minmax\(5\.25rem, 1fr\)/u);
  assert.match(headerStyles, /transform: scaleX\(\.1\)/u);
  assert.match(headerStyles, /\.public-header\[data-search-open="true"\] \.public-header-search-layer/u);
  assert.match(headerStyles, /@media \(prefers-reduced-motion: reduce\)/u);

  assert.doesNotMatch(categoryPage, /import PublicBackLink/u);
  assert.doesNotMatch(categoryPage, /import PublicSearchForm/u);
  assert.match(categoryPage, /backHref=\{returnUrl\}/u);
  assert.match(categoryPage, /<header class="directory-page-title">[\s\S]*?<h1>\{category\.name\}<\/h1>/u);
  assert.match(searchPage, /backHref=\{returnUrl\}/u);
  assert.match(searchPage, /class="search-page-title"/u);

  assert.match(
    desktop,
    /@media \(min-width: 768px\) \{[\s\S]*?\.category-mobile-directory \{[\s\S]*?display: none/u,
  );
  assert.match(
    categoryPolish,
    /@media \(max-width: 767px\) \{[\s\S]*?\.category-mobile-directory \{[\s\S]*?display: grid/u,
  );
});

test("product detail pages place the gallery before the title and keep thumbnails beside the main image on every viewport", async () => {
  const [refresh, rail] = await Promise.all([
    readFile(new URL("../src/styles/public-layout-refresh.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-gallery-rail.css", import.meta.url), "utf8"),
  ]);

  assert.match(refresh, /\.product-detail-media \{[\s\S]*?grid-row: 1 !important/u);
  assert.match(refresh, /\.product-detail-title \{[\s\S]*?grid-row: 2 !important/u);
  assert.match(refresh, /\.product-detail-information \{[\s\S]*?grid-row: 3 !important/u);
  assert.match(rail, /^\.product-detail \.product-gallery\.has-thumbnails \{/mu);
  assert.match(rail, /padding-right: calc\(var\(--gallery-thumbnail-size\) \+ var\(--gallery-thumbnail-gap\)\)/u);
  assert.match(rail, /position: absolute/u);
  assert.match(rail, /inset: 0 0 0 auto/u);
  assert.match(rail, /grid-auto-flow: row/u);
  assert.match(rail, /overflow-y: auto/u);
});

test("conversion navigation exposes a copy fallback for SMS numbers and links", async () => {
  const [productPage, ctaScript] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/product/[product].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-product-cta.ts", import.meta.url), "utf8"),
  ]);

  assert.match(productPage, /data-contact-box/u);
  assert.match(productPage, /data-contact-fallback/u);
  assert.match(productPage, /data-contact-copy-value/u);
  assert.match(productPage, /data-contact-copy/u);
  assert.match(productPage, /If it did not open, copy the contact below\./u);

  assert.match(ctaScript, /navigator\.clipboard\?\.writeText/u);
  assert.match(ctaScript, /document\.execCommand\("copy"\)/u);
  assert.match(ctaScript, /Copy number/u);
  assert.match(ctaScript, /Copy link/u);
  assert.match(ctaScript, /window\.location\.assign\(target\)/u);
  assert.match(ctaScript, /scheduleFallback\(\)/u);
  assert.match(ctaScript, /document\.visibilityState === "visible"/u);
  assert.match(ctaScript, /window\.addEventListener\("pageshow"/u);
});
