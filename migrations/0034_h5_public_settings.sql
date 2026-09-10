CREATE TABLE h5_public_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  public_origin TEXT,
  updated_at TEXT NOT NULL
);

INSERT INTO h5_public_settings (id, public_origin, updated_at)
VALUES (1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
