PRAGMA foreign_keys = ON;

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  content_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'failed', 'deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX media_assets_active_hash_unique
  ON media_assets(content_hash)
  WHERE content_hash IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX media_assets_status_idx
  ON media_assets(status, deleted_at, created_at);

CREATE TABLE sections (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  icon_type TEXT NOT NULL DEFAULT 'icon'
    CHECK (icon_type IN ('icon', 'asset')),
  icon_value TEXT,
  icon_asset_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (icon_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  CHECK (
    (icon_type = 'icon' AND icon_value IS NOT NULL AND icon_asset_id IS NULL)
    OR
    (icon_type = 'asset' AND icon_value IS NULL AND icon_asset_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX sections_active_slug_unique
  ON sections(lower(slug))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX sections_active_name_unique
  ON sections(lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX sections_navigation_idx
  ON sections(is_enabled, deleted_at, sort_order, name);

CREATE TABLE conversion_methods (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('url', 'phone', 'email', 'custom')),
  button_label TEXT NOT NULL,
  target_value TEXT,
  config_json TEXT CHECK (config_json IS NULL OR json_valid(config_json)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT,
  UNIQUE (section_id, id),
  CHECK (
    (type IN ('url', 'phone', 'email') AND target_value IS NOT NULL)
    OR
    (type = 'custom' AND config_json IS NOT NULL)
  )
);

CREATE UNIQUE INDEX conversion_methods_active_name_unique
  ON conversion_methods(section_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX conversion_methods_section_idx
  ON conversion_methods(section_id, is_enabled, deleted_at, sort_order);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  service_mode TEXT NOT NULL
    CHECK (service_mode IN ('online', 'offline')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  address TEXT,
  cover_asset_id TEXT,
  conversion_method_id TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  featured_order INTEGER NOT NULL DEFAULT 0 CHECK (featured_order >= 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT,
  FOREIGN KEY (cover_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  FOREIGN KEY (section_id, conversion_method_id)
    REFERENCES conversion_methods(section_id, id) ON DELETE RESTRICT,
  CHECK (service_mode = 'offline' OR address IS NULL),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE UNIQUE INDEX products_active_slug_unique
  ON products(section_id, lower(slug))
  WHERE deleted_at IS NULL;

CREATE INDEX products_section_list_idx
  ON products(section_id, status, deleted_at, created_at DESC);

CREATE INDEX products_featured_idx
  ON products(is_featured, status, deleted_at, featured_order, published_at DESC);

CREATE TABLE product_media (
  product_id TEXT NOT NULL,
  media_asset_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  alt_text TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (product_id, media_asset_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX product_media_position_unique
  ON product_media(product_id, sort_order);

CREATE TABLE faqs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX faqs_active_question_unique
  ON faqs(lower(question))
  WHERE deleted_at IS NULL;

CREATE INDEX faqs_public_idx
  ON faqs(is_enabled, deleted_at, sort_order);

CREATE TABLE site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  site_name TEXT NOT NULL,
  location_label TEXT NOT NULL,
  media_base_url TEXT,
  logo_asset_id TEXT,
  home_section_limit INTEGER NOT NULL DEFAULT 5
    CHECK (home_section_limit BETWEEN 1 AND 20),
  show_hot INTEGER NOT NULL DEFAULT 1 CHECK (show_hot IN (0, 1)),
  show_latest INTEGER NOT NULL DEFAULT 1 CHECK (show_latest IN (0, 1)),
  show_more INTEGER NOT NULL DEFAULT 1 CHECK (show_more IN (0, 1)),
  show_messages INTEGER NOT NULL DEFAULT 0 CHECK (show_messages IN (0, 1)),
  show_faq INTEGER NOT NULL DEFAULT 1 CHECK (show_faq IN (0, 1)),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (logo_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  CHECK (
    media_base_url IS NULL
    OR (
      media_base_url LIKE 'https://%'
      AND substr(media_base_url, -1) <> '/'
      AND instr(media_base_url, '?') = 0
      AND instr(media_base_url, '#') = 0
    )
  )
);

INSERT INTO site_settings (
  id,
  site_name,
  location_label,
  media_base_url,
  home_section_limit,
  show_hot,
  show_latest,
  show_more,
  show_messages,
  show_faq,
  updated_at
) VALUES (
  1,
  'Service Catalog',
  'Location / City',
  NULL,
  5,
  1,
  1,
  1,
  0,
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

CREATE TABLE publish_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL
    CHECK (status IN ('queued', 'building', 'published', 'failed', 'cancelled')),
  source_revision TEXT NOT NULL,
  content_version TEXT UNIQUE,
  previous_content_version TEXT,
  error_code TEXT,
  error_message TEXT,
  requested_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX publish_jobs_status_idx
  ON publish_jobs(status, requested_at DESC);

CREATE TABLE publish_versions (
  content_version TEXT PRIMARY KEY,
  publish_job_id TEXT NOT NULL UNIQUE,
  manifest_key TEXT NOT NULL UNIQUE,
  manifest_sha256 TEXT NOT NULL,
  object_count INTEGER NOT NULL CHECK (object_count >= 0),
  total_bytes INTEGER NOT NULL CHECK (total_bytes >= 0),
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  published_at TEXT NOT NULL,
  FOREIGN KEY (publish_job_id) REFERENCES publish_jobs(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX publish_versions_single_current
  ON publish_versions(is_current)
  WHERE is_current = 1;

CREATE TABLE conversion_events (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  conversion_method_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'click'
    CHECK (event_type IN ('click', 'open', 'submit')),
  request_id TEXT NOT NULL,
  metadata_json TEXT CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (section_id, conversion_method_id)
    REFERENCES conversion_methods(section_id, id) ON DELETE RESTRICT
);

CREATE INDEX conversion_events_reporting_idx
  ON conversion_events(section_id, product_id, conversion_method_id, created_at DESC);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL DEFAULT 'single_admin',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  request_id TEXT NOT NULL,
  before_json TEXT CHECK (before_json IS NULL OR json_valid(before_json)),
  after_json TEXT CHECK (after_json IS NULL OR json_valid(after_json)),
  metadata_json TEXT CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  created_at TEXT NOT NULL
);

CREATE INDEX audit_logs_entity_idx
  ON audit_logs(entity_type, entity_id, created_at DESC);

CREATE INDEX audit_logs_request_idx
  ON audit_logs(request_id);

CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  response_status INTEGER NOT NULL CHECK (response_status BETWEEN 100 AND 599),
  response_body TEXT NOT NULL CHECK (json_valid(response_body)),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idempotency_keys_expiry_idx
  ON idempotency_keys(expires_at);
