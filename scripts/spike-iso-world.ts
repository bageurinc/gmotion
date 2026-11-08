import fs from 'fs';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import type { ChromiumOptions } from '@remotion/renderer';
import sharp from 'sharp';
import { generateIsoPlan } from '../src/lib/explainer/iso-plan';
import { buildIsoWorld, IsoPlan, resolveIsoPlan } from '../src/lib/explainer/iso-world';
import { generateSceneAudio } from '../src/lib/pipeline/tts-engine';
import type { SceneSpec } from '../src/types/studio';

const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const topic = argument('topic', 'Aman nggak sih HP dicas semalaman?');
const run = argument('run', 'hp');
const voice = argument('voice', 'Puck');
const gl = argument('gl', 'angle') as NonNullable<ChromiumOptions['gl']>;
const model = process.env.ASSET_MODEL || process.env.CODER_MODEL || 'ag/gemini-3.8-flash-high';
const sheetOnly = process.argv.includes('--sheet-only');
const directory = path.join(process.cwd(), 'storage', 'spike', 'iso-world', run);
const projectId = `iso-${run}`;
const FPS = 30;
const look: 'flat' | 'lit' = process.argv.includes('--lit') ? 'lit' : 'flat';
const VIEW = { width: 1080, height: 1920, centerY: 0.55, look };

const rootCode = `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { IsoVideo } from '@/motion-kit/world/IsoVideo';
import data from './data.json';

const Clip: React.FC = () => <IsoVideo world={data.world as never} script={data.script as never} />;
const last = data.script.beats.at(-1);

registerRoot(() => <Composition id="Iso" component={Clip} durationInFrames={last.from + last.duration} fps={${FPS}} width={${VIEW.width}} height={${VIEW.height}} />);
`;

async function main() {
  fs.mkdirSync(path.join(directory, 'public'), { recursive: true });
  const startedAt = Date.now();
  const planFile = path.join(directory, 'plan.json');
  let plan: IsoPlan;
  if (fs.existsSync(planFile)) {
    plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  } else {
    const result = await generateIsoPlan(model, topic);
    plan = result.plan;
    fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
    console.log('ISO plan', `${result.attempts} attempts`, `${Math.round(result.usage.seconds)}s`, `${result.usage.promptTokens} in`, `${result.usage.completionTokens} out`);
    if (result.firstProblems.length) console.log('ISO first answer rejected:', result.firstProblems.join(' | ').slice(0, 900));
  }
  const resolved = resolveIsoPlan(plan, { repair: true });
  plan = resolved.plan;
  console.log('ISO objects', resolved.placements.length, 'links', resolved.links.length, 'beats', plan.beats.length);
  console.log('ISO palette', JSON.stringify(plan.palette));
  console.log('ISO repairs', resolved.warnings.length ? resolved.warnings.join(' | ') : 'none');
  console.log('ISO beats', plan.beats.map((beat) => `${beat.text} [${beat.focus ?? 'wide'}]`).join(' | '));

  const audioFile = path.join(directory, 'beats.json');
  let beats;
  if (fs.existsSync(audioFile)) {
    beats = JSON.parse(fs.readFileSync(audioFile, 'utf8'));
  } else {
    let from = 0;
    beats = [];
    for (const [index, beat] of plan.beats.entries()) {
      const sceneId = `beat-${index + 1}`;
      const audio = await generateSceneAudio({ id: sceneId, voiceoverText: beat.text } as SceneSpec, { fps: FPS, projectId, voice });
      const fileName = audio.audioUrl.split('/').pop()!.split('?')[0];
      fs.copyFileSync(path.join(process.cwd(), 'storage', 'projects', projectId, 'assets', fileName), path.join(directory, 'public', fileName));
      const duration = Math.max(45, audio.durationInFrames - 8);
      beats.push({ ...beat, view: 'main', zoom: 1, from, duration, audio: fileName, wordTimings: audio.wordTimings });
      from += duration;
    }
    fs.writeFileSync(audioFile, JSON.stringify(beats, null, 2));
  }
  const last = beats.at(-1);
  console.log('ISO audio', ((last.from + last.duration) / FPS).toFixed(1) + 's');

  const world = buildIsoWorld(resolved, beats, VIEW);
  fs.writeFileSync(path.join(directory, 'data.json'), JSON.stringify({ world, script: { unit: plan.unit, palette: plan.palette, beats } }, null, 2));
  const entryPoint = path.join(directory, 'Root.tsx');
  fs.writeFileSync(entryPoint, rootCode);
  fs.cpSync(path.join(process.cwd(), 'public', 'audio'), path.join(directory, 'public', 'audio'), { recursive: true });

  const srcDir = path.join(process.cwd(), 'src');
  const serveUrl = await bundle({
    entryPoint,
    publicDir: path.join(directory, 'public'),
    ignoreRegisterRootWarning: true,
    webpackOverride: (config) => ({ ...config, resolve: { ...config.resolve, alias: { ...(config.resolve?.alias || {}), '@': srcDir } } }),
  });
  const chromiumOptions: ChromiumOptions = { gl };
  const composition = await selectComposition({ serveUrl, id: 'Iso', chromiumOptions });

  const frames: Buffer[] = [];
  for (const beat of beats) {
    const { buffer } = await renderStill({ composition, serveUrl, frame: beat.from + Math.floor(beat.duration * 0.7), output: null, imageFormat: 'jpeg', chromiumOptions });
    frames.push(await sharp(buffer as Buffer).resize(300, 533).toBuffer());
  }
  const columns = Math.min(frames.length, 5);
  await sharp({ create: { width: 300 * columns, height: 533 * Math.ceil(frames.length / 5), channels: 3, background: '#000000' } })
    .composite(frames.map((input, index) => ({ input, left: (index % 5) * 300, top: Math.floor(index / 5) * 533 })))
    .jpeg({ quality: 85 })
    .toFile(path.join(directory, 'sheet.jpg'));
  if (sheetOnly) return;

  const renderedAt = Date.now();
  await renderMedia({ composition, serveUrl, codec: 'h264', pixelFormat: 'yuv420p', outputLocation: path.join(directory, 'clip.mp4'), chromiumOptions });
  console.log('ISO render', ((Date.now() - renderedAt) / 1000).toFixed(1) + 's', 'total', Math.round((Date.now() - startedAt) / 1000) + 's');
}

main().catch((error) => {
  console.log('ISO FAILED', String(error?.stack ?? error).slice(0, 1200));
  process.exitCode = 1;
});
