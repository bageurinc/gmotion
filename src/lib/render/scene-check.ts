import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import sharp from 'sharp';
import { mapWithConcurrency, PIPELINE_CONCURRENCY } from '@/lib/pipeline/concurrency';
import type { StudioProject } from '@/types/studio';
import { bundleProject, COMPOSITION_ID } from './render-service';

export interface SceneCrash {
  index: number;
  message: string;
}

const MAX_MESSAGE_LENGTH = 600;

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

export async function findSceneCrashes(project: StudioProject): Promise<SceneCrash[]> {
  const serveUrl = await bundleProject(project);
  const browser = await openBrowser('chrome');
  try {
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, puppeteerInstance: browser });
    const crashes = new Map<number, string>();
    const samples = sampleSceneFrames(project.storyboard.scenes.map((scene) => scene.durationInFrames));

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

const SHEET_FRAME = { width: 405, height: 720 };

/** Renders contact sheets per scene. A scene that crashes is simply left out. */
export async function captureSceneSheets(project: StudioProject, indexes: number[]): Promise<Map<number, Buffer>> {
  const serveUrl = await bundleProject(project);
  const browser = await openBrowser('chrome');
  try {
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, puppeteerInstance: browser });
    const samples = sampleSceneFrames(project.storyboard.scenes.map((scene) => scene.durationInFrames));
    const sheets = new Map<number, Buffer>();

    await mapWithConcurrency(indexes, PIPELINE_CONCURRENCY, async (index) => {
      try {
        const frames: Buffer[] = [];
        for (const { frame } of samples.filter((sample) => sample.index === index)) {
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
        sheets.set(
          index,
          await sharp({
            create: { width: SHEET_FRAME.width * frames.length, height: SHEET_FRAME.height, channels: 3, background: '#000000' },
          })
            .composite(frames.map((input, position) => ({ input, left: position * SHEET_FRAME.width, top: 0 })))
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
