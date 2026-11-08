/**
 * Runs the Isometric path the app uses, without the login step: real draft, generation job, and MP4 export.
 *
 * npx tsx --env-file=.env scripts/spike-iso-job.ts --prompt "Gimana cara kerja paru-paru?"
 */
import { generateStoryboard } from '@/lib/pipeline/director-agent';
import { prepareGeneration, runGeneration } from '@/lib/pipeline/generation-job';
import { renderProvider } from '@/lib/render/render-service';
import { getProject, saveProject } from '@/lib/storage/project-store';
import type { StudioProject } from '@/types/studio';

const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

async function main() {
  const prompt = argument('prompt', 'Gimana cara kerja paru-paru?');
  const startedAt = Date.now();
  const storyboard = await generateStoryboard(prompt, 'world', '9:16', { strict: true });
  const draftSeconds = (Date.now() - startedAt) / 1000;
  const id = `proj_${Date.now()}_isojob`;
  const draft: StudioProject = { id, createdAt: Date.now(), updatedAt: Date.now(), userPrompt: prompt, storyboard, files: {}, chatHistory: [], status: 'draft' };
  saveProject(draft);

  const generatedAt = Date.now();
  const prepared = prepareGeneration(draft);
  saveProject(prepared);
  await runGeneration(prepared);
  const generated = getProject(id);
  if (!generated) throw new Error('Project disappeared');
  const generateSeconds = (Date.now() - generatedAt) / 1000;
  console.log('JOB', id, 'status', generated.status, 'scenes', generated.storyboard.scenes.length, 'progress', JSON.stringify(generated.sceneProgress).slice(0, 300));
  console.log('JOB chat', JSON.stringify(generated.chatHistory.at(-1) ?? null).slice(0, 400));
  if (generated.status === 'error') return;

  const renderedAt = Date.now();
  const { outputUrl } = await renderProvider.renderProject({ ...generated, safeAreaPlatform: 'tiktok' }, () => undefined);
  const frames = generated.storyboard.scenes.reduce((total, scene) => total + scene.durationInFrames, 0);
  console.log('JOB draft', draftSeconds.toFixed(0) + 's', 'generate', generateSeconds.toFixed(0) + 's', 'export', ((Date.now() - renderedAt) / 1000).toFixed(0) + 's', 'video', (frames / 30).toFixed(1) + 's', outputUrl);
}

main().catch((error) => {
  console.log('JOB FAILED', String(error?.stack ?? error).slice(0, 1500));
  process.exitCode = 1;
});
