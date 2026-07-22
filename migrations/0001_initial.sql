PRAGMA foreign_keys = ON;

-- Clean template schema. This project intentionally starts from an empty D1 database.

CREATE TABLE image_assets (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  thumbnail_object_key TEXT UNIQUE,
  thumbnail_width INTEGER,
  thumbnail_height INTEGER,
  thumbnail_size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (
      thumbnail_object_key IS NULL
      AND thumbnail_width IS NULL
      AND thumbnail_height IS NULL
      AND thumbnail_size_bytes IS NULL
    )
    OR
    (
      thumbnail_object_key IS NOT NULL
      AND thumbnail_width > 0
      AND thumbnail_height > 0
      AND thumbnail_size_bytes > 0
    )
  )
);

CREATE TABLE site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  site_name TEXT NOT NULL DEFAULT 'Site' CHECK (length(trim(site_name)) BETWEEN 1 AND 120),
  site_description TEXT NOT NULL DEFAULT 'Visual recommendations, updated in real time.' CHECK (length(site_description) <= 300),
  logo_asset_id TEXT REFERENCES image_assets(id) ON DELETE SET NULL,
  favicon_asset_id TEXT REFERENCES image_assets(id) ON DELETE SET NULL,
  default_channel_id TEXT REFERENCES channels(id) ON DELETE SET NULL,
  r2_public_base_url TEXT NOT NULL DEFAULT '',
  ga4_id TEXT NOT NULL DEFAULT '',
  meta_pixel_id TEXT NOT NULL DEFAULT '',
  adult_gate_enabled INTEGER NOT NULL DEFAULT 0 CHECK (adult_gate_enabled IN (0, 1)),
  privacy_content TEXT NOT NULL DEFAULT '',
  disclaimer_content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  slug TEXT NOT NULL UNIQUE CHECK (length(trim(slug)) BETWEEN 1 AND 80),
  icon TEXT NOT NULL DEFAULT '',
  hero_ad_pool_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hero_ad_pool_id, id) REFERENCES ad_pools(id, channel_id) ON DELETE RESTRICT
);

CREATE TABLE category_filters (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  slug TEXT NOT NULL CHECK (length(trim(slug)) BETWEEN 1 AND 80),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel_id, slug),
  UNIQUE (id, channel_id)
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  slug TEXT NOT NULL CHECK (length(trim(slug)) BETWEEN 1 AND 96),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel_id, slug),
  UNIQUE (id, channel_id)
);

CREATE TABLE category_filter_relations (
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  filter_id TEXT NOT NULL REFERENCES category_filters(id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, filter_id)
);

CREATE TABLE ad_pools (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel_id, name),
  UNIQUE (id, channel_id)
);

CREATE TABLE advertisements (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES ad_pools(id) ON DELETE CASCADE,
  image_asset_id TEXT NOT NULL REFERENCES image_assets(id) ON DELETE RESTRICT,
  target_url TEXT NOT NULL CHECK (length(trim(target_url)) > 0),
  open_mode TEXT NOT NULL DEFAULT 'same' CHECK (open_mode IN ('same', 'new')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversion_groups (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel_id, name),
  UNIQUE (id, channel_id)
);

CREATE TABLE conversion_resources (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES conversion_groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('link', 'sms')),
  value TEXT NOT NULL CHECK (length(trim(value)) > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
  category_id TEXT,
  conversion_group_id TEXT,
  cover_asset_id TEXT REFERENCES image_assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  slug TEXT NOT NULL CHECK (length(trim(slug)) BETWEEN 1 AND 96),
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags) AND json_type(tags) = 'array'),
  body_source TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT 'View Details' CHECK (length(trim(cta_label)) BETWEEN 1 AND 80),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel_id, slug),
  FOREIGN KEY (category_id, channel_id) REFERENCES categories(id, channel_id) ON DELETE RESTRICT,
  FOREIGN KEY (conversion_group_id, channel_id) REFERENCES conversion_groups(id, channel_id) ON DELETE RESTRICT
);

