import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { generateStoryboard } from '../src/lib/pipeline/director-agent';
import { syncStoryboardWithAudio } from '../src/lib/pipeline/tts-engine';
import { generateProjectVirtualFiles, reviseSceneCode } from '../src/lib/pipeline/coder-agent';
import { compileVirtualProject } from '../src/lib/runtime/browser-compiler';
import { saveProject, getProject } from '../src/lib/storage/project-store';
import { StudioProject } from '../src/types/studio';

describe('End-to-End Pipeline Verification', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('TTS_PROVIDER', '9router');
    vi.stubEnv('TTS_BASE_URL', 'https://tts.example/v1');
    vi.stubEnv('TTS_API_KEY', 'test-key');
    const speech = fs.readFileSync(new URL('./fixtures/tts-indonesian.mp3', import.meta.url));
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(new Uint8Array(speech))));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('generates a full Ads UI project, locks frame durations, and compiles in browser compiler', async () => {
    const prompt = 'Buat video iklan FB Ads 15 detik untuk WhatsApp AI Chatbot anti-ghosting closing omzet naik';
    const projectId = 'test_e2e_ads_project';

    // Stage 1: Director
    const storyboard = await generateStoryboard(prompt, 'ads-ui', '9:16');
    expect(storyboard.scenes).toHaveLength(4);
    expect(storyboard.scenes[0].role).toBe('hook');
    expect(storyboard.scenes[3].role).toBe('cta');

    // Stage 2: Audio-first frame sync
    const syncedStoryboard = await syncStoryboardWithAudio(storyboard, projectId);
    expect(syncedStoryboard.scenes[0].durationInFrames).toBeGreaterThanOrEqual(90);
    expect(syncedStoryboard.scenes[0].wordTimings.length).toBeGreaterThan(0);

    // Stage 3 & 4: Coder & Validator
    const files = await generateProjectVirtualFiles(syncedStoryboard);
    expect(files['Scene1.tsx']).toBeDefined();
    expect(files['Scene2.tsx']).toBeDefined();
    expect(files['Scene3.tsx']).toBeDefined();
    expect(files['Scene4.tsx']).toBeDefined();
    expect(files['MainVideo.tsx']).toBeDefined();

    // In-browser Sucrase compiler check
    const MainVideoComponent = compileVirtualProject(files, 'MainVideo.tsx');
    expect(typeof MainVideoComponent).toBe('function');

    // Persistence
    const project: StudioProject = {
      id: projectId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userPrompt: prompt,
      storyboard: syncedStoryboard,
      files,
      chatHistory: [],
      status: 'ready',
    };
    saveProject(project);

    const loaded = getProject(projectId);
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(projectId);

    // Chat revision test on Scene 3
    const scene3Spec = syncedStoryboard.scenes[2];
    const revisedScene3 = await reviseSceneCode(
      files['Scene3.tsx'],
      scene3Spec,
      'Ubah warna aksen di scene 3 jadi emas/gold dan target omzet Rp 120.000.000',
      syncedStoryboard.palette
    );
    expect(revisedScene3).toContain('#F59E0B');
  });

  it('generates a full 2D Illustrated Story project and compiles in browser compiler', async () => {
    const prompt = 'Ceritakan perjalanan biji kopi nusantara dari kebun pegunungan hingga diseduh hangat';
    const projectId = 'test_e2e_story_project';

    // Stage 1: Director
    const storyboard = await generateStoryboard(prompt, 'story-2d', '9:16');
    expect(storyboard.preset).toBe('story-2d');
    expect(storyboard.scenes).toHaveLength(4);

    // Stage 2: Audio-first frame sync
    const syncedStoryboard = await syncStoryboardWithAudio(storyboard, projectId);

    // Stage 3: Coder & Validator
    const files = await generateProjectVirtualFiles(syncedStoryboard);
    expect(files['Scene1.tsx']).toContain('ParallaxWorld');

    // In-browser Sucrase compiler check
    const MainVideoComponent = compileVirtualProject(files, 'MainVideo.tsx');
    expect(typeof MainVideoComponent).toBe('function');
  });
});
