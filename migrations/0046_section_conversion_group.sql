PRAGMA foreign_keys = ON;

ALTER TABLE sections
  ADD COLUMN conversion_group_id TEXT REFERENCES conversion_groups(id) ON DELETE RESTRICT;

CREATE INDEX sections_conversion_group_idx
  ON sections(conversion_group_id);
