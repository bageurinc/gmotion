import fs from 'fs';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import sharp from 'sharp';
import { generateWorldAsset, generateWorldScript } from '../src/lib/explainer/world-plan';
import { generateSceneAudio } from '../src/lib/pipeline/tts-engine';
import type { SceneSpec } from '../src/types/studio';

const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const topic = argument('topic', 'Aman nggak sih HP dicas semalaman?');
const run = argument('run', 'hp');
const voice = argument('voice', 'Puck');
const model = process.env.ASSET_MODEL || process.env.CODER_MODEL || 'ag/gemini-3.8-flash-high';
const directory = path.join(process.cwd(), 'storage', 'spike', 'world', run);
const projectId = `world-${run}`;
const FPS = 30;

const rootCode = `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { WorldVideo } from '@/motion-kit/world/WorldStage';
import Asset from './Asset';
import world from './world.json';

const Clip: React.FC = () => <WorldVideo world={world as never} Asset={Asset} />;
const total = world.script.beats.at(-1).from + world.script.beats.at(-1).duration;

registerRoot(() => <Composition id="World" component={Clip} durationInFrames={total} fps={${FPS}} width={1080} height={1920} />);
`;

async function main() {
  fs.mkdirSync(path.join(directory, 'public'), { recursive: true });
  const assetFile = path.join(directory, 'asset.json');
  const startedAt = Date.now();
  const asset = fs.existsSync(assetFile) ? JSON.parse(fs.readFileSync(assetFile, 'utf8')) : await generateWorldAsset(model, topic);
  fs.writeFileSync(assetFile, JSON.stringify(asset, null, 2));
  console.log('WORLD asset', Math.round((Date.now() - startedAt) / 1000) + 's', asset.manifest.parts.map((part: { id: string }) => part.id).join(','));

  const script = await generateWorldScript(model, topic, asset.manifest);
  console.log('WORLD script', JSON.stringify(script.palette), script.beats.map((beat) => `${beat.text} [${beat.focus ?? 'wide'}]`).join(' | '));

  let from = 0;
  const beats = [];
  for (const [index, beat] of script.beats.entries()) {
    const sceneId = `beat-${index + 1}`;
    const audio = await generateSceneAudio({ id: sceneId, voiceoverText: beat.text } as SceneSpec, { fps: FPS, projectId, voice });
    const fileName = audio.audioUrl.split('/').pop()!.split('?')[0];
    fs.copyFileSync(path.join(process.cwd(), 'storage', 'projects', projectId, 'assets', fileName), path.join(directory, 'public', fileName));
    const duration = Math.max(45, audio.durationInFrames - 8);
    beats.push({ ...beat, from, duration, audio: fileName, wordTimings: audio.wordTimings });
    from += duration;
  }
  console.log('WORLD audio', (from / FPS).toFixed(1) + 's');

  fs.writeFileSync(path.join(directory, 'world.json'), JSON.stringify({ manifest: asset.manifest, script: { ...script, beats } }, null, 2));
  fs.writeFileSync(path.join(directory, 'Asset.tsx'), asset.code);
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
  const composition = await selectComposition({ serveUrl, id: 'World' });

  const frames: Buffer[] = [];
  for (const beat of beats) {
    const { buffer } = await renderStill({ composition, serveUrl, frame: beat.from + Math.floor(beat.duration * 0.6), output: null, imageFormat: 'jpeg' });
    frames.push(await sharp(buffer as Buffer).resize(300, 533).toBuffer());
  }
  await sharp({ create: { width: 300 * Math.min(frames.length, 5), height: 533 * Math.ceil(frames.length / 5), channels: 3, background: '#000000' } })
    .composite(frames.map((input, index) => ({ input, left: (index % 5) * 300, top: Math.floor(index / 5) * 533 })))
    .jpeg({ quality: 82 })
    .toFile(path.join(directory, 'sheet.jpg'));
  await renderMedia({ composition, serveUrl, codec: 'h264', pixelFormat: 'yuv420p', outputLocation: path.join(directory, 'clip.mp4') });
  console.log('WORLD done', Math.round((Date.now() - startedAt) / 1000) + 's');
}

main().catch((error) => {
  console.log('WORLD FAILED', String(error?.stack ?? error).slice(0, 700));
  process.exitCode = 1;
});
