/**
 * Draws the Full SVG object draft for an existing project's storyboard and saves cards to look at.
 * npx tsx --env-file=.env scripts/spike-object-draft.ts --from proj_1794190079962_job [--model ag/gemini-3.8-flash-high]
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { renderNamedComponents } from '@/lib/assets/draft-runtime';
import { assetModel } from '@/lib/explainer/scene-generator';
import { generateStorySvgDraft } from '@/lib/explainer/story-svg-draft';
import { worldViewBox } from '@/lib/explainer/story-svg-shared';
import type { StudioProject } from '@/types/studio';

async function main() {
const arg = (name: string) => process.argv[process.argv.indexOf(`--${name}`) + 1];
const from = arg('from');
if (!from) throw new Error('Pass --from <projectId>');
const project = JSON.parse(fs.readFileSync(path.join('storage/projects', from, 'project.json'), 'utf8')) as StudioProject;
const model = process.argv.includes('--model') ? arg('model') : assetModel(project.drawingModel);
const out = path.join('storage/spike/object-draft', `${from}-${Date.now()}`);
fs.mkdirSync(out, { recursive: true });

const started = Date.now();
const draft = await generateStorySvgDraft(model, project.storyboard);
const seconds = Math.round((Date.now() - started) / 1000);
fs.writeFileSync(path.join(out, 'draft.json'), JSON.stringify(draft, null, 2));

const names = ['WorldBase', ...(draft.plan?.objects.map((object) => object.name) ?? [])];
const rendered = renderNamedComponents(draft.sharedWorld, names);
for (const name of names) {
  const svg = rendered[name].svg;
  if (!svg) { console.log(name, rendered[name].error); continue; }
  const object = draft.plan?.objects.find((item) => item.name === name);
  const side = object ? Math.max(object.width, object.height) * 1.3 : 0;
  const viewBox = object ? `${-side / 2} ${-object.height / 2 - side / 2} ${side} ${side}` : worldViewBox(project.storyboard.aspectRatio);
  const [, , w, h] = viewBox.split(' ').map(Number);
  const width = 900;
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round(width * h / w)}" viewBox="${viewBox}"><rect x="-5000" y="-5000" width="10000" height="10000" fill="${project.storyboard.palette.surface}"/>${svg}</svg>`;
  await sharp(Buffer.from(doc)).png().toFile(path.join(out, `${name}.png`));
}
// The setting with every object standing on its ground line, to judge scale together.
const groundY = draft.plan?.world.groundY ?? 700;
const objects = draft.plan?.objects ?? [];
const step = 1000 / (objects.length + 1);
const scene = `${rendered.WorldBase.svg}${objects.map((object, index) => `<g transform="translate(${step * (index + 1)} ${groundY})">${rendered[object.name].svg}</g>`).join('')}`;
const viewBox = worldViewBox(project.storyboard.aspectRatio);
const [, , w, h] = viewBox.split(' ').map(Number);
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${Math.round(900 * h / w)}" viewBox="${viewBox}">${scene}</svg>`)).png().toFile(path.join(out, 'together.png'));

console.log(JSON.stringify({
  out, model, seconds,
  objects: objects.map((object) => `${object.name} (${object.label}) ${object.width}x${object.height}`),
  sceneObjects: draft.sceneObjects,
  blockChars: draft.sharedWorld.length,
}, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
