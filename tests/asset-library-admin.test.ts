import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/client';
import { createDraftFromRequest, listDrafts, listRequestedAssets, recordAssetRequests, setDraftStatus } from '@/lib/assets/library-db';
import { validateAssetPlan } from '@/lib/assets';
import { ASSET_REGISTRY } from '@/lib/assets/registry';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveInstanceProps } from '@/lib/assets/plan-schema';
import { assetComponent, variantRendererProps } from '@/motion-kit/assets/asset-renderers';
import { POST as draftAction } from '@/app/api/admin/assets/drafts/route';
import { TEST_USER } from './setup-auth';

beforeEach(async () => {
  await getDb().run('DELETE FROM asset_requests');
  await getDb().run('DELETE FROM asset_drafts');
});
afterEach(() => vi.unstubAllEnvs());

const form = (fields: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return new NextRequest('http://localhost/api/admin/assets/drafts', { method: 'POST', body });
};

describe('asset demand log', () => {
  it('aggregates requests per style and subject, case and spacing insensitive', async () => {
    await recordAssetRequests([{ subject: 'lampu merah', kind: 'object' }, { subject: 'tikungan', kind: 'environment' }], { preset: 'world', topic: 'Mobil berhenti di lampu merah' });
    await recordAssetRequests([{ subject: 'lampu merah', kind: 'object' }], { preset: 'world', topic: 'Lampu lalu lintas' });
    await recordAssetRequests([{ subject: 'lampu merah', kind: 'object' }], { preset: 'story-svg' });
    const rows = await listRequestedAssets();
    expect(rows[0]).toMatchObject({ preset: 'world', subject: 'lampu merah', count: 2, draftStatus: null });
    expect(rows).toHaveLength(3);
  });

  it('dedupes repeated subjects within one plan', async () => {
    expect(await recordAssetRequests([{ subject: 'tikungan', kind: 'environment' }, { subject: 'tikungan', kind: 'environment' }], { preset: 'world' })).toBe(1);
  });

  it('accepts coverage gaps in a plan and normalizes their subject', () => {
    const result = validateAssetPlan({
      schemaVersion: 1, visualPolicy: 'library-first',
      unsupported: [{ subject: '  Lampu   Merah ', kind: 'object', reason: 'No traffic light asset' }],
      instances: [{ id: 'car', assetId: 'vehicle.car', assetVersion: '0.1.0', variant: 'petrol' }],
      scenes: [{ id: 'one', layout: 'single', durationSec: 4, narration: 'Mobil berhenti.', instances: ['car'] }],
    });
    expect(result.ok && result.plan.unsupported).toEqual([{ subject: 'lampu merah', kind: 'object', reason: 'No traffic light asset' }]);
  });
});

describe('asset drafts', () => {
  it('opens one draft per subject and style, and links it back to the request', async () => {
    await recordAssetRequests([{ subject: 'lampu merah', kind: 'object' }], { preset: 'world' });
    const first = await createDraftFromRequest({ subject: 'lampu merah', preset: 'world' }, 'boss@example.com');
    const again = await createDraftFromRequest({ subject: 'lampu merah', preset: 'world' }, 'boss@example.com');
    expect(first).toMatchObject({ created: true, draft: { assetId: 'draft.lampu-merah', version: '0.0.1', status: 'draft', label: 'Lampu merah' } });
    expect(again.created).toBe(false);
    expect((await listRequestedAssets())[0].draftStatus).toBe('draft');
  });

  it('gives a new draft the next asset id after a rejection', async () => {
    const { draft } = await createDraftFromRequest({ subject: 'tikungan', preset: 'world' }, null);
    expect(await setDraftStatus(draft.id, 'rejected')).toBe(true);
    expect((await listRequestedAssets()).length).toBe(0);
    const retry = await createDraftFromRequest({ subject: 'tikungan', preset: 'world' }, null);
    expect(retry.draft.assetId).toBe('draft.tikungan-2');
    expect((await listDrafts()).map((item) => item.status)).toEqual(['draft', 'rejected']);
  });

  it('hides the route from non-admins and validates admin input', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'boss@example.com');
    expect((await draftAction(form({ action: 'create', subject: 'lampu merah', preset: 'world' }))).status).toBe(404);

    vi.stubEnv('ADMIN_EMAILS', TEST_USER.email);
    const bad = await draftAction(form({ action: 'create', subject: 'x', preset: 'world' }));
    expect(bad.status).toBe(303);
    expect(decodeURIComponent(bad.headers.get('location') ?? '').replace(/\+/g, ' ')).toContain('tidak valid');
    const ok = await draftAction(form({ action: 'create', subject: 'Lampu Merah', preset: 'world' }));
    expect(decodeURIComponent(ok.headers.get('location') ?? '').replace(/\+/g, ' ')).toContain('Draf "Lampu merah" dibuat');
    const [draft] = await listDrafts();
    expect(draft).toMatchObject({ subject: 'lampu merah', createdBy: TEST_USER.email });
    await draftAction(form({ action: 'status', id: draft.id, status: 'rejected' }));
    expect((await listDrafts())[0].status).toBe('rejected');
    expect((await draftAction(form({ action: 'status', id: draft.id, status: 'published' }))).headers.get('location')).toContain('tidak+dikenal');
  });
});

describe('admin preview renderers', () => {
  it('has a component for every registered asset', () => {
    for (const entry of ASSET_REGISTRY) expect(assetComponent(entry)).toBeTypeOf('function');
  });

  it('draws each variant differently, so the preview shows what the variant is', () => {
    for (const entry of ASSET_REGISTRY) {
      const variants = Object.keys(entry.variants);
      if (variants.length < 2) continue;
      const markup = variants.map((variant) => renderToStaticMarkup(React.createElement(assetComponent(entry)!, {
        ...resolveInstanceProps(entry, { id: 'p', assetId: entry.assetId, assetVersion: entry.version, variant, props: {} }),
        ...variantRendererProps(entry.renderer, variant),
      })).replace(/id="[^"]*"|url\(#[^)]*\)|aria-labelledby="[^"]*"/g, ''));
      expect(new Set(markup).size, entry.assetId).toBe(variants.length);
    }
  });
});
