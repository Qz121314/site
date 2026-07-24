import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PC navigation uses one premium brand, navigation, category, and product frame", async () => {
  const [entrypoint, source, hierarchy, editorial, sidebar] = await Promise.all([
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-ui-polish.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-navigation-hierarchy.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-editorial.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogSidebarV2.astro", import.meta.url), "utf8"),
  ]);

  assert.match(entrypoint, /@import "\.\/public-desktop-navigation-hierarchy\.css";\s*$/u);
  assert.doesNotMatch(entrypoint, /public-desktop-density-finish/u);
  assert.match(source, /--public-width: 90rem/u);
  assert.match(source, /--desktop-nav-width: 12rem/u);
  assert.match(source, /--desktop-category-width: 11rem/u);
  assert.match(source, /--desktop-accent: #b69058/u);
  assert.match(source, /grid-template-areas: "brand search \. navigation"/u);
  assert.match(source, /grid-template-columns: var\(--desktop-nav-width\) minmax\(0, 1fr\)/u);
  assert.match(source, /border-radius: 1\.2rem/u);
  assert.match(source, /0 24px 64px rgb\(58 44 28 \/ \.12\)/u);
  assert.match(source, /background:[\s\S]*?var\(--desktop-ink\)/u);
  assert.match(source, /\.desktop-nav-section-link\[aria-current="page"\][\s\S]*?border-left-color: rgb\(var\(--section-accent\)\)/u);
  assert.match(source, /grid-template-columns: var\(--desktop-category-width\) minmax\(0, 1fr\)/u);
  assert.match(source, /\.category-entry \{[\s\S]*?border-radius: \.65rem;[\s\S]*?background: transparent;/u);
  assert.match(source, /\.product-card \{[\s\S]*?max-width: 13\.75rem;[\s\S]*?border-radius: \.9rem;/u);
  assert.match(source, /linear-gradient\(180deg, transparent 0%, rgb\(13 11 9 \/ \.18\) 28%, rgb\(13 11 9 \/ \.88\) 100%\)/u);
  assert.match(source, /\.public-footer \{[\s\S]*?background: var\(--desktop-ink\)/u);
  assert.match(editorial, /\.public-body:has\(\.integrated-desktop-catalog\) \.public-main \{[\s\S]*?flex: 0 0 auto;/u);

  assert.match(hierarchy, /\.desktop-nav-section-link::after[\s\S]*?content: "›"/u);
  assert.match(hierarchy, /\.desktop-nav-section-link\[aria-expanded="true"\]::after[\s\S]*?content: "⌄"/u);
  assert.match(hierarchy, /\.desktop-nav-filter-link \{[\s\S]*?border: 1px solid rgb\(255 255 255 \/ \.1\);[\s\S]*?box-shadow:/u);
  assert.match(hierarchy, /\.desktop-nav-filter-link::after[\s\S]*?content: "›"/u);
  assert.match(hierarchy, /\.desktop-nav-filter-link:focus-visible/u);
  assert.match(hierarchy, /\.desktop-catalog-heading \{[\s\S]*?clip-path: inset\(50%\)/u);

  assert.match(sidebar, /site\.channels\.map/u);
  assert.match(sidebar, /const expanded = active && filters\.length > 0/u);
  assert.match(sidebar, /aria-expanded=\{expanded \? "true" : undefined\}/u);
  assert.match(sidebar, /desktop-nav-section-label/u);
  assert.match(sidebar, /desktop-nav-filter-label/u);
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
