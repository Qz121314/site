PRAGMA foreign_keys = OFF;

DELETE FROM message_cta_cards WHERE target_kind = 'page';

CREATE TABLE message_cta_cards_clean (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  background_media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('article', 'link')),
  target_ref TEXT NOT NULL CHECK (length(target_ref) BETWEEN 1 AND 1000),
  section_id TEXT,
  conversion_group_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0 AND sort_order <= 1000000),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (section_id, conversion_group_id)
    REFERENCES conversion_groups(section_id, id) ON DELETE RESTRICT
);

INSERT INTO message_cta_cards_clean (
  id, title, background_media_id, target_kind, target_ref,
  section_id, conversion_group_id, sort_order, is_enabled, created_at, updated_at
)
SELECT
  id, title, background_media_id, target_kind, target_ref,
  section_id, conversion_group_id, sort_order, is_enabled, created_at, updated_at
FROM message_cta_cards;

DROP TABLE message_cta_cards;
ALTER TABLE message_cta_cards_clean RENAME TO message_cta_cards;

CREATE INDEX message_cta_cards_order_idx
  ON message_cta_cards (is_enabled, sort_order, id);

DROP INDEX IF EXISTS products_presentation_mode_idx;
ALTER TABLE products DROP COLUMN presentation_mode;

DROP TABLE IF EXISTS h5_page_ctas;
DROP TABLE IF EXISTS h5_page_files;
DROP TABLE IF EXISTS h5_page_versions;
DROP TABLE IF EXISTS h5_pages;
DROP TABLE IF EXISTS h5_public_settings;

PRAGMA foreign_keys = ON;
