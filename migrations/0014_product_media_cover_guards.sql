PRAGMA foreign_keys = ON;

CREATE TRIGGER products_cover_media_guard_insert
BEFORE INSERT ON products
WHEN NEW.cover_asset_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM media_assets ma
    WHERE ma.id = NEW.cover_asset_id
      AND ma.status = 'ready'
      AND ma.deleted_at IS NULL
      AND ma.mime_type LIKE 'image/%'
  )
BEGIN
  SELECT RAISE(ABORT, 'PRODUCT_COVER_MUST_BE_IMAGE');
END;

CREATE TRIGGER products_cover_media_guard_update
BEFORE UPDATE OF cover_asset_id ON products
WHEN NEW.cover_asset_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM media_assets ma
    WHERE ma.id = NEW.cover_asset_id
      AND ma.status = 'ready'
      AND ma.deleted_at IS NULL
      AND ma.mime_type LIKE 'image/%'
  )
BEGIN
  SELECT RAISE(ABORT, 'PRODUCT_COVER_MUST_BE_IMAGE');
END;

CREATE TRIGGER products_published_cover_required_insert
BEFORE INSERT ON products
WHEN NEW.status = 'published' AND NEW.cover_asset_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'PUBLISHED_PRODUCT_COVER_REQUIRED');
END;

CREATE TRIGGER products_published_cover_required_update
BEFORE UPDATE OF status, cover_asset_id ON products
WHEN NEW.status = 'published' AND NEW.cover_asset_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'PUBLISHED_PRODUCT_COVER_REQUIRED');
END;
