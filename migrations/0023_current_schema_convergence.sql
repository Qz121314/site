PRAGMA foreign_keys = ON;

-- The singleton customer-service configuration was migrated into
-- customer_service_connections by 0006 and then explicitly cleared.
DROP TABLE customer_service_settings;

-- Bottom navigation, GA4-only analytics, and backend-driven Storefront content
-- are now the authoritative models. Retire columns left by superseded features.
ALTER TABLE site_settings DROP COLUMN show_messages;
ALTER TABLE site_settings DROP COLUMN facebook_pixel_id;
ALTER TABLE site_settings DROP COLUMN affiliate_detection_enabled;
ALTER TABLE site_settings DROP COLUMN affiliate_platform;
ALTER TABLE site_settings DROP COLUMN affiliate_detection_config_json;
ALTER TABLE site_settings DROP COLUMN storefront_copy_json;
