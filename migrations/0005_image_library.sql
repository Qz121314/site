ALTER TABLE image_assets ADD COLUMN original_name TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_image_assets_admin_created
ON image_assets(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_image_assets_admin_original_name
ON image_assets(original_name);
