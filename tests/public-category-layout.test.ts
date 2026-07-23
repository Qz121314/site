import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile category directory stays compact for large category sets", async () => {
  const [system, styles, card] = await Promise.all([
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-category-navigation.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/CategoryCard.astro", import.meta.url), "utf8"),
  ]);

  assert.match(system, /@import "\.\/public-editorial\.css";[\s\S]*@import "\.\/public-category-navigation\.css";/u);
  assert.match(styles, /@media \(max-width: 767px\)/u);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(styles, /grid-auto-rows: 3\.25rem/u);
  assert.match(styles, /height: 3\.25rem/u);
  assert.match(styles, /-webkit-line-clamp: 2/u);
  assert.match(styles, /\.category-entry-arrow svg \{[\s\S]*width: \.82rem;[\s\S]*height: \.82rem;/u);
  assert.match(card, /class="category-entry-label"/u);
  assert.match(card, /class="category-entry-arrow"/u);
});
