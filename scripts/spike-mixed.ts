import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { imageModel } from '../src/lib/explainer/image-generator';
import { buildImageScene } from '../src/lib/explainer/image-scene';
import { assetModel, generateVideoSceneFile } from '../src/lib/explainer/scene-generator';
import { planSceneMoments } from '../src/lib/explainer/scene-moments';
import { generateMainVideoCode } from '../src/lib/pipeline/coder-agent';
import { mapWithConcurrency, PIPELINE_CONCURRENCY } from '../src/lib/pipeline/concurrency';
import { generateStoryboard } from '../src/lib/pipeline/director-agent';
import { generateSceneAudio } from '../src/lib/pipeline/tts-engine';
import { frameChanges, LONGEST_STILL_SECONDS as LONGEST_ALLOWED_SECONDS, STILL_STEP_SECONDS as STEP_SECONDS, STILL_THRESHOLD, stillStretches } from '../src/lib/render/motion-check';
import { renderProvider } from '../src/lib/render/render-service';
import { measureStillness } from '../src/lib/render/scene-check';
import { saveProject } from '../src/lib/storage/project-store';
import type { StudioProject } from '../src/types/studio';

const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const topic = argument('topic', 'Bagaimana cara kerja sabun membersihkan kuman dari tangan?');
const voice = argument('voice', 'Puck');
const checkOnly = argument('check', '');
const seconds = (startedAt: number) => Math.round((Date.now() - startedAt) / 1000) + 's';

const COMPOSITOR = path.join(process.cwd(), 'node_modules', '@remotion', 'compositor-darwin-arm64');

/** Compares sampled frames with the headline and captions cropped out, since text changes constantly. */
async function measureVideoStillness(video: string, durationSeconds: number) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmotion-check-'));
  const samples: Buffer[] = [];
  for (let time = 0; time < durationSeconds - 0.1; time += STEP_SECONDS) {
    const file = path.join(dir, `${samples.length}.png`);
    execFileSync(path.join(COMPOSITOR, 'ffmpeg'), ['-v', 'error', '-y', '-ss', time.toFixed(2), '-i', video, '-frames:v', '1', file], { env: { ...process.env, DYLD_LIBRARY_PATH: COMPOSITOR } });
    samples.push(await sharp(file).extract({ left: 0, top: 520, width: 1080, height: 720 }).resize(120, 80).greyscale().raw().toBuffer());
  }
  fs.rmSync(dir, { recursive: true });
  const changes = frameChanges(samples);
  const sorted = [...changes].sort((a, b) => a - b);
  const quantile = (share: number) => sorted[Math.floor((sorted.length - 1) * share)].toFixed(2);
  console.log('MIXED change', `p10 ${quantile(0.1)}`, `p25 ${quantile(0.25)}`, `p50 ${quantile(0.5)}`, `p75 ${quantile(0.75)}`, `p90 ${quantile(0.9)}`);
  const still = stillStretches(changes, STEP_SECONDS, STILL_THRESHOLD, LONGEST_ALLOWED_SECONDS);
  const stillSeconds = still.reduce((sum, item) => sum + item.seconds, 0);
  console.log('MIXED still', `${still.length} stretches over ${LONGEST_ALLOWED_SECONDS}s`, `${stillSeconds.toFixed(1)}s of ${durationSeconds.toFixed(1)}s`, still.map((item) => `${item.from.toFixed(1)}-${item.to.toFixed(1)}`).join(' '));
}

