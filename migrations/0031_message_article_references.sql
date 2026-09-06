PRAGMA foreign_keys = ON;

CREATE TABLE message_article_references (
  article_id TEXT PRIMARY KEY REFERENCES faqs(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0 AND sort_order <= 1000000),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX message_article_references_public_idx
  ON message_article_references (is_enabled, sort_order, article_id);

CREATE TRIGGER message_article_references_prune_on_article_soft_delete
AFTER UPDATE OF deleted_at ON faqs
WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
BEGIN
  DELETE FROM message_article_references WHERE article_id = NEW.id;
END;
