PRAGMA foreign_keys = ON;

CREATE TABLE site_home_section_slots (
  placement TEXT NOT NULL
    CHECK (placement IN ('shortcut', 'recommendation')),
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (placement, section_id),
  UNIQUE (placement, sort_order),
  CHECK (
    (placement = 'shortcut' AND sort_order BETWEEN 0 AND 6)
    OR (placement = 'recommendation' AND sort_order BETWEEN 0 AND 2)
  )
);

INSERT INTO site_home_section_slots (placement, section_id, sort_order, updated_at)
SELECT 'shortcut', id, position - 1, CURRENT_TIMESTAMP
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY sort_order ASC, name COLLATE NOCASE ASC, id ASC) AS position
  FROM sections
  WHERE deleted_at IS NULL AND is_enabled = 1
)
WHERE position <= 7;

INSERT INTO site_home_section_slots (placement, section_id, sort_order, updated_at)
SELECT 'recommendation', id, position - 1, CURRENT_TIMESTAMP
FROM (
  SELECT
    s.id,
    ROW_NUMBER() OVER (ORDER BY s.sort_order ASC, s.name COLLATE NOCASE ASC, s.id ASC) AS position
  FROM sections s
  WHERE s.deleted_at IS NULL
    AND s.is_enabled = 1
    AND EXISTS (
      SELECT 1
      FROM products p
      WHERE p.section_id = s.id
        AND p.deleted_at IS NULL
        AND p.status = 'published'
        AND p.is_featured = 1
    )
)
WHERE position <= 3;
