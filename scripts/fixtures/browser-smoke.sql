UPDATE site_settings
SET site_name = 'Template Smoke',
    site_description = 'Browser smoke fixture',
    r2_public_base_url = 'https://example.com'
WHERE id = 1;

INSERT INTO channels (id, name, slug, sort_order, status)
VALUES ('10000000-0000-4000-8000-000000000001', 'Demo', 'demo', 10, 'published');

UPDATE site_settings
SET default_channel_id = '10000000-0000-4000-8000-000000000001';

INSERT INTO categories (id, channel_id, name, slug, sort_order, status)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'People',
  'people',
  10,
  'published'
);

INSERT INTO conversion_groups (id, channel_id, name, status)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Primary CTA',
  'enabled'
);

INSERT INTO conversion_resources (id, group_id, type, value, sort_order, status)
VALUES (
  '31000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'link',
  'https://example.com/contact',
  10,
  'enabled'
);

INSERT INTO image_assets (
  id, object_key, original_name, mime_type, width, height, size_bytes,
  thumbnail_object_key, thumbnail_width, thumbnail_height, thumbnail_size_bytes
) VALUES
  ('40000000-0000-4000-8000-000000000001', 'smoke/product.webp', 'Product', 'image/webp', 900, 1200, 1000, 'smoke/product-thumb.webp', 360, 480, 500),
  ('40000000-0000-4000-8000-000000000002', 'smoke/hero-a.webp', 'Hero A', 'image/webp', 1200, 700, 1000, 'smoke/hero-a-responsive.webp', 960, 560, 500),
  ('40000000-0000-4000-8000-000000000003', 'smoke/hero-b.webp', 'Hero B', 'image/webp', 1200, 700, 1000, 'smoke/hero-b-responsive.webp', 960, 560, 500);

INSERT INTO products (
  id, channel_id, category_id, conversion_group_id, cover_asset_id,
  title, slug, tags, body_source, body_html, cta_label, sort_order, status
) VALUES (
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'Smoke Product',
  'smoke-product',
  '["featured"]',
  'Smoke product body',
  '<p>Smoke product body</p>',
  'Contact',
  10,
  'draft'
);

INSERT INTO product_images (product_id, image_asset_id, sort_order)
VALUES (
  '50000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  10
);

UPDATE products
SET status = 'published'
WHERE id = '50000000-0000-4000-8000-000000000001';

INSERT INTO ad_pools (id, channel_id, name, status)
VALUES (
  '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Hero',
  'enabled'
);

INSERT INTO advertisements (
  id, pool_id, image_asset_id, target_url, open_mode, sort_order, status
) VALUES
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'https://example.com/a', 'same', 10, 'enabled'),
  ('61000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'https://example.com/b', 'same', 20, 'enabled');

UPDATE channels
SET hero_ad_pool_id = '60000000-0000-4000-8000-000000000001'
WHERE id = '10000000-0000-4000-8000-000000000001';
