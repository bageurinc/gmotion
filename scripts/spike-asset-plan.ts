/**
 * Spike: prompt → catalog subset → model plan → validation → narration → render.
 * Every visible object comes from the asset registry; the model writes no SVG or code.
 *
 *   npx tsx --env-file=.env scripts/spike-asset-plan.ts --run ev --topic "Apa beda mobil listrik dan mobil bensin?"
 */
import fs from 'fs';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import sharp from 'sharp';
import { callChat } from '../src/lib/explainer/asset-generator';
import { COPY_ANTI_SLOP_RULES } from '../src/lib/pipeline/anti-slop';
import { generateSceneAudio } from '../src/lib/pipeline/tts-engine';
import { describeForPrompt, findAssets, PLAN_LIMITS, registrySnapshot, validateAssetPlan, type AssetPlan } from '../src/lib/assets';
import { retimePlan } from '../src/lib/assets/plan-state';
import type { SceneSpec } from '../src/types/studio';

const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const topic = argument('topic', 'Apa beda mobil listrik dan mobil bensin?');
const run = argument('run', 'ev');
const voice = argument('voice', 'Puck');
const model = process.env.DIRECTOR_MODEL || 'ag/gemini-3.8-flash-high';
const directory = path.join(process.cwd(), 'storage', 'spike', 'asset-plan', run);
const FPS = 30;

const SYSTEM = `You plan short vertical (9:16) explainer videos in Bahasa Indonesia using ONLY the registered assets given to you.
Return one JSON object and nothing else, with this shape:
{
  "schemaVersion": 1,
  "visualPolicy": "library-only",
  "instances": [{ "id": "kebab-id", "assetId": "...", "assetVersion": "...", "variant": "...", "props": { } }],
  "scenes": [{
    "id": "kebab-id",
    "layout": "single" | "close-up" | "side-by-side" | "road",
    "durationSec": number,
    "instances": ["instance ids shown in this scene"],
    "narration": "one or two spoken sentences in casual, clear Bahasa Indonesia",
    "set": [{ "instanceId": "...", "props": { } }],
    "focus": [{ "instanceId": "...", "anchor": "...", "label": "short Indonesian label, max 3 words" }],
    "actions": [{ "instanceId": "...", "prop": "...", "from": number, "to": number, "startSec": number, "endSec": number, "easing": "linear" | "ease-in-out" | "ease-out" }]
  }]
}
Rules:
- Use only assetId, assetVersion, variant, prop names, and anchor names from the catalog. Never invent any.
- Props listed with "variants" are allowed only on those variants. Actions may only target props marked animatable.
- Layouts: "single" and "close-up" take exactly 1 car; "side-by-side" takes exactly 2 cars; "road" takes one road plus 1-4 cars. A road appears only in the road layout.
- On a road, wheel spin follows the road automatically, and energy dots move by themselves while energyFlow is on. Do not animate those.
- "set" changes non-animated props (for example view) from that scene onward. Use view "chassis" or "cutaway" when narration talks about hidden parts.
- At most 2 focus labels per scene; each must point at a part the narration in that scene talks about. Side-by-side already prints each car's name, so never label a whole car there; label parts instead, or none.
- 4 to 6 scenes, 3 to 7 seconds each (about 2.4 spoken words per second). At most ${PLAN_LIMITS.instances} instances.
- Every important thing said must be visible through the chosen assets. If the catalog cannot show something, do not talk about it.
- Respect the limitations in the catalog. Do not state numbers such as range, capacity, efficiency, or price.
${COPY_ANTI_SLOP_RULES}`;

async function requestPlan(catalog: unknown): Promise<{ plan: AssetPlan; attempts: number; seconds: number }> {
  const startedAt = Date.now();
  let feedback = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { text } = await callChat({
      model,
      system: SYSTEM,
      content: `Topic: "${topic}"\nCatalog: ${JSON.stringify(catalog)}${feedback}`,
      maxTokens: 8000,
    });
    const json = text.match(/\{[\s\S]*\}/);
    const result = json ? validateAssetPlan(safeParse(json[0])) : { ok: false as const, errors: ['Response was not JSON'] };
    if (result.ok) return { plan: result.plan, attempts: attempt, seconds: Math.round((Date.now() - startedAt) / 1000) };
    console.log(`PLAN attempt ${attempt} rejected:\n  ${result.errors.slice(0, 12).join('\n  ')}`);
    feedback = `\n\nYour previous plan was rejected. Fix these errors and return the full corrected JSON:\n${result.errors.slice(0, 20).join('\n')}\n\nPrevious plan:\n${json?.[0] ?? text.slice(0, 4000)}`;
  }
  throw new Error('No valid plan after 3 attempts');
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

