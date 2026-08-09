PRAGMA foreign_keys = ON;

ALTER TABLE sections ADD COLUMN description TEXT;
ALTER TABLE sections ADD COLUMN browse_background_asset_id TEXT REFERENCES media_assets(id) ON DELETE RESTRICT;

CREATE INDEX sections_browse_background_asset_idx
  ON sections(browse_background_asset_id)
  WHERE browse_background_asset_id IS NOT NULL;

CREATE TRIGGER media_assets_protect_section_browse_background
BEFORE UPDATE OF status, deleted_at ON media_assets
WHEN (
  NEW.status <> 'ready' OR NEW.deleted_at IS NOT NULL
) AND EXISTS (
  SELECT 1
  FROM sections s
  WHERE s.browse_background_asset_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'SECTION_BROWSE_BACKGROUND_IN_USE');
END;
