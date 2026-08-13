ALTER TABLE customer_service_connections
  ADD COLUMN client_api_url TEXT;

ALTER TABLE customer_service_connections
  ADD COLUMN realtime_url TEXT;

ALTER TABLE customer_service_connections
  ADD COLUMN verified_at TEXT;

ALTER TABLE conversion_groups
  ADD COLUMN customer_service_connection_id TEXT
  REFERENCES customer_service_connections(id) ON DELETE RESTRICT;

ALTER TABLE conversion_groups
  ADD COLUMN remote_group_id TEXT;

ALTER TABLE conversion_groups
  ADD COLUMN remote_group_name TEXT;

-- Migrate the first currently active customer-service target into the group
-- itself. Online support no longer uses a separate target/entry layer.
UPDATE conversion_groups
SET customer_service_connection_id = (
      SELECT t.customer_service_connection_id
      FROM conversion_targets t
      WHERE t.group_id = conversion_groups.id
        AND t.deleted_at IS NULL
        AND t.customer_service_connection_id IS NOT NULL
        AND t.remote_group_id IS NOT NULL
      ORDER BY t.sort_order ASC, t.id ASC
      LIMIT 1
    ),
    remote_group_id = (
      SELECT t.remote_group_id
      FROM conversion_targets t
      WHERE t.group_id = conversion_groups.id
        AND t.deleted_at IS NULL
        AND t.customer_service_connection_id IS NOT NULL
        AND t.remote_group_id IS NOT NULL
      ORDER BY t.sort_order ASC, t.id ASC
      LIMIT 1
    ),
    remote_group_name = (
      SELECT t.remote_group_name
      FROM conversion_targets t
      WHERE t.group_id = conversion_groups.id
        AND t.deleted_at IS NULL
        AND t.customer_service_connection_id IS NOT NULL
        AND t.remote_group_id IS NOT NULL
      ORDER BY t.sort_order ASC, t.id ASC
      LIMIT 1
    )
WHERE mode = 'customer_service';

UPDATE conversion_targets
SET is_enabled = 0,
    deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
WHERE group_id IN (
  SELECT id FROM conversion_groups WHERE mode = 'customer_service'
)
  AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversion_groups_customer_service
  ON conversion_groups(customer_service_connection_id, remote_group_id)
  WHERE mode = 'customer_service' AND deleted_at IS NULL;