CREATE TABLE product_images (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_asset_id TEXT NOT NULL REFERENCES image_assets(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, image_asset_id)
);

CREATE TABLE image_deletion_queue (
  object_key TEXT PRIMARY KEY,
  image_id TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_channels_public
ON channels(status, sort_order, created_at);

CREATE INDEX idx_category_filters_public
ON category_filters(channel_id, status, sort_order, created_at);

CREATE INDEX idx_categories_public
ON categories(channel_id, status, sort_order, created_at);

CREATE INDEX idx_categories_channel_name_nocase
ON categories(channel_id, name COLLATE NOCASE);

CREATE INDEX idx_category_filter_relations_filter
ON category_filter_relations(filter_id, category_id);

CREATE INDEX idx_ad_pools_channel
ON ad_pools(channel_id, status, created_at);

CREATE INDEX idx_advertisements_pool
ON advertisements(pool_id, status, sort_order, created_at);

CREATE INDEX idx_advertisements_image_asset
ON advertisements(image_asset_id);

CREATE INDEX idx_conversion_groups_channel
ON conversion_groups(channel_id, status, created_at);

CREATE INDEX idx_conversion_resources_group
ON conversion_resources(group_id, status, sort_order, created_at);

CREATE INDEX idx_products_channel_listing
ON products(channel_id, status, sort_order, created_at DESC);

CREATE INDEX idx_products_category_listing
ON products(channel_id, category_id, status, sort_order, created_at DESC);

CREATE INDEX idx_products_admin_list
ON products(channel_id, status, category_id, sort_order, created_at DESC);

CREATE INDEX idx_products_conversion_group
ON products(channel_id, conversion_group_id);

CREATE INDEX idx_products_cover_asset
ON products(cover_asset_id) WHERE cover_asset_id IS NOT NULL;

CREATE INDEX idx_product_images_order
ON product_images(product_id, sort_order);

CREATE INDEX idx_product_images_asset
ON product_images(image_asset_id, product_id);

CREATE INDEX idx_image_assets_admin_created
ON image_assets(created_at DESC, id DESC);

CREATE INDEX idx_image_assets_admin_original_name
ON image_assets(original_name);

CREATE INDEX idx_image_deletion_queue_retry
ON image_deletion_queue(updated_at ASC, object_key ASC);

CREATE TRIGGER trg_category_filter_same_channel_insert
BEFORE INSERT ON category_filter_relations
WHEN NOT EXISTS (
  SELECT 1
  FROM categories category
  INNER JOIN category_filters filter ON filter.channel_id = category.channel_id
  WHERE category.id = NEW.category_id AND filter.id = NEW.filter_id
)
BEGIN
  SELECT RAISE(ABORT, 'category filter must belong to the same channel');
END;

CREATE TRIGGER trg_product_cover_requires_thumbnail_insert
BEFORE INSERT ON products
WHEN NEW.cover_asset_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM image_assets image
    WHERE image.id = NEW.cover_asset_id AND image.thumbnail_object_key IS NOT NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'product cover requires a directory thumbnail');
END;

CREATE TRIGGER trg_product_cover_requires_thumbnail_update
BEFORE UPDATE OF cover_asset_id ON products
WHEN NEW.cover_asset_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM image_assets image
    WHERE image.id = NEW.cover_asset_id AND image.thumbnail_object_key IS NOT NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'product cover requires a directory thumbnail');
END;

CREATE TRIGGER trg_product_image_requires_thumbnail_insert
BEFORE INSERT ON product_images
WHEN NOT EXISTS (
  SELECT 1 FROM image_assets image
  WHERE image.id = NEW.image_asset_id AND image.thumbnail_object_key IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'product image requires a directory thumbnail');
END;

CREATE TRIGGER trg_product_image_requires_thumbnail_update
BEFORE UPDATE OF image_asset_id ON product_images
WHEN NOT EXISTS (
  SELECT 1 FROM image_assets image
  WHERE image.id = NEW.image_asset_id AND image.thumbnail_object_key IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'product image requires a directory thumbnail');
END;

