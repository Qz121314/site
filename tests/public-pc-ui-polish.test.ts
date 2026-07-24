import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PC navigation reads as centered colored menus", async () => {
  const [entrypoint, source] = await Promise.all([
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-ui-polish.css", import.meta.url), "utf8"),
  ]);

  assert.match(entrypoint, /@import "\.\/public-desktop-ui-polish\.css";\s*$/u);
  assert.match(source, /\.public-header-default \{\s*display: grid;/u);
  assert.match(source, /grid-template-areas: "leading brand search \. navigation"/u);
  assert.match(source, /\.desktop-density-section-group:nth-child\(4n \+ 1\)/u);
  assert.match(source, /\.desktop-density-section-group:nth-child\(4n \+ 4\)/u);
  assert.match(source, /\.desktop-density-section-link \{[\s\S]*?justify-content: center;[\s\S]*?text-align: center;/u);
  assert.match(source, /\.desktop-density-section-link svg \{\s*display: none;/u);
  assert.match(source, /\.desktop-density-filter-link span \{[\s\S]*?text-align: center;/u);
  assert.match(source, /\.desktop-density-category-grid \.category-entry-arrow \{\s*display: none;/u);
  assert.match(source, /\.desktop-density-category-grid \.category-entry-label \{[\s\S]*?text-align: center;/u);
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
