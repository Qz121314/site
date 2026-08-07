PRAGMA foreign_keys = ON;

CREATE TABLE publish_module_jobs (
  id TEXT PRIMARY KEY,
  module_key TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('building', 'published', 'failed', 'cancelled')),
  source_revision TEXT NOT NULL,
  content_version TEXT UNIQUE,
  previous_content_version TEXT,
  error_code TEXT,
  error_message TEXT,
  requested_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX publish_module_jobs_scope_status_idx
  ON publish_module_jobs(module_key, status, requested_at DESC);

CREATE TABLE publish_module_versions (
  content_version TEXT PRIMARY KEY,
  module_key TEXT NOT NULL,
  publish_job_id TEXT NOT NULL UNIQUE,
  manifest_key TEXT NOT NULL UNIQUE,
  manifest_sha256 TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  state_revision TEXT NOT NULL,
  media_keys_json TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(media_keys_json)),
  object_count INTEGER NOT NULL CHECK (object_count >= 0),
  total_bytes INTEGER NOT NULL CHECK (total_bytes >= 0),
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  published_at TEXT NOT NULL,
  FOREIGN KEY (publish_job_id) REFERENCES publish_module_jobs(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX publish_module_versions_single_current
  ON publish_module_versions(module_key)
  WHERE is_current = 1;

CREATE INDEX publish_module_versions_history_idx
  ON publish_module_versions(module_key, is_current DESC, published_at DESC, content_version DESC);

CREATE INDEX publish_module_versions_state_idx
  ON publish_module_versions(module_key, state_revision, is_current, published_at DESC);
