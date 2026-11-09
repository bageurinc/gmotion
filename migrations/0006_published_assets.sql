-- Assets an admin published from a reviewed draft. Rows are immutable: a fix is a new
-- version, so projects that pinned an older version keep rendering the same picture.
CREATE TABLE published_assets (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  version TEXT NOT NULL,
  draft_id TEXT NOT NULL REFERENCES asset_drafts (id),
  draft_version INTEGER NOT NULL,
  preset TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'deprecated')),
  code TEXT NOT NULL,
  metadata TEXT NOT NULL,
  previews TEXT NOT NULL,
  published_by TEXT,
  published_at INTEGER NOT NULL,
  UNIQUE (asset_id, version)
);

CREATE INDEX idx_published_assets_status ON published_assets (status, asset_id);
