import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { generateImage, imageModel, sceneImagePrompt } from '../src/lib/explainer/image-generator';
import { composeImageScene } from '../src/lib/explainer/scene-generator';
import { generateMainVideoCode } from '../src/lib/pipeline/coder-agent';
import { validateSceneCode } from '../src/lib/pipeline/code-validator';
import { mapWithConcurrency, PIPELINE_CONCURRENCY } from '../src/lib/pipeline/concurrency';
import { generateStoryboard } from '../src/lib/pipeline/director-agent';
import { generateSceneAudio } from '../src/lib/pipeline/tts-engine';
import { renderProvider } from '../src/lib/render/render-service';
import { saveProject } from '../src/lib/storage/project-store';
import type { StudioProject } from '../src/types/studio';

const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const topic = argument('topic', 'Bagaimana cara mencuci tangan yang benar?');
const voice = argument('voice', 'Puck');
const seconds = (startedAt: number) => Math.round((Date.now() - startedAt) / 1000) + 's';

async function main() {
  const startedAt = Date.now();
  const projectId = `proj_spike_image_${Date.now()}`;
  const assetsDir = path.join(process.cwd(), 'storage', 'projects', projectId, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const storyboard = await generateStoryboard(topic, 'story-2d', '9:16', { strict: true });
  storyboard.voice = voice;
  console.log('IMAGE draft', seconds(startedAt), storyboard.title, storyboard.scenes.length, 'scenes', JSON.stringify(storyboard.palette));

  const audioAt = Date.now();
  await mapWithConcurrency(storyboard.scenes.map((_, index) => index), PIPELINE_CONCURRENCY, async (index) => {
    const audio = await generateSceneAudio(storyboard.scenes[index], { fps: storyboard.fps, projectId, voice });
    storyboard.scenes[index] = { ...storyboard.scenes[index], ...audio };
  });
  console.log('IMAGE audio', seconds(audioAt));

  const imagesAt = Date.now();
  const files: Record<string, string> = {};
  const thumbs: Buffer[] = [];
  await mapWithConcurrency(storyboard.scenes.map((_, index) => index), PIPELINE_CONCURRENCY, async (index) => {
    const imageAt = Date.now();
    const image = await generateImage(sceneImagePrompt(storyboard, index), storyboard.aspectRatio);
    const name = `${storyboard.scenes[index].id}-image.png`;
    fs.writeFileSync(path.join(assetsDir, name), image);
    thumbs[index] = await sharp(image).resize(270, 480, { fit: 'cover' }).toBuffer();
    const code = composeImageScene(storyboard, index, [`/api/projects/${projectId}/assets/${name}`], [{ from: 0, pose: 0, box: null, label: null }]);
    const validation = validateSceneCode(code, `Scene${index + 1}.tsx`);
    if (!validation.valid) throw new Error(validation.errors.join('\n'));
    files[`Scene${index + 1}.tsx`] = code;
    console.log('IMAGE scene', index + 1, seconds(imageAt));
  });
  console.log('IMAGE images', imageModel(), seconds(imagesAt));

  await sharp({ create: { width: 270 * thumbs.length, height: 480, channels: 3, background: '#000000' } })
    .composite(thumbs.map((input, index) => ({ input, left: index * 270, top: 0 })))
    .jpeg({ quality: 88 })
    .toFile(path.join(assetsDir, '..', 'images.jpg'));

  const project: StudioProject = {
    id: projectId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    userPrompt: topic,
    storyboard,
    files: { ...files, 'MainVideo.tsx': generateMainVideoCode(storyboard) },
    chatHistory: [],
    status: 'ready',
    sceneProgress: Object.fromEntries(storyboard.scenes.map((scene) => [scene.id, { stage: 'ready' as const }])),
    safeAreaPlatform: 'tiktok',
  };
  saveProject(project);

  const renderedAt = Date.now();
  const { outputPath } = await renderProvider.renderProject(project);
  console.log('IMAGE render', seconds(renderedAt), 'total', seconds(startedAt));
  console.log('IMAGE video', ((storyboard.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0)) / storyboard.fps).toFixed(1) + 's', outputPath);
}

main().catch((error) => {
  console.log('IMAGE FAILED', String(error?.stack ?? error).slice(0, 1200));
  process.exitCode = 1;
});
