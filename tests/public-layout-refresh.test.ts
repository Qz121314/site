import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public pages use a light commerce shell with centered inline search and a standard footer", async () => {
  const [layout, headerSearch, interactions, categoryPage, searchPage, system, headerStyles, commerce, ads] = await Promise.all([
    readFile(new URL("../src/layouts/PublicLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/PublicHeaderSearch.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-interactions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/category/[category].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/[channel]/search.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-header-refinement.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-commerce.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-ads.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /import PublicHeaderSearch/u);
  assert.match(layout, /const hasBack = Boolean\(backHref\)/u);
  assert.match(layout, /data-public-header/u);
  assert.match(layout, /class="public-menu"/u);
  assert.match(layout, /<PublicBackLink href=/u);
  assert.match(layout, /class="public-brand public-brand-centered"/u);
  assert.match(layout, /data-header-search-open/u);
  assert.match(layout, /data-header-search-layer/u);
  assert.match(layout, /<meta name="color-scheme" content="light"/u);
  assert.match(layout, /<footer class="public-footer">/u);
  assert.match(layout, /class="public-footer-links"/u);

  assert.match(headerSearch, /data-header-search-form/u);
  assert.match(headerSearch, /data-header-search-close/u);
  assert.match(headerSearch, /data-header-search-input/u);
  assert.match(interactions, /const setSearchOpen = \(nextOpen: boolean\)/u);
  assert.match(interactions, /searchLayer\.inert = !nextOpen/u);
  assert.match(interactions, /event\.key !== "Escape"/u);
  assert.match(interactions, /Please enter a search term\./u);
  assert.match(interactions, /searchInput\.reportValidity\(\)/u);

  assert.match(system, /@import "\.\/public-commerce\.css";/u);
  assert.match(system, /@import "\.\/public-ads\.css";/u);
  assert.doesNotMatch(system, /public-design-system\.css/u);
  assert.doesNotMatch(system, /public-layout-refresh\.css/u);
  assert.doesNotMatch(system, /public-gallery-rail\.css/u);
  assert.match(headerStyles, /transform: scaleX\(\.1\)/u);
  assert.match(headerStyles, /\.public-header\[data-search-open="true"\] \.public-header-search-layer/u);

  assert.match(commerce, /--canvas-0: #ffffff/u);
  assert.match(commerce, /background: #ffffff/u);
  assert.match(commerce, /\.visual-card-overlay \{[\s\S]*?position: static/u);
  assert.match(commerce, /\.product-grid \{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(ads, /\.affiliate-ad-inline \{[\s\S]*?grid-column: 1 \/ -1/u);
  assert.match(ads, /\.affiliate-ad-modal-backdrop/u);

  assert.doesNotMatch(categoryPage, /import PublicBackLink/u);
  assert.doesNotMatch(categoryPage, /import PublicSearchForm/u);
  assert.match(categoryPage, /backHref=\{returnUrl\}/u);
  assert.match(categoryPage, /<header class="desktop-catalog-heading">[\s\S]*?<h1>\{category\.name\}<\/h1>/u);
  assert.match(searchPage, /backHref=\{returnUrl\}/u);
  assert.match(searchPage, /class="search-page-title"/u);
});

test("mobile, tablet, and desktop use distinct commerce compositions", async () => {
  const [commerce, desktop] = await Promise.all([
    readFile(new URL("../src/styles/public-commerce.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop.css", import.meta.url), "utf8"),
  ]);

  assert.match(commerce, /\.product-grid \{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(
    desktop,
    /@media \(min-width: 768px\) and \(max-width: 1099px\) \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/u,
  );
  assert.match(
    desktop,
    /@media \(min-width: 1100px\) \{[\s\S]*?--public-width: 88rem[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/u,
  );
  assert.match(
    desktop,
    /@media \(min-width: 1400px\) \{[\s\S]*?--public-width: 94rem[\s\S]*?repeat\(5, minmax\(0, 1fr\)\)/u,
  );
  assert.match(desktop, /@media \(min-width: 1100px\) \{[\s\S]*?\.product-detail \{[\s\S]*?grid-template-columns:/u);
  assert.match(desktop, /@media \(min-width: 768px\) and \(max-width: 1099px\) \{[\s\S]*?\.product-detail \{[\s\S]*?max-width: 50rem/u);
  assert.match(commerce, /padding-right: calc\(var\(--gallery-thumbnail-size\) \+ var\(--gallery-thumbnail-gap\)\)/u);
  assert.match(commerce, /\.product-gallery\.has-thumbnails \.product-gallery-thumbnails \{[\s\S]*?position: absolute/u);
  assert.match(commerce, /overflow-y: auto/u);
});

test("conversion resolution reveals one-line open and copy actions", async () => {
  const [productPage, ctaScript, browserSmoke] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/product/[product].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-product-cta.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/verify-browser-smoke.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(productPage, /data-contact-box/u);
  assert.match(productPage, /data-contact-resolved/u);
  assert.match(productPage, /data-contact-open/u);
  assert.match(productPage, /data-contact-sms-icon/u);
  assert.match(productPage, /data-contact-link-icon/u);
  assert.match(productPage, /data-contact-value/u);
  assert.match(productPage, /data-contact-copy/u);
  assert.match(productPage, /data-contact-copy-label/u);
  assert.doesNotMatch(productPage, /data-contact-fallback/u);
  assert.doesNotMatch(productPage, /Could not open/u);

  assert.match(ctaScript, /navigator\.clipboard\?\.writeText/u);
  assert.match(ctaScript, /document\.execCommand\("copy"\)/u);
  assert.match(ctaScript, /function formatVisibleValue/u);
  assert.match(ctaScript, /copyValue: type === "sms" \? display : target/u);
  assert.match(ctaScript, /resolveButton\.hidden = true/u);
  assert.match(ctaScript, /resolvedRow\.hidden = false/u);
  assert.match(ctaScript, /copyLabel\.textContent = copied \? "Copied" : "Copy failed"/u);
  assert.doesNotMatch(ctaScript, /window\.location\.assign/u);
  assert.doesNotMatch(ctaScript, /scheduleFallback/u);
  assert.doesNotMatch(ctaScript, /visibilitychange/u);

  assert.match(browserSmoke, /\/demo\/search\?q=Smoke/u);
  assert.match(browserSmoke, /\/api\/public\/channels\/demo\/products\?page=1/u);
  assert.match(browserSmoke, /\/api\/public\/channels\/demo\/ads\?device=mobile/u);
  assert.match(browserSmoke, /\/go\/smoke-product\?channel=demo/u);
  assert.match(browserSmoke, /Conversion resolver did not return the configured fixture target\./u);
});
