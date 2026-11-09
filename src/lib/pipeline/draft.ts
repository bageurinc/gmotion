import { z } from 'zod';
import { VOICE_OPTIONS } from './voices';
import { TextStyleSchema, type SceneSpec, type Storyboard, type StudioProject } from '@/types/studio';

export const MAX_DRAFT_SCENES = 12;
// Measured from 283 narrated scenes in storage (Gemini TTS, Bahasa Indonesia): about 2.08 words/sec.
export const WORDS_PER_SECOND = 2.1;
const SCENE_PADDING_SECONDS = 0.35;
const MIN_SCENE_SECONDS = 3;
/** A draft within this fraction of the requested duration counts as on target. */
export const DURATION_TOLERANCE = 0.15;

export const DraftUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  voice: z.string().max(40).optional(),
  voiceProvider: z.enum(['gemini', 'elevenlabs']).optional(),
  textStyle: TextStyleSchema.optional(),
  scenes: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        title: z.string().max(80),
        voiceoverText: z.string().max(800),
        kineticHeadline: z.string().max(120),
        visualPrompt: z.string().max(1200),
      })
    )
    .min(1)
    .max(MAX_DRAFT_SCENES),
}).superRefine((value, ctx) => {
  if (value.voice === undefined) return;
  // Gemini voices are a fixed list; ElevenLabs voices are account ids, checked by shape.
  const valid = value.voiceProvider === 'elevenlabs'
    ? /^[A-Za-z0-9]{10,40}$/.test(value.voice)
    : VOICE_OPTIONS.some((voice) => voice.id === value.voice);
  if (!valid) ctx.addIssue({ code: 'custom', path: ['voice'], message: 'Unknown voice' });
});
export type DraftUpdate = z.infer<typeof DraftUpdateSchema>;

export function applyDraftUpdate(storyboard: Storyboard, update: DraftUpdate): Storyboard {
  const existing = new Map(storyboard.scenes.map((scene) => [scene.id, scene]));
  const scenes = update.scenes.map((item, index): SceneSpec => {
    const base: SceneSpec = existing.get(item.id) ?? {
      id: item.id,
      order: index + 1,
      role: 'narrative',
      title: `Adegan ${index + 1}`,
      voiceoverText: '',
      kineticHeadline: '',
      visualPrompt: '',
      cameraAction: 'slow-push',
      sfxCue: 'none',
      durationInFrames: 120,
      wordTimings: [],
    };
    return { ...base, ...item, order: index + 1 };
  });
  return {
    ...storyboard,
    title: update.title,
    voice: update.voice ?? storyboard.voice,
    voiceProvider: update.voice !== undefined ? update.voiceProvider ?? 'gemini' : storyboard.voiceProvider,
    textStyle: update.textStyle ?? storyboard.textStyle,
    textStyleSuggested: storyboard.textStyleSuggested ?? storyboard.textStyle,
    scenes,
  };
}

/** Scene ids drive file and audio names, so generation needs them to match the final order. */
export function normalizeSceneOrder(storyboard: Storyboard): Storyboard {
  return {
    ...storyboard,
    scenes: storyboard.scenes.map((scene, index) => ({
      ...scene,
      id: `scene-${index + 1}-${scene.role}`,
      order: index + 1,
    })),
  };
}

export function firstSceneWithoutNarration(scenes: Pick<SceneSpec, 'voiceoverText'>[]): number {
  return scenes.findIndex((scene) => !scene.voiceoverText.trim());
}

export function estimateNarrationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words === 0 ? 0 : Math.max(MIN_SCENE_SECONDS, words / WORDS_PER_SECOND + SCENE_PADDING_SECONDS);
}

export function estimateStoryboardSeconds(scenes: Pick<SceneSpec, 'voiceoverText'>[]): number {
  return scenes.reduce((sum, scene) => sum + estimateNarrationSeconds(scene.voiceoverText), 0);
}

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const DURATION_UNIT = String.raw`(\d+(?:[.,]\d+)?)\s*(detik|dtk|seconds?|secs?|s|menit|mnt|minutes?|min)\b`;
// A length counts only when it is about the video, so "rebus telur 7 menit" is not a target.
const DURATION_PATTERNS = [
  new RegExp(String.raw`(?:video|durasi(?:nya)?|berdurasi|panjang(?:nya)?|total|maks(?:imal)?|max|target|reels?|tiktok|shorts?|klip|clip|iklan|promo|konten|animasi|explainer)\D{0,20}?` + DURATION_UNIT, 'i'),
  new RegExp(String.raw`^\s*` + DURATION_UNIT, 'i'),
  new RegExp(DURATION_UNIT + String.raw`\s*(?:video|reels?|klip|clip)\b`, 'i'),
];

/**
 * Reads an explicit video length from the prompt, such as "video 30 detik" or "durasi 1,5 menit".
 * Returns null when the prompt states no length for the video or an implausible one.
 */
export function parseTargetDurationSeconds(prompt: string): number | null {
  for (const pattern of DURATION_PATTERNS) {
    const match = prompt.match(pattern);
    if (!match) continue;
    const value = Number(match[1].replace(',', '.'));
    const seconds = /^m/i.test(match[2]) ? value * 60 : value;
    return seconds >= 8 && seconds <= 300 ? Math.round(seconds) : null;
  }
  return null;
}

export interface DurationBudget {
  targetSeconds: number;
  minWords: number;
  maxWords: number;
  minScenes: number;
  maxScenes: number;
}

/** Converts a target length into the narration word count and scene range that produce it. */
export function durationBudget(targetSeconds: number): DurationBudget {
  const scenesFor = (secondsPerScene: number) =>
    Math.min(MAX_DRAFT_SCENES, Math.max(3, Math.round(targetSeconds / secondsPerScene)));
  const minScenes = scenesFor(9);
  const maxScenes = Math.max(minScenes, scenesFor(5));
  // Each scene adds padding, so the spoken words get what is left of the target.
  const wordsFor = (seconds: number, scenes: number) =>
    Math.max(scenes * 3, Math.round((seconds - scenes * SCENE_PADDING_SECONDS) * WORDS_PER_SECOND));
  const midScenes = Math.round((minScenes + maxScenes) / 2);
  return {
    targetSeconds,
    minWords: wordsFor(targetSeconds * (1 - DURATION_TOLERANCE * 0.6), midScenes),
    maxWords: wordsFor(targetSeconds * (1 + DURATION_TOLERANCE * 0.6), midScenes),
    minScenes,
    maxScenes,
  };
}

export interface DurationFit {
  estimatedSeconds: number;
  words: number;
  onTarget: boolean;
}

export function checkDurationFit(scenes: Pick<SceneSpec, 'voiceoverText'>[], targetSeconds: number): DurationFit {
  const estimatedSeconds = estimateStoryboardSeconds(scenes);
  return {
    estimatedSeconds,
    words: scenes.reduce((sum, scene) => sum + countWords(scene.voiceoverText), 0),
    onTarget: Math.abs(estimatedSeconds - targetSeconds) <= targetSeconds * DURATION_TOLERANCE,
  };
}

export function readyScenes(project: Pick<StudioProject, 'storyboard' | 'sceneProgress'>): SceneSpec[] {
  const { sceneProgress, storyboard } = project;
  if (!sceneProgress) return storyboard.scenes;
  return storyboard.scenes.filter((scene) => sceneProgress[scene.id]?.stage === 'ready');
}

export function hasFailedScene(project: Pick<StudioProject, 'sceneProgress'>): boolean {
  return Object.values(project.sceneProgress ?? {}).some((scene) => scene.stage === 'failed');
}
