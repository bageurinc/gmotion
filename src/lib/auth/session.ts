import { cookies } from 'next/headers';
import { getDb } from '@/lib/db/client';

export const SESSION_COOKIE = 'gmotion_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface User {
  id: string;
  google_sub: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  credits: number;
  created_at: number;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
} as const;

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url');
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: number }> {
  const token = randomToken();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await getDb().run('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', [
    await sha256Hex(token),
    userId,
    expiresAt,
    now,
  ]);
  return { token, expiresAt };
}

export async function findUserBySessionToken(token: string): Promise<User | null> {
  return getDb().first<User>(
    `SELECT users.* FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ? AND sessions.expires_at > ?`,
    [await sha256Hex(token), Date.now()]
  );
}

export async function deleteSession(token: string): Promise<void> {
  await getDb().run('DELETE FROM sessions WHERE id = ?', [await sha256Hex(token)]);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? findUserBySessionToken(token) : null;
}
