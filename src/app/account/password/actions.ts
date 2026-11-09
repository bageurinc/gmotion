'use server';

import { redirect } from 'next/navigation';
import { PASSWORD_SETTINGS_PATH, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, setAccountPassword } from '@/lib/auth/password';
import { getCurrentUser, getPasswordSetupSessionId } from '@/lib/auth/session';

export async function savePassword(formData: FormData) {
  const user = await getCurrentUser();
  const sessionId = user && await getPasswordSetupSessionId(user.id);
  if (!user || !sessionId) redirect(PASSWORD_SETTINGS_PATH);

  const password = formData.get('password');
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH || password !== formData.get('confirmation')) {
    redirect(`${PASSWORD_SETTINGS_PATH}?status=invalid`);
  }

  const saved = await setAccountPassword(user.id, user.email, sessionId, password);
  redirect(`${PASSWORD_SETTINGS_PATH}?status=${saved ? 'saved' : 'failed'}`);
}
