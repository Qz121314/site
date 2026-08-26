PRAGMA foreign_keys = ON;

CREATE TABLE site_home_section_slots_v2 (
  placement TEXT NOT NULL
    CHECK (placement IN ('shortcut', 'recommendation')),
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (placement, section_id),
  UNIQUE (placement, sort_order),
  CHECK (
    (placement = 'shortcut' AND sort_order BETWEEN 0 AND 6)
    OR (placement = 'recommendation' AND sort_order >= 0)
  )
);

INSERT INTO site_home_section_slots_v2 (placement, section_id, sort_order, updated_at)
SELECT placement, section_id, sort_order, updated_at
FROM site_home_section_slots;

DROP TABLE site_home_section_slots;

ALTER TABLE site_home_section_slots_v2 RENAME TO site_home_section_slots;
