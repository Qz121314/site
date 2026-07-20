ALTER TABLE ad_pools ADD COLUMN channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE;
ALTER TABLE conversion_groups ADD COLUMN channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ad_pools_channel ON ad_pools(channel_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_conversion_groups_channel ON conversion_groups(channel_id, status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_pools_channel_name ON ad_pools(channel_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversion_groups_channel_name ON conversion_groups(channel_id, name);

CREATE TRIGGER IF NOT EXISTS trg_ad_pools_require_channel_insert
BEFORE INSERT ON ad_pools
WHEN NEW.channel_id IS NULL OR trim(NEW.channel_id) = ''
BEGIN
  SELECT RAISE(ABORT, 'ad_pools.channel_id is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_ad_pools_require_channel_update
BEFORE UPDATE OF channel_id ON ad_pools
WHEN NEW.channel_id IS NULL OR trim(NEW.channel_id) = ''
BEGIN
  SELECT RAISE(ABORT, 'ad_pools.channel_id is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_conversion_groups_require_channel_insert
BEFORE INSERT ON conversion_groups
WHEN NEW.channel_id IS NULL OR trim(NEW.channel_id) = ''
BEGIN
  SELECT RAISE(ABORT, 'conversion_groups.channel_id is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_conversion_groups_require_channel_update
BEFORE UPDATE OF channel_id ON conversion_groups
WHEN NEW.channel_id IS NULL OR trim(NEW.channel_id) = ''
BEGIN
  SELECT RAISE(ABORT, 'conversion_groups.channel_id is required');
END;

CREATE TRIGGER IF NOT EXISTS trg_channels_hero_pool_same_channel_insert
BEFORE INSERT ON channels
WHEN NEW.hero_ad_pool_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ad_pools
    WHERE id = NEW.hero_ad_pool_id AND channel_id = NEW.id
  )
BEGIN
  SELECT RAISE(ABORT, 'hero ad pool must belong to the same channel');
END;

CREATE TRIGGER IF NOT EXISTS trg_channels_hero_pool_same_channel_update
BEFORE UPDATE OF hero_ad_pool_id, id ON channels
WHEN NEW.hero_ad_pool_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ad_pools
    WHERE id = NEW.hero_ad_pool_id AND channel_id = NEW.id
  )
BEGIN
  SELECT RAISE(ABORT, 'hero ad pool must belong to the same channel');
END;

CREATE TRIGGER IF NOT EXISTS trg_products_conversion_same_channel_insert
BEFORE INSERT ON products
WHEN NEW.conversion_group_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM conversion_groups
    WHERE id = NEW.conversion_group_id AND channel_id = NEW.channel_id
  )
BEGIN
  SELECT RAISE(ABORT, 'conversion group must belong to the same channel');
END;

CREATE TRIGGER IF NOT EXISTS trg_products_conversion_same_channel_update
BEFORE UPDATE OF conversion_group_id, channel_id ON products
WHEN NEW.conversion_group_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM conversion_groups
    WHERE id = NEW.conversion_group_id AND channel_id = NEW.channel_id
  )
BEGIN
  SELECT RAISE(ABORT, 'conversion group must belong to the same channel');
END;
