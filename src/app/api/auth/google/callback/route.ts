import { NextRequest, NextResponse } from 'next/server';
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';
import { PASSWORD_SETTINGS_PATH } from '@/lib/auth/password';
import {
  appUrl,
  exchangeCodeForProfile,
  OAUTH_COOKIE,
  parseOAuthCookie,
  upsertGoogleUser,
} from '@/lib/auth/google';

export async function GET(req: NextRequest) {
  const fail = (reason: string) => {
    const res = NextResponse.redirect(`${appUrl()}/login?error=${reason}`);
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  };

  const params = req.nextUrl.searchParams;
  const pending = parseOAuthCookie(req.cookies.get(OAUTH_COOKIE)?.value);
  const code = params.get('code');
  if (!pending || !code || params.get('state') !== pending.state) return fail('state');

  try {
    const profile = await exchangeCodeForProfile(code, pending.verifier);
    const user = await upsertGoogleUser(profile);
    const { token, expiresAt } = await createSession(user.id, pending.next === PASSWORD_SETTINGS_PATH);

    const res = NextResponse.redirect(`${appUrl()}${pending.next}`);
    res.cookies.delete(OAUTH_COOKIE);
    res.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions, expires: new Date(expiresAt) });
    return res;
  } catch (err) {
    console.error('[API /auth/google/callback] Sign-in failed:', err);
    return fail('google');
  }
}
