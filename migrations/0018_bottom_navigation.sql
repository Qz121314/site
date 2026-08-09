PRAGMA foreign_keys = ON;

CREATE TABLE site_bottom_navigation (
  item_key TEXT PRIMARY KEY
    CHECK (item_key IN ('home', 'browse', 'messages', 'faq')),
  label TEXT NOT NULL,
  icon_type TEXT NOT NULL
    CHECK (icon_type IN ('builtin', 'emoji', 'asset')),
  icon_value TEXT,
  icon_asset_id TEXT REFERENCES media_assets(id) ON DELETE RESTRICT,
  is_enabled INTEGER NOT NULL DEFAULT 1
    CHECK (is_enabled IN (0, 1)),
  sort_order INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO site_bottom_navigation (
  item_key, label, icon_type, icon_value, icon_asset_id, is_enabled, sort_order, updated_at
) VALUES
  ('home', 'Home', 'builtin', 'home', NULL, 1, 0, CURRENT_TIMESTAMP),
  ('browse', 'Browse', 'builtin', 'compass', NULL, 1, 1, CURRENT_TIMESTAMP),
  ('messages', 'Messages', 'builtin', 'messages', NULL, 1, 2, CURRENT_TIMESTAMP),
  ('faq', 'FAQ', 'builtin', 'help', NULL, 1, 3, CURRENT_TIMESTAMP);

CREATE UNIQUE INDEX idx_site_bottom_navigation_sort_order
  ON site_bottom_navigation(sort_order);

CREATE TRIGGER prevent_bottom_navigation_asset_soft_delete
BEFORE UPDATE OF status ON media_assets
WHEN NEW.status = 'deleted'
  AND EXISTS (
    SELECT 1 FROM site_bottom_navigation nav
    WHERE nav.icon_asset_id = OLD.id
  )
BEGIN
  SELECT RAISE(ABORT, 'BOTTOM_NAVIGATION_ASSET_IN_USE');
END;
