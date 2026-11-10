/**
 * Full SVG video with characters through the app's own code: (Director draft) → object draft →
 * approve → scenes → export. Login, credits, and the browser are the only parts skipped.
 *
 *   npx tsx --env-file=.env scripts/e2e-character-video.ts --project <draft project id>
 *   npx tsx --env-file=.env scripts/e2e-character-video.ts --prompt "..." --owner <user id>
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { generateStoryboard } from '../src/lib/pipeline/director-agent';
import { hasFailedScene } from '../src/lib/pipeline/draft';
import { prepareGeneration, runGeneration } from '../src/lib/pipeline/generation-job';
import { getProject, saveProject } from '../src/lib/storage/project-store';
import { LocalRemotionRenderProvider } from '../src/lib/render/render-service';
import { renderCharacterPoses } from '../src/lib/explainer/human-rig-runtime';
import type { StudioProject } from '../src/types/studio';

const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const seconds = (since: number) => Math.round((Date.now() - since) / 1000);

async function main() {
  const startedAt = Date.now();
  let project: StudioProject;
  const existing = argument('project');
  if (existing) {
    project = getProject(existing)!;
    if (!project) throw new Error(`No project ${existing}`);
  } else {
    const prompt = argument('prompt');
    if (!prompt) throw new Error('Pass --project or --prompt');
    const storyboard = await generateStoryboard(prompt, 'story-svg', '9:16', { strict: true });
    project = {
      id: `proj_rig_${Date.now()}`, ownerId: argument('owner'), createdAt: Date.now(), updatedAt: Date.now(), userPrompt: prompt,
      storyboard, drawingModel: 'gemini', files: {}, chatHistory: [], status: 'draft',
    };
    saveProject(project);
    console.log(`DRAFT ${project.id}: ${storyboard.scenes.length} scenes in ${seconds(startedAt)}s`);
    for (const scene of storyboard.scenes) console.log(`  - ${scene.voiceoverText}`);
  }
  const id = project.id;
  const out = path.join('storage', 'spike', 'character-e2e', id);
  fs.mkdirSync(out, { recursive: true });

  // --resume retries failed scenes of a drafted project, like the editor's retry button.
  const resume = process.argv.includes('--resume') && project.storySvgDraft;
  // 1. Object draft (the job stops for the user's approval).
  const draftAt = Date.now();
  if (!resume) {
    const prepared = prepareGeneration(project);
    saveProject(prepared);
    await runGeneration(prepared);
  }
  const drafted = resume ? { ...project, storySvgReviewPending: true } : getProject(id)!;
  const draft = drafted.storySvgDraft;
  if (!draft?.plan || !drafted.storySvgReviewPending) throw new Error(`Object draft did not finish: ${drafted.generationError ?? drafted.status}`);
  console.log(`OBJECT DRAFT in ${seconds(draftAt)}s`);
  for (const object of draft.plan.objects) console.log(`  - ${object.name} [${object.kind}] ${object.width}x${object.height}: ${object.description.slice(0, 120)}`);
  console.log(`  scenes: ${JSON.stringify(draft.sceneObjects)}`);
  for (const object of draft.plan.objects.filter((item) => item.kind === 'character')) {
    const h = object.height;
    const renders = renderCharacterPoses(draft.pieces![object.name], object.name);
    const markup = renders.map((render, index) => `<g transform="translate(${(index - 1) * 0.85 * h} 0)">${render.svg ?? ''}</g>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="440" viewBox="${-1.35 * h} ${-1.25 * h} ${2.9 * h} ${1.4 * h}"><rect x="-9999" y="-9999" width="99999" height="99999" fill="#e9e4da"/>${markup}</svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(out, `character-${object.name}.png`));
  }

  // 2. Approve, as the draft screen's button does, and animate the scenes.
  const generateAt = Date.now();
  const approved = prepareGeneration({ ...drafted, storySvgReviewPending: undefined });
  saveProject(approved);
  await runGeneration(approved);
  const done = getProject(id)!;
  console.log(`GENERATE ${done.status} in ${seconds(generateAt)}s`);
  console.log(`  scenes: ${JSON.stringify(Object.fromEntries(Object.entries(done.sceneProgress ?? {}).map(([key, value]) => [key, value.stage + (value.error ? `: ${value.error}` : '')])))}`);
  console.log(`  message: ${done.chatHistory.at(-1)?.content}`);
  if (done.status !== 'ready' && done.status !== 'idle') { console.log(`  error: ${done.generationError}`); process.exitCode = 1; return; }
  // The export route refuses a project with failed scenes; so does this run.
  if (hasFailedScene(done)) { console.log('  export skipped: failed scenes, as the app would refuse it'); process.exitCode = 1; return; }

  // 3. Export.
  const renderAt = Date.now();
  const { outputUrl } = await new LocalRemotionRenderProvider().renderProject(done);
  console.log(`EXPORT ${outputUrl} in ${seconds(renderAt)}s`);
  console.log(`DONE ${id} in ${seconds(startedAt)}s`);
}

main()
  .catch((error) => { console.error('FAILED', error instanceof Error ? error.stack : error); process.exitCode = 1; })
  // Open handles (database, timers) would otherwise keep the process alive after the run.
  .finally(() => process.exit());
