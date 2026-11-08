import { NextRequest, NextResponse } from 'next/server';

// Must match SESSION_COOKIE in lib/auth/session.ts. That module is not imported
// here because it reaches the database, which the edge middleware cannot use.
const SESSION_COOKIE = 'gmotion_session';
const PUBLIC_PAGES = ['/login', '/register'];
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/webhooks/'];

/**
 * A fast redirect for signed-out visitors, based on cookie presence only.
 * The real session and ownership checks run in each route and page.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PAGES.includes(pathname) || PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Silakan masuk dulu.' }, { status: 401 });
  }
  const login = new URL('/login', req.url);
  if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico).*)'],
};
