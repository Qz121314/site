PRAGMA foreign_keys = ON;

ALTER TABLE products
  ADD COLUMN presentation_mode TEXT NOT NULL DEFAULT 'standard'
    CHECK (presentation_mode IN ('standard', 'h5'));

ALTER TABLE h5_pages
  ADD COLUMN product_id TEXT REFERENCES products(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX h5_pages_product_id_unique
  ON h5_pages(product_id)
  WHERE product_id IS NOT NULL;

CREATE INDEX products_presentation_mode_idx
  ON products(presentation_mode, status, deleted_at, updated_at DESC);
