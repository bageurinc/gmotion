import { getDb } from '@/lib/db/client';

export const CREDITS_PER_VIDEO = 1;

export type ChargeResult = 'charged' | 'already_charged' | 'insufficient';

/**
 * Charges one video. The ledger's UNIQUE (reason, ref) means a project pays once,
 * so retrying failed scenes stays free. The balance moves through the ledger trigger.
 */
export async function chargeForVideo(userId: string, projectId: string): Promise<ChargeResult> {
  const db = getDb();
  const inserted = await db.run(
    `INSERT OR IGNORE INTO credit_ledger (id, user_id, delta, reason, ref, created_at)
     SELECT ?, id, ?, 'generate', ?, ? FROM users WHERE id = ? AND credits >= ?`,
    [crypto.randomUUID(), -CREDITS_PER_VIDEO, projectId, Date.now(), userId, CREDITS_PER_VIDEO]
  );
  if (inserted > 0) return 'charged';

  const existing = await db.first<{ id: string }>(
    `SELECT id FROM credit_ledger WHERE reason = 'generate' AND ref = ?`,
    [projectId]
  );
  return existing ? 'already_charged' : 'insufficient';
}

/** Returns true only for the call that actually added the credits. */
export async function addPurchasedCredits(userId: string, paymentId: string, credits: number): Promise<boolean> {
  const inserted = await getDb().run(
    `INSERT OR IGNORE INTO credit_ledger (id, user_id, delta, reason, ref, created_at)
     VALUES (?, ?, ?, 'purchase', ?, ?)`,
    [crypto.randomUUID(), userId, credits, paymentId, Date.now()]
  );
  return inserted > 0;
}
