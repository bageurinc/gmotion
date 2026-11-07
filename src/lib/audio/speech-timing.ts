import type { WordTiming } from '@/types/studio';

export interface SpeechSegment {
  startMs: number;
  endMs: number;
}

const WINDOW_MS = 20;
const MIN_PAUSE_MS = 90;
const SILENCE_RATIO = 0.08;

/** Finds spoken ranges in 16-bit mono PCM WAV audio by measuring loudness over short windows. */
export function detectSpeechSegments(wav: Buffer): SpeechSegment[] {
  const sampleRate = wav.readUInt32LE(24);
  const dataStart = wav.indexOf(Buffer.from('data'), 12) + 8;
  const windowSamples = Math.round((sampleRate * WINDOW_MS) / 1000);
  const totalSamples = Math.floor((wav.length - dataStart) / 2);

  const levels: number[] = [];
  for (let start = 0; start + windowSamples <= totalSamples; start += windowSamples) {
    let energy = 0;
    for (let index = start; index < start + windowSamples; index += 1) {
      energy += wav.readInt16LE(dataStart + index * 2) ** 2;
    }
    levels.push(Math.sqrt(energy / windowSamples));
  }

  const threshold = Math.max(...levels, 1) * SILENCE_RATIO;
  const segments: SpeechSegment[] = [];
  levels.forEach((level, index) => {
    if (level < threshold) return;
    const startMs = index * WINDOW_MS;
    const endMs = startMs + WINDOW_MS;
    const last = segments.at(-1);
    if (last && startMs - last.endMs < MIN_PAUSE_MS) last.endMs = endMs;
    else segments.push({ startMs, endMs });
  });
  return segments;
}

/** Spreads words over the spoken ranges by length, so pauses stay silent in the captions. */
export function alignWordsToSpeech(text: string, segments: SpeechSegment[]): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const spokenMs = segments.reduce((sum, segment) => sum + segment.endMs - segment.startMs, 0);
  if (!words.length || spokenMs <= 0) return [];

  const totalWeight = words.reduce((sum, word) => sum + word.length + 1, 0);
  const toClock = (spoken: number) => {
    let remaining = spoken;
    for (const segment of segments) {
      const length = segment.endMs - segment.startMs;
      if (remaining <= length) return segment.startMs + remaining;
      remaining -= length;
    }
    return segments[segments.length - 1].endMs;
  };

  let weight = 0;
  return words.map((word) => {
    const startMs = Math.round(toClock((weight / totalWeight) * spokenMs));
    weight += word.length + 1;
    return { word, startMs, endMs: Math.round(toClock((weight / totalWeight) * spokenMs)) };
  });
}
