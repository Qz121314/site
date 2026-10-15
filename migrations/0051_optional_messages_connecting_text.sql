PRAGMA foreign_keys = ON;

ALTER TABLE site_settings
  ADD COLUMN messages_connecting_text_updated TEXT NOT NULL DEFAULT ''
    CHECK (length(messages_connecting_text_updated) BETWEEN 0 AND 200);

UPDATE site_settings
SET messages_connecting_text_updated = CASE
  WHEN messages_connecting_text = 'Connecting you with a real customer service agent…'
    THEN ''
  ELSE messages_connecting_text
END;

ALTER TABLE site_settings DROP COLUMN messages_connecting_text;
ALTER TABLE site_settings
  RENAME COLUMN messages_connecting_text_updated TO messages_connecting_text;
