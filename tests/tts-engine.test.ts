import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateSceneAudio,
  estimateWordTimings,
  createFallbackAudioBuffer,
} from '../src/lib/pipeline/tts-engine';
import { SceneSpec } from '../src/types/studio';
import * as musicMetadata from 'music-metadata';
import fs from 'node:fs';

const speechFixture = fs.readFileSync(new URL('./fixtures/tts-indonesian.mp3', import.meta.url));

describe('Stage 2: Audio-First TTS Engine', () => {
  beforeEach(() => {
    vi.stubEnv('TTS_PROVIDER', '9router');
    vi.stubEnv('TTS_BASE_URL', 'https://tts.example/v1');
    vi.stubEnv('TTS_API_KEY', 'test-key');
    vi.stubEnv('TTS_MODEL', 'edge-tts/id-ID-ArdiNeural');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      new Uint8Array(speechFixture),
      { headers: { 'Content-Type': 'audio/mpeg' } },
    )));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('creates valid PCM WAV buffer with accurate duration', async () => {
    const duration = 2.5;
    const buffer = createFallbackAudioBuffer(duration);
    expect(buffer.length).toBeGreaterThan(44);

    const parsed = await musicMetadata.parseBuffer(buffer, { mimeType: 'audio/wav' });
    expect(parsed.format.duration).toBeCloseTo(duration, 1);
  });

  it('generates estimated word timings with startMs and endMs', () => {
    const text = 'Halo selamat datang di gmotion studio';
    const duration = 2.0;
    const timings = estimateWordTimings(text, duration);

    expect(timings.length).toBe(6);
    expect(timings[0].word).toBe('Halo');
    expect(timings[0].startMs).toBeGreaterThanOrEqual(100);
    expect(timings[5].endMs).toBeLessThanOrEqual(duration * 1000);
  });

  it('stores Gemini WAV speech and sends the chosen voice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      new Uint8Array(createFallbackAudioBuffer(4)),
      { headers: { 'Content-Type': 'audio/wav' } },
    )));
    const scene = {
      id: 'wav-scene', order: 1, role: 'narrative', title: 'Suara', voiceoverText: 'Halo dari Gemini.',
      kineticHeadline: 'Suara', visualPrompt: '', cameraAction: 'static', sfxCue: 'none',
      durationInFrames: 0, wordTimings: [],
    } as SceneSpec;
    const result = await generateSceneAudio(scene, { fps: 30, projectId: 'test-wav-voice', voice: 'Puck' });
    expect(result.audioUrl).toContain('wav-scene.wav');
    expect(result.durationInFrames).toBe(Math.ceil((4 + 0.35) * 30));
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string).voice).toBe('Puck');
    fs.rmSync('storage/projects/test-wav-voice', { recursive: true, force: true });
  });

  it('retries a rate-limited speech request', async () => {
    vi.stubEnv('TTS_RETRY_DELAY_MS', '0');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('busy', { status: 502 }))
      .mockResolvedValue(new Response(new Uint8Array(createFallbackAudioBuffer(1)))));
    const scene = {
      id: 'retry-scene', order: 1, role: 'narrative', title: 'Suara', voiceoverText: 'Halo.',
      kineticHeadline: 'Suara', visualPrompt: '', cameraAction: 'static', sfxCue: 'none',
      durationInFrames: 0, wordTimings: [],
    } as SceneSpec;
    await generateSceneAudio(scene, { fps: 30, projectId: 'test-retry-voice' });
    expect(fetch).toHaveBeenCalledTimes(2);
    fs.rmSync('storage/projects/test-retry-voice', { recursive: true, force: true });
  });

  it('calculates durationInFrames locked to audio length + 0.35s breath room', async () => {
    const dummyScene: SceneSpec = {
      id: 'test-scene-1',
      order: 1,
      role: 'hook',
      title: 'Hook Test',
      voiceoverText: 'Ini adalah tes audio narasi suara bahasa indonesia.',
      kineticHeadline: 'Tes Headline',
      visualPrompt: 'Visual test',
      cameraAction: 'macro-zoom-in',
      sfxCue: 'pop',
      durationInFrames: 0,
      wordTimings: [],
    };

    const result = await generateSceneAudio(dummyScene, {
      fps: 30,
      projectId: 'test_project_unit',
    });

    expect(result.audioUrl).toContain('test-scene-1');
    expect(result.audioUrl).toMatch(/\?v=[a-f0-9]{12}$/);
    expect(result.durationInFrames).toBeGreaterThanOrEqual(90);
    const metadata = await musicMetadata.parseBuffer(speechFixture, { mimeType: 'audio/mpeg' }, { duration: true });
    expect(result.durationInFrames).toBe(Math.max(90, Math.ceil((metadata.format.duration! + 0.35) * 30)));
    expect(result.wordTimings.length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith('https://tts.example/v1/audio/speech', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ model: 'edge-tts/id-ID-ArdiNeural', voice: 'id-ID-ArdiNeural', input: dummyScene.voiceoverText, response_format: 'mp3' }),
    }));
  });

  it.each([503, 401])('reports provider HTTP %s instead of creating fake narration', async (status) => {
    vi.mocked(fetch).mockResolvedValue(new Response('upstream failed', { status }));
    const scene = { id: 'failed-tts', voiceoverText: 'Tes suara' } as SceneSpec;
    await expect(generateSceneAudio(scene, { projectId: 'test_project_unit' })).rejects.toThrow(`HTTP ${status}`);
  });

  it('rejects a successful HTTP response that contains no valid audio', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not audio'));
    const scene = { id: 'invalid-tts', voiceoverText: 'Tes suara' } as SceneSpec;
    await expect(generateSceneAudio(scene, { projectId: 'test_project_unit' })).rejects.toThrow();
  });
});
