import { saveProject } from '@/lib/storage/project-store';
import { usesWorldEngine } from '@/types/studio';
import type { SceneStage, StudioProject } from '@/types/studio';
import { assetModel, generateVideoSceneFile } from '@/lib/explainer/scene-generator';
import { isApiKeyConfigured } from '@/lib/ai/llm-client';
import { improveWeakScenes, qualityTools } from '@/lib/explainer/scene-quality';
import { findSceneCrashes, repairCrashedScenes } from '@/lib/render/scene-check';
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
    updatedAt: Date.now(),
  };
}

function completionMessage(project: StudioProject): string {
  if (!usesWorldEngine(project.storyboard.preset)) {
    return 'Semua adegan selesai dibuat. Tonton hasilnya di player, lalu minta revisi per adegan di sini.';
  }
  const repairs = project.worldRepairs?.length ?? 0;
  return repairs
    ? `Dunia selesai dibuat. Ada ${repairs} objek yang disesuaikan otomatis karena tidak muat. Tonton hasilnya di player.`
    : 'Dunia selesai dibuat. Tonton hasilnya di player.';
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
    const { code, repairs } = await buildWorldFiles(assetModel(), current());
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

  await mapWithConcurrency(isWorld ? [] : pending, PIPELINE_CONCURRENCY, async (index) => {
    const sceneId = project.storyboard.scenes[index].id;
    try {
      setStage(sceneId, 'audio');
      const audio = await generateSceneAudio(project.storyboard.scenes[index], {
        fps: project.storyboard.fps,
        projectId: project.id,
        voice: project.storyboard.voice,
      });
      commit((current) => ({
        storyboard: {
          ...current.storyboard,
          scenes: current.storyboard.scenes.map((scene) => (scene.id === sceneId ? { ...scene, ...audio } : scene)),
        },
      }));

      setStage(sceneId, 'animation');
      const { code, simplified, asset: sceneAsset } = await generateVideoSceneFile(project.storyboard, index);
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
            current.storyboard.palette
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
