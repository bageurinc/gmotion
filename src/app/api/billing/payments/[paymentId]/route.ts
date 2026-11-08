import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/project-access';
import { getCurrentUser } from '@/lib/auth/session';
import { findUserPayment, refreshPayment, toPublicPayment } from '@/lib/billing/payments';

export async function GET(req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const { paymentId } = await params;
  const payment = await findUserPayment(paymentId, auth.user.id);
  if (!payment) return NextResponse.json({ error: 'Pembayaran tidak ditemukan.' }, { status: 404 });

  const latest = await refreshPayment(payment);
  // Read again so a payment that just settled shows its new balance immediately.
  const user = await getCurrentUser();
  return NextResponse.json({ payment: toPublicPayment(latest), credits: user?.credits ?? auth.user.credits });
}
