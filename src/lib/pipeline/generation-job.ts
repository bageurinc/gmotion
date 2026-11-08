import { saveProject } from '@/lib/storage/project-store';
import { usesWorldEngine } from '@/types/studio';
import type { SceneStage, StudioProject } from '@/types/studio';
import { buildImageScene } from '@/lib/explainer/image-scene';
import { planSceneMoments, ScenePlan, singlePictureScene } from '@/lib/explainer/scene-moments';
import { continuityFor } from '@/lib/explainer/continuity';
import { assetModel, generateVideoSceneFile } from '@/lib/explainer/scene-generator';
import { isApiKeyConfigured } from '@/lib/ai/llm-client';
import { improveWeakScenes, qualityTools } from '@/lib/explainer/scene-quality';
import { describeStillStretches } from '@/lib/render/motion-check';
import { findSceneCrashes, measureStillness, repairCrashedScenes } from '@/lib/render/scene-check';
import { generateMainVideoCode, reviseSceneCode, simpleSceneCode } from './coder-agent';
import { mapWithConcurrency, PIPELINE_CONCURRENCY } from './concurrency';
import { hasFailedScene, normalizeSceneOrder } from './draft';
import { generateSceneAudio } from './tts-engine';
import { buildWorldFiles } from './world-video';

const globalJobs = globalThis as typeof globalThis & { __gmotionGenerationJobs?: Set<string> };
const activeJobs = (globalJobs.__gmotionGenerationJobs ??= new Set<string>());

export function isGenerationActive(projectId: string): boolean {
  return activeJobs.has(projectId);
}

export function hasRetryableScenes(project: StudioProject): boolean {
  return Object.values(project.sceneProgress ?? {}).some((scene) => scene.stage !== 'ready');
}

export function prepareGeneration(project: StudioProject): StudioProject {
  const storyboard = normalizeSceneOrder(project.storyboard);
  const sceneProgress = Object.fromEntries(
    storyboard.scenes.map((scene) => [
      scene.id,
      { stage: project.sceneProgress?.[scene.id]?.stage === 'ready' ? ('ready' as const) : ('queued' as const) },
    ])
  );
  return {
    ...project,
    storyboard,
    sceneProgress,
    status: 'generating',
    generationError: undefined,
    stillStretches: undefined,
    updatedAt: Date.now(),
  };
}

function finishedMessage(project: StudioProject): string {
  if (!usesWorldEngine(project.storyboard.preset)) {
    return 'Semua adegan selesai dibuat. Tonton hasilnya di player, lalu minta revisi per adegan di sini.';
  }
  const repairs = project.worldRepairs?.length ?? 0;
  return repairs
    ? `Dunia selesai dibuat. Ada ${repairs} objek yang disesuaikan otomatis karena tidak muat. Tonton hasilnya di player.`
    : 'Dunia selesai dibuat. Tonton hasilnya di player.';
}

export function completionMessage(project: StudioProject): string {
  return [finishedMessage(project), describeStillStretches(project.stillStretches ?? [])].filter(Boolean).join(' ');
}

interface WorldJobTools {
  current: () => StudioProject;
  commit: (changes: (current: StudioProject) => Partial<StudioProject>) => void;
  setStage: (sceneId: string, stage: SceneStage, error?: string) => void;
}

/** One world serves every scene, so audio runs per scene and the world is made once from all of them. */
async function generateWorld(pending: number[], { current, commit, setStage }: WorldJobTools): Promise<void> {
  await mapWithConcurrency(pending, PIPELINE_CONCURRENCY, async (index) => {
    const scene = current().storyboard.scenes[index];
    try {
      setStage(scene.id, 'audio');
      if (!scene.audioUrl) {
        const audio = await generateSceneAudio(scene, {
          fps: current().storyboard.fps,
          projectId: current().id,
          voice: current().storyboard.voice,
          provider: current().storyboard.voiceProvider,
        });
        commit((project) => ({
          storyboard: {
            ...project.storyboard,
            scenes: project.storyboard.scenes.map((item) => (item.id === scene.id ? { ...item, ...audio } : item)),
          },
        }));
      }
      setStage(scene.id, 'animation');
    } catch (err: unknown) {
      console.error(`[GenerationJob] Scene ${scene.id} audio failed:`, err);
      setStage(scene.id, 'failed', err instanceof Error ? err.message : 'Audio adegan gagal dibuat.');
    }
  });
  if (hasFailedScene(current())) return;

  const failAll = (message: string) => {
    for (const scene of current().storyboard.scenes) setStage(scene.id, 'failed', message);
  };
  try {
    const { code, repairs } = await buildWorldFiles(assetModel(current().drawingModel), current());
    commit((project) => ({
      files: { ...project.files, 'MainVideo.tsx': code },
      worldRepairs: repairs,
      sceneProgress: Object.fromEntries(project.storyboard.scenes.map((scene) => [scene.id, { stage: 'ready' as const }])),
    }));
  } catch (err: unknown) {
    console.error(`[GenerationJob] World failed for ${current().id}:`, err);
    failAll(err instanceof Error ? err.message : 'Dunia gagal dibuat.');
    return;
  }

  commit(() => ({ checkingScenes: true }));
  try {
    const crashes = await findSceneCrashes(current());
    if (crashes.length) failAll(`Dunia gagal dirender: ${crashes[0].message}`);
  } catch (err) {
    // A broken checker must not block a video that may be fine. Export still reports real crashes.
    console.error(`[GenerationJob] Scene check failed for ${current().id}:`, err);
  }
  commit(() => ({ checkingScenes: undefined }));
}

