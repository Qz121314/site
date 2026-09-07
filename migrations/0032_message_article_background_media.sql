PRAGMA foreign_keys = ON;

ALTER TABLE message_article_references
  ADD COLUMN background_media_id TEXT NULL
    REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX message_article_references_background_media_idx
  ON message_article_references (background_media_id)
  WHERE background_media_id IS NOT NULL;
