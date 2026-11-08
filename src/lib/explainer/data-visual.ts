import { narrationWords } from './choreography';
import type { DataVisual, WordTiming } from '@/types/studio';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function isSpoken(value: string, unit: string | undefined, narration: string): boolean {
  const units = !unit ? '' : unit === '%' || unit.toLowerCase() === 'persen' ? '\\s*(?:%|persen)' : `\\s*${escape(unit)}`;
  return new RegExp(`(?<![\\d.,])${escape(value)}(?![\\d])${units}`, 'i').test(narration);
}

const digitsAreSpoken = (text: string, narration: string) =>
  (text.match(/\d+(?:[.,]\d+)*/g) ?? []).every((number) => isSpoken(number, undefined, narration));

/** A card may only repeat what the narration says, so any unspoken number removes the whole card. */
export function spokenDataVisual(visual: DataVisual | undefined, narration: string): DataVisual | undefined {
  if (!visual) return undefined;
  if (visual.kind === 'stat') {
    return /\d/.test(visual.value) && isSpoken(visual.value, visual.unit, narration) && digitsAreSpoken(visual.label, narration)
      ? visual
      : undefined;
  }
  if (visual.kind === 'compare') {
    return visual.items.every((item) => /\d/.test(item.value) && isSpoken(item.value, visual.unit, narration) && digitsAreSpoken(item.label, narration))
      ? visual
      : undefined;
  }
  return visual.items.every((item) => digitsAreSpoken(item, narration)) ? visual : undefined;
}

const OPENING_FRAME = 15;

/** The card arrives as its first number is spoken. Steps have no number, so they arrive early. */
export function dataVisualStart(
  visual: DataVisual,
  scene: { wordTimings: WordTiming[]; voiceoverText: string; durationInFrames: number },
  fps: number,
): number {
  const first = visual.kind === 'stat' ? visual.value : visual.kind === 'compare' ? visual.items[0].value : null;
  const word = first && narrationWords(scene, fps).find((item) => item.word.includes(first));
  return word ? Math.max(0, Math.floor((word.startMs * fps) / 1000) - 3) : OPENING_FRAME;
}
