PRAGMA foreign_keys = ON;

CREATE TABLE conversion_group_sections (
  group_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (section_id, group_id),
  FOREIGN KEY (group_id) REFERENCES conversion_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT
);

CREATE INDEX conversion_group_sections_group_idx
  ON conversion_group_sections(group_id, section_id);

INSERT INTO conversion_group_sections (group_id, section_id, created_at)
SELECT id, section_id, created_at FROM conversion_groups;

INSERT OR IGNORE INTO conversion_group_sections (group_id, section_id, created_at)
SELECT p.conversion_group_id, p.section_id, g.created_at
FROM products p
JOIN conversion_groups g ON g.id = p.conversion_group_id
WHERE p.conversion_group_id IS NOT NULL;

INSERT OR IGNORE INTO conversion_group_sections (group_id, section_id, created_at)
SELECT g.id, s.id, g.created_at
FROM sections s
JOIN conversion_groups g ON g.id = s.conversion_group_id
WHERE s.conversion_group_id IS NOT NULL;

INSERT OR IGNORE INTO conversion_group_sections (group_id, section_id, created_at)
SELECT g.id, c.section_id, g.created_at
FROM message_cta_cards c
JOIN conversion_groups g ON g.id = c.conversion_group_id
WHERE c.conversion_group_id IS NOT NULL AND c.section_id IS NOT NULL;
