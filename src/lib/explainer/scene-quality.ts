import { mapWithConcurrency, PIPELINE_CONCURRENCY } from '@/lib/pipeline/concurrency';
import { captureSceneSheets } from '@/lib/render/scene-check';
import type { StudioProject } from '@/types/studio';
import { AssetCritique, critiqueAsset, GeneratedAsset, repairAsset, reviseAsset } from './asset-generator';
import { assetModel, buildAssetScene, sceneTopicPrompt } from './scene-generator';

/** The critic is strict: clips viewers accepted scored about 5, so only clearly weak scenes are redrawn. */
export const QUALITY_THRESHOLD = 5.5;

interface SceneDraft {
  asset: GeneratedAsset;
  code: string;
}

export interface QualityTools {
  current: () => StudioProject;
  capture: (project: StudioProject, indexes: number[]) => Promise<Map<number, Buffer>>;
  critique: (project: StudioProject, index: number, asset: GeneratedAsset, sheet: Buffer) => Promise<AssetCritique>;
  redraw: (project: StudioProject, index: number, asset: GeneratedAsset, critique: AssetCritique, sheet: Buffer) => Promise<SceneDraft>;
  saveScene: (index: number, draft: SceneDraft | null, score: number) => void;
}

const settled = async <T,>(task: () => Promise<T>): Promise<T | null> => {
  try {
    return await task();
  } catch (error) {
    console.warn('[SceneQuality] Step skipped:', error);
    return null;
  }
};

/** Redraws weak scenes once and keeps a redraw only when it scores higher than the original. */
export async function improveWeakScenes(project: StudioProject, tools: QualityTools): Promise<void> {
  const assetOf = (index: number) => project.sceneAssets?.[project.storyboard.scenes[index].id];
  const indexes = project.storyboard.scenes.flatMap((_, index) => (assetOf(index) ? [index] : []));
  if (!indexes.length) return;

  const sheets = await tools.capture(project, indexes);
  const reviews = await mapWithConcurrency(indexes, PIPELINE_CONCURRENCY, async (index) => {
    const sheet = sheets.get(index);
    const asset = assetOf(index);
    if (!sheet || !asset) return null;
    const critique = await settled(() => tools.critique(project, index, asset, sheet));
    return critique ? { index, asset, sheet, critique } : null;
  });

  const scored = reviews.flatMap((review) => (review ? [review] : []));
  const weak = scored.filter((review) => review.critique.average < QUALITY_THRESHOLD);
  for (const review of scored) {
    console.log(`[SceneQuality] Scene ${review.index + 1}: ${review.critique.average}`);
    tools.saveScene(review.index, null, review.critique.average);
  }
  if (!weak.length) return;

  const redraws = await mapWithConcurrency(weak, PIPELINE_CONCURRENCY, async (review) => {
    const draft = await settled(() =>
      tools.redraw(project, review.index, review.asset, review.critique, review.sheet)
    );
    return draft ? { ...review, draft } : null;
  });
  const candidates = redraws.flatMap((redraw) => (redraw ? [redraw] : []));
  if (!candidates.length) return;

  const current = tools.current();
  const trial: StudioProject = {
    ...current,
    files: {
      ...current.files,
      ...Object.fromEntries(candidates.map(({ index, draft }) => [`Scene${index + 1}.tsx`, draft.code])),
    },
  };
  const trialSheets = await tools.capture(trial, candidates.map((candidate) => candidate.index));

  await mapWithConcurrency(candidates, PIPELINE_CONCURRENCY, async ({ index, draft, critique }) => {
    const sheet = trialSheets.get(index);
    if (!sheet) return;
    const retry = await settled(() => tools.critique(trial, index, draft.asset, sheet));
    if (retry && retry.average > critique.average) {
      console.log(`[SceneQuality] Scene ${index + 1} improved: ${critique.average} -> ${retry.average}`);
      tools.saveScene(index, draft, retry.average);
    }
  });
}

export function qualityTools(
  current: () => StudioProject,
  commit: (changes: (project: StudioProject) => Partial<StudioProject>) => void
): QualityTools {
  const criticModel = () => process.env.CRITIC_MODEL || 'ag/gemini-3.8-flash-high';

  return {
    current,
    capture: captureSceneSheets,
    critique: async (project, index, asset, sheet) =>
      (await critiqueAsset(criticModel(), sceneTopicPrompt(project.storyboard, index), asset, sheet)).critique,
    redraw: async (project, index, asset, critique, sheet) => {
      const prompt = sceneTopicPrompt(project.storyboard, index);
      const { text } = await reviseAsset(assetModel(), prompt, asset, critique, sheet);
      try {
        return buildAssetScene(text, project.storyboard, index);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const repaired = await repairAsset(assetModel(), prompt, text, message);
        return buildAssetScene(repaired.text, project.storyboard, index);
      }
    },
    saveScene: (index, draft, score) => {
      commit((project) => {
        const sceneId = project.storyboard.scenes[index].id;
        return {
          sceneProgress: { ...project.sceneProgress, [sceneId]: { ...project.sceneProgress?.[sceneId], stage: 'ready', score } },
          ...(draft
            ? {
                files: { ...project.files, [`Scene${index + 1}.tsx`]: draft.code },
                sceneAssets: { ...project.sceneAssets, [sceneId]: draft.asset },
              }
            : {}),
        };
      });
    },
  };
}
