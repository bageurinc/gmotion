import { getDb } from '@/lib/db/client';
import { randomToken, User } from './session';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export const OAUTH_COOKIE = 'gmotion_oauth';
export const OAUTH_TTL_SECONDS = 600;

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export function appUrl(): string {
  return (process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`).replace(/\/$/, '');
}

const redirectUri = () => `${appUrl()}/api/auth/google/callback`;

function googleCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth is not configured.');
  return { clientId, clientSecret };
}

/** Accepts same-site paths only, so a crafted ?next= cannot redirect off the site. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  return next;
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString('base64url');
}

export async function buildGoogleAuthorization(next: string) {
  const { clientId } = googleCredentials();
  const state = randomToken();
  const verifier = randomToken();
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return { url: url.toString(), cookie: JSON.stringify({ state, verifier, next: safeNextPath(next) }) };
}

export function parseOAuthCookie(value: string | undefined): { state: string; verifier: string; next: string } | null {
  try {
    const parsed = JSON.parse(value ?? '');
    if (typeof parsed?.state !== 'string' || typeof parsed?.verifier !== 'string') return null;
    return { state: parsed.state, verifier: parsed.verifier, next: safeNextPath(parsed.next) };
  } catch {
    return null;
  }
}

export async function exchangeCodeForProfile(
  code: string,
  verifier: string,
  fetcher: typeof fetch = fetch
): Promise<GoogleProfile> {
  const { clientId, clientSecret } = googleCredentials();
  const tokenRes = await fetcher(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  const tokens = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
  if (!tokenRes.ok || !tokens?.access_token) throw new Error(`Google token exchange failed (${tokenRes.status})`);

  const profileRes = await fetcher(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const profile = (await profileRes.json().catch(() => null)) as GoogleProfile | null;
  if (!profileRes.ok || !profile?.sub || !profile.email) throw new Error(`Google profile lookup failed (${profileRes.status})`);
  if (profile.email_verified !== true) throw new Error('Google account email is not verified');
  return profile;
}

/** The Google subject is the identity. Email can change, so it is only refreshed. */
export async function upsertGoogleUser(profile: GoogleProfile): Promise<User> {
  const user = await getDb().first<User>(
    `INSERT INTO users (id, google_sub, email, name, avatar_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (google_sub) DO UPDATE SET
       email = excluded.email, name = excluded.name, avatar_url = excluded.avatar_url
     RETURNING *`,
    [crypto.randomUUID(), profile.sub, profile.email, profile.name ?? null, profile.picture ?? null, Date.now()]
  );
  if (!user) throw new Error('Failed to save user');
  return user;
}