CREATE TRIGGER trg_product_images_preserve_published_gallery
BEFORE DELETE ON product_images
WHEN EXISTS (
  SELECT 1 FROM products product
  WHERE product.id = OLD.product_id AND product.status = 'published'
)
  AND NOT EXISTS (
    SELECT 1 FROM product_images image
    WHERE image.product_id = OLD.product_id AND image.image_asset_id <> OLD.image_asset_id
  )
BEGIN
  SELECT RAISE(ABORT, 'published product requires a gallery image');
END;

CREATE TRIGGER trg_products_require_published_media_insert
BEFORE INSERT ON products
WHEN NEW.status = 'published'
  AND (
    NEW.cover_asset_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM product_images image WHERE image.product_id = NEW.id)
  )
BEGIN
  SELECT RAISE(ABORT, 'published product requires a gallery image');
END;

CREATE TRIGGER trg_products_require_published_media_update
BEFORE UPDATE OF status, cover_asset_id ON products
WHEN NEW.status = 'published'
  AND (
    NEW.cover_asset_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM product_images image WHERE image.product_id = NEW.id)
  )
BEGIN
  SELECT RAISE(ABORT, 'published product requires a gallery image');
END;

CREATE TRIGGER trg_products_require_published_category_insert
BEFORE INSERT ON products
WHEN NEW.status = 'published'
  AND NEW.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM categories category
    WHERE category.id = NEW.category_id
      AND category.channel_id = NEW.channel_id
      AND category.status = 'published'
  )
BEGIN
  SELECT RAISE(ABORT, 'published product requires a published category');
END;

CREATE TRIGGER trg_products_require_published_category_update
BEFORE UPDATE OF status, category_id, channel_id ON products
WHEN NEW.status = 'published'
  AND NEW.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM categories category
    WHERE category.id = NEW.category_id
      AND category.channel_id = NEW.channel_id
      AND category.status = 'published'
  )
BEGIN
  SELECT RAISE(ABORT, 'published product requires a published category');
END;

CREATE TRIGGER trg_products_require_available_conversion_insert
BEFORE INSERT ON products
WHEN NEW.status = 'published'
  AND (
    NEW.conversion_group_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM conversion_groups conversion_group
      INNER JOIN conversion_resources resource
        ON resource.group_id = conversion_group.id AND resource.status = 'enabled'
      WHERE conversion_group.id = NEW.conversion_group_id
        AND conversion_group.channel_id = NEW.channel_id
        AND conversion_group.status = 'enabled'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'published product requires an available conversion group');
END;

CREATE TRIGGER trg_products_require_available_conversion_update
BEFORE UPDATE OF status, conversion_group_id, channel_id ON products
WHEN NEW.status = 'published'
  AND (
    NEW.conversion_group_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM conversion_groups conversion_group
      INNER JOIN conversion_resources resource
        ON resource.group_id = conversion_group.id AND resource.status = 'enabled'
      WHERE conversion_group.id = NEW.conversion_group_id
        AND conversion_group.channel_id = NEW.channel_id
        AND conversion_group.status = 'enabled'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'published product requires an available conversion group');
END;

CREATE TRIGGER trg_categories_preserve_published_products
BEFORE UPDATE OF status ON categories
WHEN OLD.status = 'published'
  AND NEW.status <> 'published'
  AND EXISTS (
    SELECT 1 FROM products product
    WHERE product.category_id = OLD.id AND product.status = 'published'
  )
BEGIN
  SELECT RAISE(ABORT, 'category is used by published products');
END;

CREATE TRIGGER trg_conversion_groups_preserve_published_cta
BEFORE UPDATE OF status ON conversion_groups
WHEN OLD.status = 'enabled'
  AND NEW.status = 'disabled'
  AND EXISTS (
    SELECT 1 FROM products product
    WHERE product.channel_id = OLD.channel_id
      AND product.conversion_group_id = OLD.id
      AND product.status = 'published'
  )
BEGIN
  SELECT RAISE(ABORT, 'conversion group is used by published products');
END;

