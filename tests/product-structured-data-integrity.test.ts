import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("product structured data does not invent brand or product images", async () => {
  const source = await readFile(
    new URL("../src/pages/[channel]/product/[product].astro", import.meta.url),
    "utf8",
  );

  assert.match(source, /const productPrimaryImage = product\?\.coverUrl \?\? product\?\.gallery\[0\]\?\.imageUrl \?\? null/u);
  assert.match(source, /const primaryImage = productPrimaryImage \?\? site\.logoUrl/u);
  assert.match(source, /productPrimaryImage && galleryImages\.length > 0[\s\S]*image: galleryImages\.map/u);
  assert.doesNotMatch(source, /"@type": "Brand"|\bbrand:\s*\{/u);
  assert.match(source, /ogImageAlt=\{product \? \(productPrimaryImage \? product\.title : site\.siteName\) : null\}/u);
});
