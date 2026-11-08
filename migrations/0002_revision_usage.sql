-- Chat revisions call the AI again, so each paid video includes a limited number.
-- One row per revision request; `units` is the number of scenes it revised.
CREATE TABLE revision_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  units INTEGER NOT NULL CHECK (units > 0),
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_revision_usage_project ON revision_usage (project_id);