CREATE TRIGGER trg_conversion_resources_preserve_published_cta_update
BEFORE UPDATE OF status ON conversion_resources
WHEN OLD.status = 'enabled'
  AND NEW.status = 'disabled'
  AND EXISTS (
    SELECT 1
    FROM conversion_groups conversion_group
    INNER JOIN products product
      ON product.channel_id = conversion_group.channel_id
     AND product.conversion_group_id = conversion_group.id
     AND product.status = 'published'
    WHERE conversion_group.id = OLD.group_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM conversion_resources resource
    WHERE resource.group_id = OLD.group_id
      AND resource.id <> OLD.id
      AND resource.status = 'enabled'
  )
BEGIN
  SELECT RAISE(ABORT, 'published product conversion group requires an enabled resource');
END;

CREATE TRIGGER trg_conversion_resources_preserve_published_cta_delete
BEFORE DELETE ON conversion_resources
WHEN OLD.status = 'enabled'
  AND EXISTS (
    SELECT 1
    FROM conversion_groups conversion_group
    INNER JOIN products product
      ON product.channel_id = conversion_group.channel_id
     AND product.conversion_group_id = conversion_group.id
     AND product.status = 'published'
    WHERE conversion_group.id = OLD.group_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM conversion_resources resource
    WHERE resource.group_id = OLD.group_id
      AND resource.id <> OLD.id
      AND resource.status = 'enabled'
  )
BEGIN
  SELECT RAISE(ABORT, 'published product conversion group requires an enabled resource');
END;

CREATE TRIGGER trg_channels_hero_pool_requires_available_ad
BEFORE UPDATE OF hero_ad_pool_id ON channels
WHEN NEW.hero_ad_pool_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM ad_pools pool
    INNER JOIN advertisements advertisement
      ON advertisement.pool_id = pool.id
     AND advertisement.status = 'enabled'
    WHERE pool.id = NEW.hero_ad_pool_id
      AND pool.channel_id = NEW.id
      AND pool.status = 'enabled'
  )
BEGIN
  SELECT RAISE(ABORT, 'hero ad pool must be enabled and contain an enabled ad');
END;

CREATE TRIGGER trg_ad_pools_preserve_bound_hero
BEFORE UPDATE OF status ON ad_pools
WHEN OLD.status = 'enabled'
  AND NEW.status = 'disabled'
  AND EXISTS (
    SELECT 1 FROM channels channel
    WHERE channel.id = OLD.channel_id AND channel.hero_ad_pool_id = OLD.id
  )
BEGIN
  SELECT RAISE(ABORT, 'bound hero ad pool cannot be disabled');
END;

CREATE TRIGGER trg_advertisements_preserve_bound_hero_update
BEFORE UPDATE OF status ON advertisements
WHEN OLD.status = 'enabled'
  AND NEW.status = 'disabled'
  AND EXISTS (
    SELECT 1
    FROM ad_pools pool
    INNER JOIN channels channel
      ON channel.id = pool.channel_id AND channel.hero_ad_pool_id = pool.id
    WHERE pool.id = OLD.pool_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM advertisements advertisement
    WHERE advertisement.pool_id = OLD.pool_id
      AND advertisement.id <> OLD.id
      AND advertisement.status = 'enabled'
  )
BEGIN
  SELECT RAISE(ABORT, 'bound hero ad pool requires an enabled advertisement');
END;

CREATE TRIGGER trg_advertisements_preserve_bound_hero_delete
BEFORE DELETE ON advertisements
WHEN OLD.status = 'enabled'
  AND EXISTS (
    SELECT 1
    FROM ad_pools pool
    INNER JOIN channels channel
      ON channel.id = pool.channel_id AND channel.hero_ad_pool_id = pool.id
    WHERE pool.id = OLD.pool_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM advertisements advertisement
    WHERE advertisement.pool_id = OLD.pool_id
      AND advertisement.id <> OLD.id
      AND advertisement.status = 'enabled'
  )
BEGIN
  SELECT RAISE(ABORT, 'bound hero ad pool requires an enabled advertisement');
END;

INSERT INTO site_settings (id) VALUES (1);
