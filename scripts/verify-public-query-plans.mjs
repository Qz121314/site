import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const migrations = readdirSync("migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort();

assert.deepEqual(migrations, [
  "0001_initial.sql",
  "0002_affiliate_ad_system.sql",
  "0003_affiliate_ad_rollback_compatibility.sql",
  "0004_optimize_query_planner.sql",
]);

const labels = [
  "indexes",
  "public categories",
  "public product list",
  "public product detail",
  "product gallery",
  "public product search",
  "desktop filter map",
  "affiliate ad candidates",
];

const sql = `
SELECT '=== indexes ===' AS audit_section;
SELECT name, tbl_name, sql
FROM sqlite_schema
WHERE type = 'index' AND sql IS NOT NULL
ORDER BY tbl_name ASC, name ASC;

SELECT '=== public categories ===' AS audit_section;
EXPLAIN QUERY PLAN
WITH filter_usage AS (
  SELECT relation.category_id, GROUP_CONCAT(relation.filter_id) AS filter_ids
  FROM category_filter_relations relation
  INNER JOIN category_filters filter
    ON filter.id = relation.filter_id
   AND filter.status = 'enabled'
  WHERE filter.channel_id = 'audit-channel'
  GROUP BY relation.category_id
)
SELECT category.id, category.name, category.slug, filter_usage.filter_ids
FROM categories category
LEFT JOIN filter_usage ON filter_usage.category_id = category.id
WHERE category.channel_id = 'audit-channel'
  AND category.status = 'published'
  AND EXISTS (
    SELECT 1 FROM products product
    WHERE product.channel_id = category.channel_id
      AND product.category_id = category.id
      AND product.status = 'published'
  )
ORDER BY category.sort_order ASC, category.created_at ASC;

SELECT '=== public product list ===' AS audit_section;
EXPLAIN QUERY PLAN
SELECT p.id, p.title, p.slug, cover.thumbnail_object_key, p.tags
FROM products p
INNER JOIN image_assets cover
  ON cover.id = p.cover_asset_id
 AND cover.thumbnail_object_key IS NOT NULL
LEFT JOIN categories category
  ON category.id = p.category_id
 AND category.channel_id = p.channel_id
WHERE p.channel_id = 'audit-channel'
  AND p.status = 'published'
  AND p.category_id = 'audit-category'
  AND (p.category_id IS NULL OR category.status = 'published')
ORDER BY p.sort_order ASC, p.created_at DESC
LIMIT 21 OFFSET 0;

SELECT '=== public product detail ===' AS audit_section;
EXPLAIN QUERY PLAN
SELECT
  p.id,
  EXISTS(
    SELECT 1
    FROM conversion_groups conversion_group
    INNER JOIN conversion_resources resource
      ON resource.group_id = conversion_group.id
     AND resource.status = 'enabled'
    WHERE conversion_group.id = p.conversion_group_id
      AND conversion_group.channel_id = p.channel_id
      AND conversion_group.status = 'enabled'
    LIMIT 1
  ) AS has_conversion,
  EXISTS(
    SELECT 1 FROM category_filters category_filter
    WHERE category_filter.channel_id = p.channel_id
      AND category_filter.status = 'enabled'
    LIMIT 1
  ) AS has_category_navigation
FROM products p
INNER JOIN channels channel
  ON channel.id = p.channel_id
 AND channel.status = 'published'
LEFT JOIN categories category
  ON category.id = p.category_id
 AND category.channel_id = p.channel_id
 AND category.status = 'published'
LEFT JOIN image_assets cover ON cover.id = p.cover_asset_id
WHERE channel.slug = 'audit-channel'
  AND p.slug = 'audit-product'
  AND p.status = 'published'
  AND (p.category_id IS NULL OR category.id IS NOT NULL);

SELECT '=== product gallery ===' AS audit_section;
EXPLAIN QUERY PLAN
SELECT image.id, image.object_key
FROM product_images relation
INNER JOIN image_assets image ON image.id = relation.image_asset_id
WHERE relation.product_id = 'audit-product'
ORDER BY relation.sort_order ASC, image.created_at ASC;

SELECT '=== public product search ===' AS audit_section;
EXPLAIN QUERY PLAN
SELECT p.id, p.title, p.slug, cover.thumbnail_object_key, p.tags
FROM products p
INNER JOIN image_assets cover
  ON cover.id = p.cover_asset_id
 AND cover.thumbnail_object_key IS NOT NULL
LEFT JOIN categories category
  ON category.id = p.category_id
 AND category.channel_id = p.channel_id
WHERE p.channel_id = 'audit-channel'
  AND p.status = 'published'
  AND (p.title LIKE '%audit%' OR p.tags LIKE '%audit%')
  AND (p.category_id IS NULL OR category.status = 'published')
ORDER BY p.sort_order ASC, p.created_at DESC
LIMIT 40;

SELECT '=== desktop filter map ===' AS audit_section;
EXPLAIN QUERY PLAN
SELECT filter.channel_id, filter.id, filter.name, filter.slug
FROM category_filters filter
WHERE filter.channel_id IN ('audit-channel', 'audit-channel-2')
  AND filter.status = 'enabled'
  AND EXISTS (
    SELECT 1
    FROM category_filter_relations relation
    INNER JOIN categories category
      ON category.id = relation.category_id
     AND category.channel_id = filter.channel_id
     AND category.status = 'published'
    WHERE relation.filter_id = filter.id
      AND EXISTS (
        SELECT 1
        FROM products product
        WHERE product.channel_id = filter.channel_id
          AND product.category_id = category.id
          AND product.status = 'published'
      )
    LIMIT 1
  )
ORDER BY filter.channel_id ASC, filter.sort_order ASC, filter.created_at ASC;

SELECT '=== affiliate ad candidates ===' AS audit_section;
EXPLAIN QUERY PLAN
SELECT advertisement.id, advertisement.name
FROM channels channel
INNER JOIN ad_pools pool
  ON pool.channel_id = channel.id
 AND pool.device_type = 'mobile'
 AND pool.status = 'enabled'
INNER JOIN advertisements advertisement
  ON advertisement.pool_id = pool.id
 AND advertisement.status = 'enabled'
 AND advertisement.display_type = 'banner'
 AND advertisement.id >= 'audit-pivot'
LEFT JOIN image_assets image ON image.id = advertisement.image_asset_id
INNER JOIN site_settings settings ON settings.id = 1
WHERE channel.slug = 'audit-channel'
  AND channel.status = 'published'
ORDER BY advertisement.id ASC
LIMIT 10;
`;

const result = spawnSync(
  "pnpm",
  ["exec", "wrangler", "d1", "execute", "DB", "--local", `--command=${sql}`],
  { encoding: "utf8" },
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
if (result.status !== 0) {
  console.error(output);
  throw new Error("D1 query-plan inspection failed.");
}

function readSection(label) {
  const marker = `=== ${label} ===`;
  const start = output.indexOf(marker);
  assert.notEqual(start, -1, `Missing D1 query-plan section: ${label}`);
  const labelIndex = labels.indexOf(label);
  const nextPositions = labels
    .slice(labelIndex + 1)
    .map((nextLabel) => output.indexOf(`=== ${nextLabel} ===`, start + marker.length))
    .filter((position) => position >= 0);
  const end = nextPositions.length > 0 ? Math.min(...nextPositions) : output.length;
  return output.slice(start, end);
}

function assertUses(label, indexNames) {
  const section = readSection(label);
  for (const indexName of indexNames) {
    assert.match(section, new RegExp(indexName, "u"), `${label} must use ${indexName}`);
  }
  assert.doesNotMatch(
    section,
    /"detail": "SCAN (?:p|product|category|filter|relation|channel|pool|advertisement)\b/u,
    `${label} must not fall back to a hot-table scan`,
  );
}

const indexSection = readSection("indexes");
for (const indexName of [
  "idx_categories_public",
  "idx_category_filters_public",
  "idx_category_filter_relations_filter",
  "idx_products_admin_list",
  "idx_products_channel_listing",
  "idx_product_images_order",
  "idx_ad_pools_channel_device_status",
  "idx_advertisements_pool_status_type",
]) {
  assert.match(indexSection, new RegExp(indexName, "u"), `Missing required D1 index: ${indexName}`);
}

assertUses("public categories", [
  "idx_category_filters_public",
  "idx_category_filter_relations_filter",
  "idx_categories_public",
  "idx_products_admin_list",
]);
assertUses("public product list", ["idx_products_admin_list"]);
assertUses("public product detail", [
  "sqlite_autoindex_channels_2",
  "sqlite_autoindex_products_2",
  "idx_conversion_resources_group",
  "idx_category_filters_public",
]);
assertUses("product gallery", ["idx_product_images_order"]);
assertUses("public product search", ["idx_products_channel_listing"]);
assertUses("desktop filter map", [
  "idx_category_filters_public",
  "idx_categories_public",
  "idx_products_admin_list",
]);
assertUses("affiliate ad candidates", [
  "idx_ad_pools_channel_device_status",
  "idx_advertisements_pool_status_type",
]);

console.log("D1 public query plans use the expected indexes.");
