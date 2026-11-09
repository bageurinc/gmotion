-- Every save of a draft asset is a new version, so an admin can compare and restore.
-- Previews are rendered on the server when the version is saved and stored with it.
CREATE TABLE asset_draft_versions (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES asset_drafts (id),
  number INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ai', 'manual', 'restore')),
  instruction TEXT NOT NULL DEFAULT '',
  model TEXT,
  code TEXT NOT NULL,
  metadata TEXT NOT NULL,
  report TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (draft_id, number)
);

ALTER TABLE asset_drafts ADD COLUMN current_version INTEGER NOT NULL DEFAULT 0;
