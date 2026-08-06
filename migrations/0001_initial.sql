PRAGMA foreign_keys = ON;

CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations >= 100000),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  deleted_by TEXT REFERENCES admin_users(id),
  delete_reason TEXT
);

CREATE INDEX idx_admin_users_status ON admin_users(status) WHERE deleted_at IS NULL;

CREATE TABLE roles (
  role_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE permissions (
  permission_key TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE role_permissions (
  role_key TEXT NOT NULL REFERENCES roles(role_key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(permission_key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);

CREATE TABLE admin_user_roles (
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL REFERENCES roles(role_key) ON DELETE RESTRICT,
  assigned_at INTEGER NOT NULL,
  assigned_by TEXT REFERENCES admin_users(id),
  PRIMARY KEY (admin_user_id, role_key)
);

CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  user_agent_hash TEXT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX idx_admin_sessions_user ON admin_sessions(admin_user_id, expires_at DESC);
CREATE INDEX idx_admin_sessions_active ON admin_sessions(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
  updated_at INTEGER NOT NULL
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_admin_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  request_id TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_admin_user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);

CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  deleted_by TEXT REFERENCES admin_users(id),
  delete_reason TEXT
);

CREATE TABLE channel_translations (
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (channel_id, locale)
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
  parent_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  deleted_by TEXT REFERENCES admin_users(id),
  delete_reason TEXT,
  UNIQUE (channel_id, slug)
);

CREATE TABLE category_translations (
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (category_id, locale)
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  deleted_by TEXT REFERENCES admin_users(id),
  delete_reason TEXT
);

CREATE TABLE tag_translations (
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  name TEXT NOT NULL,
  PRIMARY KEY (tag_id, locale)
);

CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  country_code TEXT,
  region TEXT,
  city TEXT,
  address_line TEXT,
  latitude REAL,
  longitude REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  deleted_by TEXT REFERENCES admin_users(id),
  delete_reason TEXT
);

CREATE TABLE store_translations (
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (store_id, locale)
);

CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  store_id TEXT REFERENCES stores(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('store_service', 'online_service')),
  conversion_type TEXT NOT NULL CHECK (conversion_type IN ('support', 'tracked_link', 'direct_link')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  cover_asset_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  deleted_by TEXT REFERENCES admin_users(id),
  delete_reason TEXT
);

CREATE TABLE listing_translations (
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (listing_id, locale)
);

CREATE TABLE listing_tags (
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_id, tag_id)
);

INSERT INTO roles (role_key, name, description, is_system, created_at, updated_at)
VALUES
  ('super_admin', '超级管理员', '拥有全部后台权限。', 1, unixepoch(), unixepoch()),
  ('editor', '内容编辑', '管理内容但不能管理管理员与角色。', 1, unixepoch(), unixepoch()),
  ('auditor', '审计员', '只读查看后台与审计日志。', 1, unixepoch(), unixepoch());

INSERT INTO permissions (permission_key, description)
VALUES
  ('admin.session.read', '读取当前管理员会话'),
  ('admin.users.read', '读取管理员'),
  ('admin.users.write', '管理管理员'),
  ('admin.roles.read', '读取角色与权限'),
  ('admin.roles.write', '管理角色与权限'),
  ('audit.read', '读取审计日志'),
  ('content.read', '读取内容'),
  ('content.write', '管理内容'),
  ('content.publish', '发布内容'),
  ('media.read', '读取媒体'),
  ('media.write', '管理媒体'),
  ('settings.read', '读取系统设置'),
  ('settings.write', '管理系统设置');

INSERT INTO role_permissions (role_key, permission_key)
SELECT 'super_admin', permission_key FROM permissions;

INSERT INTO role_permissions (role_key, permission_key)
VALUES
  ('editor', 'admin.session.read'),
  ('editor', 'content.read'),
  ('editor', 'content.write'),
  ('editor', 'media.read'),
  ('editor', 'media.write'),
  ('auditor', 'admin.session.read'),
  ('auditor', 'admin.users.read'),
  ('auditor', 'admin.roles.read'),
  ('auditor', 'audit.read'),
  ('auditor', 'content.read'),
  ('auditor', 'media.read'),
  ('auditor', 'settings.read');
