/**
 * Runs isometric canvas chat revisions on a copy of a project, so the original and its revision
 * allowance stay untouched, then exports the copy.
 *
 * npx tsx --env-file=.env scripts/spike-iso-revise.ts --from proj_x --message "..." [--message "..."] [--scene 2]
 */
import fs from 'fs';
import path from 'path';
import { runWithUsage } from '@/lib/billing/usage';
import { getDb } from '@/lib/db/client';
import { reviseIsoCanvas } from '@/lib/explainer/iso-canvas/revise';
import { assetModel } from '@/lib/explainer/scene-generator';
import { renderProvider } from '@/lib/render/render-service';
import { getProject, saveProject } from '@/lib/storage/project-store';
import type { StudioProject } from '@/types/studio';

const values = (name: string) => process.argv.flatMap((arg, index) => (arg === `--${name}` ? [process.argv[index + 1]] : []));

async function main() {
  const from = values('from')[0];
  const source = from ? getProject(from) : null;
  if (!source) throw new Error('Pass --from with an existing project id');
  const scene = values('scene')[0];
  const id = `${source.id}_rev${Date.now().toString(36)}`;
  // The copy needs its own audio files: export serves assets from the project's own folder.
  const assets = path.join(process.cwd(), 'storage', 'projects', source.id, 'assets');
  if (fs.existsSync(assets)) fs.cpSync(assets, path.join(process.cwd(), 'storage', 'projects', id, 'assets'), { recursive: true });
  const storyboard = {
    ...source.storyboard,
    scenes: source.storyboard.scenes.map((item) => ({ ...item, audioUrl: item.audioUrl?.replace(`/api/projects/${source.id}/`, `/api/projects/${id}/`) })),
  };
  // MainVideo.tsx embeds each scene's audio URL in its overlay script.
  const files = Object.fromEntries(Object.entries(source.files).map(([name, code]) => [name, code.split(`/api/projects/${source.id}/`).join(`/api/projects/${id}/`)]));
  let project: StudioProject = { ...source, id, storyboard, files, chatHistory: [], createdAt: Date.now(), updatedAt: Date.now() };
  saveProject(project);
  for (const message of values('message')) {
    const startedAt = Date.now();
    const result = await runWithUsage({ projectId: id, preset: project.storyboard.preset, stage: 'revision' }, () =>
      reviseIsoCanvas(assetModel(project.drawingModel), project, message, scene ? Number(scene) - 1 : null));
    project = result.project;
    saveProject(project);
    console.log('REVISION', JSON.stringify({ message, changed: result.changed, seconds: Math.round((Date.now() - startedAt) / 1000), reply: result.reply }));
  }
  const usage = await getDb().all<{ calls: number; input: number; output: number }>(
    'SELECT COUNT(*) AS calls, SUM(input_tokens) AS input, SUM(output_tokens) AS output FROM ai_usage WHERE project_id = ?', [id]);
  console.log('USAGE', JSON.stringify(usage));
  const renderedAt = Date.now();
  const { outputUrl } = await renderProvider.renderProject({ ...project, safeAreaPlatform: 'tiktok' }, () => undefined);
  console.log('EXPORT', id, `${Math.round((Date.now() - renderedAt) / 1000)}s`, outputUrl);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
