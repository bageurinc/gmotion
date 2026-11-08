import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as webhook } from '@/app/api/webhooks/xendit/route';
import { addPurchasedCredits, chargeForVideo } from '@/lib/billing/credits';
import { CREDIT_PACKAGES } from '@/lib/billing/packages';
import { findUserPayment, handleXenditWebhook, Payment, refreshPayment, startQrisPayment } from '@/lib/billing/payments';
import { isValidWebhookToken, isXenditTestMode } from '@/lib/billing/xendit';
import { getDb } from '@/lib/db/client';

const pkg = CREDIT_PACKAGES[0];
let userId: string;

const balance = async () =>
  (await getDb().first<{ credits: number }>('SELECT credits FROM users WHERE id = ?', [userId]))?.credits;

const qrisResponse = (referenceId: string, overrides: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      payment_request_id: `pr-${referenceId}`,
      reference_id: referenceId,
      request_amount: pkg.priceIdr,
      currency: 'IDR',
      status: 'REQUIRES_ACTION',
      actions: [{ type: 'PRESENT_TO_CUSTOMER', descriptor: 'QR_STRING', value: '00020101QR' }],
      ...overrides,
    }),
    { status: 201 }
  );

const startPayment = async (): Promise<Payment> => {
  vi.mocked(fetch).mockImplementationOnce(async (_url, init) =>
    qrisResponse(JSON.parse(String(init?.body)).reference_id)
  );
  return startQrisPayment(userId, pkg, 'test');
};

const capture = (payment: Payment, overrides: Record<string, unknown> = {}) => ({
  event: 'payment.capture',
  data: {
    payment_request_id: payment.xendit_id ?? undefined,
    reference_id: payment.id,
    currency: 'IDR',
    request_amount: payment.amount,
    status: 'SUCCEEDED',
    ...overrides,
  },
});

beforeEach(async () => {
  userId = crypto.randomUUID();
  await getDb().run('INSERT INTO users (id, google_sub, email, created_at) VALUES (?, ?, ?, ?)', [
    userId,
    `sub_${userId}`,
    `${userId}@example.com`,
    1,
  ]);
  process.env.XENDIT_SECRET_KEY = 'xnd_development_key';
  process.env.XENDIT_WEBHOOK_TOKEN = 'webhook-secret';
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('QRIS creation', () => {
  it('sends the documented v3 QRIS request', async () => {
    const payment = await startPayment();
    const [url, init] = vi.mocked(fetch).mock.calls[0];

    expect(url).toBe('https://api.xendit.co/v3/payment_requests');
    expect(init?.headers).toMatchObject({
      Authorization: `Basic ${btoa('xnd_development_key:')}`,
      'api-version': '2024-11-11',
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      reference_id: payment.id,
      type: 'PAY',
      country: 'ID',
      currency: 'IDR',
      request_amount: pkg.priceIdr,
      channel_code: 'QRIS',
    });
    expect(payment).toMatchObject({ status: 'pending', qr_string: '00020101QR' });
  });

  it('reuses an open QR for the same package', async () => {
    const first = await startPayment();
    const second = await startQrisPayment(userId, pkg, 'test');
    expect(second.id).toBe(first.id);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('marks the payment failed when Xendit rejects it', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error_code: 'API_ERROR' }), { status: 400 }));
    await expect(startQrisPayment(userId, pkg, 'test')).rejects.toThrow('API_ERROR');
    const rows = await getDb().all<Payment>('SELECT * FROM payments WHERE user_id = ?', [userId]);
    expect(rows.map((row) => row.status)).toEqual(['failed']);
  });
});