export async function runGeneration(initial: StudioProject): Promise<void> {
  let project = initial;
  activeJobs.add(project.id);

  const commit = (changes: (current: StudioProject) => Partial<StudioProject>) => {
    project = { ...project, ...changes(project), updatedAt: Date.now() };
    saveProject(project);
  };
  const setStage = (sceneId: string, stage: SceneStage, error?: string) => {
    commit((current) => ({
      sceneProgress: { ...current.sceneProgress, [sceneId]: { stage, ...(error ? { error } : {}) } },
    }));
  };
  const readyIndexes = (current: StudioProject) =>
    current.storyboard.scenes.flatMap((scene, index) =>
      current.sceneProgress?.[scene.id]?.stage === 'ready' ? [index] : []
    );

  const pending = project.storyboard.scenes.flatMap((scene, index) =>
    project.sceneProgress?.[scene.id]?.stage === 'ready' ? [] : [index]
  );

  const isWorld = usesWorldEngine(project.storyboard.preset);

  const makeAudio = async (index: number) => {
    const scene = project.storyboard.scenes[index];
    setStage(scene.id, 'audio');
    const audio = await generateSceneAudio(scene, {
      fps: project.storyboard.fps,
      projectId: project.id,
      voice: project.storyboard.voice,
      provider: project.storyboard.voiceProvider,
    });
    commit((current) => ({
      storyboard: {
        ...current.storyboard,
        scenes: current.storyboard.scenes.map((item) => (item.id === scene.id ? { ...item, ...audio } : item)),
      },
    }));
  };

  // Story 2D plans all scenes together, and that plan needs the real narration timing.
  const usesMoments = project.storyboard.preset === 'story-2d' && isApiKeyConfigured();
  // Full SVG scenes build on each other, so they are drawn in order.
  const chained = project.storyboard.preset === 'story-svg';
  const audioFirst = usesMoments || chained;
  const audioFailures = new Map<number, string>();
  let plans: ScenePlan[] | null = null;
  if (audioFirst) {
    await mapWithConcurrency(pending, PIPELINE_CONCURRENCY, async (index) => {
      try {
        await makeAudio(index);
        setStage(project.storyboard.scenes[index].id, 'queued');
      } catch (err: unknown) {
        audioFailures.set(index, err instanceof Error ? err.message : 'Audio adegan gagal dibuat.');
      }
    });
  }
  if (usesMoments) {
    try {
      plans = await planSceneMoments(assetModel(project.drawingModel), project.storyboard);
    } catch (err) {
      console.warn(`[GenerationJob] Moment plan failed for ${project.id}, drawing every scene from parts:`, err);
    }
    // Parts are flat vector and would break a pixel art video, so a failed plan still draws pictures.
    if (!plans && project.storyboard.artStyle === 'pixel') plans = project.storyboard.scenes.map(singlePictureScene);
  }

  const drawScene = async (index: number) => {
    const plan = plans?.[index];
    const { drawingModel } = project;
    if (chained) {
      const continuity = continuityFor(project.storyboard.scenes, project.sceneAssets, index);
      return generateVideoSceneFile(project.storyboard, index, { drawingModel, continuity });
    }
    if (plan?.kind !== 'image') return generateVideoSceneFile(project.storyboard, index, { drawingModel });
    try {
      return { code: await buildImageScene(project.id, project.storyboard, plan, index), simplified: false, asset: undefined };
    } catch (err) {
      // A failed picture must not cost the scene, so it falls back to moving parts.
      console.warn(`[GenerationJob] Image scene ${index + 1} failed, drawing it from parts:`, err);
      return generateVideoSceneFile(project.storyboard, index, { drawingModel });
    }
  };

  await mapWithConcurrency(isWorld ? [] : pending, chained ? 1 : PIPELINE_CONCURRENCY, async (index) => {
    const sceneId = project.storyboard.scenes[index].id;
    try {
      const audioFailure = audioFailures.get(index);
      if (audioFailure) throw new Error(audioFailure);
      if (!audioFirst) await makeAudio(index);

      setStage(sceneId, 'animation');
      const { code, simplified, asset: sceneAsset } = await drawScene(index);
      commit((current) => {
        const sceneProgress = {
          ...current.sceneProgress,
          [sceneId]: { stage: 'ready' as const, ...(simplified ? { simplified } : {}) },
        };
        const next = { ...current, sceneProgress };
        return {
          sceneProgress,
          sceneAssets: sceneAsset ? { ...current.sceneAssets, [sceneId]: sceneAsset } : current.sceneAssets,
          files: {
            ...current.files,
            [`Scene${index + 1}.tsx`]: code,
            'MainVideo.tsx': generateMainVideoCode(current.storyboard, readyIndexes(next)),
          },
        };
      });
    } catch (err: unknown) {
      console.error(`[GenerationJob] Scene ${sceneId} failed:`, err);
      setStage(sceneId, 'failed', err instanceof Error ? err.message : 'Adegan gagal dibuat.');
    }
  });

  if (isWorld) {
    await generateWorld(pending, { current: () => project, commit, setStage });
  } else if (isApiKeyConfigured() && !hasFailedScene(project)) {
    commit(() => ({ checkingScenes: true }));
    try {
      await improveWeakScenes(project, qualityTools(() => project, commit));
    } catch (err) {
      console.error(`[GenerationJob] Quality review failed for ${project.id}:`, err);
    }
    try {
      await repairCrashedScenes(project, {
        findCrashes: findSceneCrashes,
        reviseScene: (current, crash) =>
          reviseSceneCode(
            current.files[`Scene${crash.index + 1}.tsx`],
            current.storyboard.scenes[crash.index],
            `Fix this runtime crash and keep the same visual: ${crash.message}`,
            current.storyboard.palette,
            { svgOnly: current.storyboard.preset === 'story-svg' }
          ),
        replaceWithSimpleScene: (current, crash) =>
          simpleSceneCode(current.storyboard, crash.index),
        saveScene: (index, code, simplified) => {
          const sceneId = project.storyboard.scenes[index].id;
          commit((current) => ({
            files: { ...current.files, [`Scene${index + 1}.tsx`]: code },
            sceneProgress: simplified
              ? { ...current.sceneProgress, [sceneId]: { stage: 'ready', simplified } }
              : current.sceneProgress,
          }));
        },
        current: () => project,
      });
    } catch (err) {
      // A broken checker must not block a video that may be fine. Export still reports real crashes.
      console.error(`[GenerationJob] Scene check failed for ${project.id}:`, err);
    }
    commit(() => ({ checkingScenes: undefined }));
  }

  // Full SVG moves small objects under a fixed camera, which this measure reads as still.
  if (project.storyboard.preset !== 'story-svg' && !hasFailedScene(project)) {
    commit(() => ({ checkingScenes: true }));
    try {
      const stillStretches = await measureStillness(project);
      commit(() => ({ stillStretches }));
    } catch (err) {
      // The check only informs the user, so a broken measurement must not cost the video.
      console.error(`[GenerationJob] Stillness check failed for ${project.id}:`, err);
    }
    commit(() => ({ checkingScenes: undefined }));
  }

  commit((current) => {
    const failed = Object.values(current.sceneProgress ?? {}).filter((scene) => scene.stage === 'failed').length;
    return {
      status: 'ready',
      generationError: failed ? `${failed} adegan gagal dibuat.` : undefined,
      chatHistory:
        failed || current.chatHistory.length
          ? current.chatHistory
          : [
              {
                id: `msg_${Date.now()}`,
                sender: 'assistant',
                content: completionMessage(current),
                timestamp: Date.now(),
              },
            ],
    };
  });
  activeJobs.delete(project.id);
}
