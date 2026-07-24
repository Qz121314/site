import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PC catalog centers products between adaptive navigation and advertising rails", async () => {
  const [entrypoint, source, hierarchy, editorial, ads, sidebar] = await Promise.all([
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-ui-polish.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-navigation-hierarchy.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-editorial.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-ads.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogSidebarV2.astro", import.meta.url), "utf8"),
  ]);

  assert.match(entrypoint, /@import "\.\/public-desktop-navigation-hierarchy\.css";\s*$/u);
  assert.doesNotMatch(entrypoint, /public-desktop-density-finish/u);
  assert.match(source, /--public-width: 90rem/u);
  assert.match(source, /--desktop-accent: #b69058/u);
  assert.match(source, /grid-template-areas: "brand search \. navigation"/u);
  assert.match(source, /background:[\s\S]*?var\(--desktop-ink\)/u);
  assert.match(source, /\.public-footer \{[\s\S]*?background: var\(--desktop-ink\)/u);
  assert.match(editorial, /\.public-body:has\(\.integrated-desktop-catalog\) \.public-main \{[\s\S]*?flex: 0 0 auto;/u);

  assert.match(hierarchy, /--desktop-content-width: 50rem/u);
  assert.match(hierarchy, /grid-template-columns:[\s\S]*?minmax\(var\(--desktop-side-min\), 1fr\)[\s\S]*?minmax\(0, var\(--desktop-content-width\)\)[\s\S]*?minmax\(var\(--desktop-side-min\), 1fr\)/u);
  assert.match(hierarchy, /width: 100vw;/u);
  assert.match(hierarchy, /margin-inline: calc\(50% - 50vw\)/u);
  assert.match(hierarchy, /\.desktop-nav-rail \{[\s\S]*?width: clamp\(9\.5rem, var\(--desktop-nav-fit, 12rem\), 14rem\);[\s\S]*?position: sticky;[\s\S]*?top: calc\(var\(--desktop-header-height\) \+ 1rem\)/u);
  assert.match(hierarchy, /\.integrated-desktop-content \{[\s\S]*?grid-column: 2;[\s\S]*?max-width: var\(--desktop-content-width\);[\s\S]*?justify-self: center;/u);
  assert.match(hierarchy, /\.integrated-desktop-catalog::after \{[\s\S]*?grid-column: 3;/u);
  assert.match(hierarchy, /repeat\(auto-fill, minmax\(11\.25rem, 11\.75rem\)\)/u);
  assert.match(hierarchy, /\.desktop-catalog-heading \{[\s\S]*?clip-path: inset\(50%\)/u);

  assert.match(ads, /\.affiliate-ad-rail \{[\s\S]*?position: fixed;/u);

  assert.match(sidebar, /site\.channels\.map/u);
  assert.match(sidebar, /longestNavigationLabel/u);
  assert.match(sidebar, /navigationCharacterWidth = Math\.min\(Math\.max\(longestNavigationLabel \+ 5, 13\), 24\)/u);
  assert.match(sidebar, /--desktop-nav-fit: \$\{navigationCharacterWidth\}ch/u);
  assert.match(sidebar, /const expanded = active && filters\.length > 0/u);
  assert.match(sidebar, /aria-expanded=\{expanded \? "true" : undefined\}/u);
  assert.doesNotMatch(sidebar, /<svg/u);
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
