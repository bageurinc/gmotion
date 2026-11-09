import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/client';
import { createDraftFromRequest, getDraft, listVersions } from '@/lib/assets/library-db';
import { previewCases, validateDraftCode, DraftMetaSchema } from '@/lib/assets/draft-contract';
import { checkDraft } from '@/lib/assets/draft-runtime';
import { parseDraftResponse } from '@/lib/assets/draft-ai';
import { POST as draftVersionAction } from '@/app/api/admin/assets/drafts/[id]/route';
import { SIGN_CODE, SIGN_META } from './fixtures/draft-sign';
import { TEST_USER } from './setup-auth';

const chat = vi.hoisted(() => vi.fn());
vi.mock('@/lib/explainer/asset-generator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/explainer/asset-generator')>()),
  callChat: chat,
}));

const answer = (meta: unknown, code: string) => ({ text: `\`\`\`json\n${JSON.stringify(meta)}\n\`\`\`\n\`\`\`tsx\n${code}\`\`\``, finishReason: 'stop', usage: {} });

beforeEach(async () => {
  await getDb().run('DELETE FROM published_assets');
  await getDb().run('DELETE FROM asset_draft_versions');
  await getDb().run('DELETE FROM asset_drafts');
  chat.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('draft contract and checks', () => {
  it('passes every check for a well-formed draft', () => {
    const report = checkDraft(SIGN_CODE, SIGN_META);
    expect(report.checks.filter((check) => !check.ok)).toEqual([]);
    expect(report.ready).toBe(true);
    expect(report.previews.map((preview) => preview.key)).toEqual(['single', 'single:state=on', 'double', 'double:state=on']);
    expect(report.previews[0].svg).toMatch(/^<svg[^>]*viewBox="0 0 760 480"/);
  });

  it('rejects imports outside the draft kit, raster images, and globals', () => {
    expect(validateDraftCode(SIGN_CODE.replace("'@/motion-kit/isometric/draft-kit'", "'@/motion-kit'")).join()).toContain("Forbidden import '@/motion-kit'");
    expect(validateDraftCode(SIGN_CODE.replace('<circle', '<image href="x.png" /><circle')).join()).toMatch(/image/i);
    expect(validateDraftCode(SIGN_CODE.replace('const heads', 'fetch("/x"); const heads')).join()).toContain("Forbidden global 'fetch'");
    expect(validateDraftCode('export const Asset = () => null;').join()).toContain('default export');
  });

  it('reports states that change nothing, identical variants, and anchors off the canvas', () => {
    const meta = structuredClone(SIGN_META) as typeof SIGN_META;
    meta.props = { ...meta.props, unused: { type: 'enum', values: ['a', 'b'], default: 'a', description: 'No effect' } } as typeof meta.props;
    (meta.variants.double.anchors as Record<string, number[]>).lamp = [0, 0, 900];
    const report = checkDraft(SIGN_CODE.replace("variant === 'double' ? [0, 90] : [0]", '[0]'), meta);
    const failed = Object.fromEntries(report.checks.filter((check) => !check.ok).map((check) => [check.id, check.detail ?? '']));
    expect(Object.keys(failed).sort()).toEqual(['anchors', 'states', 'variants']);
    expect(failed.states).toContain('unused: b');
    expect(failed.anchors).toContain('double.lamp');
    expect(report.ready).toBe(false);
  });

  it('stops runaway or broken code without hanging', () => {
    const loop = checkDraft(SIGN_CODE.replace('const heads', 'while (true) {} const heads'), SIGN_META);
    expect(loop.checks.find((check) => check.id === 'render')?.ok).toBe(false);
    const throws = checkDraft(SIGN_CODE.replace('const heads', "if (state === 'on') throw new Error('boom'); const heads"), SIGN_META);
    expect(throws.checks.find((check) => check.id === 'render')?.detail).toContain('boom');
    expect(throws.previews.filter((preview) => preview.svg)).toHaveLength(2);
  });

  it('serialises SVG like React and refuses hooks', async () => {
    const { renderSvgMarkup } = await import('@/lib/assets/draft-runtime');
    const React = (await import('react')).default;
    expect(renderSvgMarkup(React.createElement('svg', { viewBox: '0 0 10 10', className: 'a' },
      React.createElement('path', { d: 'M0 0', strokeWidth: 2, strokeLinejoin: 'round', fillOpacity: 0.5, onClick: () => null }),
      React.createElement(React.Fragment, null, 'a<b', false, null)))).toBe('<svg viewBox="0 0 10 10" class="a"><path d="M0 0" stroke-width="2" stroke-linejoin="round" fill-opacity="0.5"></path>a&lt;b</svg>');
    const hooked = checkDraft(SIGN_CODE.replace('const heads', 'const [x] = React.useState(0); const heads'), SIGN_META);
    expect(hooked.checks.find((check) => check.id === 'render')?.ok).toBe(false);
  });

  it('caps preview states and keeps variant as a renderer prop', () => {
    expect(previewCases(DraftMetaSchema.parse(SIGN_META), 3)).toHaveLength(3);
    expect(DraftMetaSchema.safeParse({ ...SIGN_META, props: { variant: { type: 'boolean', default: true, description: 'x' } } }).success).toBe(false);
  });

  it('parses the two fenced blocks of a model answer', () => {
    expect(parseDraftResponse(answer(SIGN_META, SIGN_CODE).text)?.meta).toEqual(SIGN_META);
    expect(parseDraftResponse('no blocks here')).toBeNull();
  });
});

describe('draft version actions', () => {
  const form = (id: string, fields: Record<string, string>) => {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    return draftVersionAction(new NextRequest(`http://localhost/api/admin/assets/drafts/${id}`, { method: 'POST', body }), { params: Promise.resolve({ id }) });
  };
  const message = (response: Response) => decodeURIComponent(response.headers.get('location') ?? '').replace(/\+/g, ' ');

  it('generates with feedback on rejected attempts, then revises, saves, and restores', async () => {
    vi.stubEnv('ADMIN_EMAILS', TEST_USER.email);
    const { draft } = await createDraftFromRequest({ subject: 'lampu merah', preset: 'world' }, TEST_USER.email);
    chat.mockResolvedValueOnce({ text: 'not a draft', finishReason: 'stop', usage: {} })
      .mockResolvedValueOnce(answer(SIGN_META, SIGN_CODE));

    expect(message(await form(draft.id, { action: 'generate' }))).toContain('Versi 1 dibuat oleh AI dalam 2 percobaan, semua pemeriksaan lolos');
    expect(chat.mock.calls[1][0].content).toContain('did not contain the two fenced blocks');
    expect((await getDraft(draft.id))).toMatchObject({ status: 'review', currentVersion: 1 });

    chat.mockResolvedValueOnce(answer(SIGN_META, SIGN_CODE.replace('#F2C14E', '#E5533D')));
    expect(message(await form(draft.id, { action: 'revise', instruction: 'Lampu menyala merah' }))).toContain('Versi 2 dibuat');
    expect(chat.mock.calls[2][0].content).toContain('Lampu menyala merah');

    expect(message(await form(draft.id, { action: 'save', code: SIGN_CODE, metadata: 'not json' }))).toContain('bukan JSON');
    expect(message(await form(draft.id, { action: 'save', code: SIGN_CODE.replace('fetch', ''), metadata: JSON.stringify(SIGN_META) }))).toContain('Versi 3 disimpan, semua pemeriksaan lolos');
    expect(message(await form(draft.id, { action: 'restore', version: '1' }))).toContain('Versi 1 dipulihkan sebagai versi 4');

    const versions = await listVersions(draft.id);
    expect(versions.map((version) => [version.number, version.source])).toEqual([[4, 'restore'], [3, 'manual'], [2, 'ai'], [1, 'ai']]);
    expect(versions[2].instruction).toBe('Lampu menyala merah');
    expect(versions[3].report.previews[0].svg).toMatch(/^<svg/);
  });

  it('publishes only with confirmation, then locks the draft until it is reopened', async () => {
    vi.stubEnv('ADMIN_EMAILS', TEST_USER.email);
    await getDb().run('DELETE FROM published_assets');
    const { draft } = await createDraftFromRequest({ subject: 'lampu merah', preset: 'world' }, null);
    chat.mockResolvedValueOnce(answer(SIGN_META, SIGN_CODE));
    await form(draft.id, { action: 'generate' });
    expect(message(await form(draft.id, { action: 'publish' }))).toContain('Centang konfirmasi');
    expect(message(await form(draft.id, { action: 'publish', confirm: 'yes' }))).toContain('Diterbitkan sebagai custom.lampu-merah@0.1.0');
    expect(message(await form(draft.id, { action: 'revise', instruction: 'ubah warna' }))).toContain('tidak bisa diubah');
    expect(message(await form(draft.id, { action: 'reopen' }))).toContain('Draf dibuka lagi');
    expect((await getDraft(draft.id))?.status).toBe('review');
  });

  it('keeps a failing draft so the admin can see why, and hides the route from non-admins', async () => {
    const { draft } = await createDraftFromRequest({ subject: 'tikungan', preset: 'world' }, null);
    vi.stubEnv('ADMIN_EMAILS', 'boss@example.com');
    expect((await form(draft.id, { action: 'generate' })).status).toBe(404);

    vi.stubEnv('ADMIN_EMAILS', TEST_USER.email);
    chat.mockResolvedValue(answer(SIGN_META, SIGN_CODE.replace("'@/motion-kit/isometric/draft-kit'", "'fs'")));
    expect(message(await form(draft.id, { action: 'generate' }))).toMatch(/Versi 1 dibuat oleh AI dalam 3 percobaan, \d+ pemeriksaan belum lolos/);
    const [version] = await listVersions(draft.id);
    expect(version.report.ready).toBe(false);
    expect(version.report.notes?.length).toBe(3);
  });
});
