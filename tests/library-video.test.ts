import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db/client';
import { buildLibraryFiles } from '@/lib/pipeline/library-video';
import { completionMessage } from '@/lib/pipeline/generation-job';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { compileVirtualProject } from '@/lib/runtime/browser-compiler';
import { addVersion, createDraftFromRequest, listRequestedAssets } from '@/lib/assets/library-db';
import { checkDraft } from '@/lib/assets/draft-runtime';
import { publishDraft } from '@/lib/assets/published';
import type { StudioProject } from '@/types/studio';
import { SIGN_CODE, SIGN_META } from './fixtures/draft-sign';

const chat = vi.hoisted(() => vi.fn());
vi.mock('@/lib/explainer/asset-generator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/explainer/asset-generator')>()),
  callChat: chat,
}));

vi.mock('@/lib/pipeline/library-environment', () => ({
  buildLibraryEnvironment: vi.fn(async () => ({
    code: "import React from 'react'; export default function Environment() { return <svg viewBox=\"0 0 760 480\"><rect width={760} height={480} fill=\"#aabb99\" /></svg>; }",
    placement: { x: -1800, y: -1800, scale: 10 },
  })),
}));

const project = (narration: string[], prompt = 'Mobil berhenti di dekat tiang lampu'): StudioProject => ({
  id: 'proj_library_test', ownerId: 'user_test', createdAt: 1, updatedAt: 1, userPrompt: prompt, files: {}, chatHistory: [], status: 'generating',
  visualPolicy: 'library-first',
  storyboard: {
    title: 'Uji', preset: 'world', aspectRatio: '9:16', fps: 30, bgmTrack: 'warm-acoustic',
    scenes: narration.map((text, index) => ({ id: `scene-${index + 1}`, voiceoverText: text, durationInFrames: 120, audioUrl: `/api/projects/proj_library_test/assets/s${index}.wav` })),
  } as unknown as StudioProject['storyboard'],
});

const reply = (plan: unknown) => ({ text: JSON.stringify(plan), finishReason: 'stop', usage: {} });
const scene = (id: string, extra: Record<string, unknown>) => ({ id, layout: 'single', durationSec: 9, narration: 'model text that must be replaced', set: [], focus: [], actions: [], ...extra });

beforeEach(async () => {
  chat.mockReset();
  for (const table of ['published_assets', 'asset_draft_versions', 'asset_drafts', 'asset_requests']) await getDb().run(`DELETE FROM ${table}`);
});

async function publishSign() {
  const { draft } = await createDraftFromRequest({ subject: 'tiang lampu', preset: 'world' }, null);
  const report = checkDraft(SIGN_CODE, SIGN_META);
  await addVersion(draft.id, { source: 'manual', code: SIGN_CODE, metadata: SIGN_META, report: { ready: report.ready, checks: report.checks, previews: report.previews }, createdBy: null });
  await publishDraft(draft.id, null);
}

