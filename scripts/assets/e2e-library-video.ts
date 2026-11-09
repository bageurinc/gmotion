/**
 * End-to-end check of a library-first isometric video through the app's own code:
 * Director draft → generation job → export. The project is saved for the given owner, so it
 * opens in the studio like one made from the browser. Charges no credits.
 *
 *   npx tsx --env-file=.env scripts/assets/e2e-library-video.ts --owner <userId> --prompt "..."
 */
import { generateStoryboard } from '../../src/lib/pipeline/director-agent';
import { prepareGeneration, runGeneration } from '../../src/lib/pipeline/generation-job';
import { libraryDraftNote } from '../../src/lib/pipeline/library-video';
import { getProject, saveProject } from '../../src/lib/storage/project-store';
import { LocalRemotionRenderProvider } from '../../src/lib/render/render-service';
import type { StudioProject } from '../../src/types/studio';

const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

async function main() {
  const prompt = argument('prompt') ?? 'Mobil listrik dan mobil bensin berhenti saat lampu merah, lalu jalan lagi saat lampu hijau.';
  const startedAt = Date.now();
  const storyboard = await generateStoryboard(prompt, 'world', '9:16', { strict: true, libraryNote: await libraryDraftNote(prompt) });
  const id = `proj_libe2e_${Date.now()}`;
  const project: StudioProject = {
    id, ownerId: argument('owner'), createdAt: Date.now(), updatedAt: Date.now(), userPrompt: prompt, storyboard,
    drawingModel: 'gemini', files: {}, chatHistory: [], status: 'draft', visualPolicy: 'library-first',
  };
  saveProject(project);
  console.log(`DRAFT ${id}: ${storyboard.scenes.length} scenes in ${Math.round((Date.now() - startedAt) / 1000)}s`);
  for (const scene of storyboard.scenes) console.log(`  - ${scene.voiceoverText}`);

  const generateAt = Date.now();
  const prepared = prepareGeneration(project);
  saveProject(prepared);
  await runGeneration(prepared);
  const done = getProject(id)!;
  console.log(`GENERATE ${done.status} in ${Math.round((Date.now() - generateAt) / 1000)}s`);
  console.log(`  library: ${JSON.stringify(done.libraryReport)}`);
  console.log(`  files: ${Object.keys(done.files).join(', ')}`);
  console.log(`  message: ${done.chatHistory.at(-1)?.content}`);
  if (done.status !== 'ready' && done.status !== 'idle') { console.log(`  error: ${done.generationError}`); process.exitCode = 1; return; }

  const renderAt = Date.now();
  const { outputUrl } = await new LocalRemotionRenderProvider().renderProject(done);
  console.log(`EXPORT ${outputUrl} in ${Math.round((Date.now() - renderAt) / 1000)}s`);
}

main().catch((error) => { console.error('FAILED', error instanceof Error ? error.stack : error); process.exitCode = 1; });
