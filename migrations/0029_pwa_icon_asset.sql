ALTER TABLE site_settings ADD COLUMN pwa_icon_asset_id TEXT REFERENCES media_assets(id) ON DELETE RESTRICT;
