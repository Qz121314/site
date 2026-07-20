ALTER TABLE products ADD COLUMN body_source TEXT NOT NULL DEFAULT '';

UPDATE products
SET body_source = body_html
WHERE body_source = '' AND body_html <> '';

CREATE INDEX IF NOT EXISTS idx_products_admin_list
ON products(channel_id, status, category_id, sort_order, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_products_category_same_channel_insert
BEFORE INSERT ON products
WHEN NEW.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM categories
    WHERE id = NEW.category_id AND channel_id = NEW.channel_id
  )
BEGIN
  SELECT RAISE(ABORT, 'category must belong to the same channel');
END;

CREATE TRIGGER IF NOT EXISTS trg_products_category_same_channel_update
BEFORE UPDATE OF category_id, channel_id ON products
WHEN NEW.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM categories
    WHERE id = NEW.category_id AND channel_id = NEW.channel_id
  )
BEGIN
  SELECT RAISE(ABORT, 'category must belong to the same channel');
END;
