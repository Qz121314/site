import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const migrations = readdirSync("migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort();

console.log("D1 migrations:");
for (const migration of migrations) console.log(`- ${migration}`);

function inspect(label, sql) {
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", "--local", `--command=${sql}`],
    { encoding: "utf8" },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  console.log(`\n=== ${label} ===`);
  console.log(output);
  if (result.status !== 0) {
    throw new Error(`D1 query-plan inspection failed for ${label}.`);
  }
}

inspect(
  "indexes",
  `SELECT name, tbl_name, sql
   FROM sqlite_schema
   WHERE type = 'index' AND sql IS NOT NULL
   ORDER BY tbl_name ASC, name ASC`,
);

inspect(
  "public categories",
  `EXPLAIN QUERY PLAN
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
   ORDER BY category.sort_order ASC, category.created_at ASC`,
);

inspect(
  "public product list",
  `EXPLAIN QUERY PLAN
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
   LIMIT 21 OFFSET 0`,
);

inspect(
  "public product detail",
  `EXPLAIN QUERY PLAN
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
     AND (p.category_id IS NULL OR category.id IS NOT NULL)`,
);

inspect(
  "product gallery",
  `EXPLAIN QUERY PLAN
   SELECT image.id, image.object_key
   FROM product_images relation
   INNER JOIN image_assets image ON image.id = relation.image_asset_id
   WHERE relation.product_id = 'audit-product'
   ORDER BY relation.sort_order ASC, image.created_at ASC`,
);

inspect(
  "public product search",
  `EXPLAIN QUERY PLAN
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
   LIMIT 40`,
);

inspect(
  "desktop filter map",
  `EXPLAIN QUERY PLAN
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
   ORDER BY filter.channel_id ASC, filter.sort_order ASC, filter.created_at ASC`,
);

inspect(
  "affiliate ad candidates",
  `EXPLAIN QUERY PLAN
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
   LIMIT 10`,
);

console.log("\nD1 query plans inspected.");
throw new Error("Intentional diagnostic failure after D1 query-plan capture.");
