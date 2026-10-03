PRAGMA foreign_keys = ON;

CREATE TRIGGER reviews_section_single_active_page_insert
BEFORE INSERT ON products
WHEN NEW.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM sections
    WHERE id = NEW.section_id
      AND lower(slug) = 'reviews'
      AND deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM products
    WHERE section_id = NEW.section_id
      AND deleted_at IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'REVIEWS_PAGE_ALREADY_EXISTS');
END;

CREATE TRIGGER reviews_section_single_active_page_restore
BEFORE UPDATE OF section_id, deleted_at ON products
WHEN NEW.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM sections
    WHERE id = NEW.section_id
      AND lower(slug) = 'reviews'
      AND deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM products
    WHERE section_id = NEW.section_id
      AND id <> NEW.id
      AND deleted_at IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'REVIEWS_PAGE_ALREADY_EXISTS');
END;
