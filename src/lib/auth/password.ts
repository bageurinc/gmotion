import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { PASSWORD_ACCOUNT_PREFIX } from './session';

export const PASSWORD_SETTINGS_PATH = '/account/password';
export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;

const deriveKey = promisify(pbkdf2);
const ITERATIONS = 600_000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const registrationEmail = z.string().trim().toLowerCase().max(254).email();

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, ITERATIONS, 32, 'sha256');
  return `pbkdf2-sha256$${ITERATIONS}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function registerPasswordAccount(email: unknown, password: unknown, confirmation: unknown) {
  const parsedEmail = registrationEmail.safeParse(email);
  if (!parsedEmail.success || typeof password !== 'string' || password !== confirmation ||
      password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return { error: 'invalid' } as const;
  }

  const id = crypto.randomUUID();
  const hash = await hashPassword(password);
  const changes = await getDb().run(
    `INSERT INTO users (id, google_sub, email, password_hash, created_at)
     SELECT ?, ?, ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = ?)
     ON CONFLICT DO NOTHING`,
    [id, `${PASSWORD_ACCOUNT_PREFIX}${id}`, parsedEmail.data, hash, Date.now(), parsedEmail.data]
  );
  return changes === 1 ? { userId: id } as const : { error: 'unavailable' } as const;
}

export async function setAccountPassword(userId: string, email: string, sessionId: string, password: string): Promise<boolean> {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) return false;
  const hash = await hashPassword(password);
  const now = Date.now();
  const changes = await getDb().run(
    `UPDATE OR IGNORE users SET password_hash = ?, password_attempts = 0, password_window_until = 0
     WHERE id = ? AND email = ? AND EXISTS (
       SELECT 1 FROM sessions WHERE id = ? AND user_id = users.id AND expires_at > ? AND password_setup_until > ?
     )`,
    [hash, userId, email, sessionId, now, now]
  );
  return changes === 1;
}

export async function authenticateWithPassword(email: string, password: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || normalizedEmail.length > 254 ||
      password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) return null;

  const db = getDb();
  const now = Date.now();
  // Reserve an attempt before hashing, including when requests arrive concurrently.
  const account = await db.first<{ id: string; password_hash: string; password_attempts: number; password_window_until: number }>(
    `UPDATE users SET
       password_attempts = CASE WHEN password_window_until <= ? THEN 1 ELSE password_attempts + 1 END,
       password_window_until = CASE WHEN password_window_until <= ? THEN ? ELSE password_window_until END
     WHERE lower(email) = ? AND password_hash IS NOT NULL
       AND (password_window_until <= ? OR password_attempts < ?)
     RETURNING id, password_hash, password_attempts, password_window_until`,
    [now, now, now + ATTEMPT_WINDOW_MS, normalizedEmail, now, MAX_ATTEMPTS]
  );
  if (!account) return null;

  const [algorithm, iterations, salt, key] = account.password_hash.split('$');
  if (algorithm !== 'pbkdf2-sha256' || Number(iterations) !== ITERATIONS ||
      !/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{64}$/.test(key)) return null;
  const candidate = await deriveKey(password, Buffer.from(salt, 'hex'), ITERATIONS, 32, 'sha256');
  if (!timingSafeEqual(candidate, Buffer.from(key, 'hex'))) return null;

  await db.run(
    `UPDATE users SET password_attempts = 0, password_window_until = 0
     WHERE id = ? AND password_hash = ? AND password_attempts = ? AND password_window_until = ?`,
    [account.id, account.password_hash, account.password_attempts, account.password_window_until]
  );
  const current = await db.first<{ id: string }>(
    'SELECT id FROM users WHERE id = ? AND password_hash = ?',
    [account.id, account.password_hash]
  );
  return current?.id ?? null;
}
