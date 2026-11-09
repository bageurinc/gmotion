'use server';

import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/google';
import { authenticateWithPassword } from '@/lib/auth/password';
import { startPasswordSession } from '@/lib/auth/session';

export async function signInWithPassword(formData: FormData) {
  const email = formData.get('email');
  const password = formData.get('password');
  const next = formData.get('next');
  const target = safeNextPath(typeof next === 'string' ? next : undefined);
  const userId = typeof email === 'string' && typeof password === 'string'
    ? await authenticateWithPassword(email, password)
    : null;
  if (!userId) redirect(`/login?error=password&next=${encodeURIComponent(target)}`);

  await startPasswordSession(userId);
  redirect(target);
}
