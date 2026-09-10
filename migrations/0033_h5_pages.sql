PRAGMA foreign_keys = ON;

CREATE TABLE h5_pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  published_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX h5_pages_status_idx
  ON h5_pages(status, deleted_at, updated_at);

CREATE TABLE h5_page_versions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES h5_pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  entry_path TEXT NOT NULL DEFAULT 'index.html',
  manifest_json TEXT NOT NULL CHECK (json_valid(manifest_json)),
  created_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE(page_id, version_number)
);

CREATE INDEX h5_page_versions_page_idx
  ON h5_page_versions(page_id, version_number DESC);

CREATE TABLE h5_page_files (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES h5_page_versions(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  UNIQUE(version_id, path)
);

CREATE INDEX h5_page_files_version_idx
  ON h5_page_files(version_id, path);

CREATE TABLE h5_page_ctas (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES h5_page_versions(id) ON DELETE CASCADE,
  cta_key TEXT NOT NULL,
  label TEXT NOT NULL,
  file_path TEXT NOT NULL,
  selector TEXT NOT NULL,
  section_id TEXT REFERENCES sections(id) ON DELETE RESTRICT,
  conversion_group_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(version_id, cta_key),
  FOREIGN KEY (section_id, conversion_group_id)
    REFERENCES conversion_groups(section_id, id) ON DELETE RESTRICT
);

CREATE INDEX h5_page_ctas_version_idx
  ON h5_page_ctas(version_id, cta_key);

CREATE INDEX h5_page_ctas_conversion_group_idx
  ON h5_page_ctas(section_id, conversion_group_id)
  WHERE conversion_group_id IS NOT NULL;
