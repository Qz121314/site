PRAGMA foreign_keys = ON;

CREATE TABLE product_tags_catalog (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT,
  UNIQUE (section_id, id)
);

CREATE UNIQUE INDEX product_tags_catalog_active_name_unique
  ON product_tags_catalog(section_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX product_tags_catalog_section_list_idx
  ON product_tags_catalog(section_id, is_enabled, deleted_at, sort_order, name);

CREATE TABLE product_tag_bindings (
  product_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (product_id, tag_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES product_tags_catalog(id) ON DELETE RESTRICT
);

CREATE INDEX product_tag_bindings_tag_idx
  ON product_tag_bindings(tag_id, product_id);
