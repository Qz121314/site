import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("category filters fill one row and remain visually separate from category links", async () => {
  const [page, styles, interaction] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-category-filter-bar.css", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/public-category-filters.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /categoryFilterColumns = Math\.min\(Math\.max\(activeFilters\.length, 1\), 4\)/u);
  assert.match(page, /--category-filter-columns/u);
  assert.match(page, /class="category-filter-bar"/u);
  assert.match(page, /class="category-filter-bar category-filter-bar-desktop"/u);
  assert.match(page, /class="category-filter-button"/u);
  assert.match(page, /class="category-group-heading"/u);
  assert.doesNotMatch(page, /class="filter-button category-group-label category-group-filter"/u);

  assert.match(styles, /grid-template-columns: repeat\(var\(--category-filter-columns, 1\), minmax\(0, 1fr\)\)/u);
  assert.match(styles, /\.category-filter-button \{[\s\S]*?width: 100%/u);
  assert.match(styles, /\.category-filter-button \{[\s\S]*?text-align: center/u);
  assert.match(styles, /\.category-mobile-directory \{[\s\S]*?gap: 1\.25rem !important/u);
  assert.match(styles, /\.category-filter-button\[aria-pressed="true"\]/u);
  assert.match(styles, /\.category-group-heading/u);

  assert.match(interaction, /row\.hidden = Boolean\(filterId && row\.dataset\.categoryGroupRow !== filterId\)/u);
});
