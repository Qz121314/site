import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PC navigation forms a compact integrated logo rail and nested section menu", async () => {
  const [entrypoint, source, density, sidebar] = await Promise.all([
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-ui-polish.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-density-finish.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogSidebarV2.astro", import.meta.url), "utf8"),
  ]);

  assert.match(entrypoint, /@import "\.\/public-desktop-density-finish\.css";\s*$/u);
  assert.match(source, /--desktop-nav-width/u);
  assert.match(source, /grid-template-areas: "brand search \. navigation"/u);
  assert.match(source, /grid-template-columns: var\(--desktop-nav-width\) minmax\(0, 1fr\)/u);
  assert.match(source, /\.desktop-nav-section-1/u);
  assert.match(source, /\.desktop-nav-section-4/u);
  assert.match(source, /\.desktop-nav-section-link\[aria-current="page"\]/u);
  assert.match(source, /\.desktop-nav-filter-list/u);
  assert.match(source, /\.desktop-catalog-panel/u);
  assert.match(source, /border-right: 1px solid #dfe2e6/u);

  assert.match(density, /--desktop-nav-width: clamp\(8\.5rem, 8\.8vw, 9\.5rem\)/u);
  assert.match(density, /\.desktop-nav-section-link,[\s\S]*?width: max-content/u);
  assert.match(density, /\.desktop-nav-filter-list \{[\s\S]*?margin: 0;[\s\S]*?border-left: 0;/u);
  assert.match(density, /\.desktop-nav-filter-link \{[\s\S]*?color: rgb\(var\(--section-accent\)\)/u);
  assert.match(density, /grid-template-columns: clamp\(6\.75rem, 7\.2vw, 8rem\) minmax\(0, 1fr\)/u);
  assert.match(density, /\.category-entry \{[\s\S]*?border: 1px solid #cbd2da;[\s\S]*?background: #ffffff;/u);
  assert.match(density, /\.product-card \.visual-card-overlay \{[\s\S]*?position: absolute;[\s\S]*?bottom: 0;/u);
  assert.match(density, /linear-gradient\(180deg, transparent 0%, rgb\(0 0 0 \/ \.72\) 100%\)/u);

  assert.match(sidebar, /active && filters\.length > 0/u);
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
