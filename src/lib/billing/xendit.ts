const API_BASE = 'https://api.xendit.co/v3/payment_requests';
const API_VERSION = '2024-11-11';

export interface XenditPaymentRequest {
  payment_request_id: string;
  reference_id: string;
  request_amount: number;
  currency: string;
  status: string;
  channel_properties?: { expires_at?: string };
  actions?: Array<{ descriptor?: string; value?: string }>;
}

function secretKey(): string {
  const key = process.env.XENDIT_SECRET_KEY;
  if (!key) throw new Error('XENDIT_SECRET_KEY is not configured.');
  return key;
}

/** Simulation exists only for test keys, so production keys can never reach it. */
export const isXenditTestMode = () => process.env.XENDIT_SECRET_KEY?.startsWith('xnd_development_') === true;

async function xenditRequest<T>(url: string, init: RequestInit, fetcher: typeof fetch): Promise<T> {
  const res = await fetcher(url, {
    ...init,
    headers: {
      Authorization: `Basic ${btoa(`${secretKey()}:`)}`,
      'api-version': API_VERSION,
      'Content-Type': 'application/json',
    },
  });
  const body = (await res.json().catch(() => null)) as (T & { error_code?: string; message?: string }) | null;
  if (!res.ok || !body) {
    throw new Error(`Xendit request failed (${res.status}): ${body?.error_code ?? ''} ${body?.message ?? ''}`.trim());
  }
  return body;
}

/**
 * The body matches Xendit's published QRIS example. Its docs do not confirm where
 * QRIS accepts an expiry, so none is sent and the response value is used instead.
 * Not retried: the API documents no idempotency key, so a retry could mint a second QR.
 */
export function createQrisRequest(
  input: { referenceId: string; amount: number; description: string },
  fetcher: typeof fetch = fetch
): Promise<XenditPaymentRequest> {
  return xenditRequest(
    API_BASE,
    {
      method: 'POST',
      body: JSON.stringify({
        reference_id: input.referenceId,
        type: 'PAY',
        country: 'ID',
        currency: 'IDR',
        request_amount: input.amount,
        channel_code: 'QRIS',
        description: input.description,
      }),
    },
    fetcher
  );
}

export function getPaymentRequest(id: string, fetcher: typeof fetch = fetch): Promise<XenditPaymentRequest> {
  return xenditRequest(`${API_BASE}/${encodeURIComponent(id)}`, { method: 'GET' }, fetcher);
}

export function simulatePayment(id: string, amount: number, fetcher: typeof fetch = fetch): Promise<unknown> {
  return xenditRequest(
    `${API_BASE}/${encodeURIComponent(id)}/simulate`,
    { method: 'POST', body: JSON.stringify({ amount }) },
    fetcher
  );
}

export function extractQrString(request: XenditPaymentRequest): string | null {
  return request.actions?.find((action) => action.descriptor === 'QR_STRING')?.value ?? null;
}

/** Compares digests so the check takes the same time wherever the tokens differ. */
export async function isValidWebhookToken(received: string | null): Promise<boolean> {
  const expected = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expected || !received) return false;
  const encode = (value: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const [a, b] = (await Promise.all([encode(received), encode(expected)])).map((digest) => new Uint8Array(digest));
  return a.reduce((diff, byte, index) => diff | (byte ^ b[index]), 0) === 0;
}
