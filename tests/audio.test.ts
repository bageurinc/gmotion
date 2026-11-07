import { describe, expect, it } from 'vitest';
import { alignWordsToSpeech, detectSpeechSegments } from '@/lib/audio/speech-timing';
import { encodeWav, synthMusic, synthSfx } from '@/lib/audio/synth';
import { generateMainVideoCode } from '@/lib/pipeline/coder-agent';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import { compileVirtualProject } from '@/lib/runtime/browser-compiler';
import { musicVolume } from '@/motion-kit/core/VideoTimeline';

function speechWav(ranges: Array<[number, number]>, seconds = 1.5) {
  const channel = new Float32Array(Math.round(seconds * 22050));
  for (const [from, to] of ranges) {
    for (let index = Math.round(from * 22050); index < to * 22050; index += 1) {
      channel[index] = Math.sin(index / 10) * 0.5;
    }
  }
  return encodeWav([channel]);
}

describe('speech timing', () => {
  it('finds spoken ranges around a pause', () => {
    const segments = detectSpeechSegments(speechWav([[0.1, 0.5], [0.9, 1.3]]));
    expect(segments).toHaveLength(2);
    expect(segments[0].startMs).toBeCloseTo(100, -2);
    expect(segments[1].startMs).toBeCloseTo(900, -2);
  });

  it('keeps words out of a pause', () => {
    const timings = alignWordsToSpeech('satu dua tiga empat lima', [{ startMs: 100, endMs: 500 }, { startMs: 900, endMs: 1300 }]);
    for (const { startMs } of timings) expect(startMs > 500 && startMs < 900).toBe(false);
    expect(timings[0].startMs).toBe(100);
    expect(timings.at(-1)?.endMs).toBe(1300);
  });

  it('returns nothing for silent audio', () => {
    expect(alignWordsToSpeech('halo', [])).toEqual([]);
  });
});

describe('music mix', () => {
  it('stays low under narration and lifts at scene changes', () => {
    expect(musicVolume(150, [300, 300], 30)).toBeCloseTo(0.13);
    expect(musicVolume(300, [300, 300], 30)).toBeCloseTo(0.3);
  });

  it('fades at both ends', () => {
    expect(musicVolume(0, [300], 30)).toBe(0);
    expect(musicVolume(300, [300], 30)).toBe(0);
  });
});

describe('synthesis', () => {
  const recipe = { bpm: 120, chords: [[60, 64, 67]], pluckPattern: [0, 1], pulse: true, brightness: 0.3 };

  it('produces identical non-clipping music', () => {
    const [left] = synthMusic(recipe);
    const peak = left.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    expect(peak).toBeLessThanOrEqual(0.71);
    expect(peak).toBeGreaterThan(0.1);
    expect(Array.from(synthMusic(recipe)[0].slice(1000, 1010))).toEqual(Array.from(left.slice(1000, 1010)));
  });

  it.each(['pop', 'whoosh', 'notification', 'cash-register', 'success'])('renders the %s effect', (kind) => {
    const [channel] = synthSfx(kind);
    expect(channel.some((value) => Math.abs(value) > 0.1)).toBe(true);
    expect(channel.every(Number.isFinite)).toBe(true);
  });
});

it('adds music, effects, and transitions to the video', async () => {
  const storyboard = generateProceduralStoryboard('Topik', 'story-2d', '9:16');
  const code = generateMainVideoCode(storyboard);
  expect(code).toContain('<MusicBed');
  expect(code).toContain('<SceneTransition');
  expect(code).toContain('<SceneSfx cue="none"');
  expect(code.match(/<SceneSfx cue=/g)).toHaveLength(storyboard.scenes.length);
  const scene = 'export default function Scene() { return null; }';
  const files = Object.fromEntries(storyboard.scenes.map((_, index) => [`Scene${index + 1}.tsx`, scene]));
  expect(typeof compileVirtualProject({ ...files, 'MainVideo.tsx': code }, 'MainVideo.tsx')).toBe('function');
});