/** Asks the model for a plan, adds narration audio, and writes plan.json. */
async function makePlan(): Promise<boolean> {
  const planFile = path.join(directory, 'plan.json');
  const matches = findAssets(topic, 'world');
  if (!matches.length) {
    console.log('PLAN no registered asset matches this topic; library-first would fall back here.');
    return false;
  }
  const catalog = describeForPrompt(matches);
  console.log('PLAN catalog', matches.map((match) => `${match.entry.assetId} [${match.variants.join(',') || 'all'}]`).join(', '));

  // The road is an environment asset; offer it whenever a vehicle matched.
  const withRoad = matches.some((match) => match.entry.assetId === 'vehicle.car') && !matches.some((match) => match.entry.assetId === 'environment.road')
    ? [...catalog, ...describeForPrompt(findAssets('jalan', 'world'))]
    : catalog;

  const { plan: draft, attempts, seconds } = await requestPlan(withRoad);
  console.log(`PLAN ok after ${attempts} attempt(s), ${seconds}s:`);
  for (const scene of draft.scenes) console.log(`  [${scene.layout}] ${scene.narration} | focus: ${scene.focus.map((f) => f.label).join(', ') || '-'}`);

  const audio: string[] = [];
  const durations: number[] = [];
  for (const scene of draft.scenes) {
    const result = await generateSceneAudio({ id: `asset-${scene.id}`, voiceoverText: scene.narration } as SceneSpec, { fps: FPS, projectId: `asset-plan-${run}`, voice });
    const fileName = result.audioUrl.split('/').pop()!.split('?')[0];
    fs.copyFileSync(path.join(process.cwd(), 'storage', 'projects', `asset-plan-${run}`, 'assets', fileName), path.join(directory, 'public', fileName));
    audio.push(fileName);
    durations.push(Math.max(2.5, result.durationInFrames / FPS + 0.35));
  }
  const plan = retimePlan(draft, durations);
  const check = validateAssetPlan(plan);
  if (!check.ok) throw new Error(`Retimed plan invalid: ${check.errors.join('; ')}`);
  const total = durations.reduce((sum, value) => sum + value, 0);
  console.log(`AUDIO ${total.toFixed(1)}s`);

  fs.writeFileSync(planFile, JSON.stringify({ topic, model, registry: registrySnapshot(), plan, audio }, null, 2));
  return true;
}

async function main() {
  const startedAt = Date.now();
  fs.mkdirSync(path.join(directory, 'public'), { recursive: true });
  const planFile = path.join(directory, 'plan.json');
  if (!(process.argv.includes('--reuse') && fs.existsSync(planFile))) {
    const made = await makePlan();
    if (!made) return;
  } else {
    console.log('PLAN reusing', planFile);
  }
  const { plan } = JSON.parse(fs.readFileSync(planFile, 'utf8')) as { plan: AssetPlan };
  const entryPoint = path.join(directory, 'Root.tsx');
  fs.writeFileSync(entryPoint, `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { PlanVideo, planDurationInFrames } from '@/motion-kit/assets/PlanVideo';
import data from './plan.json';

const Clip: React.FC = () => <PlanVideo plan={data.plan as never} audio={data.audio} />;
registerRoot(() => <Composition id="Plan" component={Clip} durationInFrames={planDurationInFrames(data.plan as never, ${FPS})} fps={${FPS}} width={1080} height={1920} />);
`);

  const serveUrl = await bundle({
    entryPoint,
    publicDir: path.join(directory, 'public'),
    ignoreRegisterRootWarning: true,
    webpackOverride: (config) => ({ ...config, resolve: { ...config.resolve, alias: { ...(config.resolve?.alias || {}), '@': path.join(process.cwd(), 'src') } } }),
  });
  const composition = await selectComposition({ serveUrl, id: 'Plan' });

  const frames: Buffer[] = [];
  let from = 0;
  for (const scene of plan.scenes) {
    const length = Math.round(scene.durationSec * FPS);
    const { buffer } = await renderStill({ composition, serveUrl, frame: from + Math.floor(length * 0.6), output: null, imageFormat: 'jpeg' });
    fs.writeFileSync(path.join(directory, `scene-${scene.id}.jpg`), buffer as Buffer);
    frames.push(await sharp(buffer as Buffer).resize(360, 640).toBuffer());
    from += length;
  }
  const columns = Math.min(frames.length, 6);
  await sharp({ create: { width: 360 * columns, height: 640 * Math.ceil(frames.length / columns), channels: 3, background: '#000000' } })
    .composite(frames.map((input, index) => ({ input, left: (index % columns) * 360, top: Math.floor(index / columns) * 640 })))
    .jpeg({ quality: 85 })
    .toFile(path.join(directory, 'sheet.jpg'));

  const renderStartedAt = Date.now();
  await renderMedia({ composition, serveUrl, codec: 'h264', pixelFormat: 'yuv420p', outputLocation: path.join(directory, 'clip.mp4') });
  console.log(`RENDER ${Math.round((Date.now() - renderStartedAt) / 1000)}s`);
  console.log(`DONE ${Math.round((Date.now() - startedAt) / 1000)}s → ${path.join(directory, 'clip.mp4')}`);
}

main().catch((error) => {
  console.log('FAILED', String(error?.stack ?? error).slice(0, 900));
  process.exitCode = 1;
});
