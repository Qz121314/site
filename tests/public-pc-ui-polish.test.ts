import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PC catalog centers the content screen between persistent navigation and advertising rails", async () => {
  const [entrypoint, source, screen, editorial, ads, adComponent, sidebar] = await Promise.all([
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-ui-polish.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-content-screen.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-editorial.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-ads.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/AffiliateAds.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogSidebarV2.astro", import.meta.url), "utf8"),
  ]);

  assert.match(entrypoint, /@import "\.\/public-desktop-content-screen\.css";\s*$/u);
  assert.doesNotMatch(entrypoint, /public-desktop-density-finish/u);
  assert.match(source, /--desktop-accent: #b69058/u);
  assert.match(editorial, /\.public-body:has\(\.integrated-desktop-catalog\) \.public-main \{[\s\S]*?flex: 0 0 auto;/u);

  assert.match(screen, /--desktop-screen-width: min\(58rem, calc\(100vw - 25rem\)\)/u);
  assert.match(screen, /\.public-body:has\(\.integrated-desktop-catalog\) \.public-header \{[\s\S]*?display: none;/u);
  assert.match(screen, /grid-template-columns:[\s\S]*?minmax\(var\(--desktop-side-track\), 1fr\)[\s\S]*?minmax\(0, var\(--desktop-screen-width\)\)[\s\S]*?minmax\(var\(--desktop-side-track\), 1fr\)/u);
  assert.match(screen, /\.desktop-nav-rail \{[\s\S]*?grid-row: 1 \/ 3;[\s\S]*?position: sticky;[\s\S]*?top: 1rem;/u);
  assert.match(screen, /\.desktop-portal-banner-slot \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1;/u);
  assert.match(screen, /\.integrated-desktop-content,[\s\S]*?\.desktop-portal-screen \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 2;/u);
  assert.match(screen, /\.desktop-portal-ad-slot \{[\s\S]*?grid-column: 3;[\s\S]*?position: sticky;/u);

  assert.match(ads, /\.affiliate-ad-rail \{[\s\S]*?position: fixed;/u);
  assert.match(adComponent, /data-affiliate-ad-banner-slot/u);
  assert.match(adComponent, /data-affiliate-ad-vertical-slot/u);
  assert.match(adComponent, /placeDesktopAdvertisementSlots/u);
  assert.match(adComponent, /adoptMountedAdvertisements/u);
  assert.match(adComponent, /vertical\.classList\.remove\("affiliate-ad-rail", "affiliate-ad-inline", "is-footer-overlap"\)/u);

  assert.match(sidebar, /site\.channels\.map/u);
  assert.match(sidebar, /longestNavigationLabel/u);
  assert.match(sidebar, /--desktop-nav-fit: \$\{navigationCharacterWidth\}ch/u);
  assert.match(sidebar, /class="desktop-nav-brand"/u);
  assert.match(sidebar, /class="desktop-nav-tools"/u);
  assert.match(sidebar, /href=\{searchHref\}>Search/u);
  assert.match(sidebar, /href="\/privacy"/u);
  assert.match(sidebar, /href="\/disclaimer"/u);
});

test("PC product detail keeps the gallery and title compact", async () => {
  const source = await readFile(
    new URL("../src/styles/public-desktop-ui-polish.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /grid-template-columns: minmax\(0, 26\.5rem\) minmax\(18rem, 21\.5rem\)/u);
  assert.match(source, /grid-template-rows: max-content auto;/u);
  assert.match(source, /\.product-detail-title \{[\s\S]*?height: max-content;[\s\S]*?align-self: start;/u);
  assert.match(source, /height: clamp\(23rem, 30vw, 27\.5rem\) !important;/u);
  assert.match(source, /max-height: 27\.5rem;/u);
  assert.match(source, /--gallery-thumbnail-size: 3\.5rem;/u);
  assert.match(source, /\.product-detail:has\(\.product-detail-ad-slot:not\(:empty\)\)[\s\S]*?max-width: 80rem;/u);
  assert.doesNotMatch(source, /@media \(max-width:/u);
});
