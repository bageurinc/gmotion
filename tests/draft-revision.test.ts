import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import { applyRevisedDraft, MAX_DRAFT_REVISIONS } from '@/lib/pipeline/draft-revision';
import { getProject, saveProject } from '@/lib/storage/project-store';
import type { Storyboard, StudioProject } from '@/types/studio';
import { TEST_USER } from './setup-auth';

const generateText = vi.hoisted(() => vi.fn());
vi.mock('ai', () => ({ generateText }));
vi.mock('@/lib/ai/llm-client', () => ({ getDirectorModel: () => 'model', getCoderModel: () => 'model', isApiKeyConfigured: () => true }));

const { PATCH, POST } = await import('@/app/api/projects/[projectId]/storyboard/route');

const base: Storyboard = {
  ...generateProceduralStoryboard('Kopi', 'story-2d', '9:16'),
  scenes: generateProceduralStoryboard('Kopi', 'story-2d', '9:16').scenes.map((scene, i) => ({
    ...scene,
    id: `scene-${i + 1}-narrative`,
    role: 'narrative' as const,
    cameraAction: i === 0 ? ('timelapse' as const) : scene.cameraAction,
  })),
};
const answer = (scenes: object[], title = 'Kopi Santai') => JSON.stringify({ title, summary: 'Narasi dibuat lebih santai.', scenes });

describe('applyRevisedDraft', () => {
  it('keeps technical fields of kept scenes, adds new ones, and drops removed ones', () => {
    const result = applyRevisedDraft(base, answer([
      { id: 'scene-2-narrative', title: 'Dua', voiceoverText: 'Narasi baru dua.', kineticHeadline: 'DUA', visualPrompt: 'Visual dua.' },
      { id: 'scene-1-narrative', title: 'Satu', voiceoverText: base.scenes[0].voiceoverText, kineticHeadline: 'SATU', visualPrompt: 'Visual satu.' },
      { id: null, title: 'Baru', voiceoverText: 'Adegan baru.', kineticHeadline: 'BARU', visualPrompt: 'Visual baru.' },
    ]), false)!;
    expect(result.summary).toBe('Narasi dibuat lebih santai.');
    expect(result.storyboard.title).toBe('Kopi Santai');
    expect(result.storyboard.scenes.map((scene) => scene.title)).toEqual(['Dua', 'Satu', 'Baru']);
    expect(result.storyboard.scenes[1].cameraAction).toBe('timelapse');
    expect(result.storyboard.scenes[1].wordTimings).toBe(base.scenes[0].wordTimings);
    expect(result.storyboard.scenes[2].id).toMatch(/^scene-new-/);
    expect(result.storyboard.scenes.map((scene) => scene.order)).toEqual([1, 2, 3]);
  });

  it('only allows a CTA scene when the prompt or instruction asks for one, and rejects broken answers', () => {
    const cta = answer([{ id: null, title: 'Pesan', voiceoverText: 'Pesan sekarang.', role: 'cta' }]);
    expect(applyRevisedDraft(base, cta, false)!.storyboard.scenes[0].role).toBe('narrative');
    expect(applyRevisedDraft(base, cta, true)!.storyboard.scenes[0].role).toBe('cta');
    expect(applyRevisedDraft(base, '{"title":"x","scenes":[]}', false)).toBeNull();
    expect(applyRevisedDraft(base, 'bukan json', false)).toBeNull();
  });

  it('uses each existing id once, so a duplicated id cannot clone a scene', () => {
    const result = applyRevisedDraft(base, answer([
      { id: 'scene-1-narrative', title: 'A', voiceoverText: 'a.' },
      { id: 'scene-1-narrative', title: 'B', voiceoverText: 'b.' },
    ]), false)!;
    expect(result.storyboard.scenes[0].id).toBe('scene-1-narrative');
    expect(result.storyboard.scenes[1].id).toMatch(/^scene-new-/);
  });
});

describe('draft revision route', () => {
  const id = `proj_draftrev_${Date.now()}`;
  const context = { params: Promise.resolve({ projectId: id }) };
  const post = (body: unknown) => POST(new NextRequest('http://localhost/api', { method: 'POST', body: JSON.stringify(body) }), context);
  const reset = (extra: Partial<StudioProject> = {}) => saveProject({
    id, ownerId: TEST_USER.id, createdAt: 1, updatedAt: 1, userPrompt: 'Proses kopi', chatHistory: [], files: {},
    status: 'draft', storyboard: base, ...extra,
  } as StudioProject);
  const revised = answer([{ id: 'scene-1-narrative', title: 'Satu', voiceoverText: 'Kopi itu asyik.' }]);

  beforeEach(() => generateText.mockReset());
  afterAll(() => fs.rmSync(path.join(process.cwd(), 'storage', 'projects', id), { recursive: true, force: true }));

  it('revises the draft, counts it, and can undo it exactly', async () => {
    reset();
    generateText.mockResolvedValueOnce({ text: revised });
    const res = await post({ instruction: 'buat lebih santai dan cukup satu adegan' });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ summary: 'Narasi dibuat lebih santai.', revisionsLeft: MAX_DRAFT_REVISIONS - 1 });
    expect(getProject(id)?.storyboard.scenes).toHaveLength(1);
    expect(generateText.mock.calls[0][0].prompt).toContain('buat lebih santai');

    const undo = await post({ undo: true });
    expect(undo.status).toBe(200);
    expect(getProject(id)?.storyboard).toEqual(base);
    expect((await post({ undo: true })).status).toBe(409);
  });

  it('passes a duration target in the instruction to the model', async () => {
    reset();
    generateText.mockResolvedValueOnce({ text: revised });
    await post({ instruction: 'jadikan video 30 detik' });
    expect(generateText.mock.calls[0][0].prompt).toContain('TARGET DURATION: 30 seconds');
  });

  it('retries one broken answer, then reports failure without counting it', async () => {
    reset();
    generateText.mockResolvedValue({ text: 'bukan json' });
    const res = await post({ instruction: 'buat lebih santai' });
    expect(res.status).toBe(500);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(getProject(id)?.draftRevisionCount ?? 0).toBe(0);
  });

  it('stops at the limit, refuses after generation, and a manual edit ends undo', async () => {
    reset({ draftRevisionCount: MAX_DRAFT_REVISIONS });
    expect((await post({ instruction: 'buat lebih santai' })).status).toBe(429);

    reset({ status: 'ready' });
    expect((await post({ instruction: 'buat lebih santai' })).status).toBe(409);

    reset({ draftBeforeRevision: base });
    const scenes = base.scenes.map(({ id: sceneId, title, voiceoverText, kineticHeadline, visualPrompt }) => ({ id: sceneId, title, voiceoverText, kineticHeadline, visualPrompt }));
    await PATCH(new NextRequest('http://localhost/api', { method: 'PATCH', body: JSON.stringify({ title: 'Manual', scenes }) }), context);
    expect(getProject(id)?.draftBeforeRevision).toBeUndefined();
    expect((await post({ instruction: 'x' })).status).toBe(400);
  });
});
