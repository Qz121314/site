PRAGMA foreign_keys = ON;

ALTER TABLE site_settings
  ADD COLUMN storefront_layout_json TEXT NOT NULL
    DEFAULT '{"home":"current","browse":"current","section":"current","product":"current","article":"current","messages":"current"}'
    CHECK (json_valid(storefront_layout_json));
