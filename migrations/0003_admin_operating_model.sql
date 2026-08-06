PRAGMA foreign_keys = ON;

CREATE TABLE categories (
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

CREATE UNIQUE INDEX categories_active_name_unique
  ON categories(section_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX categories_section_list_idx
  ON categories(section_id, is_enabled, deleted_at, sort_order, name);

ALTER TABLE products
  ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT;

CREATE INDEX products_category_idx
  ON products(section_id, category_id, status, deleted_at);

CREATE TRIGGER products_category_section_insert
BEFORE INSERT ON products
WHEN NEW.category_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM categories
      WHERE id = NEW.category_id
        AND section_id = NEW.section_id
        AND deleted_at IS NULL
    )
    THEN RAISE(ABORT, 'PRODUCT_CATEGORY_SECTION_MISMATCH')
  END;
END;

CREATE TRIGGER products_category_section_update
BEFORE UPDATE OF section_id, category_id ON products
WHEN NEW.category_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM categories
      WHERE id = NEW.category_id
        AND section_id = NEW.section_id
        AND deleted_at IS NULL
    )
    THEN RAISE(ABORT, 'PRODUCT_CATEGORY_SECTION_MISMATCH')
  END;
END;

ALTER TABLE site_settings
  ADD COLUMN ga4_measurement_id TEXT;

ALTER TABLE site_settings
  ADD COLUMN facebook_pixel_id TEXT;

ALTER TABLE site_settings
  ADD COLUMN affiliate_detection_enabled INTEGER NOT NULL DEFAULT 0
    CHECK (affiliate_detection_enabled IN (0, 1));

ALTER TABLE site_settings
  ADD COLUMN affiliate_platform TEXT;

ALTER TABLE site_settings
  ADD COLUMN affiliate_detection_config_json TEXT
    CHECK (
      affiliate_detection_config_json IS NULL
      OR json_valid(affiliate_detection_config_json)
    );

CREATE TABLE customer_service_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
  provider TEXT,
  endpoint_url TEXT,
  project_id TEXT,
  config_json TEXT CHECK (config_json IS NULL OR json_valid(config_json)),
  updated_at TEXT NOT NULL
);

INSERT INTO customer_service_settings (
  id,
  is_enabled,
  provider,
  endpoint_url,
  project_id,
  config_json,
  updated_at
) VALUES (
  1,
  0,
  NULL,
  NULL,
  NULL,
  NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
