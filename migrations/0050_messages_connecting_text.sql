PRAGMA foreign_keys = ON;

ALTER TABLE site_settings
  ADD COLUMN messages_connecting_text TEXT NOT NULL
    DEFAULT 'Connecting you with a real customer service agent…'
    CHECK (length(messages_connecting_text) BETWEEN 1 AND 200);
