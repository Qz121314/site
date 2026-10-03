PRAGMA foreign_keys = ON;

DROP TRIGGER prevent_bottom_navigation_asset_soft_delete;
DROP INDEX idx_site_bottom_navigation_sort_order;

ALTER TABLE site_bottom_navigation RENAME TO site_bottom_navigation_legacy;

CREATE TABLE site_bottom_navigation (
  item_key TEXT PRIMARY KEY
    CHECK (item_key IN ('home', 'browse', 'messages', 'reviews')),
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
)
SELECT
  CASE item_key WHEN 'faq' THEN 'reviews' ELSE item_key END,
  CASE WHEN item_key = 'faq' AND label = 'FAQ' THEN 'Reviews' ELSE label END,
  icon_type,
  CASE
    WHEN item_key = 'faq' AND icon_type = 'builtin' AND icon_value = 'help' THEN 'star'
    ELSE icon_value
  END,
  icon_asset_id,
  is_enabled,
  sort_order,
  updated_at
FROM site_bottom_navigation_legacy;

DROP TABLE site_bottom_navigation_legacy;

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
