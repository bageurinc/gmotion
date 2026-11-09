import type { SceneStage, StudioProject } from '@/types/studio';

/** Share of a Full SVG run spent on the object draft. Measured runs took 5 to 8 minutes of a 10 to 18 minute job. */
export const DRAFT_SHARE = 30;

/** How far a scene is, by its stage. Drawing is the slow part, so it moves the bar least until it finishes. */
const STAGE_WEIGHT: Record<SceneStage, number> = { queued: 0, audio: 0.15, animation: 0.45, ready: 1, failed: 1 };

/**
 * One percentage for the whole generation, so the user sees movement during the long steps.
 * Full SVG runs that draw an object draft give it the first part of the bar.
 */
export function generationPercent(project: StudioProject): number {
  const { scenes } = project.storyboard;
  const usesDraft = project.storyboard.preset === 'story-svg' && Boolean(project.storySvgDraft || project.storySvgDraftProgress);
  const draftShare = usesDraft ? DRAFT_SHARE : 0;

  if (usesDraft && !project.storySvgDraft) {
    return Math.round((draftShare * (project.storySvgDraftProgress?.percent ?? 0)) / 100);
  }
  if (project.storySvgReviewPending) return draftShare;

  const done = scenes.reduce((sum, scene) => sum + STAGE_WEIGHT[project.sceneProgress?.[scene.id]?.stage ?? 'queued'], 0);
  const percent = draftShare + (100 - draftShare) * (scenes.length ? done / scenes.length : 0);
  // The final checks still run after every scene is drawn.
  const ceiling = project.status === 'generating' ? 97 : 100;
  return Math.min(ceiling, Math.round(percent));
}
