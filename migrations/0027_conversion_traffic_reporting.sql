PRAGMA foreign_keys = ON;

ALTER TABLE conversion_events
  ADD COLUMN business_date TEXT;

UPDATE conversion_events
SET business_date = substr(created_at, 1, 10)
WHERE business_date IS NULL;

-- A request id represents one pass through the authoritative /go route. Historical
-- duplicate ids were never used for billing, so normalize them before enforcing the
-- invariant for new traffic.
UPDATE conversion_events
SET request_id = id
WHERE request_id IN (
  SELECT request_id
  FROM conversion_events
  GROUP BY request_id
  HAVING COUNT(*) > 1
);

CREATE UNIQUE INDEX conversion_events_request_id_unique
  ON conversion_events(request_id);

CREATE INDEX conversion_events_business_date_outcome_idx
  ON conversion_events(business_date, outcome, mode);

CREATE INDEX conversion_events_business_date_recipient_idx
  ON conversion_events(
    business_date,
    conversion_group_id,
    conversion_target_id,
    product_id
  );
