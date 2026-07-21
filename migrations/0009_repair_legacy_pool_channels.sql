-- Repair pool records created before ad_pools and conversion_groups became channel-scoped.
-- Only deterministic assignments are applied. Ambiguous records remain untouched rather
-- than being assigned to the wrong channel.

UPDATE ad_pools
SET channel_id = (
  SELECT channels.id
  FROM channels
  WHERE channels.hero_ad_pool_id = ad_pools.id
  LIMIT 1
)
WHERE channel_id IS NULL
  AND (
    SELECT COUNT(*)
    FROM channels
    WHERE channels.hero_ad_pool_id = ad_pools.id
  ) = 1
  AND NOT EXISTS (
    SELECT 1
    FROM ad_pools existing
    WHERE existing.channel_id = (
      SELECT channels.id
      FROM channels
      WHERE channels.hero_ad_pool_id = ad_pools.id
      LIMIT 1
    )
      AND existing.name = ad_pools.name
  );

UPDATE conversion_groups
SET channel_id = (
  SELECT MIN(products.channel_id)
  FROM products
  WHERE products.conversion_group_id = conversion_groups.id
)
WHERE channel_id IS NULL
  AND (
    SELECT COUNT(DISTINCT products.channel_id)
    FROM products
    WHERE products.conversion_group_id = conversion_groups.id
  ) = 1
  AND NOT EXISTS (
    SELECT 1
    FROM conversion_groups existing
    WHERE existing.channel_id = (
      SELECT MIN(products.channel_id)
      FROM products
      WHERE products.conversion_group_id = conversion_groups.id
    )
      AND existing.name = conversion_groups.name
  );

-- A database with exactly one channel has no channel-assignment ambiguity. Keep duplicate
-- names unresolved so the existing per-channel unique indexes cannot be violated.
UPDATE ad_pools
SET channel_id = (SELECT id FROM channels ORDER BY created_at ASC, id ASC LIMIT 1)
WHERE channel_id IS NULL
  AND (SELECT COUNT(*) FROM channels) = 1
  AND (
    SELECT COUNT(*)
    FROM ad_pools sibling
    WHERE sibling.channel_id IS NULL
      AND sibling.name = ad_pools.name
  ) = 1
  AND NOT EXISTS (
    SELECT 1
    FROM ad_pools existing
    WHERE existing.channel_id = (SELECT id FROM channels ORDER BY created_at ASC, id ASC LIMIT 1)
      AND existing.name = ad_pools.name
  );

UPDATE conversion_groups
SET channel_id = (SELECT id FROM channels ORDER BY created_at ASC, id ASC LIMIT 1)
WHERE channel_id IS NULL
  AND (SELECT COUNT(*) FROM channels) = 1
  AND (
    SELECT COUNT(*)
    FROM conversion_groups sibling
    WHERE sibling.channel_id IS NULL
      AND sibling.name = conversion_groups.name
  ) = 1
  AND NOT EXISTS (
    SELECT 1
    FROM conversion_groups existing
    WHERE existing.channel_id = (SELECT id FROM channels ORDER BY created_at ASC, id ASC LIMIT 1)
      AND existing.name = conversion_groups.name
  );
