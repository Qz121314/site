PRAGMA foreign_keys = ON;

CREATE TABLE media_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX media_folders_name_unique
  ON media_folders(lower(trim(name)));

CREATE INDEX media_folders_sort_idx
  ON media_folders(sort_order, name);

ALTER TABLE media_assets
  ADD COLUMN folder_id TEXT
    REFERENCES media_folders(id) ON DELETE SET NULL;

CREATE INDEX media_assets_folder_idx
  ON media_assets(folder_id, deleted_at, created_at DESC);
