PRAGMA foreign_keys = ON;

CREATE TABLE message_cta_cards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  background_media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('article', 'page', 'link')),
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

CREATE INDEX message_cta_cards_order_idx
  ON message_cta_cards (is_enabled, sort_order, id);

INSERT INTO message_cta_cards (
  id, title, background_media_id, target_kind, target_ref,
  sort_order, is_enabled, created_at, updated_at
)
SELECT
  'legacy-' || article_id,
  f.question,
  background_media_id,
  'article',
  article_id,
  mar.sort_order,
  mar.is_enabled,
  mar.created_at,
  mar.updated_at
FROM message_article_references mar
JOIN faqs f ON f.id = mar.article_id;
