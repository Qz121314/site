import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the latest gallery thumbnail selection wins asynchronous image loading", async () => {
  const source = await readFile(
    new URL("../src/scripts/public-product-gallery.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /let selectionVersion = 0/u);
  assert.match(source, /const version = \+\+selectionVersion/u);
  assert.match(source, /preload\.onload = \(\) => \{[\s\S]*version !== selectionVersion[\s\S]*mainImage\.src = nextUrl/u);
  assert.match(source, /preload\.onerror = \(\) => \{[\s\S]*version === selectionVersion/u);
});
