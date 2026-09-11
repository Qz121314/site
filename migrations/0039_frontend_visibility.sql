PRAGMA foreign_keys = ON;

ALTER TABLE sections
  ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1
    CHECK (is_visible IN (0, 1));

ALTER TABLE products
  ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1
    CHECK (is_visible IN (0, 1));

CREATE INDEX sections_visibility_idx
  ON sections(is_visible, is_enabled, deleted_at, sort_order);

CREATE INDEX products_visibility_idx
  ON products(is_visible, status, deleted_at, updated_at DESC);
