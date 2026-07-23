-- Keep the affiliate schema writable by the immediately previous Hero-only Worker.
-- This is an expand/contract compatibility layer: remove it only after the rollback
-- window no longer includes a Worker that writes the legacy advertisement shape.

DROP INDEX IF EXISTS idx_advertisements_pool_status_type;
DROP INDEX IF EXISTS idx_advertisements_image_asset;

ALTER TABLE advertisements RENAME TO advertisements_affiliate;

CREATE TABLE advertisements (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES ad_pools(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Advertisement' CHECK (length(trim(name)) BETWEEN 1 AND 120),
  display_type TEXT NOT NULL DEFAULT 'banner' CHECK (display_type IN ('banner', 'vertical', 'modal')),
  creative_type TEXT NOT NULL DEFAULT 'uploaded_image' CHECK (creative_type IN ('uploaded_image', 'external_media', 'embed_code')),
  image_asset_id TEXT REFERENCES image_assets(id) ON DELETE RESTRICT,
  media_url TEXT NOT NULL DEFAULT '',
  embed_code TEXT NOT NULL DEFAULT '',
  target_url TEXT NOT NULL DEFAULT '',
  declared_width INTEGER,
  declared_height INTEGER,
  open_mode TEXT NOT NULL DEFAULT 'new' CHECK (open_mode IN ('same', 'new')),
  sort_order INTEGER NOT NULL DEFAULT 0,
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
  media_url,
  embed_code,
  target_url,
  declared_width,
  declared_height,
  open_mode,
  sort_order,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  pool_id,
  name,
  display_type,
  creative_type,
  image_asset_id,
  media_url,
  embed_code,
  target_url,
  declared_width,
  declared_height,
  open_mode,
  0,
  status,
  created_at,
  updated_at
FROM advertisements_affiliate;

DROP TABLE advertisements_affiliate;

CREATE INDEX idx_advertisements_pool_status_type
ON advertisements(pool_id, status, display_type, created_at);

CREATE INDEX idx_advertisements_image_asset
ON advertisements(image_asset_id)
WHERE image_asset_id IS NOT NULL;
