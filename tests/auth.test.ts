import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getProjectRoute } from '@/app/api/projects/[projectId]/route';
import { GET as listProjectsRoute, POST as createProject } from '@/app/api/projects/route';
import { GET as getAsset } from '@/app/api/projects/[projectId]/assets/[...assetPath]/route';
import { POST as generate } from '@/app/api/projects/[projectId]/generate/route';
import { exchangeCodeForProfile, safeNextPath, upsertGoogleUser } from '@/lib/auth/google';
import { createSession, deleteSession, findUserBySessionToken, getCurrentUser, sha256Hex } from '@/lib/auth/session';
import { createD1HttpDb, getDb } from '@/lib/db/client';
import { saveProject } from '@/lib/storage/project-store';
import { StudioProject } from '@/types/studio';
import { middleware } from '@/middleware';
import { TEST_USER } from './setup-auth';

const otherProjectId = `auth_test_${Date.now()}`;
const params = (projectId: string) => ({ params: Promise.resolve({ projectId }) });
const request = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`http://localhost${url}`, init);

describe('middleware', () => {
  it('sends signed-out pages to login and keeps the target', () => {
    const res = middleware(request('/studio/abc?x=1'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Fstudio%2Fabc%3Fx%3D1');
  });

  it('answers signed-out API calls with 401', async () => {
    const res = middleware(request('/api/projects'));
    expect(res.status).toBe(401);
  });

  it.each(['/login', '/register', '/api/auth/google', '/api/webhooks/xendit'])('leaves %s public', (url) => {
    expect(middleware(request(url)).headers.get('x-middleware-next')).toBe('1');
  });

  it('does not treat a lookalike path as public', () => {
    expect(middleware(request('/loginx')).status).toBe(307);
  });
});

describe('sessions', () => {
  it('stores only a hash of the token', async () => {
    const { token } = await createSession(TEST_USER.id);
    expect(await getDb().first('SELECT id FROM sessions WHERE id = ?', [token])).toBeNull();
    expect(await getDb().first('SELECT id FROM sessions WHERE id = ?', [await sha256Hex(token)])).not.toBeNull();
    expect((await findUserBySessionToken(token))?.id).toBe(TEST_USER.id);
  });

  it('rejects expired, deleted, and unknown tokens', async () => {
    const { token } = await createSession(TEST_USER.id);
    await getDb().run('UPDATE sessions SET expires_at = 1 WHERE id = ?', [await sha256Hex(token)]);
    expect(await findUserBySessionToken(token)).toBeNull();

    const live = await createSession(TEST_USER.id);
    await deleteSession(live.token);
    expect(await findUserBySessionToken(live.token)).toBeNull();
    expect(await findUserBySessionToken('unknown')).toBeNull();
  });
});

describe('Google sign-in', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'client';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
  });

  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '', null])('rejects next=%s', (next) => {
    expect(safeNextPath(next)).toBe('/');
  });

  it('keeps a same-site path', () => {
    expect(safeNextPath('/studio/abc?x=1')).toBe('/studio/abc?x=1');
  });

  const googleFetch = (profile: Record<string, unknown>) =>
    vi.fn(async (url: string | URL | Request) =>
      String(url).includes('token')
        ? new Response(JSON.stringify({ access_token: 'token' }))
        : new Response(JSON.stringify(profile))
    ) as unknown as typeof fetch;

  it('refuses an unverified email', async () => {
    const fetcher = googleFetch({ sub: 's1', email: 'a@example.com', email_verified: false });
    await expect(exchangeCodeForProfile('code', 'verifier', fetcher)).rejects.toThrow('not verified');
  });

  it('sends the PKCE verifier to Google', async () => {
    const fetcher = googleFetch({ sub: 's1', email: 'a@example.com', email_verified: true });
    await exchangeCodeForProfile('code', 'verifier', fetcher);
    const body = vi.mocked(fetcher).mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get('code_verifier')).toBe('verifier');
  });

  it('keeps one account and its balance across sign-ins', async () => {
    const first = await upsertGoogleUser({ sub: 'stable', email: 'old@example.com' });
    await getDb().run('UPDATE users SET credits = 7 WHERE id = ?', [first.id]);
    const second = await upsertGoogleUser({ sub: 'stable', email: 'new@example.com' });
    expect(second).toMatchObject({ id: first.id, email: 'new@example.com', credits: 7 });
  });
});

describe('project ownership', () => {
  const projectDir = path.join(process.cwd(), 'storage', 'projects', otherProjectId);

  beforeEach(() => {
    saveProject({
      id: otherProjectId,
      ownerId: 'someone_else',
      createdAt: 1,
      updatedAt: 1,
      userPrompt: 'private',
      files: {},
      chatHistory: [],
      status: 'draft',
    } as unknown as StudioProject);
    fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'assets', 'voice.mp3'), 'audio');
  });

  afterAll(() => fs.rmSync(projectDir, { recursive: true, force: true }));

  it('hides another user project from every route', async () => {
    expect((await getProjectRoute(request('/x'), params(otherProjectId))).status).toBe(404);
    expect((await generate(request('/x'), params(otherProjectId))).status).toBe(404);
    const asset = await getAsset(request('/x'), {
      params: Promise.resolve({ projectId: otherProjectId, assetPath: ['voice.mp3'] }),
    });
    expect(asset.status).toBe(404);

    const { projects } = await (await listProjectsRoute()).json();
    expect(projects.map((project: StudioProject) => project.id)).not.toContain(otherProjectId);
  });

  it('answers 401 when the session is gone', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    expect((await getProjectRoute(request('/x'), params(otherProjectId))).status).toBe(401);
  });

  it('blocks drafting without credit', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ ...TEST_USER, credits: 0 });
    const res = await createProject(request('/api/projects', { method: 'POST', body: JSON.stringify({ prompt: 'x' }) }));
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe('insufficient_credits');
  });
});

describe('D1 HTTP driver', () => {
  afterEach(() => vi.restoreAllMocks());

  const config = { accountId: 'acct', databaseId: 'db', apiToken: 'tok' };

  it('sends parameterized SQL and reads results', async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, result: [{ results: [{ id: 1 }], meta: { changes: 3 } }] }))
    );
    const db = createD1HttpDb(config, fetcher as unknown as typeof fetch);

    expect(await db.first('SELECT ?', ['a'])).toEqual({ id: 1 });
    expect(await db.all('SELECT ?', ['a'])).toEqual([{ id: 1 }]);
    expect(await db.run('UPDATE x')).toBe(3);

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acct/d1/database/db/query');
    expect(JSON.parse(String(init.body))).toEqual({ sql: 'SELECT ?', params: ['a'] });
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok' });
  });

  it('throws on an API error instead of returning empty rows', async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ success: false, errors: [{ message: 'no such table' }] }), { status: 400 })
    );
    const db = createD1HttpDb(config, fetcher as unknown as typeof fetch);
    await expect(db.first('SELECT 1')).rejects.toThrow('no such table');
  });
});
