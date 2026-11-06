import { describe, it, expect } from 'vitest';
import {
  generateSceneAudio,
  estimateWordTimings,
  createFallbackAudioBuffer,
} from '../src/lib/pipeline/tts-engine';
import { SceneSpec } from '../src/types/studio';
import * as musicMetadata from 'music-metadata';

describe('Stage 2: Audio-First TTS Engine', () => {
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
    expect(result.durationInFrames).toBeGreaterThanOrEqual(90);
    expect(result.wordTimings.length).toBeGreaterThan(0);
  });
});
