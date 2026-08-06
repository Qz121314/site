PRAGMA foreign_keys = ON;

ALTER TABLE products
  ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0
    CHECK (sort_order >= 0);

CREATE INDEX products_admin_list_idx
  ON products(section_id, deleted_at, status, sort_order, updated_at DESC);