async function main() {
  const measure = argument('measure', '');
  if (measure) {
    const project = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'storage', 'projects', measure, 'project.json'), 'utf8')) as StudioProject;
    const startedAt = Date.now();
    const stretches = await measureStillness(project);
    const total = stretches.reduce((sum, item) => sum + item.seconds, 0);
    console.log('MIXED measure', measure, project.storyboard.preset, seconds(startedAt), `${total.toFixed(1)}s still`, stretches.map((item) => `${item.from.toFixed(1)}-${item.to.toFixed(1)}`).join(' '));
    return;
  }
  const rerender = argument('rerender', '');
  if (rerender) {
    const project = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'storage', 'projects', rerender, 'project.json'), 'utf8')) as StudioProject;
    const renderedAt = Date.now();
    const { outputPath } = await renderProvider.renderProject(project);
    console.log('MIXED render', seconds(renderedAt));
    await measureVideoStillness(outputPath, project.storyboard.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0) / project.storyboard.fps);
    return;
  }
  if (checkOnly) {
    const video = path.join(process.cwd(), 'storage', 'projects', checkOnly, 'exports', 'video.mp4');
    const project = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'storage', 'projects', checkOnly, 'project.json'), 'utf8')) as StudioProject;
    await measureVideoStillness(video, project.storyboard.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0) / project.storyboard.fps);
    return;
  }

  const startedAt = Date.now();
  const projectId = `proj_spike_mixed_${Date.now()}`;
  const assetsDir = path.join(process.cwd(), 'storage', 'projects', projectId, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const storyboard = await generateStoryboard(topic, 'story-2d', '9:16', { strict: true });
  storyboard.voice = voice;
  console.log('MIXED draft', seconds(startedAt), storyboard.title, storyboard.scenes.length, 'scenes');

  const audioAt = Date.now();
  await mapWithConcurrency(storyboard.scenes.map((_, index) => index), PIPELINE_CONCURRENCY, async (index) => {
    const audio = await generateSceneAudio(storyboard.scenes[index], { fps: storyboard.fps, projectId, voice });
    storyboard.scenes[index] = { ...storyboard.scenes[index], ...audio };
  });
  console.log('MIXED audio', seconds(audioAt));

  const planAt = Date.now();
  const plans = await planSceneMoments(assetModel(), storyboard);
  console.log('MIXED plan', seconds(planAt), plans.map((plan, index) => `${index + 1}:${plan.kind}`).join(' '));
  plans.forEach((plan, index) => console.log('MIXED why', index + 1, plan.reason));

  const project: StudioProject = {
    id: projectId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    userPrompt: topic,
    storyboard,
    files: {},
    chatHistory: [],
    status: 'ready',
    sceneProgress: Object.fromEntries(storyboard.scenes.map((scene) => [scene.id, { stage: 'ready' as const }])),
    safeAreaPlatform: 'tiktok',
  };

  const scenesAt = Date.now();
  await mapWithConcurrency(storyboard.scenes.map((_, index) => index), PIPELINE_CONCURRENCY, async (index) => {
    const sceneAt = Date.now();
    let code: string;
    try {
      code = plans[index].kind === 'image'
        ? await buildImageScene(projectId, storyboard, plans[index], index)
        : (await generateVideoSceneFile(storyboard, index)).code;
    } catch (error) {
      // One failed picture must not stop the video, so the scene falls back to parts.
      console.log('MIXED fallback', index + 1, String(error).slice(0, 300));
      code = (await generateVideoSceneFile(storyboard, index)).code;
    }
    project.files[`Scene${index + 1}.tsx`] = code;
    console.log('MIXED scene done', index + 1, plans[index].kind, seconds(sceneAt));
  });
  console.log('MIXED scenes', imageModel(), seconds(scenesAt));

  project.files['MainVideo.tsx'] = generateMainVideoCode(storyboard);
  saveProject(project);

  const renderedAt = Date.now();
  const { outputPath } = await renderProvider.renderProject(project);
  const duration = storyboard.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0) / storyboard.fps;
  console.log('MIXED render', seconds(renderedAt), 'total', seconds(startedAt), 'video', `${duration.toFixed(1)}s`, projectId);
  await measureVideoStillness(outputPath, duration);
}

main().catch((error) => {
  console.log('MIXED FAILED', String(error?.stack ?? error).slice(0, 1200));
  process.exitCode = 1;
});
