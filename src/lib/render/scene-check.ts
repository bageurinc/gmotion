import fs from 'fs';
import os from 'os';
import path from 'path';
import { makeCancelSignal, openBrowser, renderFrames, renderStill, selectComposition } from '@remotion/renderer';
import sharp from 'sharp';
import { buildActionCues, narrationWords } from '@/lib/explainer/choreography';
import { hasContinuousCut } from '@/lib/explainer/continuity';
import { mapWithConcurrency, PIPELINE_CONCURRENCY } from '@/lib/pipeline/concurrency';
import type { StudioProject } from '@/types/studio';
import {
  frameChanges,
  LONGEST_STILL_SECONDS,
  SCENE_FADE_FRAMES,
  STILL_BAND,
  STILL_SAMPLE_SIZE,
  STILL_STEP_SECONDS,
  STILL_THRESHOLD,
  stillStretches,
  type StillStretch,
} from './motion-check';
import { bundleProject, chromiumOptionsFor, COMPOSITION_ID } from './render-service';

export interface SceneCrash {
  index: number;
  message: string;
}

const MAX_MESSAGE_LENGTH = 600;
const STILL_SCALE = 0.5;
const STILL_TIMEOUT_MS = 3 * 60_000;

/** Samples the start, middle, and end of each scene on the shared video timeline. */
export function sampleSceneFrames(durations: number[]): Array<{ index: number; frame: number }> {
  let offset = 0;
  return durations.flatMap((duration, index) => {
    const start = offset;
    offset += duration;
    const positions = [2, Math.floor(duration / 2), duration - 3];
    return [...new Set(positions)].map((position) => ({
      index,
      frame: start + Math.min(Math.max(position, 0), duration - 1),
    }));
  });
}

export async function findSceneCrashes(project: StudioProject, onlyIndexes?: number[]): Promise<SceneCrash[]> {
  const serveUrl = await bundleProject(project);
  const chromiumOptions = chromiumOptionsFor(project);
  const browser = await openBrowser('chrome', { chromiumOptions });
  try {
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, puppeteerInstance: browser });
    const crashes = new Map<number, string>();
    const samples = sampleSceneFrames(project.storyboard.scenes.map((scene) => scene.durationInFrames))
      .filter(({ index }) => !onlyIndexes || onlyIndexes.includes(index));

    await mapWithConcurrency(samples, PIPELINE_CONCURRENCY, async ({ index, frame }) => {
      if (crashes.has(index)) return;
      try {
        await renderStill({
          composition,
          serveUrl,
          frame,
          output: null,
          imageFormat: 'jpeg',
          puppeteerInstance: browser,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        crashes.set(index, message.slice(0, MAX_MESSAGE_LENGTH));
      }
    });

    return [...crashes].map(([index, message]) => ({ index, message }));
  } finally {
    await browser.close({ silent: true });
  }
}

