import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/project-access';
import { findUserPayment } from '@/lib/billing/payments';
import { isXenditTestMode, simulatePayment } from '@/lib/billing/xendit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  if (!isXenditTestMode()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const { paymentId } = await params;
  const payment = await findUserPayment(paymentId, auth.user.id);
  if (!payment?.xendit_id || payment.status !== 'pending') {
    return NextResponse.json({ error: 'Pembayaran tidak bisa disimulasikan.' }, { status: 409 });
  }

  try {
    await simulatePayment(payment.xendit_id, payment.amount);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[API /billing/simulate] Simulation failed:', err);
    return NextResponse.json({ error: 'Simulasi gagal.' }, { status: 502 });
  }
}
