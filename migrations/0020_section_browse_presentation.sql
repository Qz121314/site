PRAGMA foreign_keys = ON;

ALTER TABLE sections ADD COLUMN description TEXT;
ALTER TABLE sections ADD COLUMN browse_background_asset_id TEXT REFERENCES media_assets(id) ON DELETE RESTRICT;

CREATE INDEX sections_browse_background_asset_idx
  ON sections(browse_background_asset_id)
  WHERE browse_background_asset_id IS NOT NULL;
