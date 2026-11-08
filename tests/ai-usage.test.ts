import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { getDb } from '@/lib/db/client';
import { currentUsageContext, recordUsage, runWithUsage, usageFromBody } from '@/lib/billing/usage';
import { addModelRate, costSummary, isAdmin } from '@/lib/billing/costs';
import { POST as addRate } from '@/app/api/admin/rates/route';
import { TEST_USER } from './setup-auth';

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const rows = () => getDb().all<Record<string, unknown>>('SELECT * FROM ai_usage ORDER BY created_at');

beforeEach(async () => {
  await getDb().run('DELETE FROM ai_usage');
  await getDb().run('DELETE FROM model_rates');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('usage recording', () => {
  it('attaches the request context, including inside later promises', async () => {
    await runWithUsage({ userId: TEST_USER.id, projectId: 'proj_a', preset: 'story-2d', stage: 'generate' }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(currentUsageContext()?.stage).toBe('generate');
      recordUsage({ kind: 'chat', model: 'gemini-x', inputTokens: 1200, outputTokens: 300.4, durationMs: 900, ok: true });
    });
    recordUsage({ kind: 'image', model: 'img', images: 1, durationMs: 5000, ok: true });
    await settle();
    const [chat, image] = await rows();
    expect(chat).toMatchObject({ user_id: TEST_USER.id, project_id: 'proj_a', preset: 'story-2d', stage: 'generate', input_tokens: 1200, output_tokens: 300, ok: 1 });
    expect(image).toMatchObject({ user_id: null, stage: 'other', images: 1 });
  });

  it('reads token counts in either naming', () => {
    expect(usageFromBody({ usage: { prompt_tokens: 10, completion_tokens: 4 } })).toEqual({ inputTokens: 10, outputTokens: 4 });
    expect(usageFromBody({ usage: { input_tokens: 7, output_tokens: 2 } })).toEqual({ inputTokens: 7, outputTokens: 2 });
    expect(usageFromBody(null)).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it('records a real AI SDK call through the shared client', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_BASE_URL', 'http://router.test/v1');
    vi.stubEnv('DIRECTOR_MODEL', 'gemini-director');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'x', object: 'chat.completion', created: 1, model: 'gemini-director',
      choices: [{ index: 0, message: { role: 'assistant', content: 'halo' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 50, completion_tokens: 8, total_tokens: 58 },
    }), { headers: { 'content-type': 'application/json' } })));
    const { getDirectorModel } = await import('@/lib/ai/llm-client');
    await runWithUsage({ projectId: 'proj_b', stage: 'draft' }, () => generateText({ model: getDirectorModel(), prompt: 'hai' }));
    await settle();
    expect(await rows()).toEqual([expect.objectContaining({ project_id: 'proj_b', stage: 'draft', kind: 'chat', model: 'gemini-director', input_tokens: 50, output_tokens: 8, ok: 1 })]);
  });
});

describe('cost summary', () => {
  it('prices each request with the rate in force at that time and flags unpriced models', async () => {
    const db = getDb();
    const insert = (createdAt: number, model: string, stage: string, projectId: string, input = 0, output = 0, images = 0) =>
      db.run(`INSERT INTO ai_usage (id, created_at, user_id, project_id, preset, stage, kind, model, input_tokens, output_tokens, images, characters, duration_ms, ok)
              VALUES (?, ?, ?, ?, 'story-2d', ?, 'chat', ?, ?, ?, ?, 0, 1, 1)`,
        [crypto.randomUUID(), createdAt, TEST_USER.id, projectId, stage, model, input, output, images]);
    await addModelRate({ model: 'gemini', idrPerMillionInput: 1000, idrPerMillionOutput: 4000, idrPerImage: 0, idrPerMillionCharacters: 0 }, 1000);
    await addModelRate({ model: 'gemini', idrPerMillionInput: 2000, idrPerMillionOutput: 8000, idrPerImage: 0, idrPerMillionCharacters: 0 }, 5000);
    await addModelRate({ model: 'img', idrPerMillionInput: 0, idrPerMillionOutput: 0, idrPerImage: 600, idrPerMillionCharacters: 0 }, 1000);
    await insert(2000, 'gemini', 'generate', 'p1', 1_000_000, 0); // old rate: Rp1.000
    await insert(6000, 'gemini', 'generate', 'p1', 0, 1_000_000); // new rate: Rp8.000
    await insert(6000, 'img', 'generate', 'p2', 0, 0, 2); // Rp1.200
    await insert(6000, 'unknown-model', 'revision', 'p2', 500, 0);

    const summary = await costSummary(0);
    expect(summary.total).toMatchObject({ requests: 4, idr: 10_200, unpriced: 1 });
    expect(summary.byModel.find((row) => row.model === 'unknown-model')).toMatchObject({ hasRate: false, unpriced: 1, idr: 0 });
    expect(summary.topProjects[0]).toMatchObject({ projectId: 'p1', idr: 9000, email: TEST_USER.email });
    expect(summary.byPreset).toEqual([{ preset: 'story-2d', videos: 2, averageIdr: 5100, maxIdr: 9000 }]);
    expect(summary.rates.find((rate) => rate.model === 'gemini')?.idrPerMillionInput).toBe(2000);
    expect((await costSummary(5500)).total.requests).toBe(3);
  });
});

describe('admin access', () => {
  it('only lists emails from ADMIN_EMAILS', () => {
    vi.stubEnv('ADMIN_EMAILS', ' Boss@Example.com, ops@example.com ');
    expect(isAdmin({ email: 'boss@example.com' })).toBe(true);
    expect(isAdmin({ email: TEST_USER.email })).toBe(false);
    vi.stubEnv('ADMIN_EMAILS', '');
    expect(isAdmin({ email: 'boss@example.com' })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it('hides the rate route from non-admins and saves rates for admins', async () => {
    const form = () => {
      const body = new FormData();
      body.set('model', 'gemini');
      body.set('idrPerMillionInput', '1500');
      return new NextRequest('http://localhost/api/admin/rates', { method: 'POST', body });
    };
    vi.stubEnv('ADMIN_EMAILS', 'boss@example.com');
    expect((await addRate(form())).status).toBe(404);

    vi.stubEnv('ADMIN_EMAILS', TEST_USER.email);
    const res = await addRate(form());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/admin/biaya');
    expect((await getDb().first<{ idr_per_million_input: number }>('SELECT idr_per_million_input FROM model_rates WHERE model = ?', ['gemini']))?.idr_per_million_input).toBe(1500);
  });
});
