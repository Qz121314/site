ALTER TABLE customer_service_connections
  ADD COLUMN client_api_url TEXT;

ALTER TABLE customer_service_connections
  ADD COLUMN realtime_url TEXT;

ALTER TABLE customer_service_connections
  ADD COLUMN verified_at TEXT;
