import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { alignmentToWordTimings, listElevenLabsVoices, synthesizeElevenLabs } from '@/lib/audio/elevenlabs';
import { chargeForVideo, creditsForVideo } from '@/lib/billing/credits';
import { DraftUpdateSchema } from '@/lib/pipeline/draft';
import { generateSceneAudio } from '@/lib/pipeline/tts-engine';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import { getDb } from '@/lib/db/client';
import { saveProject } from '@/lib/storage/project-store';
import type { SceneSpec, StudioProject } from '@/types/studio';
import { TEST_USER } from './setup-auth';

const VOICE = 'AbCdEfGhIj1234567890';
const speech = fs.readFileSync(new URL('./fixtures/tts-indonesian.mp3', import.meta.url));
const text = 'Ragi memakan gula, lalu roti mengembang.';
const alignmentFor = (value: string, step = 0.05) => ({
  characters: [...value],
  character_start_times_seconds: [...value].map((_, i) => i * step),
  character_end_times_seconds: [...value].map((_, i) => (i + 1) * step),
});
const ok = (value = text) => new Response(JSON.stringify({ audio_base64: speech.toString('base64'), alignment: alignmentFor(value) }), { status: 200 });

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_API_KEY', 'test-key');
  vi.stubEnv('ELEVENLABS_VOICE_ID', VOICE);
  vi.stubEnv('ELEVENLABS_RETRY_DELAY_MS', '1');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('ElevenLabs word timings', () => {
  it('turns character timings into one timing per narration word', () => {
    const timings = alignmentToWordTimings(text, alignmentFor(text, 0.1));
    expect(timings.map((t) => t.word)).toEqual(['Ragi', 'memakan', 'gula,', 'lalu', 'roti', 'mengembang.']);
    expect(timings[0]).toEqual({ word: 'Ragi', startMs: 0, endMs: 400 });
    expect(timings[1].startMs).toBe(500);
  });

  it('returns nothing when the words do not line up', () => {
    expect(alignmentToWordTimings(text, alignmentFor('Teks lain sama sekali'))).toEqual([]);
    expect(alignmentToWordTimings(text, null)).toEqual([]);
  });
});

describe('ElevenLabs speech', () => {
  it('sends the narration with the voice and model, and records usage', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    const result = await synthesizeElevenLabs(text, VOICE);
    expect(result.audio.length).toBe(speech.length);
    expect(result.wordTimings).toHaveLength(6);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/v1/text-to-speech/${VOICE}/with-timestamps`);
    expect(JSON.parse(String(init.body))).toMatchObject({ text, model_id: 'eleven_multilingual_v2', language_code: 'id' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await getDb().first('SELECT model, characters FROM ai_usage WHERE model = ? ORDER BY created_at DESC', ['elevenlabs/eleven_multilingual_v2']))
      .toEqual({ model: 'elevenlabs/eleven_multilingual_v2', characters: text.length });
  });

  it('explains a key without speech permission and does not retry it', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ detail: { status: 'missing_permissions' } }), { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(synthesizeElevenLabs(text, VOICE)).rejects.toThrow('izin text_to_speech');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a rate limit and rejects a malformed voice id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}', { status: 429 })).mockResolvedValueOnce(ok()));
    await expect(synthesizeElevenLabs(text, VOICE)).resolves.toBeTruthy();
    await expect(synthesizeElevenLabs(text, '../etc')).rejects.toThrow('tidak valid');
  });

  it('offers the configured voice when the key cannot list voices', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    expect(await listElevenLabsVoices()).toEqual([{ id: VOICE, name: 'Suara ElevenLabs' }]);
    vi.stubEnv('ELEVENLABS_API_KEY', '');
    expect(await listElevenLabsVoices()).toEqual([]);
  });

  it('is used by the scene audio step, with its word timings', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    const projectId = `proj_eleven_${Date.now()}`;
    const scene = { ...generateProceduralStoryboard('x', 'story-2d', '9:16').scenes[0], id: 'scene-1-narrative', voiceoverText: text } as SceneSpec;
    try {
      const audio = await generateSceneAudio(scene, { projectId, voice: VOICE, provider: 'elevenlabs' });
      expect(audio.audioUrl).toContain('scene-1-narrative.mp3');
      expect(audio.wordTimings[0]).toEqual({ word: 'Ragi', startMs: 0, endMs: 200 });
    } finally {
      fs.rmSync(path.join(process.cwd(), 'storage', 'projects', projectId), { recursive: true, force: true });
    }
  });
});

describe('ElevenLabs pricing and draft choice', () => {
  const id = `proj_elevencredit_${Date.now()}`;
  afterAll(() => fs.rmSync(path.join(process.cwd(), 'storage', 'projects', id), { recursive: true, force: true }));

  it('costs one extra credit', async () => {
    expect(creditsForVideo({ voiceProvider: 'elevenlabs' })).toBe(2);
    expect(creditsForVideo({})).toBe(1);
    const before = (await getDb().first<{ credits: number }>('SELECT credits FROM users WHERE id = ?', [TEST_USER.id]))!.credits;
    expect(await chargeForVideo(TEST_USER.id, id, 2)).toBe('charged');
    expect((await getDb().first<{ credits: number }>('SELECT credits FROM users WHERE id = ?', [TEST_USER.id]))!.credits).toBe(before - 2);
  });

  it('charges two credits when generating with ElevenLabs, and refuses when it is not configured', async () => {
    const { POST } = await import('@/app/api/projects/[projectId]/generate/route');
    const projectId = `${id}_gen`;
    const storyboard = { ...generateProceduralStoryboard('Kopi', 'story-2d', '9:16'), voice: VOICE, voiceProvider: 'elevenlabs' as const };
    saveProject({ id: projectId, ownerId: TEST_USER.id, createdAt: 1, updatedAt: 1, userPrompt: 'Kopi', chatHistory: [], files: {}, status: 'draft', storyboard } as StudioProject);
    const call = () => POST(new NextRequest('http://localhost/api', { method: 'POST' }), { params: Promise.resolve({ projectId }) });

    vi.stubEnv('ELEVENLABS_API_KEY', '');
    expect((await call()).status).toBe(409);

    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    await call();
    const row = await getDb().first<{ delta: number }>("SELECT delta FROM credit_ledger WHERE reason = 'generate' AND ref = ?", [projectId]);
    expect(row?.delta).toBe(-2);
    fs.rmSync(path.join(process.cwd(), 'storage', 'projects', projectId), { recursive: true, force: true });
  });

  it('validates voices per provider', () => {
    const base = { title: 'x', scenes: [{ id: 'a', title: 'a', voiceoverText: 'a', kineticHeadline: '', visualPrompt: '' }] };
    expect(DraftUpdateSchema.safeParse({ ...base, voice: 'Kore' }).success).toBe(true);
    expect(DraftUpdateSchema.safeParse({ ...base, voice: VOICE, voiceProvider: 'elevenlabs' }).success).toBe(true);
    expect(DraftUpdateSchema.safeParse({ ...base, voice: VOICE }).success).toBe(false);
    expect(DraftUpdateSchema.safeParse({ ...base, voice: 'Kore', voiceProvider: 'elevenlabs' }).success).toBe(false);
  });
});
