import type { AssetManifest } from './asset-contract';
import type { WordTiming } from '@/types/studio';

export interface ActionCue {
  id: string;
  from: number;
  to: number;
}

/** Real word timings, or an even split of the narration when none were recorded. */
export function narrationWords(
  scene: { wordTimings: WordTiming[]; voiceoverText: string; durationInFrames: number },
  fps: number,
): WordTiming[] {
  if (scene.wordTimings.length) return scene.wordTimings;
  const words = scene.voiceoverText.trim().split(/\s+/).filter(Boolean);
  const wordMs = (scene.durationInFrames / fps) * 1000 / Math.max(1, words.length);
  return words.map((word, index) => ({ word, startMs: index * wordMs, endMs: (index + 1) * wordMs }));
}

/** Action ids the code never reads from actionProgress, so they would show no motion. */
export function unanimatedActions(actions: NonNullable<AssetManifest['choreography']>, code: string): string[] {
  return actions
    .map((action) => action.id)
    .filter((id) => !new RegExp(`actionProgress(?:\\??\\.${id}\\b|\\??\\.?\\[['"]${id}['"]\\])`).test(code));
}

/** Resolve action timing from spoken words, keeping the ending pose visible. */
export function buildActionCues(
  actions: NonNullable<AssetManifest['choreography']>,
  words: WordTiming[],
  durationInFrames: number,
  fps: number,
): ActionCue[] {
  const lastFrame = Math.max(1, durationInFrames - 1);
  return actions.map((action) => {
    const start = words[action.startWord];
    const end = words[action.endWord];
    if (!start || !end) throw new Error(`Action ${action.id} references words outside the narration`);
    const from = Math.min(lastFrame - 1, Math.max(0, Math.floor(start.startMs * fps / 1000)));
    const to = Math.min(lastFrame, Math.max(from + 1, Math.ceil(end.endMs * fps / 1000)));
    return { id: action.id, from, to };
  });
}

/** Frame-local, seek-safe progression with gentle acceleration and a settled final pose. */
export function actionProgressAt(cues: ActionCue[], frame: number): Record<string, number> {
  return Object.fromEntries(cues.map(({ id, from, to }) => {
    const t = Math.max(0, Math.min(1, (frame - from) / Math.max(1, to - from)));
    return [id, t * t * (3 - 2 * t)];
  }));
}
