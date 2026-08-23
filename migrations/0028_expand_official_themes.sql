PRAGMA foreign_keys = ON;

ALTER TABLE site_settings RENAME COLUMN theme_key TO theme_key_legacy;

ALTER TABLE site_settings
  ADD COLUMN theme_key TEXT NOT NULL DEFAULT 'marketplace'
    CHECK (
      theme_key IN (
        'marketplace',
        'noir',
        'live',
        'velvet',
        'midnight',
        'pearl',
        'saas',
        'travel',
        'tech'
      )
    );

UPDATE site_settings SET theme_key = theme_key_legacy;

ALTER TABLE site_settings DROP COLUMN theme_key_legacy;
