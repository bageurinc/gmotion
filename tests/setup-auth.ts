import { beforeAll, vi } from 'vitest';
import { createLocalDb, setDbForTests } from '@/lib/db/client';
import type { User } from '@/lib/auth/session';

export const TEST_USER: User = {
  id: 'user_test',
  google_sub: 'google_test',
  email: 'tester@example.com',
  name: 'Tester',
  avatar_url: null,
  credits: 100,
  created_at: 1,
};

// Route tests run outside a request, so next/headers cookies are unavailable.
// getCurrentUser reads the in-memory database, which keeps balances real.
vi.mock('@/lib/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/session')>();
  const { getDb } = await import('@/lib/db/client');
  return {
    ...actual,
    getCurrentUser: vi.fn(async () => getDb().first<User>('SELECT * FROM users WHERE id = ?', ['user_test'])),
  };
});

beforeAll(async () => {
  const db = createLocalDb(':memory:');
  setDbForTests(db);
  await db.run('INSERT INTO users (id, google_sub, email, name, credits, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    TEST_USER.id,
    TEST_USER.google_sub,
    TEST_USER.email,
    TEST_USER.name,
    TEST_USER.credits,
    TEST_USER.created_at,
  ]);
  process.env.LEGACY_PROJECT_OWNER_EMAIL = TEST_USER.email;
});
