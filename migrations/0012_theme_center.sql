PRAGMA foreign_keys = ON;

ALTER TABLE site_settings
  ADD COLUMN theme_key TEXT NOT NULL DEFAULT 'marketplace'
    CHECK (theme_key IN ('marketplace', 'noir', 'live', 'saas', 'travel', 'tech'));

ALTER TABLE site_settings
  ADD COLUMN theme_overrides_json TEXT
    CHECK (theme_overrides_json IS NULL OR json_valid(theme_overrides_json));
