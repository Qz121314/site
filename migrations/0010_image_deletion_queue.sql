CREATE TABLE IF NOT EXISTS image_deletion_queue (
  object_key TEXT PRIMARY KEY,
  image_id TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_image_deletion_queue_retry
ON image_deletion_queue(updated_at ASC, object_key ASC);
