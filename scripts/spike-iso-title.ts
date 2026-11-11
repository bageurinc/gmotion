/**
 * Designs an opening title card for a copy of an isometric canvas project, saves the frames the
 * critic saw, and exports the copy so the title can be watched in the real video.
 *
 * npx tsx --env-file=.env scripts/spike-iso-title.ts --from proj_x [--title "..."] [--narration "line 1|line 2"] [--no-export]
 */
import fs from 'fs';
import path from 'path';
import { runWithUsage } from '@/lib/billing/usage';
import { getDb } from '@/lib/db/client';
import { isoCanvasMainVideo, isoTitleFrames } from '@/lib/explainer/iso-canvas/assemble';
import { improve, titleTask, type IsoTaskContext } from '@/lib/explainer/iso-canvas/build';
import { renderIsoSheet, withIsoBrowser } from '@/lib/explainer/iso-canvas/render';
import { assetModel } from '@/lib/explainer/scene-generator';
import { renderProvider } from '@/lib/render/render-service';
import { getProject, saveProject } from '@/lib/storage/project-store';
import { AspectRatioDimensions, type StudioProject } from '@/types/studio';

const value = (name: string) => process.argv.find((_, index) => process.argv[index - 1] === `--${name}`);

async function main() {
  const source = getProject(value('from') ?? '');
  if (!source?.isoCanvasPlan) throw new Error('Pass --from with an isometric canvas project id');
  const plan = source.isoCanvasPlan;
  const tag = Date.now().toString(36);
  const id = `${source.id}_title${tag}`;
  const out = path.join(process.cwd(), 'storage', 'spike', 'iso-title', tag);
  fs.mkdirSync(out, { recursive: true });

  const assets = path.join(process.cwd(), 'storage', 'projects', source.id, 'assets');
  if (fs.existsSync(assets)) fs.cpSync(assets, path.join(process.cwd(), 'storage', 'projects', id, 'assets'), { recursive: true });
  const storyboard = {
    ...source.storyboard,
    title: value('title') ?? source.storyboard.title,
    scenes: source.storyboard.scenes.map((item) => ({ ...item, audioUrl: item.audioUrl?.replace(`/api/projects/${source.id}/`, `/api/projects/${id}/`) })),
  };
  const narration = value('narration')?.split('|') ?? storyboard.scenes.map((scene) => scene.voiceoverText);
  const files = Object.fromEntries(Object.entries(source.files).map(([name, code]) => [name, code.split(`/api/projects/${source.id}/`).join(`/api/projects/${id}/`)]));
  const frame = AspectRatioDimensions[storyboard.aspectRatio];
  const model = assetModel(source.drawingModel);
  const frames = isoTitleFrames(storyboard);

  const startedAt = Date.now();
  const result = await runWithUsage({ projectId: id, preset: storyboard.preset, stage: 'generate' }, () =>
    withIsoBrowser(async (browser) => {
      const ctx: IsoTaskContext = { model, plan, frame, topic: source.userPrompt, browser };
      const designed = await improve(titleTask(ctx, { topic: source.userPrompt, title: storyboard.title, narration, frames, fps: storyboard.fps }));
      if (designed.code) {
        // Frames over the real world, not the stand-in the critic saw.
        const sheet = await renderIsoSheet(browser, { ...files, 'IsoTitle.tsx': designed.code, 'Preview.tsx': `import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { CanvasScene, paintIsoScene } from '@/motion-kit';
import type { Iso } from '@/motion-kit';
import { drawWorld } from './IsoWorld';
import { scenes } from './IsoScenes';
import { TitleCard } from './IsoTitle';
export default function Preview() {
  return (
    <AbsoluteFill>
      <CanvasScene labelTop={0.31} draw={(iso: Iso, t: number) => paintIsoScene(iso, scenes[0], t, drawWorld)} />
      <Sequence from={0} durationInFrames={${frames}} layout="none"><TitleCard duration={${frames}} /></Sequence>
    </AbsoluteFill>
  );
}` }, [0.2, 0.5, 0.9, 1.5, 2.4, frames / storyboard.fps - 0.15], frame);
        fs.writeFileSync(path.join(out, 'real-sheet.jpg'), sheet.sheet);
        sheet.frames.forEach((buffer, index) => fs.writeFileSync(path.join(out, `real-${index}.jpg`), buffer));
      }
      return designed;
    }));
  console.log('TITLE', JSON.stringify({ seconds: Math.round((Date.now() - startedAt) / 1000), item: result.item }));
  if (!result.code) throw new Error('No title code');
  fs.writeFileSync(path.join(out, 'IsoTitle.tsx'), result.code);

  const project: StudioProject = {
    ...source, id, storyboard, chatHistory: [], createdAt: Date.now(), updatedAt: Date.now(),
    files: { ...files, 'IsoTitle.tsx': result.code, 'MainVideo.tsx': isoCanvasMainVideo(storyboard, plan, { title: true }) },
  };
  saveProject(project);
  const usage = await getDb().all<{ calls: number; input: number; output: number }>(
    'SELECT COUNT(*) AS calls, SUM(input_tokens) AS input, SUM(output_tokens) AS output FROM ai_usage WHERE project_id = ?', [id]);
  console.log('USAGE', JSON.stringify(usage));
  console.log('OUT', out);
  if (!process.argv.includes('--no-export')) {
    const renderedAt = Date.now();
    const { outputUrl } = await renderProvider.renderProject({ ...project, safeAreaPlatform: 'tiktok' }, () => undefined);
    console.log('EXPORT', id, `${Math.round((Date.now() - renderedAt) / 1000)}s`, outputUrl);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
