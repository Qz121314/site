PRAGMA foreign_keys = ON;

-- Product detail pages may intentionally contain only a title and Markdown body.
-- Keep the image-type guards, but remove the legacy published-cover requirement.
DROP TRIGGER IF EXISTS products_published_cover_required_insert;
DROP TRIGGER IF EXISTS products_published_cover_required_update;
