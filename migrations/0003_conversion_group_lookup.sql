CREATE INDEX IF NOT EXISTS idx_products_conversion_group
ON products(channel_id, conversion_group_id);