/** Renders every half second at half size and finds long stretches where the picture barely changes. */
export async function measureStillness(project: StudioProject, timeoutMs = STILL_TIMEOUT_MS): Promise<StillStretch[]> {
  const serveUrl = await bundleProject(project);
  const browser = await openBrowser('chrome', { chromiumOptions: chromiumOptionsFor(project) });
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmotion-still-'));
  // A stuck render must not freeze the whole job, and one was seen hanging during calibration.
  const { cancelSignal, cancel } = makeCancelSignal();
  const timeout = setTimeout(cancel, timeoutMs);
  try {
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, puppeteerInstance: browser });
    // renderFrames rejects on a crashing frame. A burst of renderStill calls killed the process on an unhandled page error.
    await renderFrames({
      composition,
      serveUrl,
      inputProps: {},
      outputDir,
      imageFormat: 'jpeg',
      scale: STILL_SCALE,
      everyNthFrame: Math.max(1, Math.round(STILL_STEP_SECONDS * composition.fps)),
      concurrency: PIPELINE_CONCURRENCY,
      cancelSignal,
      puppeteerInstance: browser,
      onStart: () => undefined,
      onFrameUpdate: () => undefined,
    });
    const band = {
      left: 0,
      top: Math.round(composition.height * STILL_BAND.top * STILL_SCALE),
      width: Math.round(composition.width * STILL_SCALE),
      height: Math.round(composition.height * STILL_BAND.height * STILL_SCALE),
    };
    const files = fs.readdirSync(outputDir).filter((file) => file.endsWith('.jpeg')).sort();
    const samples = await mapWithConcurrency(files, PIPELINE_CONCURRENCY, (file) =>
      sharp(path.join(outputDir, file)).extract(band).resize(STILL_SAMPLE_SIZE).greyscale().raw().toBuffer()
    );
    return stillStretches(frameChanges(samples), STILL_STEP_SECONDS, STILL_THRESHOLD, LONGEST_STILL_SECONDS);
  } finally {
    clearTimeout(timeout);
    await browser.close({ silent: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
}

const SHEET_FRAME = { width: 405, height: 720 };
const SHEET_COLUMNS = 4;
const SHEET_MIN_GAP = 15;

/** Keeps a story-svg scene's cut in view by leading its sheet with the previous scene's last clear frame. */
export const opensWithPreviousScene = (project: StudioProject, index: number) =>
  project.storyboard.preset === 'story-svg' && index > 0;

/**
 * Frames for the critic, all clear of the fades at a cut: the opening, middle, ending, and the
 * finished pose of every narrated action. Frames nearly on top of each other are dropped.
 */
export function sheetFrames(project: StudioProject, index: number): number[] {
  const { scenes, fps } = project.storyboard;
  const scene = scenes[index];
  const start = scenes.slice(0, index).reduce((sum, item) => sum + item.durationInFrames, 0);
  const continuous = hasContinuousCut(project, index);
  const firstClear = continuous ? 0 : Math.min(index === 0 ? 2 : SCENE_FADE_FRAMES, scene.durationInFrames - 1);
  const lastClear = Math.max(firstClear, scene.durationInFrames - 1 - SCENE_FADE_FRAMES);
  const clamp = (frame: number) => Math.min(lastClear, Math.max(firstClear, frame));

  const actions = project.sceneAssets?.[scene.id]?.manifest.choreography ?? [];
  const poses = buildActionCues(actions, narrationWords(scene, fps), scene.durationInFrames, fps).map((cue) => clamp(cue.to));
  const own = [firstClear, clamp(Math.floor(scene.durationInFrames / 2)), lastClear, ...poses].sort((a, b) => a - b);
  const spaced = own.filter((frame, position) => position === 0 || frame - own[position - 1] >= SHEET_MIN_GAP);
  const frames = spaced.map((frame) => start + frame);
  if (!opensWithPreviousScene(project, index)) return frames;
  const previousLastClear = Math.max(start - scenes[index - 1].durationInFrames, start - 1 - SCENE_FADE_FRAMES);
  return [continuous ? start - 1 : previousLastClear, ...frames];
}

/** Renders contact sheets per scene. A scene that crashes is simply left out. */
export async function captureSceneSheets(project: StudioProject, indexes: number[]): Promise<Map<number, Buffer>> {
  const serveUrl = await bundleProject(project);
  const browser = await openBrowser('chrome');
  try {
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, puppeteerInstance: browser });
    const sheets = new Map<number, Buffer>();

    await mapWithConcurrency(indexes, PIPELINE_CONCURRENCY, async (index) => {
      try {
        const frames: Buffer[] = [];
        for (const frame of sheetFrames(project, index)) {
          const { buffer } = await renderStill({
            composition,
            serveUrl,
            frame,
            output: null,
            imageFormat: 'jpeg',
            puppeteerInstance: browser,
          });
          frames.push(await sharp(buffer as Buffer).resize(SHEET_FRAME).toBuffer());
        }
        const columns = Math.min(frames.length, SHEET_COLUMNS);
        const rows = Math.ceil(frames.length / columns);
        sheets.set(
          index,
          await sharp({
            create: { width: SHEET_FRAME.width * columns, height: SHEET_FRAME.height * rows, channels: 3, background: '#000000' },
          })
            .composite(
              frames.map((input, position) => ({
                input,
                left: (position % columns) * SHEET_FRAME.width,
                top: Math.floor(position / columns) * SHEET_FRAME.height,
              }))
            )
            .jpeg({ quality: 82 })
            .toBuffer()
        );
      } catch (error) {
        console.warn(`[SceneCheck] Could not capture scene ${index + 1}:`, error);
      }
    });

    return sheets;
  } finally {
    await browser.close({ silent: true });
  }
}

