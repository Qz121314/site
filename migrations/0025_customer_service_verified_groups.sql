CREATE TABLE customer_service_verified_groups (
  connection_id TEXT NOT NULL,
  remote_group_id TEXT NOT NULL,
  remote_group_name TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  verified_at TEXT NOT NULL,
  PRIMARY KEY (connection_id, remote_group_id)
);

CREATE INDEX idx_customer_service_verified_groups_connection
  ON customer_service_verified_groups(connection_id, remote_group_name);
