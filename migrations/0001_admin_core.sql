PRAGMA foreign_keys = ON;

CREATE TABLE merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'locked')),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE RESTRICT,
  UNIQUE (merchant_id, email)
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  UNIQUE (merchant_id, name)
);

CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE admin_user_roles (
  admin_user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_user_id, role_id),
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  UNIQUE (merchant_id, slug)
);

CREATE TABLE channel_translations (
  channel_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  name TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY (channel_id, locale),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  parent_id TEXT,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE RESTRICT,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE RESTRICT,
  UNIQUE (merchant_id, channel_id, slug)
);

CREATE TABLE category_translations (
  category_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  name TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY (category_id, locale),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  UNIQUE (merchant_id, slug)
);

CREATE TABLE tag_translations (
  tag_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  name TEXT NOT NULL,
  PRIMARY KEY (tag_id, locale),
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  country_code TEXT,
  latitude REAL,
  longitude REAL,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  UNIQUE (merchant_id, slug)
);

CREATE TABLE store_translations (
  store_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  name TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  PRIMARY KEY (store_id, locale),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('store_service', 'online_service')),
  conversion_type TEXT NOT NULL DEFAULT 'support' CHECK (conversion_type IN ('support', 'tracked_link', 'direct_link')),
  content_status TEXT NOT NULL DEFAULT 'draft' CHECK (content_status IN ('draft', 'review', 'approved', 'published', 'archived')),
  publish_status TEXT NOT NULL DEFAULT 'not_published' CHECK (publish_status IN ('not_published', 'queued', 'building', 'published', 'failed')),
  cover_asset_id TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  UNIQUE (merchant_id, slug)
);

CREATE TABLE listing_translations (
  listing_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  title TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  PRIMARY KEY (listing_id, locale),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE TABLE listing_tags (
  listing_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (listing_id, tag_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT
);

CREATE TABLE store_listings (
  store_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (store_id, listing_id),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE TABLE support_connections (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  system_instance_id TEXT NOT NULL,
  remote_tenant_id TEXT NOT NULL,
  api_base_url TEXT NOT NULL,
  realtime_base_url TEXT,
  api_version TEXT NOT NULL DEFAULT 'v1',
  client_id TEXT NOT NULL,
  credential_ciphertext TEXT NOT NULL,
  credential_key_version INTEGER NOT NULL DEFAULT 1,
  webhook_secret_ciphertext TEXT,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'disabled')),
  last_health_check_at TEXT,
  last_sync_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  UNIQUE (merchant_id, system_instance_id, remote_tenant_id)
);

CREATE TABLE external_support_groups (
  connection_id TEXT NOT NULL,
  external_group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  member_count INTEGER NOT NULL DEFAULT 0,
  online_count INTEGER NOT NULL DEFAULT 0,
  source_version TEXT,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (connection_id, external_group_id),
  FOREIGN KEY (connection_id) REFERENCES support_connections(id) ON DELETE CASCADE
);

CREATE TABLE listing_support_routes (
  listing_id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  external_group_id TEXT NOT NULL,
  fallback_group_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (connection_id, external_group_id)
    REFERENCES external_support_groups(connection_id, external_group_id) ON DELETE RESTRICT
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'system', 'integration')),
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  request_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE TABLE idempotency_keys (
  merchant_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (merchant_id, scope, idempotency_key),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE INDEX idx_admin_users_merchant_status ON admin_users(merchant_id, status);
CREATE INDEX idx_admin_sessions_user_expiry ON admin_sessions(admin_user_id, expires_at);
CREATE INDEX idx_channels_merchant_status ON channels(merchant_id, status, sort_order);
CREATE INDEX idx_categories_merchant_channel ON categories(merchant_id, channel_id, status, sort_order);
CREATE INDEX idx_tags_merchant_status ON tags(merchant_id, status);
CREATE INDEX idx_stores_merchant_status ON stores(merchant_id, status);
CREATE INDEX idx_listings_merchant_status ON listings(merchant_id, content_status, publish_status);
CREATE INDEX idx_listings_channel_category ON listings(merchant_id, channel_id, category_id);
CREATE INDEX idx_support_connections_merchant_status ON support_connections(merchant_id, status);
CREATE INDEX idx_external_support_groups_connection_status ON external_support_groups(connection_id, status);
CREATE INDEX idx_audit_logs_merchant_created ON audit_logs(merchant_id, created_at DESC);
CREATE INDEX idx_idempotency_expiry ON idempotency_keys(expires_at);
