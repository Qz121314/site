import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop header aligns brand, search, and legal links in one row", async () => {
  const [entrypoint, source] = await Promise.all([
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-header-layout.css", import.meta.url), "utf8"),
  ]);

  assert.match(entrypoint, /@import "\.\/public-desktop-header-layout\.css";/u);
  assert.match(source, /@media \(min-width: 1100px\)/u);
  assert.match(source, /grid-template-areas: "leading brand search navigation"/u);
  assert.match(source, /\.public-header-leading \.public-menu \{\s*display: none;/u);
  assert.match(source, /\.public-header-default \.public-brand-centered \{\s*grid-area: brand;/u);
  assert.match(source, /\.public-header-trailing \{\s*grid-area: search;/u);
  assert.match(source, /\.public-header-desktop-nav \{\s*grid-area: navigation;/u);
  assert.match(source, /width: min\(100%, 28rem\)/u);
  assert.doesNotMatch(source, /@media \(max-width: 767px\)/u);
});
