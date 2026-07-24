import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin product surfaces prefer responsive thumbnails over original R2 objects", async () => {
  const [products, productImages] = await Promise.all([
    readFile(new URL("../src/lib/db/products.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/db/product-images.ts", import.meta.url), "utf8"),
  ]);

  assert.match(
    products,
    /COALESCE\(cover\.thumbnail_object_key, cover\.object_key\) AS cover_object_key/u,
  );
  assert.doesNotMatch(products, /cover\.object_key AS cover_object_key/u);

  assert.match(
    productImages,
    /COALESCE\(a\.thumbnail_object_key, a\.object_key\) AS preview_object_key/u,
  );
  assert.match(productImages, /buildPublicImageUrl\(baseUrl, image\.preview_object_key\)/u);
  assert.doesNotMatch(productImages, /buildPublicImageUrl\(baseUrl, image\.object_key\)/u);
});
