import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateMainVideoCode, generateSceneFile } from '@/lib/pipeline/coder-agent';
import { mapWithConcurrency } from '@/lib/pipeline/concurrency';
import { compileVirtualProject } from '@/lib/runtime/browser-compiler';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { POST as createProject } from '@/app/api/projects/route';
import { POST as generateProject } from '@/app/api/projects/[projectId]/generate/route';
import { PATCH as updateDraft } from '@/app/api/projects/[projectId]/storyboard/route';
import { GET as projectEvents } from '@/app/api/projects/[projectId]/events/route';
import { POST as projectRender } from '@/app/api/projects/[projectId]/render/route';
import { PUT as updateProject } from '@/app/api/projects/[projectId]/route';
import {
  applyDraftUpdate,
  estimateNarrationSeconds,
  firstSceneWithoutNarration,
  hasFailedScene,
  readyScenes,
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

  it('previews only finished scenes', () => {
    const [first, second] = storyboard.scenes;
    const project = { storyboard, sceneProgress: { [first.id]: { stage: 'ready' as const }, [second.id]: { stage: 'audio' as const } } };
    expect(readyScenes(project).map((scene) => scene.id)).toEqual([first.id]);
    expect(readyScenes({ storyboard }).length).toBe(storyboard.scenes.length);
  });

  it('detects failed scenes', () => {
    expect(hasFailedScene({ sceneProgress: { a: { stage: 'failed' } } })).toBe(true);
    expect(hasFailedScene({ sceneProgress: { a: { stage: 'ready' } } })).toBe(false);
    expect(hasFailedScene({})).toBe(false);
  });
});

describe('partial preview', () => {
  it('compiles a video from only the finished scenes', async () => {
    const storyboard = generateProceduralStoryboard('Topik uji', 'story-2d', '9:16');
    const main = generateMainVideoCode(storyboard, [1]);
    expect(main).toContain('Scene2');
    expect(main).not.toContain('Scene1');
    const files = { 'Scene2.tsx': await generateSceneFile(storyboard, 1), 'MainVideo.tsx': main };
    expect(typeof compileVirtualProject(files, 'MainVideo.tsx')).toBe('function');
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

  const finished = (id: string) =>
    vi.waitFor(() => {
      const project = getProject(id) as StudioProject;
      expect(project.status).toBe('ready');
      return project;
    }, { timeout: 5000, interval: 25 });

  it('saves edits and generates from the edited draft in the background', async () => {
    const project = await createDraft();
    const update = toUpdate(project);
    update.scenes[0].voiceoverText = 'Narasi hasil revisi user.';
    update.scenes.reverse();
    const saved = await updateDraft(request(update), context(project.id));
    expect(saved.status).toBe(200);

    const res = await generateProject(request(), context(project.id));
    expect(res.status).toBe(202);
    expect((await res.json()).project.status).toBe('generating');

    const result = await finished(project.id);
    expect(result.storyboard.scenes[3].voiceoverText).toBe('Narasi hasil revisi user.');
    expect(result.storyboard.scenes[0].id).toMatch(/^scene-1-/);
    expect(Object.values(result.sceneProgress ?? {}).every((scene) => scene.stage === 'ready')).toBe(true);
    expect(result.files['MainVideo.tsx']).toContain('Scene4');
    expect(result.chatHistory).toHaveLength(1);
  });

  it('streams scene progress until the job finishes', async () => {
    const project = await createDraft();
    await generateProject(request(), context(project.id));
    const res = await projectEvents(new NextRequest('http://localhost/api'), context(project.id));
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    const body = await res.text();
    const events = body.split('\n\n').filter((part) => part.startsWith('data:'));
    const last = JSON.parse(events.at(-1)!.slice(5));
    expect(last.project.status).toBe('ready');
    expect(last.interrupted).toBe(false);
  });

  it('reports a generation that lost its job', async () => {
    const project = await createDraft();
    saveProject({ ...project, status: 'generating' });
    const res = await projectEvents(new NextRequest('http://localhost/api'), context(project.id));
    const body = await res.text();
    expect(JSON.parse(body.split('\n\n')[0].slice(5)).interrupted).toBe(true);
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

  it('keeps finished scenes and retries only the failed one', async () => {
    const project = await createDraft();
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      calls += 1;
      return calls === 2 ? new Response('down', { status: 503 }) : new Response(new Uint8Array(speech));
    }));
    await generateProject(request(), context(project.id));
    const partial = await finished(project.id);
    expect(partial.generationError).toContain('1 adegan');
    const stages = Object.values(partial.sceneProgress ?? {}).map((scene) => scene.stage);
    expect(stages.filter((stage) => stage === 'ready')).toHaveLength(3);
    expect(stages).toContain('failed');
    expect((await projectRender(request({ safeAreaPlatform: 'tiktok' }), context(project.id))).status).toBe(409);

    calls = 10;
    const res = await generateProject(request(), context(project.id));
    expect(res.status).toBe(202);
    const complete = await finished(project.id);
    expect(complete.generationError).toBeUndefined();
    expect(calls).toBe(11);
    expect(Object.keys(complete.files).filter((file) => file.startsWith('Scene'))).toHaveLength(4);
  });

  it('leaves the rendering state when an export fails', async () => {
    const project = await createDraft();
    saveProject({ ...project, status: 'ready', files: { 'Scene1.tsx': 'bad <<<' } });
    const res = await projectRender(request({ safeAreaPlatform: 'tiktok' }), context(project.id));
    expect(res.status).toBe(500);
    expect(getProject(project.id)?.status).toBe('ready');
  }, 60_000);

  it('blocks manual edits while scenes are generating', async () => {
    const project = await createDraft();
    saveProject({ ...project, status: 'generating' });
    const res = await updateProject(new NextRequest('http://localhost/api', { method: 'PUT', body: '{}' }), context(project.id));
    expect(res.status).toBe(409);
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
