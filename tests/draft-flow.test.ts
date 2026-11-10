import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_USER } from './setup-auth';
import { generateMainVideoCode, generateSceneFile } from '@/lib/pipeline/coder-agent';
import { mapWithConcurrency } from '@/lib/pipeline/concurrency';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { compileVirtualProject } from '@/lib/runtime/browser-compiler';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { POST as createProject } from '@/app/api/projects/route';
import { POST as generateProject } from '@/app/api/projects/[projectId]/generate/route';
import { POST as reviewObjectDraft } from '@/app/api/projects/[projectId]/object-draft/route';
import { PATCH as updateDraft } from '@/app/api/projects/[projectId]/storyboard/route';
import { GET as projectEvents } from '@/app/api/projects/[projectId]/events/route';
import { POST as projectRender } from '@/app/api/projects/[projectId]/render/route';
import { readExportStream } from '@/lib/render/export-stream';
import { PUT as updateProject } from '@/app/api/projects/[projectId]/route';
import { GET as revisionAllowance, POST as reviseProject } from '@/app/api/projects/[projectId]/revise/route';
import {
  applyDraftUpdate,
  DraftUpdateSchema,
  estimateNarrationSeconds,
  firstSceneWithoutNarration,
  hasFailedScene,
  readyScenes,
  normalizeSceneOrder,
} from '@/lib/pipeline/draft';
import { generateProceduralStoryboard, parseStoryboardFromLLMResponse } from '@/lib/pipeline/director-agent';
import { getProject, saveProject } from '@/lib/storage/project-store';
import { releaseRevision, reserveRevision } from '@/lib/billing/credits';
import { getDb } from '@/lib/db/client';
import type { StudioProject } from '@/types/studio';

const measureStillness = vi.hoisted(() => vi.fn());
const findSceneCrashes = vi.hoisted(() => vi.fn());
vi.mock('@/lib/render/scene-check', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/render/scene-check')>()),
  measureStillness,
  findSceneCrashes,
}));

const created: string[] = [];
const speech = fs.readFileSync(new URL('./fixtures/tts-indonesian.mp3', import.meta.url));
const context = (projectId: string) => ({ params: Promise.resolve({ projectId }) });
const request = (body?: unknown) =>
  new NextRequest('http://localhost/api', { method: 'POST', body: body ? JSON.stringify(body) : undefined });

