PRAGMA foreign_keys = ON;

CREATE TABLE ai_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
  allow_guest INTEGER NOT NULL DEFAULT 0 CHECK (allow_guest IN (0, 1)),
  model TEXT NOT NULL DEFAULT '@cf/meta/llama-3.1-8b-instruct',
  system_prompt TEXT NOT NULL DEFAULT 'You are a concise assistant for this service catalog. Do not invent availability, pricing, guarantees, or business-specific facts. Ask the user to contact the listed provider when exact details are required.',
  daily_request_limit INTEGER NOT NULL DEFAULT 100 CHECK (daily_request_limit BETWEEN 1 AND 100000),
  per_visitor_daily_limit INTEGER NOT NULL DEFAULT 5 CHECK (per_visitor_daily_limit BETWEEN 1 AND 1000),
  max_input_characters INTEGER NOT NULL DEFAULT 1200 CHECK (max_input_characters BETWEEN 100 AND 12000),
  max_output_tokens INTEGER NOT NULL DEFAULT 512 CHECK (max_output_tokens BETWEEN 64 AND 4096),
  temperature REAL NOT NULL DEFAULT 0.3 CHECK (temperature BETWEEN 0 AND 2),
  updated_at TEXT NOT NULL
);

INSERT INTO ai_settings (
  id,
  is_enabled,
  allow_guest,
  model,
  system_prompt,
  daily_request_limit,
  per_visitor_daily_limit,
  max_input_characters,
  max_output_tokens,
  temperature,
  updated_at
) VALUES (
  1,
  0,
  0,
  '@cf/meta/llama-3.1-8b-instruct',
  'You are a concise assistant for this service catalog. Do not invent availability, pricing, guarantees, or business-specific facts. Ask the user to contact the listed provider when exact details are required.',
  100,
  5,
  1200,
  512,
  0.3,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

CREATE TABLE ai_request_usage (
  id TEXT PRIMARY KEY,
  usage_date TEXT NOT NULL,
  identity_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_ai_request_usage_date
  ON ai_request_usage (usage_date, created_at);

CREATE INDEX idx_ai_request_usage_identity
  ON ai_request_usage (usage_date, identity_hash, created_at);
