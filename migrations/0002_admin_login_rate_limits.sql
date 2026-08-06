PRAGMA foreign_keys = ON;

CREATE TABLE admin_login_rate_limits (
  key_hash TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0
    CHECK (failed_count BETWEEN 0 AND 1000),
  window_started_at TEXT NOT NULL,
  blocked_until TEXT,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX admin_login_rate_limits_expiry_idx
  ON admin_login_rate_limits(expires_at);
