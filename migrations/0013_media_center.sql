PRAGMA foreign_keys = ON;

ALTER TABLE media_assets
  ADD COLUMN media_kind TEXT NOT NULL DEFAULT 'image'
    CHECK (media_kind IN ('image', 'animated_image', 'video'));

ALTER TABLE media_assets
  ADD COLUMN duration_ms INTEGER
    CHECK (duration_ms IS NULL OR duration_ms >= 0);

UPDATE media_assets
SET media_kind = 'animated_image'
WHERE lower(mime_type) = 'image/gif';

CREATE TABLE media_asset_roles (
  media_asset_id TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('general', 'product', 'logo', 'icon', 'favicon', 'hero', 'background', 'content')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (media_asset_id, role),
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE CASCADE
);

CREATE INDEX media_asset_roles_role_idx
  ON media_asset_roles(role, media_asset_id);

INSERT OR IGNORE INTO media_asset_roles (media_asset_id, role, created_at)
SELECT logo_asset_id, 'logo', updated_at
FROM site_settings
WHERE logo_asset_id IS NOT NULL;

INSERT OR IGNORE INTO media_asset_roles (media_asset_id, role, created_at)
SELECT icon_asset_id, 'icon', updated_at
FROM sections
WHERE icon_asset_id IS NOT NULL;

INSERT OR IGNORE INTO media_asset_roles (media_asset_id, role, created_at)
SELECT cover_asset_id, 'product', updated_at
FROM products
WHERE cover_asset_id IS NOT NULL;

INSERT OR IGNORE INTO media_asset_roles (media_asset_id, role, created_at)
SELECT pm.media_asset_id, 'product', pm.created_at
FROM product_media pm;

INSERT OR IGNORE INTO media_asset_roles (media_asset_id, role, created_at)
SELECT ma.id, 'general', ma.created_at
FROM media_assets ma
WHERE ma.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM media_asset_roles mar WHERE mar.media_asset_id = ma.id
  );
