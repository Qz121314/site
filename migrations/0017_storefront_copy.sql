PRAGMA foreign_keys = ON;

ALTER TABLE site_settings
  ADD COLUMN storefront_copy_json TEXT NOT NULL DEFAULT '{}';
