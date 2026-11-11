import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAdmin } from './costs';

const passwordUser = { email: 'boss@example.com', google_sub: 'password:abc' };
const googleUser = { email: 'boss@example.com', google_sub: '1234567890' };

describe('isAdmin and password accounts', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('counts a listed password account only under next dev', () => {
    vi.stubEnv('ADMIN_EMAILS', 'boss@example.com');
    vi.stubEnv('NODE_ENV', 'development');
    expect(isAdmin(passwordUser)).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    expect(isAdmin(passwordUser)).toBe(false);
    vi.stubEnv('NODE_ENV', 'test');
    expect(isAdmin(passwordUser)).toBe(false);
  });

  it('still needs the email in ADMIN_EMAILS under next dev', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ADMIN_EMAILS', 'ops@example.com');
    expect(isAdmin(passwordUser)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it('keeps Google accounts as before', () => {
    vi.stubEnv('ADMIN_EMAILS', 'boss@example.com');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isAdmin(googleUser)).toBe(true);
  });
});
