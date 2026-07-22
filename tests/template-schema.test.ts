import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const migrationDirectory = new URL("../migrations/", import.meta.url);

test("ships one clean initial migration without legacy fields", async () => {
  const files = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql"));
  assert.deepEqual(files, ["0001_initial.sql"]);

  const schema = await readFile(new URL("0001_initial.sql", migrationDirectory), "utf8");
  assert.doesNotMatch(schema, /\bfeatured\b/u);
  assert.doesNotMatch(schema, /\bnoindex_enabled\b/u);
  assert.doesNotMatch(schema, /\ball_filter_label\b/u);

  const categories = schema.match(/CREATE TABLE categories \([\s\S]*?\n\);/u)?.[0] ?? "";
  assert.doesNotMatch(categories, /image_asset_id/u);
  assert.match(categories, /UNIQUE \(id, channel_id\)/u);
});

test("enforces dedicated product thumbnails and publishable relations", async () => {
  const schema = await readFile(new URL("0001_initial.sql", migrationDirectory), "utf8");
  assert.match(schema, /trg_product_cover_requires_thumbnail_insert/u);
  assert.match(schema, /trg_product_image_requires_thumbnail_insert/u);
  assert.match(schema, /trg_products_require_published_media_update/u);
  assert.match(schema, /trg_products_require_published_category_update/u);
  assert.match(schema, /trg_products_require_available_conversion_update/u);
  assert.match(schema, /channel_id TEXT NOT NULL REFERENCES channels\(id\)/u);
});

test("public catalog queries never fall back to original media", async () => {
  const sources = await Promise.all([
    readFile(new URL("../src/lib/db/public.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/db/public-availability.ts", import.meta.url), "utf8"),
  ]);
  const publicQueries = sources.join("\n");
  assert.doesNotMatch(publicQueries, /COALESCE\(cover\.thumbnail_object_key/u);
  assert.match(publicQueries, /cover\.thumbnail_object_key AS object_key/u);
});
