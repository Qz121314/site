CREATE INDEX IF NOT EXISTS idx_category_filter_relations_filter
ON category_filter_relations(filter_id, category_id);

CREATE INDEX IF NOT EXISTS idx_categories_image_asset
ON categories(image_asset_id)
WHERE image_asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_channel_name_nocase
ON categories(channel_id, name COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_products_cover_asset
ON products(cover_asset_id)
WHERE cover_asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_images_asset
ON product_images(image_asset_id, product_id);

CREATE INDEX IF NOT EXISTS idx_advertisements_image_asset
ON advertisements(image_asset_id);
