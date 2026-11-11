/**
 * Runs the Isometric path the app uses, without the login step: real draft, generation job, and MP4 export.
 *
 * npx tsx --env-file=.env scripts/spike-iso-job.ts --prompt "Gimana cara kerja paru-paru?"
 * npx tsx --env-file=.env scripts/spike-iso-job.ts --aspect 16:9 --owner-from proj_x --prompt "..."
 * npx tsx --env-file=.env scripts/spike-iso-job.ts --preset story-svg --owner-from proj_x --prompt "..."
 * npx tsx --env-file=.env scripts/spike-iso-job.ts --preset story-canvas --drawing-model gpt-terra --prompt "Kenapa adonan roti bisa mengembang?"
 */
import { generateStoryboard } from '@/lib/pipeline/director-agent';
import { prepareGeneration, runGeneration } from '@/lib/pipeline/generation-job';
import { renderProvider } from '@/lib/render/render-service';
import { getProject, saveProject } from '@/lib/storage/project-store';
import type { DrawingModel, StylePreset, StudioProject } from '@/types/studio';
import { runWithUsage } from '@/lib/billing/usage';
import { getDb } from '@/lib/db/client';

const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

async function main() {
  const prompt = argument('prompt', 'Gimana cara kerja paru-paru?');
  const startedAt = Date.now();
  const preset = argument('preset', 'world') as StylePreset;
  // Copying the owner lets the account that owns that project open the new one in the studio.
  const ownerFrom = argument('owner-from', '');
  const ownerId = ownerFrom ? getProject(ownerFrom)?.ownerId : undefined;
  const aspect = argument('aspect', '9:16') as '9:16' | '16:9' | '4:5';
  const storyboard = await generateStoryboard(prompt, preset, aspect, { strict: true });
  const draftSeconds = (Date.now() - startedAt) / 1000;
  const id = `proj_${Date.now()}_${preset === 'world' ? 'isojob' : preset === 'story-canvas' ? 'storyjob' : 'job'}`;
  const draft: StudioProject = {
    id, ...(ownerId ? { ownerId } : {}), createdAt: Date.now(), updatedAt: Date.now(),
    userPrompt: prompt, storyboard, files: {}, chatHistory: [], status: 'draft',
    // --drawing-model picks the model that plans and draws (gemini, gpt-terra, ...), as the studio choice does.
    drawingModel: argument('drawing-model', 'gemini') as DrawingModel,
    // Same as POST /api/projects: new isometric projects use the canvas engine.
    ...(preset === 'world' ? { isoEngine: 'canvas' as const } : {}),
  };
  saveProject(draft);

  const generatedAt = Date.now();
  const prepared = prepareGeneration(draft);
  saveProject(prepared);
  await runWithUsage({ projectId: id, preset, stage: 'generate' }, () => runGeneration(prepared));
  const generated = getProject(id);
  if (!generated) throw new Error('Project disappeared');
  const generateSeconds = (Date.now() - generatedAt) / 1000;
  console.log('JOB', id, 'status', generated.status, 'scenes', generated.storyboard.scenes.length, 'progress', JSON.stringify(generated.sceneProgress).slice(0, 300));
  console.log('JOB chat', JSON.stringify(generated.chatHistory.at(-1) ?? null).slice(0, 400));
  const report = generated.isoCanvasReport ?? generated.storyCanvasReport;
  if (report) {
    for (const item of report.items) console.log('QUALITY', item.kind, item.id, 'score', item.score, 'history', JSON.stringify(item.history), item.passed ? 'passed' : 'below', item.fallback ? 'fallback' : '');
  }
  const usage = await getDb().all<{ model: string; calls: number; input: number; output: number }>(
    'SELECT model, COUNT(*) AS calls, SUM(input_tokens) AS input, SUM(output_tokens) AS output FROM ai_usage WHERE project_id = ? GROUP BY model', [id]);
  console.log('USAGE', JSON.stringify(usage));
  if (generated.status === 'error' || Object.values(generated.sceneProgress ?? {}).some((progress) => progress.stage === 'failed')) return;

  const renderedAt = Date.now();
  const { outputUrl } = await renderProvider.renderProject({ ...generated, safeAreaPlatform: 'tiktok' }, () => undefined);
  const frames = generated.storyboard.scenes.reduce((total, scene) => total + scene.durationInFrames, 0);
  console.log('JOB draft', draftSeconds.toFixed(0) + 's', 'generate', generateSeconds.toFixed(0) + 's', 'export', ((Date.now() - renderedAt) / 1000).toFixed(0) + 's', 'video', (frames / 30).toFixed(1) + 's', outputUrl);
}

main().catch((error) => {
  console.log('JOB FAILED', String(error?.stack ?? error).slice(0, 1500));
  process.exitCode = 1;
});
