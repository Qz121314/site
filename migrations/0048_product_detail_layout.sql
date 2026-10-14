ALTER TABLE products
  ADD COLUMN detail_layout TEXT NOT NULL DEFAULT 'current'
    CHECK (detail_layout IN ('current', 'template-a'));
