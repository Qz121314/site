CREATE TABLE reviews_page (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  updated_at TEXT NOT NULL
);

INSERT INTO reviews_page (id, title, body, is_published, updated_at)
SELECT 1, p.title, p.body, CASE WHEN p.status = 'published' THEN 1 ELSE 0 END, p.updated_at
FROM products p
JOIN sections s ON s.id = p.section_id
WHERE lower(s.slug) = 'reviews'
  AND p.deleted_at IS NULL
ORDER BY p.updated_at DESC
LIMIT 1;

UPDATE products
SET status = 'archived',
    deleted_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND section_id IN (
    SELECT s.id FROM sections s WHERE lower(s.slug) = 'reviews'
  )
  AND EXISTS (SELECT 1 FROM reviews_page WHERE id = 1);

DROP TRIGGER IF EXISTS reviews_section_single_active_page_insert;
DROP TRIGGER IF EXISTS reviews_section_single_active_page_restore;
