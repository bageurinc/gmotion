import { getDb } from '@/lib/db/client';
import { addPurchasedCredits } from './credits';
import { CreditPackage } from './packages';
import { createQrisRequest, extractQrString, getPaymentRequest, XenditPaymentRequest } from './xendit';

// Used when Xendit returns no expiry. Xendit lists 48 hours for QRIS, so a QR can
// outlive this window. Such late payments still settle, see settlePayment.
const DEFAULT_QR_WINDOW_MS = 30 * 60 * 1000;
// Fallback for missed webhooks, and the only path on a machine Xendit cannot reach.
const RECONCILE_INTERVAL_MS = 10 * 1000;

export type PaymentStatus = 'creating' | 'pending' | 'paid' | 'expired' | 'failed';

export interface Payment {
  id: string;
  user_id: string;
  package_id: string;
  credits: number;
  amount: number;
  status: PaymentStatus;
  xendit_id: string | null;
  qr_string: string | null;
  expires_at: number;
  paid_at: number | null;
  checked_at: number | null;
  created_at: number;
  updated_at: number;
}

export function toPublicPayment(payment: Payment) {
  return {
    id: payment.id,
    packageId: payment.package_id,
    credits: payment.credits,
    amount: payment.amount,
    status: payment.status,
    qrString: payment.status === 'pending' ? payment.qr_string : null,
    expiresAt: payment.expires_at,
    paidAt: payment.paid_at,
  };
}

const findPayment = (id: string) => getDb().first<Payment>('SELECT * FROM payments WHERE id = ?', [id]);

export async function findUserPayment(id: string, userId: string): Promise<Payment | null> {
  return getDb().first<Payment>('SELECT * FROM payments WHERE id = ? AND user_id = ?', [id, userId]);
}

async function setStatus(id: string, status: PaymentStatus, from: PaymentStatus): Promise<void> {
  await getDb().run('UPDATE payments SET status = ?, updated_at = ? WHERE id = ? AND status = ?', [
    status,
    Date.now(),
    id,
    from,
  ]);
}

export async function startQrisPayment(userId: string, pkg: CreditPackage, description: string): Promise<Payment> {
  const db = getDb();
  const now = Date.now();

  // Clicking the same package again reuses the open QR instead of minting another.
  const open = await db.first<Payment>(
    `SELECT * FROM payments
     WHERE user_id = ? AND package_id = ? AND status = 'pending' AND expires_at > ?
     ORDER BY created_at DESC LIMIT 1`,
    [userId, pkg.id, now]
  );
  if (open) return open;

  const id = crypto.randomUUID();
  await db.run(
    `INSERT INTO payments (id, user_id, package_id, credits, amount, status, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'creating', ?, ?, ?)`,
    [id, userId, pkg.id, pkg.credits, pkg.priceIdr, now + DEFAULT_QR_WINDOW_MS, now, now]
  );

  try {
    const request = await createQrisRequest({ referenceId: id, amount: pkg.priceIdr, description });
    const qrString = extractQrString(request);
    if (!qrString) throw new Error('Xendit response has no QR string');

    const expiresAt = Date.parse(request.channel_properties?.expires_at ?? '');
    await db.run(
      `UPDATE payments SET status = 'pending', xendit_id = ?, qr_string = ?, expires_at = ?, updated_at = ? WHERE id = ?`,
      [request.payment_request_id, qrString, Number.isNaN(expiresAt) ? now + DEFAULT_QR_WINDOW_MS : expiresAt, Date.now(), id]
    );
  } catch (err) {
    await setStatus(id, 'failed', 'creating');
    throw err;
  }

  const payment = await findPayment(id);
  if (!payment) throw new Error('Payment disappeared after creation');
  return payment;
}

/**
 * Safe to call repeatedly: the ledger adds credits once per payment. It also runs
 * for expired payments, because money that reached us must not be lost.
 */
async function settlePayment(payment: Payment): Promise<void> {
  await addPurchasedCredits(payment.user_id, payment.id, payment.credits);
  const now = Date.now();
  await getDb().run(`UPDATE payments SET status = 'paid', paid_at = COALESCE(paid_at, ?), updated_at = ? WHERE id = ?`, [
    now,
    now,
    payment.id,
  ]);
}

function matchesPayment(payment: Payment, currency: unknown, amount: unknown): boolean {
  return currency === 'IDR' && amount === payment.amount;
}

interface CaptureWebhook {
  event?: string;
  data?: {
    payment_request_id?: string;
    reference_id?: string;
    currency?: string;
    request_amount?: number;
    status?: string;
  };
}

export type WebhookOutcome = 'settled' | 'ignored';

export async function handleXenditWebhook(body: CaptureWebhook): Promise<WebhookOutcome> {
  const data = body.data;
  if (body.event !== 'payment.capture' || data?.status !== 'SUCCEEDED' || !data.reference_id) return 'ignored';

  const payment = await findPayment(data.reference_id);
  if (!payment) {
    console.warn('[Billing] Webhook for unknown payment:', data.reference_id);
    return 'ignored';
  }
  if (
    (payment.xendit_id && payment.xendit_id !== data.payment_request_id) ||
    !matchesPayment(payment, data.currency, data.request_amount)
  ) {
    console.error('[Billing] Webhook does not match payment:', payment.id);
    return 'ignored';
  }

  await settlePayment(payment);
  return 'settled';
}

function applyRemoteStatus(payment: Payment, remote: XenditPaymentRequest): Promise<void> | undefined {
  if (remote.status === 'SUCCEEDED' && matchesPayment(payment, remote.currency, remote.request_amount)) {
    return settlePayment(payment);
  }
  if (remote.status === 'EXPIRED') return setStatus(payment.id, 'expired', 'pending');
  if (remote.status === 'FAILED' || remote.status === 'CANCELED') return setStatus(payment.id, 'failed', 'pending');
  return undefined;
}

/** Called while the QR screen polls. Throttled so polling stays inside Xendit's limits. */
export async function refreshPayment(payment: Payment): Promise<Payment> {
  const now = Date.now();
  const stale = !payment.checked_at || now - payment.checked_at >= RECONCILE_INTERVAL_MS;
  if (payment.status !== 'pending' || !payment.xendit_id || !stale) return payment;

  await getDb().run('UPDATE payments SET checked_at = ? WHERE id = ?', [now, payment.id]);
  try {
    await applyRemoteStatus(payment, await getPaymentRequest(payment.xendit_id));
  } catch (err) {
    // A Xendit outage must not break the screen. The next poll or the webhook recovers.
    console.error('[Billing] Reconcile failed:', err);
  }

  const latest = (await findPayment(payment.id)) ?? payment;
  if (latest.status === 'pending' && now > latest.expires_at) {
    await setStatus(latest.id, 'expired', 'pending');
    return { ...latest, status: 'expired' };
  }
  return latest;
}
