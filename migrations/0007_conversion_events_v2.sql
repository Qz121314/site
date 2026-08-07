PRAGMA foreign_keys = ON;

CREATE TABLE conversion_events_v2 (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  conversion_group_id TEXT,
  conversion_target_id TEXT,
  legacy_conversion_method_id TEXT,
  mode TEXT CHECK (mode IS NULL OR mode IN ('customer_service', 'link')),
  event_type TEXT NOT NULL DEFAULT 'click'
    CHECK (event_type IN ('click', 'open', 'submit')),
  outcome TEXT NOT NULL DEFAULT 'redirected'
    CHECK (outcome IN ('redirected', 'provider_error', 'not_ready', 'legacy')),
  request_id TEXT NOT NULL,
  metadata_json TEXT CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (conversion_group_id) REFERENCES conversion_groups(id) ON DELETE RESTRICT,
  FOREIGN KEY (conversion_target_id) REFERENCES conversion_targets(id) ON DELETE RESTRICT,
  FOREIGN KEY (legacy_conversion_method_id) REFERENCES conversion_methods(id) ON DELETE RESTRICT
);

INSERT INTO conversion_events_v2 (
  id,
  section_id,
  product_id,
  conversion_group_id,
  conversion_target_id,
  legacy_conversion_method_id,
  mode,
  event_type,
  outcome,
  request_id,
  metadata_json,
  created_at
)
SELECT
  id,
  section_id,
  product_id,
  NULL,
  NULL,
  conversion_method_id,
  NULL,
  event_type,
  'legacy',
  request_id,
  metadata_json,
  created_at
FROM conversion_events;

DROP TABLE conversion_events;
ALTER TABLE conversion_events_v2 RENAME TO conversion_events;

CREATE INDEX conversion_events_reporting_idx
  ON conversion_events(section_id, product_id, conversion_group_id, created_at DESC);

CREATE INDEX conversion_events_target_idx
  ON conversion_events(conversion_target_id, created_at DESC);

CREATE INDEX conversion_events_outcome_idx
  ON conversion_events(outcome, created_at DESC);
