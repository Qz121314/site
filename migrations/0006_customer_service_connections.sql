PRAGMA foreign_keys = ON;

CREATE TABLE customer_service_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'generic_v1',
  base_url TEXT NOT NULL,
  project_id TEXT,
  api_token TEXT,
  private_config_json TEXT
    CHECK (private_config_json IS NULL OR json_valid(private_config_json)),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX customer_service_connections_active_name_unique
  ON customer_service_connections(lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX customer_service_connections_list_idx
  ON customer_service_connections(is_enabled, deleted_at, name);

INSERT INTO customer_service_connections (
  id,
  name,
  provider,
  base_url,
  project_id,
  api_token,
  private_config_json,
  is_enabled,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  'legacy-default',
  COALESCE(NULLIF(trim(provider), ''), '默认客服系统'),
  'generic_v1',
  endpoint_url,
  project_id,
  NULL,
  config_json,
  is_enabled,
  updated_at,
  updated_at,
  NULL
FROM customer_service_settings
WHERE endpoint_url IS NOT NULL
  AND trim(endpoint_url) <> '';

CREATE TABLE conversion_targets_v2 (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  endpoint_url TEXT,
  customer_service_connection_id TEXT,
  remote_group_id TEXT,
  remote_group_name TEXT,
  legacy_project_id TEXT,
  legacy_config_json TEXT
    CHECK (legacy_config_json IS NULL OR json_valid(legacy_config_json)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (section_id, group_id)
    REFERENCES conversion_groups(section_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (customer_service_connection_id)
    REFERENCES customer_service_connections(id) ON DELETE RESTRICT,
  UNIQUE (group_id, id),
  CHECK (
    customer_service_connection_id IS NULL
    OR (
      endpoint_url IS NULL
      AND remote_group_id IS NOT NULL
      AND remote_group_name IS NOT NULL
    )
  )
);

INSERT INTO conversion_targets_v2 (
  id,
  section_id,
  group_id,
  name,
  endpoint_url,
  customer_service_connection_id,
  remote_group_id,
  remote_group_name,
  legacy_project_id,
  legacy_config_json,
  sort_order,
  is_enabled,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  t.id,
  t.section_id,
  t.group_id,
  t.name,
  t.endpoint_url,
  NULL,
  NULL,
  NULL,
  t.project_id,
  t.config_json,
  t.sort_order,
  CASE WHEN g.mode = 'customer_service' THEN 0 ELSE t.is_enabled END,
  t.created_at,
  t.updated_at,
  t.deleted_at
FROM conversion_targets t
JOIN conversion_groups g ON g.id = t.group_id;

DROP TABLE conversion_targets;
ALTER TABLE conversion_targets_v2 RENAME TO conversion_targets;

CREATE UNIQUE INDEX conversion_targets_active_name_unique
  ON conversion_targets(group_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX conversion_targets_group_list_idx
  ON conversion_targets(group_id, is_enabled, deleted_at, sort_order, name);

CREATE INDEX conversion_targets_customer_service_connection_idx
  ON conversion_targets(customer_service_connection_id, deleted_at, is_enabled);