describe('settlement', () => {
  it('adds credits once when Xendit repeats a webhook', async () => {
    const payment = await startPayment();
    expect(await handleXenditWebhook(capture(payment))).toBe('settled');
    await handleXenditWebhook(capture(payment));
    await handleXenditWebhook(capture(payment));

    expect(await balance()).toBe(pkg.credits);
    expect((await findUserPayment(payment.id, userId))?.status).toBe('paid');
  });

  it('keeps one purchase idempotent under concurrent delivery', async () => {
    const payment = await startPayment();
    await Promise.all([1, 2, 3, 4].map(() => handleXenditWebhook(capture(payment))));
    expect(await balance()).toBe(pkg.credits);
  });

  it.each([
    ['a different amount', { request_amount: 1 }],
    ['a different currency', { currency: 'USD' }],
    ['a different Xendit id', { payment_request_id: 'pr-other' }],
    ['a non-success status', { status: 'FAILED' }],
  ])('ignores %s', async (_label, overrides) => {
    const payment = await startPayment();
    expect(await handleXenditWebhook(capture(payment, overrides))).toBe('ignored');
    expect(await balance()).toBe(0);
  });

  it('ignores other events and unknown payments', async () => {
    const payment = await startPayment();
    expect(await handleXenditWebhook({ ...capture(payment), event: 'payment.failure' })).toBe('ignored');
    expect(await handleXenditWebhook(capture({ ...payment, id: 'missing', xendit_id: null }))).toBe('ignored');
  });

  it('still credits a payment that arrives after local expiry', async () => {
    const payment = await startPayment();
    await getDb().run(`UPDATE payments SET status = 'expired' WHERE id = ?`, [payment.id]);
    await handleXenditWebhook(capture(payment));
    expect(await balance()).toBe(pkg.credits);
  });

  it('recovers a missed webhook through reconciliation, throttled', async () => {
    const payment = await startPayment();
    vi.mocked(fetch).mockResolvedValueOnce(qrisResponse(payment.id, { status: 'SUCCEEDED' }));

    const refreshed = await refreshPayment(payment);
    expect(refreshed.status).toBe('paid');
    expect(await balance()).toBe(pkg.credits);

    const pending = await startPayment();
    vi.mocked(fetch).mockResolvedValueOnce(qrisResponse(pending.id));
    const checked = await refreshPayment(pending);
    const calls = vi.mocked(fetch).mock.calls.length;
    await refreshPayment(checked);
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls);
  });

  it('rejects a reconciled status whose amount differs', async () => {
    const payment = await startPayment();
    vi.mocked(fetch).mockResolvedValueOnce(qrisResponse(payment.id, { status: 'SUCCEEDED', request_amount: 1 }));
    expect((await refreshPayment(payment)).status).toBe('pending');
    expect(await balance()).toBe(0);
  });

  it('survives a Xendit outage during reconciliation', async () => {
    const payment = await startPayment();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'));
    expect((await refreshPayment(payment)).status).toBe('pending');
  });
});

describe('video charge', () => {
  it('refuses without credit and never goes negative', async () => {
    expect(await chargeForVideo(userId, 'project-a')).toBe('insufficient');
    expect(await balance()).toBe(0);
  });

  it('charges a project once, so retries stay free', async () => {
    await addPurchasedCredits(userId, `payment-${userId}`, 2);
    const project = `project-${userId}`;
    expect(await chargeForVideo(userId, project)).toBe('charged');
    expect(await chargeForVideo(userId, project)).toBe('already_charged');
    expect(await balance()).toBe(1);
  });

  it('does not overspend under parallel charges', async () => {
    await addPurchasedCredits(userId, `payment-${userId}`, 1);
    const results = await Promise.all(['a', 'b', 'c'].map((id) => chargeForVideo(userId, `${userId}-${id}`)));
    expect(results.filter((result) => result === 'charged')).toHaveLength(1);
    expect(await balance()).toBe(0);
  });
});

describe('webhook security', () => {
  const post = (token?: string) =>
    webhook(
      new NextRequest('http://localhost/api/webhooks/xendit', {
        method: 'POST',
        headers: token ? { 'x-callback-token': token } : {},
        body: JSON.stringify({ event: 'payment.capture' }),
      })
    );

  it('rejects a missing or wrong token', async () => {
    expect((await post()).status).toBe(401);
    expect((await post('wrong')).status).toBe(401);
    expect((await post('webhook-secret')).status).toBe(200);
  });

  it('fails closed when no token is configured', async () => {
    delete process.env.XENDIT_WEBHOOK_TOKEN;
    expect(await isValidWebhookToken('anything')).toBe(false);
  });

  it('allows simulation only with a test key', () => {
    expect(isXenditTestMode()).toBe(true);
    process.env.XENDIT_SECRET_KEY = 'xnd_production_key';
    expect(isXenditTestMode()).toBe(false);
  });
});
