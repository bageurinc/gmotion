import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/project-access';
import { findCreditPackage } from '@/lib/billing/packages';
import { startQrisPayment, toPublicPayment } from '@/lib/billing/payments';
import { isXenditTestMode } from '@/lib/billing/xendit';

const CreatePaymentSchema = z.object({ packageId: z.string().max(40) });

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const input = CreatePaymentSchema.safeParse(await req.json().catch(() => null));
  const pkg = input.success ? findCreditPackage(input.data.packageId) : undefined;
  if (!pkg) return NextResponse.json({ error: 'Paket tidak ditemukan.' }, { status: 400 });

  try {
    const payment = await startQrisPayment(auth.user.id, pkg, `gmotion ${pkg.credits} kredit`);
    return NextResponse.json({ payment: toPublicPayment(payment), testMode: isXenditTestMode() }, { status: 201 });
  } catch (err) {
    console.error('[API /billing/payments] Failed to create QRIS:', err);
    return NextResponse.json({ error: 'QRIS gagal dibuat. Coba lagi sebentar.' }, { status: 502 });
  }
}
