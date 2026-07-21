-- Preserve public conversion and Hero availability when admin records are edited concurrently.

CREATE TRIGGER IF NOT EXISTS trg_conversion_groups_preserve_published_cta
BEFORE UPDATE OF status ON conversion_groups
WHEN OLD.status = 'enabled'
  AND NEW.status = 'disabled'
  AND EXISTS (
    SELECT 1
    FROM products
    WHERE channel_id = OLD.channel_id
      AND conversion_group_id = OLD.id
      AND status = 'published'
  )
BEGIN
  SELECT RAISE(ABORT, 'conversion group is used by published products');
END;

CREATE TRIGGER IF NOT EXISTS trg_conversion_resources_preserve_published_cta_update
BEFORE UPDATE OF status ON conversion_resources
WHEN OLD.status = 'enabled'
  AND NEW.status = 'disabled'
  AND EXISTS (
    SELECT 1
    FROM conversion_groups conversion_group
    INNER JOIN products product
      ON product.channel_id = conversion_group.channel_id
     AND product.conversion_group_id = conversion_group.id
     AND product.status = 'published'
    WHERE conversion_group.id = OLD.group_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM conversion_resources resource
    WHERE resource.group_id = OLD.group_id
      AND resource.id <> OLD.id
      AND resource.status = 'enabled'
  )
BEGIN
  SELECT RAISE(ABORT, 'published product conversion group requires an enabled resource');
END;

CREATE TRIGGER IF NOT EXISTS trg_conversion_resources_preserve_published_cta_delete
BEFORE DELETE ON conversion_resources
WHEN OLD.status = 'enabled'
  AND EXISTS (
    SELECT 1
    FROM conversion_groups conversion_group
    INNER JOIN products product
      ON product.channel_id = conversion_group.channel_id
     AND product.conversion_group_id = conversion_group.id
     AND product.status = 'published'
    WHERE conversion_group.id = OLD.group_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM conversion_resources resource
    WHERE resource.group_id = OLD.group_id
      AND resource.id <> OLD.id
      AND resource.status = 'enabled'
  )
BEGIN
  SELECT RAISE(ABORT, 'published product conversion group requires an enabled resource');
END;

CREATE TRIGGER IF NOT EXISTS trg_channels_hero_pool_requires_available_ad
BEFORE UPDATE OF hero_ad_pool_id ON channels
WHEN NEW.hero_ad_pool_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM ad_pools pool
    INNER JOIN advertisements advertisement
      ON advertisement.pool_id = pool.id
     AND advertisement.status = 'enabled'
    WHERE pool.id = NEW.hero_ad_pool_id
      AND pool.channel_id = NEW.id
      AND pool.status = 'enabled'
  )
BEGIN
  SELECT RAISE(ABORT, 'hero ad pool must be enabled and contain an enabled ad');
END;

CREATE TRIGGER IF NOT EXISTS trg_ad_pools_preserve_bound_hero
BEFORE UPDATE OF status ON ad_pools
WHEN OLD.status = 'enabled'
  AND NEW.status = 'disabled'
  AND EXISTS (
    SELECT 1
    FROM channels
    WHERE id = OLD.channel_id
      AND hero_ad_pool_id = OLD.id
  )
BEGIN
  SELECT RAISE(ABORT, 'bound hero ad pool cannot be disabled');
END;

CREATE TRIGGER IF NOT EXISTS trg_advertisements_preserve_bound_hero_update
BEFORE UPDATE OF status ON advertisements
WHEN OLD.status = 'enabled'
  AND NEW.status = 'disabled'
  AND EXISTS (
    SELECT 1
    FROM ad_pools pool
    INNER JOIN channels channel
      ON channel.id = pool.channel_id
     AND channel.hero_ad_pool_id = pool.id
    WHERE pool.id = OLD.pool_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM advertisements advertisement
    WHERE advertisement.pool_id = OLD.pool_id
      AND advertisement.id <> OLD.id
      AND advertisement.status = 'enabled'
  )
BEGIN
  SELECT RAISE(ABORT, 'bound hero ad pool requires an enabled advertisement');
END;

CREATE TRIGGER IF NOT EXISTS trg_advertisements_preserve_bound_hero_delete
BEFORE DELETE ON advertisements
WHEN OLD.status = 'enabled'
  AND EXISTS (
    SELECT 1
    FROM ad_pools pool
    INNER JOIN channels channel
      ON channel.id = pool.channel_id
     AND channel.hero_ad_pool_id = pool.id
    WHERE pool.id = OLD.pool_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM advertisements advertisement
    WHERE advertisement.pool_id = OLD.pool_id
      AND advertisement.id <> OLD.id
      AND advertisement.status = 'enabled'
  )
BEGIN
  SELECT RAISE(ABORT, 'bound hero ad pool requires an enabled advertisement');
END;

-- The former hidden "featured" control is no longer part of product ordering.
DROP INDEX IF EXISTS idx_products_channel_listing;
DROP INDEX IF EXISTS idx_products_category_listing;
CREATE INDEX idx_products_channel_listing
ON products(channel_id, status, sort_order, created_at DESC);
CREATE INDEX idx_products_category_listing
ON products(channel_id, category_id, status, sort_order, created_at DESC);
