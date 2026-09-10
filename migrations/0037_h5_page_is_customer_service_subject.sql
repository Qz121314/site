PRAGMA foreign_keys = ON;

DROP INDEX h5_page_ctas_product_idx;

ALTER TABLE h5_page_ctas DROP COLUMN product_id;
