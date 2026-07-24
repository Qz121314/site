import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop catalog keeps navigation and product cards compact", async () => {
  const [entrypoint, source] = await Promise.all([
    readFile(new URL("../src/styles/public-system.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/public-desktop-catalog-refinement.css", import.meta.url), "utf8"),
  ]);

  assert.match(entrypoint, /@import "\.\/public-desktop-catalog-refinement\.css";/u);
  assert.match(source, /@media \(min-width: 1100px\)/u);
  assert.match(source, /grid-template-columns: clamp\(9\.5rem, 10vw, 10\.75rem\) minmax\(0, 1fr\)/u);
  assert.match(source, /grid-template-columns: clamp\(6\.75rem, 7\.5vw, 7\.75rem\) minmax\(0, 1fr\)/u);
  assert.match(source, /repeat\(auto-fill, minmax\(11rem, 12\.75rem\)\)/u);
  assert.match(source, /justify-content: start/u);
  assert.doesNotMatch(source, /@media \(max-width:/u);
});
