'use server';

import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/google';
import { registerPasswordAccount } from '@/lib/auth/password';
import { startPasswordSession } from '@/lib/auth/session';

export async function registerWithPassword(formData: FormData) {
  const next = formData.get('next');
  const target = safeNextPath(typeof next === 'string' ? next : undefined);
  const result = await registerPasswordAccount(
    formData.get('email'), formData.get('password'), formData.get('confirmation')
  );
  if (result.error) redirect(`/register?error=${result.error}&next=${encodeURIComponent(target)}`);

  await startPasswordSession(result.userId);
  redirect(target);
}
