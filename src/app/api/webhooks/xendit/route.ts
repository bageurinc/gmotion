import { NextRequest, NextResponse } from 'next/server';
import { handleXenditWebhook } from '@/lib/billing/payments';
import { isValidWebhookToken } from '@/lib/billing/xendit';

export async function POST(req: NextRequest) {
  if (!(await isValidWebhookToken(req.headers.get('x-callback-token')))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  try {
    return NextResponse.json({ result: await handleXenditWebhook(body) });
  } catch (err) {
    // A non-2xx answer makes Xendit retry, so a temporary database failure recovers.
    console.error('[API /webhooks/xendit] Failed to process webhook:', err);
    return NextResponse.json({ error: 'Temporary failure' }, { status: 500 });
  }
}
