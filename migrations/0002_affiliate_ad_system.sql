-- Existing Hero pools are retained as mobile ad groups; their image ads become banner creatives.
DROP TRIGGER IF EXISTS trg_channels_hero_pool_requires_available_ad;
DROP TRIGGER IF EXISTS trg_ad_pools_preserve_bound_hero;
DROP TRIGGER IF EXISTS trg_advertisements_preserve_bound_hero_update;
DROP TRIGGER IF EXISTS trg_advertisements_preserve_bound_hero_delete;

UPDATE channels SET hero_ad_pool_id = NULL WHERE hero_ad_pool_id IS NOT NULL;

DROP INDEX IF EXISTS idx_ad_pools_channel;
ALTER TABLE ad_pools
ADD COLUMN device_type TEXT NOT NULL DEFAULT 'mobile'
CHECK (device_type IN ('mobile', 'desktop'));

CREATE INDEX idx_ad_pools_channel_device_status
ON ad_pools(channel_id, device_type, status);

DROP INDEX IF EXISTS idx_advertisements_pool;
DROP INDEX IF EXISTS idx_advertisements_image_asset;

ALTER TABLE advertisements RENAME TO advertisements_legacy;

CREATE TABLE advertisements (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES ad_pools(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  display_type TEXT NOT NULL CHECK (display_type IN ('banner', 'vertical', 'modal')),
  creative_type TEXT NOT NULL CHECK (creative_type IN ('uploaded_image', 'external_media', 'embed_code')),
  image_asset_id TEXT REFERENCES image_assets(id) ON DELETE RESTRICT,
  media_url TEXT NOT NULL DEFAULT '',
  embed_code TEXT NOT NULL DEFAULT '',
  target_url TEXT NOT NULL DEFAULT '',
  declared_width INTEGER,
  declared_height INTEGER,
  open_mode TEXT NOT NULL DEFAULT 'new' CHECK (open_mode IN ('same', 'new')),
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (
      creative_type = 'uploaded_image'
      AND image_asset_id IS NOT NULL
      AND media_url = ''
      AND embed_code = ''
      AND length(trim(target_url)) > 0
      AND declared_width IS NULL
      AND declared_height IS NULL
    )
    OR
    (
      creative_type = 'external_media'
      AND image_asset_id IS NULL
      AND length(trim(media_url)) > 0
      AND embed_code = ''
      AND length(trim(target_url)) > 0
      AND declared_width BETWEEN 1 AND 4096
      AND declared_height BETWEEN 1 AND 4096
    )
    OR
    (
      creative_type = 'embed_code'
      AND image_asset_id IS NULL
      AND media_url = ''
      AND length(trim(embed_code)) > 0
      AND declared_width BETWEEN 1 AND 4096
      AND declared_height BETWEEN 1 AND 4096
    )
  )
);

INSERT INTO advertisements (
  id,
  pool_id,
  name,
  display_type,
  creative_type,
  image_asset_id,
  target_url,
  open_mode,
  status,
  created_at,
  updated_at
)
SELECT
  advertisement.id,
  advertisement.pool_id,
  COALESCE(NULLIF(trim(image.original_name), ''), 'Advertisement'),
  'banner',
  'uploaded_image',
  advertisement.image_asset_id,
  advertisement.target_url,
  advertisement.open_mode,
  advertisement.status,
  advertisement.created_at,
  advertisement.updated_at
FROM advertisements_legacy advertisement
INNER JOIN image_assets image ON image.id = advertisement.image_asset_id;

DROP TABLE advertisements_legacy;

CREATE INDEX idx_advertisements_pool_status_type
ON advertisements(pool_id, status, display_type, created_at);

CREATE INDEX idx_advertisements_image_asset
ON advertisements(image_asset_id)
WHERE image_asset_id IS NOT NULL;
