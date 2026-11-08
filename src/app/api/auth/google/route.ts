import { NextRequest, NextResponse } from 'next/server';
import { sessionCookieOptions } from '@/lib/auth/session';
import { buildGoogleAuthorization, OAUTH_COOKIE, OAUTH_TTL_SECONDS } from '@/lib/auth/google';

export async function GET(req: NextRequest) {
  try {
    const { url, cookie } = await buildGoogleAuthorization(req.nextUrl.searchParams.get('next') ?? '/');
    const res = NextResponse.redirect(url);
    res.cookies.set(OAUTH_COOKIE, cookie, { ...sessionCookieOptions, maxAge: OAUTH_TTL_SECONDS });
    return res;
  } catch (err) {
    console.error('[API /auth/google] Failed to start sign-in:', err);
    return NextResponse.redirect(new URL('/login?error=config', req.url));
  }
}
