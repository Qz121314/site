PRAGMA foreign_keys = ON;

CREATE TABLE asset_cleanup_guards (
  object_key TEXT PRIMARY KEY,
  media_asset_id TEXT NOT NULL UNIQUE,
  guard_content_version TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE CASCADE
);

CREATE INDEX asset_cleanup_guards_version_idx
  ON asset_cleanup_guards(guard_content_version, first_seen_at);
