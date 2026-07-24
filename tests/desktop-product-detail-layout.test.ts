import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop product detail stays compact and keeps thumbnails beside the image", async () => {
  const [entrypoint, source] = await Promise.all([
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-product-detail.css", import.meta.url), "utf8"),
  ]);

  assert.match(entrypoint, /@import "\.\/public-desktop-product-detail\.css";/u);
  assert.match(source, /@media \(min-width: 1100px\)/u);
  assert.match(source, /width: min\(100%, 67rem\)/u);
  assert.match(source, /grid-template-columns: minmax\(0, 31rem\) minmax\(18\.5rem, 23rem\)/u);
  assert.match(source, /height: clamp\(27rem, 40vw, 34rem\) !important/u);
  assert.match(source, /padding-left: calc\(var\(--gallery-thumbnail-size\) \+ var\(--gallery-thumbnail-gap\)\)/u);
  assert.match(source, /inset: 0 auto 0 0/u);
  assert.match(source, /border-radius: \.78rem \.78rem 0 0/u);
  assert.match(source, /border-radius: 0 0 \.78rem \.78rem/u);
  assert.doesNotMatch(source, /@media \(max-width:/u);
});
