-- Changing the narrator voice in the studio costs credits, and a failed change is refunded.
-- SQLite cannot alter a CHECK constraint, so the ledger is rebuilt with the two new reasons.
-- The copy runs before the balance trigger exists on the new table, so balances do not move.
CREATE TABLE credit_ledger_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('purchase', 'generate', 'adjustment', 'voice', 'voice_refund')),
  ref TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (reason, ref)
);

INSERT INTO credit_ledger_new (id, user_id, delta, reason, ref, created_at)
SELECT id, user_id, delta, reason, ref, created_at FROM credit_ledger;

DROP TABLE credit_ledger;
ALTER TABLE credit_ledger_new RENAME TO credit_ledger;

CREATE INDEX idx_ledger_user ON credit_ledger (user_id, created_at);

CREATE TRIGGER trg_ledger_apply_balance
AFTER INSERT ON credit_ledger
BEGIN
  UPDATE users SET credits = credits + NEW.delta WHERE id = NEW.user_id;
END;
