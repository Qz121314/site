CREATE TABLE conversion_resources_next (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES conversion_groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('link', 'sms')),
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO conversion_resources_next (
  id,
  group_id,
  type,
  value,
  sort_order,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  group_id,
  CASE WHEN type = 'phone' THEN 'sms' ELSE 'link' END,
  CASE
    WHEN type = 'url' THEN value
    WHEN type = 'phone' THEN value
    WHEN type = 'whatsapp' AND (LOWER(value) LIKE 'https://%' OR LOWER(value) LIKE 'http://%') THEN value
    WHEN type = 'whatsapp' THEN 'https://wa.me/' ||
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(value, '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '')
    WHEN type = 'telegram' AND (LOWER(value) LIKE 'https://%' OR LOWER(value) LIKE 'http://%') THEN value
    WHEN type = 'telegram' THEN 'https://t.me/' || LTRIM(value, '@')
    WHEN type = 'email' THEN 'mailto:' || value
    ELSE value
  END,
  sort_order,
  status,
  created_at,
  updated_at
FROM conversion_resources;

DROP TABLE conversion_resources;
ALTER TABLE conversion_resources_next RENAME TO conversion_resources;
CREATE INDEX idx_conversion_resources_group ON conversion_resources(group_id, status, sort_order);

INSERT OR IGNORE INTO product_images (product_id, image_asset_id, sort_order)
SELECT id, cover_asset_id, -10
FROM products
WHERE cover_asset_id IS NOT NULL;
