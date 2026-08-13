ALTER TABLE customer_service_connections
ADD COLUMN verified_groups_json TEXT NOT NULL DEFAULT '[]';
