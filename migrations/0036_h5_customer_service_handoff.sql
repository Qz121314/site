PRAGMA foreign_keys = ON;

ALTER TABLE h5_page_ctas
  ADD COLUMN product_id TEXT REFERENCES products(id) ON DELETE RESTRICT;

CREATE INDEX h5_page_ctas_product_idx
  ON h5_page_ctas(product_id)
  WHERE product_id IS NOT NULL;
