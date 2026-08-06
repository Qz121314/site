PRAGMA foreign_keys = ON;

CREATE TABLE conversion_groups (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL
    CHECK (mode IN ('customer_service', 'link')),
  button_label TEXT NOT NULL,
  rotation_strategy TEXT NOT NULL DEFAULT 'round_robin'
    CHECK (rotation_strategy = 'round_robin'),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT,
  UNIQUE (section_id, id)
);

CREATE UNIQUE INDEX conversion_groups_active_name_unique
  ON conversion_groups(section_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX conversion_groups_section_list_idx
  ON conversion_groups(section_id, is_enabled, deleted_at, sort_order, name);

CREATE TABLE conversion_targets (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  project_id TEXT,
  config_json TEXT CHECK (config_json IS NULL OR json_valid(config_json)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (section_id, group_id)
    REFERENCES conversion_groups(section_id, id) ON DELETE RESTRICT,
  UNIQUE (group_id, id)
);

CREATE UNIQUE INDEX conversion_targets_active_name_unique
  ON conversion_targets(group_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX conversion_targets_group_list_idx
  ON conversion_targets(group_id, is_enabled, deleted_at, sort_order, name);

CREATE TABLE conversion_group_rotation (
  group_id TEXT PRIMARY KEY,
  next_index INTEGER NOT NULL DEFAULT 0 CHECK (next_index >= 0),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES conversion_groups(id) ON DELETE CASCADE
);

ALTER TABLE products
  ADD COLUMN conversion_group_id TEXT REFERENCES conversion_groups(id) ON DELETE RESTRICT;

CREATE INDEX products_conversion_group_idx
  ON products(section_id, conversion_group_id, status, deleted_at);
