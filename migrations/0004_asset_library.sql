-- Asset library curation, admin only.

-- Demand log: an object, action, or environment a prompt asked for that the asset
-- library could not show. Aggregated on /admin/assets to decide what to build next.
CREATE TABLE asset_requests (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  user_id TEXT,
  project_id TEXT,
  preset TEXT NOT NULL,
  subject TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('object', 'action', 'environment')),
  topic TEXT
);

CREATE INDEX idx_asset_requests_subject ON asset_requests (preset, subject);
CREATE INDEX idx_asset_requests_created ON asset_requests (created_at);

-- Draft assets waiting for admin review. Nothing here is used by videos until an
-- admin publishes it. Published code assets live in src/lib/assets/registry.ts.
CREATE TABLE asset_drafts (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  version TEXT NOT NULL,
  label TEXT NOT NULL,
  preset TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'published', 'rejected')),
  source TEXT NOT NULL CHECK (source IN ('request', 'manual')),
  subject TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (asset_id, version)
);

CREATE INDEX idx_asset_drafts_status ON asset_drafts (status, updated_at);
