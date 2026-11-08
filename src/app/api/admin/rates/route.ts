import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { addModelRate, isAdmin, ModelRateSchema } from '@/lib/billing/costs';

/** Adds a model rate from the admin cost page form. Non-admins get 404 so the route stays hidden. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const input = ModelRateSchema.safeParse({
    model: form?.get('model'),
    idrPerMillionInput: form?.get('idrPerMillionInput') || 0,
    idrPerMillionOutput: form?.get('idrPerMillionOutput') || 0,
    idrPerImage: form?.get('idrPerImage') || 0,
    idrPerMillionCharacters: form?.get('idrPerMillionCharacters') || 0,
  });
  const back = new URL('/admin/biaya', req.url);
  if (!input.success) {
    back.searchParams.set('pesan', 'Tarif tidak valid. Isi nama model dan angka 0 atau lebih.');
    return NextResponse.redirect(back, 303);
  }
  await addModelRate(input.data);
  back.searchParams.set('pesan', `Tarif ${input.data.model} disimpan dan berlaku mulai sekarang.`);
  return NextResponse.redirect(back, 303);
}
