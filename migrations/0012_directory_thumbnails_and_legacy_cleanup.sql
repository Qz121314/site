-- Store a lightweight derivative for product directory cards while preserving the
-- original asset for product detail pages and existing uploads.
ALTER TABLE image_assets ADD COLUMN thumbnail_object_key TEXT;
ALTER TABLE image_assets ADD COLUMN thumbnail_width INTEGER CHECK (thumbnail_width IS NULL OR thumbnail_width > 0);
ALTER TABLE image_assets ADD COLUMN thumbnail_height INTEGER CHECK (thumbnail_height IS NULL OR thumbnail_height > 0);
ALTER TABLE image_assets ADD COLUMN thumbnail_size_bytes INTEGER CHECK (thumbnail_size_bytes IS NULL OR thumbnail_size_bytes >= 0);

CREATE UNIQUE INDEX idx_image_assets_thumbnail_object_key
ON image_assets(thumbnail_object_key)
WHERE thumbnail_object_key IS NOT NULL;

-- These fields were never read by the application. Removing them reduces schema
-- ambiguity without changing any current behavior or stored business content.
ALTER TABLE site_settings DROP COLUMN noindex_enabled;
ALTER TABLE site_settings DROP COLUMN all_filter_label;
ALTER TABLE products DROP COLUMN featured;

-- Category cards are text-only. Release their obsolete image references so assets
-- are governed only by current logo, product, gallery, and advertisement usage.
-- Keep the nullable column for one compatibility release because migrations run
-- before the new Worker is deployed; the old Worker still selects this column.
DROP INDEX IF EXISTS idx_categories_image_asset;
UPDATE categories SET image_asset_id = NULL WHERE image_asset_id IS NOT NULL;