export interface CrashRepairTools {
  current: () => StudioProject;
  findCrashes: (project: StudioProject) => Promise<SceneCrash[]>;
  reviseScene: (project: StudioProject, crash: SceneCrash) => Promise<string>;
  replaceWithSimpleScene: (project: StudioProject, crash: SceneCrash) => string;
  saveScene: (index: number, code: string, simplified: boolean) => void;
}

/** Gives each crashed scene one AI repair, then falls back to its known-good simple version. */
export async function repairCrashedScenes(project: StudioProject, tools: CrashRepairTools): Promise<void> {
  const crashes = await tools.findCrashes(project);
  if (!crashes.length) return;

  await mapWithConcurrency(crashes, PIPELINE_CONCURRENCY, async (crash) => {
    tools.saveScene(crash.index, await tools.reviseScene(tools.current(), crash), false);
  });

  for (const crash of await tools.findCrashes(tools.current())) {
    tools.saveScene(crash.index, tools.replaceWithSimpleScene(tools.current(), crash), true);
  }
}

export type RevisionCheckOutcome = 'ok' | 'repaired' | 'reverted' | 'unchecked';

export interface RevisionCheckTools {
  findCrashes: (project: StudioProject, onlyIndexes: number[]) => Promise<SceneCrash[]>;
  repair: (project: StudioProject, crash: SceneCrash) => Promise<string>;
}

const withSceneCodes = (project: StudioProject, codes: Map<number, string>): StudioProject => ({
  ...project,
  files: { ...project.files, ...Object.fromEntries([...codes].map(([index, code]) => [`Scene${index + 1}.tsx`, code])) },
});

export interface RevisedSceneCheck {
  code: string;
  outcome: RevisionCheckOutcome;
  crash?: string;
}

/**
 * Renders chat-revised scenes before they are kept, all in one browser session. Each crash
 * gets one AI repair; a scene that still crashes goes back to its safe code, which already rendered.
 */
export async function guardRevisedScenes(
  project: StudioProject,
  safeCodes: Map<number, string>,
  tools: RevisionCheckTools
): Promise<Map<number, RevisedSceneCheck>> {
  const indexes = [...safeCodes.keys()];
  const revised = (index: number) => project.files[`Scene${index + 1}.tsx`];
  const results = new Map<number, RevisedSceneCheck>(indexes.map((index) => [index, { code: revised(index), outcome: 'ok' }]));
  if (!indexes.length) return results;

  let crashes: SceneCrash[];
  try {
    crashes = await tools.findCrashes(project, indexes);
  } catch (error) {
    // A broken checker must not throw away the user's revision. Export still reports real crashes.
    console.error('[SceneCheck] Revision check could not run:', error);
    for (const index of indexes) results.set(index, { code: revised(index), outcome: 'unchecked' });
    return results;
  }
  if (!crashes.length) return results;

  const repairs = new Map<number, string>();
  await mapWithConcurrency(crashes, PIPELINE_CONCURRENCY, async (crash) => {
    try {
      const code = await tools.repair(project, crash);
      if (code !== revised(crash.index)) repairs.set(crash.index, code);
    } catch (error) {
      console.error('[SceneCheck] Revision repair failed:', error);
    }
  });

  let stillCrashing = new Set(crashes.map((crash) => crash.index));
  if (repairs.size) {
    try {
      const recheck = await tools.findCrashes(withSceneCodes(project, repairs), [...repairs.keys()]);
      const failed = new Set(recheck.map((crash) => crash.index));
      stillCrashing = new Set([...stillCrashing].filter((index) => !repairs.has(index) || failed.has(index)));
    } catch (error) {
      console.error('[SceneCheck] Revision recheck could not run:', error);
    }
  }
  for (const crash of crashes) {
    results.set(crash.index, stillCrashing.has(crash.index)
      ? { code: safeCodes.get(crash.index)!, outcome: 'reverted', crash: crash.message }
      : { code: repairs.get(crash.index)!, outcome: 'repaired', crash: crash.message });
  }
  return results;
}

export async function guardRevisedScene(
  project: StudioProject,
  index: number,
  previousCode: string,
  tools: RevisionCheckTools
): Promise<RevisedSceneCheck> {
  return (await guardRevisedScenes(project, new Map([[index, previousCode]]), tools)).get(index)!;
}
