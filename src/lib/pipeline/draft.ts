import { z } from 'zod';
import type { SceneSpec, Storyboard, StudioProject } from '@/types/studio';

export const MAX_DRAFT_SCENES = 12;
const WORDS_PER_SECOND = 2.4;

export const DraftUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120),
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
  return { ...storyboard, title: update.title, scenes };
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
  return words === 0 ? 0 : Math.max(3, words / WORDS_PER_SECOND + 0.35);
}

export function readyScenes(project: Pick<StudioProject, 'storyboard' | 'sceneProgress'>): SceneSpec[] {
  const { sceneProgress, storyboard } = project;
  if (!sceneProgress) return storyboard.scenes;
  return storyboard.scenes.filter((scene) => sceneProgress[scene.id]?.stage === 'ready');
}

export function hasFailedScene(project: Pick<StudioProject, 'sceneProgress'>): boolean {
  return Object.values(project.sceneProgress ?? {}).some((scene) => scene.stage === 'failed');
}
