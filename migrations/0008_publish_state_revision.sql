PRAGMA foreign_keys = ON;

ALTER TABLE publish_versions ADD COLUMN state_revision TEXT;

CREATE INDEX publish_versions_state_revision_idx
  ON publish_versions(state_revision, is_current, published_at DESC);
