import { getDb } from '@/lib/db/client';

import type { Storyboard } from '@/types/studio';

export const CREDITS_PER_VIDEO = 1;
// PLACEHOLDER surcharge for the ElevenLabs voice, decided together with the final prices.
export const ELEVENLABS_EXTRA_CREDITS = 1;

/** What one video costs the user. The ElevenLabs voice is a paid upgrade over Gemini. */
export function creditsForVideo(storyboard: Pick<Storyboard, 'voiceProvider'>): number {
  return CREDITS_PER_VIDEO + (storyboard.voiceProvider === 'elevenlabs' ? ELEVENLABS_EXTRA_CREDITS : 0);
}

export type ChargeResult = 'charged' | 'already_charged' | 'insufficient';

/**
 * Charges one video. The ledger's UNIQUE (reason, ref) means a project pays once,
 * so retrying failed scenes stays free. The balance moves through the ledger trigger.
 */
export async function chargeForVideo(userId: string, projectId: string, credits = CREDITS_PER_VIDEO): Promise<ChargeResult> {
  const db = getDb();
  const inserted = await db.run(
    `INSERT OR IGNORE INTO credit_ledger (id, user_id, delta, reason, ref, created_at)
     SELECT ?, id, ?, 'generate', ?, ? FROM users WHERE id = ? AND credits >= ?`,
    [crypto.randomUUID(), -credits, projectId, Date.now(), userId, credits]
  );
  if (inserted > 0) return 'charged';

  const existing = await db.first<{ id: string }>(
    `SELECT id FROM credit_ledger WHERE reason = 'generate' AND ref = ?`,
    [projectId]
  );
  return existing ? 'already_charged' : 'insufficient';
}

// PLACEHOLDER price for changing the narrator voice in the studio, decided with the final prices.
export const VOICE_CHANGE_CREDITS = 1;

/** What changing the voice costs. Moving to ElevenLabs adds the same surcharge as a new video. */
export function creditsForVoiceChange(provider: Storyboard['voiceProvider']): number {
  return VOICE_CHANGE_CREDITS + (provider === 'elevenlabs' ? ELEVENLABS_EXTRA_CREDITS : 0);
}

/**
 * Charges one voice change before any TTS call. Each change has its own ref, and the conditional
 * INSERT refuses when the balance is short. Returns the ref to refund, or null when short.
 */
export async function chargeForVoiceChange(userId: string, projectId: string, credits: number): Promise<string | null> {
  const ref = `${projectId}:${crypto.randomUUID()}`;
  const inserted = await getDb().run(
    `INSERT OR IGNORE INTO credit_ledger (id, user_id, delta, reason, ref, created_at)
     SELECT ?, id, ?, 'voice', ?, ? FROM users WHERE id = ? AND credits >= ?`,
    [crypto.randomUUID(), -credits, ref, Date.now(), userId, credits]
  );
  return inserted > 0 ? ref : null;
}

/** Gives a failed voice change back. UNIQUE (reason, ref) keeps it to one refund per charge. */
export async function refundVoiceChange(userId: string, ref: string, credits: number): Promise<void> {
  await getDb().run(
    `INSERT OR IGNORE INTO credit_ledger (id, user_id, delta, reason, ref, created_at)
     VALUES (?, ?, ?, 'voice_refund', ?, ?)`,
    [crypto.randomUUID(), userId, credits, ref, Date.now()]
  );
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

// PLACEHOLDER allowance, decided together with the final prices. Counted in revised scenes.
export const REVISIONS_PER_VIDEO = 20;

export type RevisionReservation = { id: string; left: number } | { id: null; left: number };

export async function revisionsLeft(projectId: string): Promise<number> {
  const row = await getDb().first<{ used: number | null }>(
    'SELECT SUM(units) AS used FROM revision_usage WHERE project_id = ?',
    [projectId]
  );
  return Math.max(0, REVISIONS_PER_VIDEO - Number(row?.used ?? 0));
}

/**
 * Reserves `units` revised scenes before any AI call. The single conditional INSERT keeps
 * two parallel requests from both passing the check. Returns id null when the allowance is short.
 */
export async function reserveRevision(userId: string, projectId: string, units: number): Promise<RevisionReservation> {
  const id = crypto.randomUUID();
  const inserted = await getDb().run(
    `INSERT INTO revision_usage (id, user_id, project_id, units, created_at)
     SELECT ?, ?, ?, ?, ?
     WHERE COALESCE((SELECT SUM(units) FROM revision_usage WHERE project_id = ?), 0) + ? <= ?`,
    [id, userId, projectId, units, Date.now(), projectId, units, REVISIONS_PER_VIDEO]
  );
  return { id: inserted > 0 ? id : null, left: await revisionsLeft(projectId) };
}

/** Gives the allowance back when a revision failed before producing anything. */
export async function releaseRevision(id: string): Promise<void> {
  await getDb().run('DELETE FROM revision_usage WHERE id = ?', [id]);
}
