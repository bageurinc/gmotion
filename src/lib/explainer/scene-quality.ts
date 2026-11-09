import { mapWithConcurrency, PIPELINE_CONCURRENCY } from '@/lib/pipeline/concurrency';
import { captureSceneSheets, opensWithPreviousScene } from '@/lib/render/scene-check';
import type { StudioProject } from '@/types/studio';
import { AssetCritique, critiqueAsset, GeneratedAsset, repairAsset, reviseAsset } from './asset-generator';
import { generateMainVideoCode } from '@/lib/pipeline/coder-agent';
import { continuedScenes, continuesCamera, continuityFor } from './continuity';
import { assetModel, buildAssetScene, composeAssetScene, sceneTopicPrompt } from './scene-generator';

/** The critic is strict: clips viewers accepted scored about 5, so only clearly weak scenes are redrawn. */
export const QUALITY_THRESHOLD = 5.5;
/** Full SVG scores higher because labels are not judged, and 5.5 no longer flagged any scene in testing. */
export const FULL_SVG_QUALITY_THRESHOLD = 6.5;

const qualityThreshold = (project: StudioProject) =>
  project.storyboard.preset === 'story-svg' ? FULL_SVG_QUALITY_THRESHOLD : QUALITY_THRESHOLD;

interface SceneDraft {
  asset: GeneratedAsset;
  code: string;
}

export interface QualityTools {
  current: () => StudioProject;
  capture: (project: StudioProject, indexes: number[]) => Promise<Map<number, Buffer>>;
  critique: (project: StudioProject, index: number, asset: GeneratedAsset, sheet: Buffer) => Promise<AssetCritique>;
  redraw: (project: StudioProject, index: number, asset: GeneratedAsset, critique: AssetCritique, sheet: Buffer) => Promise<SceneDraft>;
  saveScene: (index: number, draft: SceneDraft | null, critique: AssetCritique) => void;
}

const PREVIOUS_FRAME_NOTE = 'The first frame belongs to the previous scene and is only a reference for the cut.';
const sheetNote = (project: StudioProject, index: number) => (opensWithPreviousScene(project, index) ? PREVIOUS_FRAME_NOTE : '');

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
  const weak = scored.filter((review) => review.critique.average < qualityThreshold(project));
  for (const review of scored) {
    console.log(`[SceneQuality] Scene ${review.index + 1}: ${review.critique.average}`);
    tools.saveScene(review.index, null, review.critique);
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
      tools.saveScene(index, draft, retry);
    }
  });
}

/**
 * Stores a redrawn scene. Its camera may have moved, so the next scene, which starts from it,
 * is composed again, and MainVideo is rebuilt in case the scene now cuts instead of continuing.
 */
function redrawnFiles(project: StudioProject, index: number, draft: { code: string; asset: GeneratedAsset }) {
  const { scenes } = project.storyboard;
  const sceneAssets = { ...project.sceneAssets, [scenes[index].id]: draft.asset };
  const files = { ...project.files, [`Scene${index + 1}.tsx`]: draft.code };
  const following = scenes[index + 1] && sceneAssets[scenes[index + 1].id];
  if (following && continuesCamera(following, index + 1)) {
    files[`Scene${index + 2}.tsx`] = composeAssetScene(following, project.storyboard, index + 1, draft.asset);
  }
  const ready = scenes.flatMap((scene, position) => (project.sceneProgress?.[scene.id]?.stage === 'ready' ? [position] : []));
  files['MainVideo.tsx'] = generateMainVideoCode(project.storyboard, ready, continuedScenes(scenes, sceneAssets));
  return { files, sceneAssets };
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
      (await critiqueAsset(criticModel(), sceneTopicPrompt(project.storyboard, index), asset, sheet, sheetNote(project, index))).critique,
    redraw: async (project, index, asset, critique, sheet) => {
      const continuity = project.storyboard.preset === 'story-svg'
        ? continuityFor(project.storyboard.scenes, project.sceneAssets, index)
        : undefined;
      const prompt = sceneTopicPrompt(project.storyboard, index, continuity);
      const model = assetModel(project.drawingModel);
      const { text } = await reviseAsset(model, prompt, asset, critique, sheet, sheetNote(project, index));
      try {
        return buildAssetScene(text, project.storyboard, index, continuity);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const repaired = await repairAsset(model, prompt, text, message);
        return buildAssetScene(repaired.text, project.storyboard, index, continuity);
      }
    },
    saveScene: (index, draft, { average, issues }) => {
      commit((project) => {
        const sceneId = project.storyboard.scenes[index].id;
        return {
          sceneProgress: { ...project.sceneProgress, [sceneId]: { ...project.sceneProgress?.[sceneId], stage: 'ready', score: average, issues } },
          ...(draft ? redrawnFiles(project, index, draft) : {}),
        };
      });
    },
  };
}
