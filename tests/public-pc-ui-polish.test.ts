import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PC navigation forms an integrated logo rail and nested section menu", async () => {
  const [entrypoint, source, sidebar] = await Promise.all([
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-ui-polish.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/DesktopCatalogSidebarV2.astro", import.meta.url), "utf8"),
  ]);

  assert.match(entrypoint, /@import "\.\/public-desktop-ui-polish\.css";\s*$/u);
  assert.match(source, /--desktop-nav-width/u);
  assert.match(source, /grid-template-areas: "brand search \. navigation"/u);
  assert.match(source, /grid-template-columns: var\(--desktop-nav-width\) minmax\(0, 1fr\)/u);
  assert.match(source, /\.desktop-nav-section-1/u);
  assert.match(source, /\.desktop-nav-section-4/u);
  assert.match(source, /\.desktop-nav-section-link\[aria-current="page"\]/u);
  assert.match(source, /\.desktop-nav-filter-list/u);
  assert.match(source, /\.desktop-catalog-panel/u);
  assert.match(source, /border-right: 1px solid #dfe2e6/u);
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
