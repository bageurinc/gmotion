import fs from 'fs';
import path from 'path';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import type { Storyboard } from '@/types/studio';
import { blankCanvas, generateImage, imageChangePrompt, matchesAspect, pixelate, sceneImagePrompt } from './image-generator';
import { assetModel, composeImageScene } from './scene-generator';
import { buildImageShots, fillLongShots, locateObjects, MAX_SCENE_STATES, momentFrames, ScenePlan } from './scene-moments';

/** Draws a scene's states, one from the other so they stay one picture, and returns its code. */
export async function buildImageScene(projectId: string, storyboard: Storyboard, plan: ScenePlan, index: number): Promise<string> {
  const scene = storyboard.scenes[index];
  const states = (plan.poses.length ? plan.poses : [scene.visualPrompt]).slice(0, MAX_SCENE_STATES);

  const canvas = await blankCanvas(storyboard.aspectRatio, storyboard.palette.background);
  const images = [await generateImage(sceneImagePrompt(storyboard, index, states[0]), storyboard.aspectRatio, canvas)];
  for (const change of states.slice(1)) {
    images.push(await generateImage(imageChangePrompt(change), storyboard.aspectRatio, images[images.length - 1]));
  }
  const shapes = await Promise.all(images.map((image) => matchesAspect(image, storyboard.aspectRatio)));
  if (shapes.includes(false)) throw new Error('Image came back in the wrong shape');
  // States are drawn from the model's own pictures and snapped to the grid afterwards, so the grid never feeds back into the next drawing.
  if (storyboard.artStyle === 'pixel') {
    images.splice(0, images.length, ...(await Promise.all(images.map((image) => pixelate(image, storyboard.aspectRatio)))));
  }

  const assetsDir = path.join(process.cwd(), 'storage', 'projects', projectId, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  const sources = images.map((image, state) => {
    const name = `${scene.id}-state-${state}.png`;
    fs.writeFileSync(path.join(assetsDir, name), image);
    return `/api/projects/${projectId}/assets/${name}`;
  });

  const moments = plan.moments.length ? plan.moments : [{ phrase: '', pose: 0, focus: null, label: null }];
  const boxes = await Promise.all(images.map((image, state) => {
    const wanted = moments.filter((moment) => Math.min(moment.pose, images.length - 1) === state && moment.focus).map((moment) => moment.focus as string);
    return locateObjects(assetModel(), image, [...new Set(wanted)]);
  }));
  const frames = momentFrames(moments, scene.wordTimings, scene.durationInFrames, storyboard.fps);
  const shots = fillLongShots(buildImageShots(moments, frames, boxes, images.length), scene.durationInFrames, storyboard.fps);

  const code = composeImageScene(storyboard, index, sources, shots);
  const validation = validateSceneCode(code, `Scene${index + 1}.tsx`);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  return code;
}
