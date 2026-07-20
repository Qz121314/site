PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  site_name TEXT NOT NULL DEFAULT 'Site',
  site_description TEXT NOT NULL DEFAULT 'Visual recommendations, updated in real time.',
  logo_asset_id TEXT,
  favicon_asset_id TEXT,
  default_channel_id TEXT,
  r2_public_base_url TEXT NOT NULL DEFAULT '',
  ga4_id TEXT NOT NULL DEFAULT '',
  meta_pixel_id TEXT NOT NULL DEFAULT '',
  adult_gate_enabled INTEGER NOT NULL DEFAULT 0 CHECK (adult_gate_enabled IN (0, 1)),
  noindex_enabled INTEGER NOT NULL DEFAULT 0 CHECK (noindex_enabled IN (0, 1)),
  all_filter_label TEXT NOT NULL DEFAULT 'All',
  privacy_content TEXT NOT NULL DEFAULT '',
  disclaimer_content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS image_assets (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_pools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT '',
  hero_ad_pool_id TEXT REFERENCES ad_pools(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS category_filters (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel_id, slug)
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  image_asset_id TEXT REFERENCES image_assets(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel_id, slug)
);

CREATE TABLE IF NOT EXISTS category_filter_relations (
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  filter_id TEXT NOT NULL REFERENCES category_filters(id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, filter_id)
);

CREATE TABLE IF NOT EXISTS conversion_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversion_resources (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES conversion_groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('url', 'phone', 'whatsapp', 'telegram', 'email')),
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
  category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  conversion_group_id TEXT REFERENCES conversion_groups(id) ON DELETE RESTRICT,
  cover_asset_id TEXT REFERENCES image_assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  body_html TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT 'View Details',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel_id, slug)
);

CREATE TABLE IF NOT EXISTS product_images (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_asset_id TEXT NOT NULL REFERENCES image_assets(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, image_asset_id)
);

CREATE TABLE IF NOT EXISTS advertisements (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES ad_pools(id) ON DELETE CASCADE,
  image_asset_id TEXT NOT NULL REFERENCES image_assets(id) ON DELETE RESTRICT,
  target_url TEXT NOT NULL,
  open_mode TEXT NOT NULL DEFAULT 'same' CHECK (open_mode IN ('same', 'new')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_channels_public ON channels(status, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_category_filters_public ON category_filters(channel_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_public ON categories(channel_id, status, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_products_channel_listing ON products(channel_id, status, featured DESC, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category_listing ON products(channel_id, category_id, status, featured DESC, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_images_order ON product_images(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_advertisements_pool ON advertisements(pool_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_conversion_resources_group ON conversion_resources(group_id, status, sort_order);

INSERT OR IGNORE INTO site_settings (id) VALUES (1);
