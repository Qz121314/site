PRAGMA foreign_keys = ON;

CREATE TABLE landing_pages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  slug TEXT NOT NULL CHECK (length(slug) BETWEEN 1 AND 120),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  template_key TEXT NOT NULL DEFAULT 'direct_response'
    CHECK (template_key IN ('direct_response', 'visual_story', 'chat_first')),
  chat_template_key TEXT NOT NULL DEFAULT 'match_landing'
    CHECK (chat_template_key IN ('match_landing')),
  headline_override TEXT,
  subheadline_override TEXT,
  hero_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  cta_label_override TEXT,
  chat_welcome_override TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX landing_pages_active_slug_unique
  ON landing_pages(slug)
  WHERE deleted_at IS NULL;

CREATE INDEX landing_pages_status_idx
  ON landing_pages(status, deleted_at, updated_at DESC);

CREATE INDEX landing_pages_product_idx
  ON landing_pages(product_id, deleted_at);
