-- Cached text embeddings for asset search and request grouping. Keyed by a hash of the
-- model and text, so a changed asset description or a new model simply adds a row.
CREATE TABLE asset_embeddings (
  key TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  dims INTEGER NOT NULL,
  vector TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
