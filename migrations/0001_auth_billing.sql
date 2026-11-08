-- Accounts, sessions, QRIS payments, and the credit ledger.
-- Compatible with both D1 and the local SQLite driver.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_users_email ON users (email);

-- `id` is the SHA-256 of the cookie token, so a database leak exposes no live session.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('creating', 'pending', 'paid', 'expired', 'failed')),
  xendit_id TEXT UNIQUE,
  qr_string TEXT,
  expires_at INTEGER NOT NULL,
  paid_at INTEGER,
  checked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_payments_user ON payments (user_id, created_at);

-- UNIQUE (reason, ref) makes every balance change idempotent: a repeated webhook
-- or a double click inserts nothing, so the trigger below never runs twice.
CREATE TABLE credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('purchase', 'generate', 'adjustment')),
  ref TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (reason, ref)
);

CREATE INDEX idx_ledger_user ON credit_ledger (user_id, created_at);

-- One INSERT updates the ledger and the balance atomically. This keeps the
-- guarantee on D1's HTTP API, where each query is its own transaction.
CREATE TRIGGER trg_ledger_apply_balance
AFTER INSERT ON credit_ledger
BEGIN
  UPDATE users SET credits = credits + NEW.delta WHERE id = NEW.user_id;
END;