async function createDraft(preset: 'story-2d' | 'story-svg' = 'story-2d'): Promise<StudioProject> {
  const res = await createProject(request({ prompt: 'Ceritakan perjalanan biji kopi', preset, aspectRatio: '9:16' }));
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

  it('stores a supported voice and rejects an unknown one', () => {
    expect(applyDraftUpdate(storyboard, { title: 'Baru', voice: 'Kore', scenes }).voice).toBe('Kore');
    expect(DraftUpdateSchema.safeParse({ title: 'Baru', voice: 'Tidak Ada', scenes }).success).toBe(false);
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
    expect(estimateNarrationSeconds(Array(24).fill('kata').join(' '))).toBeCloseTo(24 / 2.1 + 0.35);
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

  it('pauses Full SVG for corrections and requires approval of the latest draft', async () => {
    const project = await createDraft('story-svg');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_BASE_URL', 'https://drawing.example/v1');
    const stream = (content: string) => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
    const sceneObjects = project.storyboard.scenes.map((scene) => scene.role === 'cta' ? [] : ['CoffeeBean']);
    const plan = (fill: string) => ({
      world: { label: 'Dapur', description: 'A warm kitchen', groundY: 700 },
      objects: [{ name: 'CoffeeBean', label: 'Biji kopi', description: `A ${fill} coffee bean`, width: 300, height: 200, props: [], closeups: [] }],
      sceneObjects,
    });
    const world = '```tsx\n/** WorldBase */\nfunction WorldBase() { return <g><rect x={-1000} y={-1000} width={3000} height={3000} fill="#eeddcc" /></g>; }\n```';
    const bean = (fill: string) => `\`\`\`tsx\n/** CoffeeBean 300x200 */\nfunction CoffeeBean() { return <g><ellipse cy={-100} rx={150} ry={100} fill="${fill}" /></g>; }\n\`\`\``;
    let fill = 'brown';
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      const system: string = body.messages[0].content;
      if (system.includes('strict art director')) {
        return stream(JSON.stringify({ imageVisible: true, items: [{ name: 'WorldBase', score: 8, issues: [] }, { name: 'CoffeeBean', score: 8, issues: [] }] }));
      }
      if (system.includes('Revise this existing plan')) {
        fill = 'red';
        return stream(JSON.stringify({ plan: plan('red'), redraw: ['CoffeeBean'] }));
      }
      if (system.startsWith('You are the art director')) return stream(JSON.stringify(plan(fill)));
      if (system.includes('fixed setting')) return stream(world);
      return stream(bean(fill));
    });

    expect((await generateProject(request(), context(project.id))).status).toBe(202);
    const pending = await vi.waitFor(() => {
      const saved = getProject(project.id)!;
      expect(saved.storySvgReviewPending).toBe(true);
      return saved;
    });
    expect(pending.status).toBe('idle');
    expect(pending.files).toEqual({});
    // Plan, setting, one object, and one review.
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(pending.storySvgDraft?.plan?.objects[0].label).toBe('Biji kopi');
    expect(pending.storySvgDraftProgress).toBeUndefined();
    expect((await generateProject(request(), context(project.id))).status).toBe(409);
    expect((await projectRender(request(), context(project.id))).status).toBe(409);

    const corrected = await reviewObjectDraft(request({
      action: 'revise', version: pending.updatedAt, instruction: 'Ubah warna biji kopi menjadi merah.',
    }), context(project.id));
    expect(corrected.status).toBe(200);
    const { project: revised } = await corrected.json();
    expect(revised.storySvgDraft.sharedWorld).toContain('fill="red"');
    expect(revised.storySvgReviewPending).toBe(true);
    expect((await reviewObjectDraft(request({ action: 'approve', version: pending.updatedAt }), context(project.id))).status).toBe(409);

    vi.stubEnv('OPENAI_API_KEY', '');
    expect((await reviewObjectDraft(request({ action: 'approve', version: revised.updatedAt }), context(project.id))).status).toBe(202);
    const result = await finished(project.id);
    expect(result.storySvgReviewPending).toBeUndefined();
    expect(result.storySvgDraft?.sharedWorld).toContain('fill="red"');
  });

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

  it('preserves the full SVG preset through draft, generation, and manual edits', async () => {
    const project = await createDraft('story-svg');
    expect(project.storyboard.preset).toBe('story-svg');
    await generateProject(request(), context(project.id));
    const result = await finished(project.id);
    expect(result.storyboard.preset).toBe('story-svg');
    expect(Object.values(result.sceneProgress ?? {}).every(scene => scene.stage === 'ready')).toBe(true);
    for (const [name, code] of Object.entries(result.files)) {
      expect(validateSceneCode(code, name, { svgOnly: true }).errors).toEqual([]);
    }
    expect(Object.values(result.files).join('')).not.toContain('ImageStage');
    const res = await updateProject(new NextRequest('http://localhost/api', {
      method: 'PUT', body: JSON.stringify({ files: { 'Scene1.tsx': 'export default () => <img src="/image.png" />;' } }),
    }), context(project.id));
    expect(res.status).toBe(400);
    expect(getProject(project.id)?.files['Scene1.tsx']).toBe(result.files['Scene1.tsx']);
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

  const generateToEnd = async (preset: 'story-2d' | 'story-svg' = 'story-2d') => {
    const project = await createDraft(preset);
    await generateProject(request(), context(project.id));
    return vi.waitFor(() => {
      const saved = getProject(project.id)!;
      if (saved.status !== 'ready') throw new Error('still running');
      return saved;
    });
  };

  it('reports long still stretches in the editor chat', async () => {
    measureStillness.mockResolvedValueOnce([{ from: 12, to: 18.5, seconds: 6.5 }]);
    const finished = await generateToEnd();
    expect(finished.stillStretches).toEqual([{ from: 12, to: 18.5, seconds: 6.5 }]);
    expect(finished.chatHistory.at(-1)?.content).toContain('detik 12,0–18,5');
  });

  it('finishes the video when the stillness check breaks, without claiming a result', async () => {
    measureStillness.mockRejectedValueOnce(new Error('browser gone'));
    const finished = await generateToEnd();
    expect(finished.generationError).toBeUndefined();
    expect(finished.stillStretches).toBeUndefined();
    expect(finished.checkingScenes).toBeUndefined();
    expect(finished.chatHistory.at(-1)?.content).not.toContain('hampir diam');
  });

  it('leaves Full SVG unmeasured, since its small actions read as still', async () => {
    measureStillness.mockClear();
    const finished = await generateToEnd('story-svg');
    expect(measureStillness).not.toHaveBeenCalled();
    expect(finished.stillStretches).toBeUndefined();
  });

  it('marks every scene failed when a 3D world cannot be made, then allows a retry', async () => {
    // Isometrik is admin-only while in development.
    vi.stubEnv('ADMIN_EMAILS', TEST_USER.email);
    const res = await createProject(request({ prompt: 'Ceritakan perjalanan biji kopi', preset: 'world', aspectRatio: '9:16' }));
    const { project } = await res.json();
    created.push(project.id);
    expect(project.storyboard.preset).toBe('world');

    expect((await generateProject(request(), context(project.id))).status).toBe(202);
    const finished = await vi.waitFor(() => {
      const saved = getProject(project.id)!;
      if (saved.status !== 'ready') throw new Error('still running');
      return saved;
    }, { timeout: 5000 });

    const stages = Object.values(finished.sceneProgress ?? {}).map((scene) => scene.stage);
    expect(new Set(stages)).toEqual(new Set(['failed']));
    expect(finished.generationError).toContain('gagal');
    expect(finished.files['MainVideo.tsx']).toBeUndefined();
    expect(finished.storyboard.scenes.every((scene) => scene.audioUrl)).toBe(true);

    const audioCalls = vi.mocked(fetch).mock.calls.length;
    expect((await generateProject(request(), context(project.id))).status).toBe(202);
    await vi.waitFor(() => {
      if (getProject(project.id)!.status !== 'ready') throw new Error('still running');
    }, { timeout: 5000 });
    expect(vi.mocked(fetch).mock.calls.length).toBe(audioCalls);
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
    await expect(readExportStream(res, () => undefined)).rejects.toThrow();
    expect(getProject(project.id)?.status).toBe('ready');
  }, 60_000);

  it('blocks manual edits while scenes are generating', async () => {
    const project = await createDraft();
    saveProject({ ...project, status: 'generating' });
    const res = await updateProject(new NextRequest('http://localhost/api', { method: 'PUT', body: '{}' }), context(project.id));
    expect(res.status).toBe(409);
  });

  describe('chat revision render check', () => {
    const sceneCode = 'export default function Scene1() { return <div style={{ color: "#38BDF8" }}>Halo</div>; }';
    async function readyProject() {
      const project = await createDraft();
      saveProject({ ...project, status: 'ready', files: { ...project.files, 'Scene1.tsx': sceneCode } });
      return project;
    }
    const revise = (project: StudioProject, userMessage: string) =>
      reviseProject(request({ userMessage, sceneId: project.storyboard.scenes[0].id }), context(project.id));
    const lastReply = (projectId: string) => getProject(projectId)?.chatHistory.at(-1)?.content ?? '';

    beforeEach(() => findSceneCrashes.mockReset().mockResolvedValue([]));

    it('keeps a revision that renders and checks only that scene', async () => {
      const project = await readyProject();
      const res = await revise(project, 'ganti warna jadi emas');
      expect((await res.json()).revisionOutcome).toBe('ok');
      expect(findSceneCrashes).toHaveBeenCalledWith(expect.anything(), [0]);
      expect(getProject(project.id)?.files['Scene1.tsx']).toContain('#F59E0B');
      expect(lastReply(project.id)).toContain('lolos cek render');
    });

    it('restores the previous scene when the revision crashes and cannot be repaired', async () => {
      const project = await readyProject();
      findSceneCrashes.mockResolvedValue([{ index: 0, message: 'boom' }]);
      const res = await revise(project, 'ganti warna jadi emas');
      expect((await res.json()).revisionOutcome).toBe('reverted');
      expect(getProject(project.id)?.files['Scene1.tsx']).toBe(sceneCode);
      expect(lastReply(project.id)).toContain('dikembalikan ke versi sebelumnya');
    });

    it('says so when the AI changed nothing', async () => {
      const project = await readyProject();
      const res = await revise(project, 'buat lebih dramatis');
      expect((await res.json()).revisionOutcome).toBe('unchanged');
      expect(findSceneCrashes).not.toHaveBeenCalled();
      expect(lastReply(project.id)).toContain('tidak berubah');
    });

    it('revises every finished scene when none is chosen, and counts each one', async () => {
      const project = await createDraft();
      const files = Object.fromEntries(project.storyboard.scenes.map((_, i) => [`Scene${i + 1}.tsx`, sceneCode.replace('Scene1', `Scene${i + 1}`)]));
      saveProject({ ...project, status: 'ready', files: { ...project.files, ...files } });
      const res = await reviseProject(request({ userMessage: 'ganti warna aksen jadi emas' }), context(project.id));
      const body = await res.json();
      const count = project.storyboard.scenes.length;
      expect(body.scenes).toHaveLength(count);
      expect(body.scenes.every((scene: { outcome: string }) => scene.outcome === 'ok')).toBe(true);
      expect(findSceneCrashes).toHaveBeenCalledTimes(1);
      expect(findSceneCrashes).toHaveBeenCalledWith(expect.anything(), project.storyboard.scenes.map((_, i) => i));
      for (let i = 0; i < count; i++) expect(getProject(project.id)?.files[`Scene${i + 1}.tsx`]).toContain('#F59E0B');
      expect(body.revisionsLeft).toBe(20 - count);
    });

    it('targets the one scene a message names', async () => {
      const project = await readyProject();
      const res = await reviseProject(request({ userMessage: 'adegan 1 warnanya jadi emas' }), context(project.id));
      expect((await res.json()).scenes.map((scene: { index: number }) => scene.index)).toEqual([0]);
    });

    it('stops at the revision allowance, and a released reservation is given back', async () => {
      const project = await readyProject();
      for (let i = 0; i < 20; i++) expect((await revise(project, 'buat lebih dramatis')).status).toBe(200);
      const blocked = await revise(project, 'ganti warna jadi emas');
      expect(blocked.status).toBe(402);
      expect(await blocked.json()).toMatchObject({ code: 'revision_limit', revisionsLeft: 0 });

      const other = await readyProject();
      const user = await getDb().first<{ user_id: string }>('SELECT user_id FROM revision_usage LIMIT 1');
      const reservation = await reserveRevision(user!.user_id, other.id, 3);
      expect(reservation.left).toBe(17);
      await releaseRevision(reservation.id!);
      expect((await (await revisionAllowance(new NextRequest('http://localhost/api'), context(other.id))).json()).revisionsLeft).toBe(20);
    });
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
