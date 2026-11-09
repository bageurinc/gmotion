import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/lib/db/client';
import { addVersion, createDraftFromRequest, getDraft } from '@/lib/assets/library-db';
import { checkDraft } from '@/lib/assets/draft-runtime';
import { getPublishedVersions, listPublishedAssets, loadAssetCatalog, publishDraft, reopenDraft, setPublishedStatus } from '@/lib/assets/published';
import { findAssets, validateAssetPlan } from '@/lib/assets';
import { ASSET_REGISTRY } from '@/lib/assets/registry';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { assetComponent, placeAsset, variantRendererProps } from '@/motion-kit/assets/asset-renderers';
import { SIGN_CODE, SIGN_META } from './fixtures/draft-sign';

beforeEach(async () => {
  await getDb().run('DELETE FROM published_assets');
  await getDb().run('DELETE FROM asset_draft_versions');
  await getDb().run('DELETE FROM asset_drafts');
});

async function draftWith(code: string, meta: unknown = SIGN_META) {
  const { draft } = await createDraftFromRequest({ subject: 'lampu merah', preset: 'world' }, null);
  const report = checkDraft(code, meta);
  await addVersion(draft.id, { source: 'manual', code, metadata: meta, report: { ready: report.ready, checks: report.checks, previews: report.previews }, createdBy: null });
  return draft.id;
}

describe('publishing drafts', () => {
  it('refuses drafts whose checks fail, re-running them on the stored code', async () => {
    const id = await draftWith(SIGN_CODE.replace("variant === 'double' ? [0, 90] : [0]", '[0]'));
    const result = await publishDraft(id, 'boss@example.com');
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('Setiap varian tampil berbeda') });
    expect(await listPublishedAssets()).toEqual([]);
  });

  it('publishes an immutable version, then a new version after reopening', async () => {
    const id = await draftWith(SIGN_CODE);
    expect(await publishDraft(id, 'boss@example.com')).toEqual({ ok: true, assetId: 'custom.lampu-merah', version: '0.1.0' });
    expect((await getDraft(id))?.status).toBe('published');
    expect(await publishDraft(id, null)).toMatchObject({ ok: false, reason: expect.stringContaining('sudah terbit') });

    expect(await reopenDraft(id)).toBe(true);
    const report = checkDraft(SIGN_CODE.replace('#F2C14E', '#E5533D'), SIGN_META);
    await addVersion(id, { source: 'manual', code: SIGN_CODE.replace('#F2C14E', '#E5533D'), metadata: SIGN_META, report: { ready: report.ready, checks: report.checks, previews: report.previews }, createdBy: null });
    expect(await publishDraft(id, null)).toEqual({ ok: true, assetId: 'custom.lampu-merah', version: '0.2.0' });

    const [latest, first] = await listPublishedAssets();
    expect([latest.entry.version, first.entry.version]).toEqual(['0.2.0', '0.1.0']);
    expect(first.code).toContain('#F2C14E');
    expect(latest.entry).toMatchObject({ renderer: 'Published', styles: ['world'], aliases: ['lampu merah', 'tiang lampu'], published: { draftVersion: 2 } });
  });

  it('offers only the latest active version to new plans, but keeps old and deprecated versions renderable', async () => {
    const id = await draftWith(SIGN_CODE);
    await publishDraft(id, null);
    await reopenDraft(id);
    await publishDraft(id, null);

    const catalog = await loadAssetCatalog();
    expect(catalog.filter((entry) => entry.assetId === 'custom.lampu-merah').map((entry) => entry.version)).toEqual(['0.2.0']);
    expect(catalog.length).toBe(ASSET_REGISTRY.length + 1);
    expect(findAssets('Mobil berhenti di dekat tiang lampu', 'world', catalog).map((match) => match.entry.assetId)).toContain('custom.lampu-merah');

    const plan = {
      schemaVersion: 1, visualPolicy: 'library-first',
      instances: [{ id: 'lamp', assetId: 'custom.lampu-merah', assetVersion: '0.2.0', variant: 'double', props: { state: 'on' } }],
      scenes: [{ id: 'one', layout: 'single', durationSec: 4, narration: 'Lampu menyala.', instances: ['lamp'], focus: [{ instanceId: 'lamp', anchor: 'lamp', label: 'Lampu' }] }],
    };
    expect(validateAssetPlan(plan, catalog).ok).toBe(true);
    expect(validateAssetPlan(plan).ok).toBe(false);

    const roadPlan = {
      schemaVersion: 1, visualPolicy: 'library-first',
      instances: [
        { id: 'road', assetId: 'environment.road', assetVersion: '0.1.0', variant: 'straight' },
        { id: 'car', assetId: 'vehicle.car', assetVersion: '0.1.0', variant: 'electric' },
        { id: 'lamp', assetId: 'custom.lampu-merah', assetVersion: '0.2.0', variant: 'single' },
      ],
      scenes: [{ id: 'stop', layout: 'road', durationSec: 4, narration: 'Mobil berhenti di lampu merah.', instances: ['road', 'car', 'lamp'],
        actions: [{ instanceId: 'road', prop: 'distance', from: 0, to: 300, startSec: 0, endSec: 3, easing: 'ease-out' }] }],
    };
    expect(validateAssetPlan(roadPlan, catalog)).toMatchObject({ ok: true });
    roadPlan.scenes[0].instances = ['road', 'lamp'];
    expect(validateAssetPlan(roadPlan, catalog)).toMatchObject({ ok: false, errors: [expect.stringContaining('needs at least one car')] });

    await setPublishedStatus('custom.lampu-merah', 'deprecated');
    expect((await loadAssetCatalog()).some((entry) => entry.assetId === 'custom.lampu-merah')).toBe(false);
    const [pinned] = await getPublishedVersions([{ assetId: 'custom.lampu-merah', version: '0.1.0' }]);
    expect(pinned.entry.status).toBe('deprecated');
  });

  it('draws published entries only from the components the render entry supplies', async () => {
    const id = await draftWith(SIGN_CODE);
    await publishDraft(id, null);
    const [item] = await listPublishedAssets();
    const component = () => null;
    expect(assetComponent(item.entry)).toBeUndefined();
    expect(assetComponent(item.entry, { 'custom.lampu-merah@0.1.0': component })).toBe(component);
    expect(variantRendererProps(item.entry.renderer, 'double')).toEqual({ variant: 'double' });
  });

  it('positions published assets with a wrapper, because model code may ignore x and y', async () => {
    const id = await draftWith(SIGN_CODE);
    await publishDraft(id, null);
    const [item] = await listPublishedAssets();
    const IgnoresPosition = () => React.createElement('svg', { viewBox: '0 0 760 480' }, React.createElement('circle', { r: 5 }));
    const markup = renderToStaticMarkup(React.createElement('svg', null,
      placeAsset(item.entry, { 'custom.lampu-merah@0.1.0': IgnoresPosition }, { variant: 'single' }, { key: 'lamp', x: 120, y: 40, width: 380, height: 240, overflow: true })));
    expect(markup).toMatch(/^<svg><svg x="120" y="40" width="380" height="240" viewBox="0 0 760 480" style="width:380px;height:240px;overflow:visible"><svg viewBox="0 0 760 480">/);
    expect(() => placeAsset(item.entry, {}, {}, { key: 'x', x: 0, y: 0, width: 1, height: 1 })).toThrow('No component for custom.lampu-merah@0.1.0');
  });
});
