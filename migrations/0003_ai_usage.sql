-- Admin-only cost tracking. Users only ever see credits.
-- One row per AI request (chat, image, or speech), including failed ones.
CREATE TABLE ai_usage (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  user_id TEXT,
  project_id TEXT,
  preset TEXT,
  stage TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('chat', 'image', 'speech')),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  images INTEGER NOT NULL DEFAULT 0,
  characters INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL CHECK (ok IN (0, 1))
);

CREATE INDEX idx_ai_usage_created ON ai_usage (created_at);
CREATE INDEX idx_ai_usage_project ON ai_usage (project_id);

-- Rupiah rates per model. A new row with a later effective_from changes the price
-- from that moment on, so older usage keeps the rate it was charged at.
CREATE TABLE model_rates (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  idr_per_million_input REAL NOT NULL DEFAULT 0,
  idr_per_million_output REAL NOT NULL DEFAULT 0,
  idr_per_image REAL NOT NULL DEFAULT 0,
  idr_per_million_characters REAL NOT NULL DEFAULT 0,
  effective_from INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_model_rates_model ON model_rates (model, effective_from);
