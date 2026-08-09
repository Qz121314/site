PRAGMA foreign_keys = ON;

CREATE TABLE site_hero_slides (
  id TEXT PRIMARY KEY,
  media_asset_id TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  cta_label TEXT,
  cta_href TEXT,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0 AND sort_order <= 10000),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  CHECK (title IS NULL OR length(title) <= 120),
  CHECK (description IS NULL OR length(description) <= 500),
  CHECK (cta_label IS NULL OR length(cta_label) <= 80),
  CHECK (cta_href IS NULL OR length(cta_href) <= 500),
  CHECK (
    (cta_label IS NULL AND cta_href IS NULL)
    OR
    (cta_label IS NOT NULL AND length(trim(cta_label)) > 0
      AND cta_href IS NOT NULL AND length(trim(cta_href)) > 0)
  )
);

CREATE UNIQUE INDEX site_hero_slides_sort_unique
  ON site_hero_slides(sort_order);