describe('library-first isometric videos', () => {
  it('builds a composition from code and published assets, locked to the approved narration', async () => {
    await publishSign();
    chat.mockResolvedValueOnce(reply({
      schemaVersion: 1, visualPolicy: 'library-first', unsupported: [],
      instances: [
        { id: 'car', assetId: 'vehicle.car', assetVersion: '0.1.0', variant: 'electric', props: {} },
        { id: 'lamp', assetId: 'custom.tiang-lampu', assetVersion: '0.1.0', variant: 'single', props: {} },
      ],
      scenes: [
        scene('scene-1', { instances: ['car'], actions: [{ instanceId: 'car', prop: 'hoodOpen', from: 0, to: 1, startSec: 1, endSec: 8 }] }),
        scene('scene-2', { instances: ['lamp'], set: [{ instanceId: 'lamp', props: { state: 'on' } }], focus: [{ instanceId: 'lamp', anchor: 'lamp', label: 'Lampu' }] }),
      ],
    }));

    const result = await buildLibraryFiles('model', project(['Mobil listrik membuka kap.', 'Tiang lampu menyala.']));
    if (!result.used) throw new Error(result.report.fallbackReason);
    expect(result.report.assets).toEqual(['vehicle.car@0.1.0', 'custom.tiang-lampu@0.1.0']);
    expect(Object.keys(result.files).sort()).toEqual(['Asset1.tsx', 'Environment.tsx', 'MainVideo.tsx']);
    expect(validateSceneCode(result.files['MainVideo.tsx'], 'MainVideo.tsx').errors).toEqual([]);

    const data = JSON.parse(/const data = (\{.*\});/.exec(result.files['MainVideo.tsx'])![1]);
    expect(data.plan.scenes.map((item: { narration: string; durationSec: number }) => [item.narration, item.durationSec])).toEqual([['Mobil listrik membuka kap.', 4], ['Tiang lampu menyala.', 4]]);
    // Action times scale with the real duration (9 s planned → 4 s of audio).
    expect(data.plan.scenes[0].actions[0]).toMatchObject({ startSec: 1 * 4 / 9, endSec: 8 * 4 / 9 });
    expect(data.audio[0]).toBe('/api/projects/proj_library_test/assets/s0.wav');
    expect(chat.mock.calls[0][0].content).toContain('custom.tiang-lampu');

    // The browser preview resolves the published file and the draft kit import.
    expect(typeof compileVirtualProject(result.files)).toBe('function');
  });

  it('falls back and logs demand when the narration needs something the library lacks', async () => {
    chat.mockResolvedValueOnce(reply({
      schemaVersion: 1, visualPolicy: 'library-first',
      unsupported: [{ subject: 'SPBU', kind: 'environment', reason: 'No fuel station asset' }],
      instances: [{ id: 'car', assetId: 'vehicle.car', assetVersion: '0.1.0', variant: 'petrol' }],
      scenes: [scene('scene-1', { instances: ['car'], actions: [{ instanceId: 'car', prop: 'hoodOpen', from: 0, to: 1, startSec: 0, endSec: 2 }] })],
    }));
    const result = await buildLibraryFiles('model', project(['Mobil bensin mengisi bahan bakar di SPBU.'], 'Mobil bensin isi bensin'));
    expect(result).toMatchObject({ used: false, report: { fallbackReason: expect.stringContaining('spbu') } });
    expect((await listRequestedAssets())[0]).toMatchObject({ subject: 'spbu', preset: 'world', count: 1 });
  });

  it('keeps the library when gaps touch at most half the scenes, and names them in the editor', async () => {
    const plan = (sceneIds: string[]) => ({
      schemaVersion: 1, visualPolicy: 'library-first',
      unsupported: [{ subject: 'Keran rumah', kind: 'object', reason: 'No tap asset', sceneIds }],
      instances: [{ id: 'car', assetId: 'vehicle.car', assetVersion: '0.1.0', variant: 'petrol' }],
      scenes: ['scene-1', 'scene-2', 'scene-3'].map((id) => scene(id, { instances: ['car'], actions: [{ instanceId: 'car', prop: 'hoodOpen', from: 0, to: 1, startSec: 0, endSec: 2 }] })),
    });
    const story = project(['Mobil bensin membuka kap.', 'Mesin bekerja.', 'Air keran mencuci mobil.'], 'Mesin mobil bensin');

    chat.mockResolvedValueOnce(reply(plan(['scene-3'])));
    const partial = await buildLibraryFiles('model', story);
    expect(partial).toMatchObject({ used: true, report: { used: true, unsupported: [{ subject: 'keran rumah', sceneIds: ['scene-3'] }] } });
    expect((await listRequestedAssets())[0]).toMatchObject({ subject: 'keran rumah', count: 1 });
    expect(chat.mock.calls[0][0].system).toContain('closest relevant registered asset');
    const message = completionMessage({ ...story, libraryReport: partial.report });
    expect(message).toContain('Belum ada aset untuk keran rumah, jadi adegan 3 memakai aset terdekat');

    chat.mockResolvedValueOnce(reply(plan(['scene-2', 'scene-3'])));
    expect(await buildLibraryFiles('model', story)).toMatchObject({ used: false, report: { fallbackReason: expect.stringContaining('Lebih dari separuh adegan') } });
  });

  it('draws a simple missing object for the video and plans again with it', async () => {
    const carScene = (id: string) => scene(id, { instances: ['car'], actions: [{ instanceId: 'car', prop: 'hoodOpen', from: 0, to: 1, startSec: 0, endSec: 2 }] });
    const first = {
      schemaVersion: 1, visualPolicy: 'library-first',
      unsupported: [{ subject: 'Keran', kind: 'object', reason: 'No tap asset', sceneIds: ['scene-2'] }, { subject: 'mengalir deras', kind: 'action', sceneIds: ['scene-2'] }],
      instances: [{ id: 'car', assetId: 'vehicle.car', assetVersion: '0.1.0', variant: 'petrol' }],
      scenes: [carScene('scene-1'), carScene('scene-2')],
    };
    const second = {
      ...first,
      unsupported: [{ subject: 'mengalir deras', kind: 'action', sceneIds: ['scene-2'] }],
      instances: [...first.instances, { id: 'tap', assetId: 'drawn.keran', assetVersion: '0.0.0', variant: 'single' }],
      scenes: [carScene('scene-1'), scene('scene-2', { instances: ['tap'], set: [{ instanceId: 'tap', props: { state: 'on' } }] })],
    };
    chat.mockImplementation(async ({ system, content }: { system: string; content: string }) => {
      if (system.includes('You draw reusable SVG assets')) {
        expect(content).toContain('Subject (Indonesian): "keran"');
        return { text: `\`\`\`json\n${JSON.stringify(SIGN_META)}\n\`\`\`\n\`\`\`tsx\n${SIGN_CODE}\`\`\``, finishReason: 'stop', usage: {} };
      }
      return reply(content.includes('drawn.keran') ? second : first);
    });

    const result = await buildLibraryFiles('model', project(['Mobil bensin membuka kap.', 'Air dari keran mengalir.'], 'Mesin mobil bensin'));
    chat.mockReset();
    if (!result.used) throw new Error(result.report.fallbackReason);
    expect(result.report).toMatchObject({ assets: ['vehicle.car@0.1.0'], generated: ['Tiang lampu contoh'], unsupported: [{ subject: 'mengalir deras' }] });
    expect(Object.keys(result.files).sort()).toEqual(['Asset1.tsx', 'Environment.tsx', 'MainVideo.tsx']);
    expect(result.files['MainVideo.tsx']).toContain('"drawn.keran@0.0.0": Asset1');
    expect((await listRequestedAssets()).map((row) => row.subject).sort()).toEqual(['keran', 'mengalir deras']);
    expect(typeof compileVirtualProject(result.files)).toBe('function');
  });

  it('logs the main visual needs of a topic with no matching asset, without planning', async () => {
    chat.mockResolvedValueOnce({ text: 'Berikut: [{"subject":"Jantung","kind":"object"},{"subject":"aliran darah","kind":"action"},{"subject":"x","kind":"object"},{"subject":"rumah sakit","kind":"place"}]', finishReason: 'stop', usage: {} });
    const result = await buildLibraryFiles('model', project(['Jantung memompa darah ke seluruh tubuh.'], 'Bagaimana jantung bekerja'));
    expect(result).toMatchObject({ used: false, report: { fallbackReason: expect.stringContaining('Belum ada aset'), unsupported: [{ subject: 'jantung', kind: 'object' }, { subject: 'aliran darah', kind: 'action' }] } });
    expect(chat).toHaveBeenCalledTimes(1);
    expect(chat.mock.calls[0][0].content).toContain('Jantung memompa darah');
    expect((await listRequestedAssets()).map((row) => row.subject).sort()).toEqual(['aliran darah', 'jantung']);
  });

  it('still falls back cleanly when need extraction fails', async () => {
    chat.mockRejectedValueOnce(new Error('router down'));
    const result = await buildLibraryFiles('model', project(['Jantung memompa darah.'], 'Bagaimana jantung bekerja'));
    expect(result).toMatchObject({ used: false, report: { unsupported: [] } });
    expect(await listRequestedAssets()).toEqual([]);
  });

  it('retries with the errors when the plan breaks the scene count', async () => {
    const good = {
      schemaVersion: 1, visualPolicy: 'library-first', unsupported: [],
      instances: [{ id: 'car', assetId: 'vehicle.car', assetVersion: '0.1.0', variant: 'petrol' }],
      scenes: [scene('scene-1', { instances: ['car'], actions: [{ instanceId: 'car', prop: 'hoodOpen', from: 0, to: 1, startSec: 0, endSec: 2 }] })],
    };
    chat.mockResolvedValueOnce(reply({ ...good, scenes: [...good.scenes, scene('extra', { instances: ['car'] })] })).mockResolvedValueOnce(reply(good));
    const result = await buildLibraryFiles('model', project(['Mobil bensin membuka kap mesin.'], 'Mesin mobil bensin'));
    expect(result.used).toBe(true);
    expect(chat.mock.calls[1][0].content).toContain('exactly 1');
  });
});
