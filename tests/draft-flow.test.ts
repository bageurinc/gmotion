import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapWithConcurrency } from '@/lib/pipeline/concurrency';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { POST as createProject } from '@/app/api/projects/route';
import { POST as generateProject } from '@/app/api/projects/[projectId]/generate/route';
import { PATCH as updateDraft } from '@/app/api/projects/[projectId]/storyboard/route';
import {
  applyDraftUpdate,
  estimateNarrationSeconds,
  firstSceneWithoutNarration,
  isGenerationStale,
  normalizeSceneOrder,
} from '@/lib/pipeline/draft';
import { generateProceduralStoryboard, parseStoryboardFromLLMResponse } from '@/lib/pipeline/director-agent';
import { getProject, saveProject } from '@/lib/storage/project-store';
import type { StudioProject } from '@/types/studio';

const created: string[] = [];
const speech = fs.readFileSync(new URL('./fixtures/tts-indonesian.mp3', import.meta.url));
const context = (projectId: string) => ({ params: Promise.resolve({ projectId }) });
const request = (body?: unknown) =>
  new NextRequest('http://localhost/api', { method: 'POST', body: body ? JSON.stringify(body) : undefined });

async function createDraft(): Promise<StudioProject> {
  const res = await createProject(request({ prompt: 'Ceritakan perjalanan biji kopi', preset: 'story-2d', aspectRatio: '9:16' }));
  const { project } = await res.json();
  created.push(project.id);
  return project;
}

const toUpdate = (project: StudioProject) => ({
  title: project.storyboard.title,
  scenes: project.storyboard.scenes.map(({ id, title, voiceoverText, kineticHeadline, visualPrompt }) => ({
    id,
    title,
    voiceoverText,
    kineticHeadline,
    visualPrompt,
  })),
});

describe('draft helpers', () => {
  const storyboard = generateProceduralStoryboard('Topik uji', 'story-2d', '9:16');
  const scenes = storyboard.scenes.map(({ id, title, voiceoverText, kineticHeadline, visualPrompt }) => ({
    id,
    title,
    voiceoverText,
    kineticHeadline,
    visualPrompt,
  }));

  it('keeps technical scene fields while reordering', () => {
    const updated = applyDraftUpdate(storyboard, { title: 'Baru', scenes: [...scenes].reverse() });
    expect(updated.scenes[0].id).toBe(storyboard.scenes[3].id);
    expect(updated.scenes[0].cameraAction).toBe(storyboard.scenes[3].cameraAction);
    expect(updated.scenes[0].order).toBe(1);
  });

  it('gives new scenes safe defaults', () => {
    const updated = applyDraftUpdate(storyboard, {
      title: 'Baru',
      scenes: [...scenes, { id: 'scene-new-1', title: 'Baru', voiceoverText: 'Halo', kineticHeadline: '', visualPrompt: '' }],
    });
    expect(updated.scenes[4].role).toBe('narrative');
  });

  it('matches ids to the final order', () => {
    const reversed = { ...storyboard, scenes: [...storyboard.scenes].reverse() };
    expect(normalizeSceneOrder(reversed).scenes[0].id).toBe(`scene-1-${storyboard.scenes[3].role}`);
  });

  it('finds scenes without narration', () => {
    expect(firstSceneWithoutNarration([{ voiceoverText: 'ada' }, { voiceoverText: '  ' }])).toBe(1);
  });

  it('estimates narration time from word count', () => {
    expect(estimateNarrationSeconds('')).toBe(0);
    expect(estimateNarrationSeconds('satu')).toBe(3);
    expect(estimateNarrationSeconds(Array(24).fill('kata').join(' '))).toBeCloseTo(10.35);
  });

  it('treats an old generating job as stale', () => {
    const project = { status: 'generating', generationStartedAt: 0 } as StudioProject;
    expect(isGenerationStale(project, 16 * 60_000)).toBe(true);
    expect(isGenerationStale(project, 60_000)).toBe(false);
  });
});

describe('topic-driven storyboard', () => {
  const stages = Array.from({ length: 14 }, (_, index) => ({
    title: `Tahap ${index + 1}`,
    voiceoverText: 'Narasi',
    kineticHeadline: 'Teks',
    visualPrompt: 'Visual',
  }));

  it('keeps every stage as a narrative scene', () => {
    const text = JSON.stringify({ scenes: stages.slice(0, 9) });
    const storyboard = parseStoryboardFromLLMResponse(text, 'Cara membangun gedung', 'story-2d', '9:16');
    expect(storyboard?.scenes).toHaveLength(9);
    expect(storyboard?.scenes.every((scene) => scene.role === 'narrative')).toBe(true);
    expect(storyboard?.scenes[8].title).toBe('Tahap 9');
  });

  it('caps oversized storyboards', () => {
    const storyboard = parseStoryboardFromLLMResponse(JSON.stringify({ scenes: stages }), 'Topik', 'story-2d', '9:16');
    expect(storyboard?.scenes).toHaveLength(12);
  });
});

describe('draft review flow', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('TTS_PROVIDER', '9router');
    vi.stubEnv('TTS_BASE_URL', 'https://tts.example/v1');
    vi.stubEnv('TTS_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(new Uint8Array(speech))));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    for (const id of created.splice(0)) {
      fs.rmSync(path.join(process.cwd(), 'storage', 'projects', id), { recursive: true, force: true });
    }
  });

  it('creates a draft without audio or code', async () => {
    const project = await createDraft();
    expect(project.status).toBe('draft');
    expect(project.files).toEqual({});
    expect(fetch).not.toHaveBeenCalled();
  });

  it('saves edits and generates from the edited draft', async () => {
    const project = await createDraft();
    const update = toUpdate(project);
    update.scenes[0].voiceoverText = 'Narasi hasil revisi user.';
    update.scenes.reverse();
    const saved = await updateDraft(request(update), context(project.id));
    expect(saved.status).toBe(200);

    const res = await generateProject(request(), context(project.id));
    expect(res.status).toBe(200);
    const result = getProject(project.id) as StudioProject;
    expect(result.status).toBe('ready');
    expect(result.storyboard.scenes[3].voiceoverText).toBe('Narasi hasil revisi user.');
    expect(result.storyboard.scenes[0].id).toMatch(/^scene-1-/);
    expect(result.files['MainVideo.tsx']).toBeDefined();
  });

  it('blocks generation when a scene has no narration', async () => {
    const project = await createDraft();
    const update = toUpdate(project);
    update.scenes[1].voiceoverText = ' ';
    await updateDraft(request(update), context(project.id));
    const res = await generateProject(request(), context(project.id));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Adegan 2');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns to draft with a message when generation fails', async () => {
    const project = await createDraft();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('down', { status: 503 })));
    const res = await generateProject(request(), context(project.id));
    expect(res.status).toBe(500);
    const result = getProject(project.id) as StudioProject;
    expect(result.status).toBe('draft');
    expect(result.generationError).toContain('503');
  });

  it('rejects draft edits after generation', async () => {
    const project = await createDraft();
    saveProject({ ...project, status: 'ready' });
    const res = await updateDraft(request(toUpdate(project)), context(project.id));
    expect(res.status).toBe(409);
  });
});

describe('mapWithConcurrency', () => {
  it('keeps result order and respects the limit', async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency([30, 5, 20, 1, 10], 2, async (delay, index) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, delay));
      active -= 1;
      return index;
    });
    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });
});
