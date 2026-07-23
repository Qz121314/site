import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const migrationDirectory = new URL("../migrations/", import.meta.url);

test("ships ordered schema, affiliate upgrade, and rollback compatibility", async () => {
  const files = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).sort();
  assert.deepEqual(files, [
    "0001_initial.sql",
    "0002_affiliate_ad_system.sql",
    "0003_affiliate_ad_rollback_compatibility.sql",
  ]);

  const [schema, advertising, compatibility] = await Promise.all([
    readFile(new URL("0001_initial.sql", migrationDirectory), "utf8"),
    readFile(new URL("0002_affiliate_ad_system.sql", migrationDirectory), "utf8"),
    readFile(new URL("0003_affiliate_ad_rollback_compatibility.sql", migrationDirectory), "utf8"),
  ]);
  assert.doesNotMatch(schema, /\bfeatured\b/u);
  assert.doesNotMatch(schema, /\bnoindex_enabled\b/u);
  assert.doesNotMatch(schema, /\ball_filter_label\b/u);

  const categories = schema.match(/CREATE TABLE categories \([\s\S]*?\n\);/u)?.[0] ?? "";
  assert.doesNotMatch(categories, /image_asset_id/u);
  assert.match(categories, /UNIQUE \(id, channel_id\)/u);

  assert.match(advertising, /device_type TEXT NOT NULL DEFAULT 'mobile'/u);
  assert.match(advertising, /display_type TEXT NOT NULL CHECK/u);
  assert.match(advertising, /creative_type TEXT NOT NULL CHECK/u);
  assert.match(advertising, /idx_ad_pools_channel_device_status/u);
  assert.match(advertising, /idx_advertisements_pool_status_type/u);

  assert.match(compatibility, /name TEXT NOT NULL DEFAULT 'Advertisement'/u);
  assert.match(compatibility, /display_type TEXT NOT NULL DEFAULT 'banner'/u);
  assert.match(compatibility, /creative_type TEXT NOT NULL DEFAULT 'uploaded_image'/u);
  assert.match(compatibility, /sort_order INTEGER NOT NULL DEFAULT 0/u);
  assert.match(compatibility, /idx_advertisements_pool_status_type[\s\S]*?display_type, id/u);
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
  const publicQueries = await readFile(new URL("../src/lib/db/public.ts", import.meta.url), "utf8");
  assert.doesNotMatch(publicQueries, /COALESCE\(cover\.thumbnail_object_key/u);
  assert.match(publicQueries, /cover\.thumbnail_object_key AS object_key/u);
});
