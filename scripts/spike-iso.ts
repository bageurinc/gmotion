import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import type { ChromiumOptions } from '@remotion/renderer';
import sharp from 'sharp';
import type { IsoWorld } from '../src/motion-kit/world/IsoStage';
import type { Vec3 } from '../src/motion-kit/world/iso-math';

/**
 * Renderer gate for the isometric engine. The world below is hand-written test data, so this
 * measures the renderer alone and spends no model tokens.
 */
const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const gl = argument('gl', 'angle') as NonNullable<ChromiumOptions['gl']>;
const stillsOnly = process.argv.includes('--stills-only');
const directory = path.join(process.cwd(), 'storage', 'spike', 'iso', 'hp');
const FPS = 30;
const DURATION = 240;

const cable: Vec3[] = [[0, 1, 7.7], [0, 0.85, 9.2], [2.5, 0.75, 10], [6, 0.75, 9.4], [7.2, 0.9, 7.2]];
const current: Vec3[] = [...[...cable].reverse().map(([x, y, z]): Vec3 => [x, y + 0.14, z]), [0, 1.4, 6.8], [-1.3, 1.4, 5.2]];

const world: IsoWorld = {
  background: '#F4EEE2',
  accent: '#F2542D',
  ink: '#1F2A37',
  solids: [
    { id: 'table', shape: 'box', at: [0, 0, 1], size: [22, 0.5, 26], color: '#E4C49B' },
    { id: 'floor', shape: 'plate', at: [0, 0.5, 0], size: [7.2, 0.25, 15.2], color: '#AEB6C1', radius: 0.8 },
    { id: 'frame', shape: 'plate', at: [0, 0.5, 0], size: [7.4, 1.05, 15.4], color: '#D6DBE2', radius: 0.9, wall: 0.28 },
    { id: 'battery', shape: 'plate', at: [-1.35, 0.75, 1.6], size: [3.9, 0.5, 8.4], color: '#38A3D1', radius: 0.25 },
    { id: 'board-side', shape: 'box', at: [1.95, 0.75, -0.6], size: [2.5, 0.12, 12.6], color: '#2F9E6E' },
    { id: 'board-top', shape: 'box', at: [-1.35, 0.75, -5.05], size: [4.1, 0.12, 3.7], color: '#2F9E6E' },
    { id: 'chip', shape: 'plate', at: [1.95, 0.87, -2.6], size: [1.7, 0.24, 1.7], color: '#3A4150', radius: 0.08 },
    { id: 'shield', shape: 'plate', at: [1.95, 0.87, 1], size: [1.9, 0.18, 2.8], color: '#C4CBD4', radius: 0.08 },
    { id: 'chip-small', shape: 'plate', at: [1.95, 0.87, 3.6], size: [1.1, 0.16, 1.1], color: '#3A4150', radius: 0.06 },
    { id: 'camera-a', shape: 'cylinder', at: [-2.1, 0.87, -5.3], size: [1.6, 0.42, 1.6], color: '#4A5263' },
    { id: 'camera-b', shape: 'cylinder', at: [-0.4, 0.87, -5.3], size: [1.6, 0.42, 1.6], color: '#4A5263' },
    { id: 'port', shape: 'plate', at: [0, 0.75, 7.05], size: [1.8, 0.4, 0.8], color: '#C4CBD4', radius: 0.14 },
    { id: 'speaker', shape: 'plate', at: [2.15, 0.75, 6.4], size: [1.7, 0.32, 1.7], color: '#59616F', radius: 0.12 },
    { id: 'flex', shape: 'box', at: [-1.35, 0.87, -2.9], size: [1.2, 0.3, 0.5], color: '#E8A13A' },
    { id: 'cover', shape: 'plate', at: [0, 1.55, 0], size: [7.4, 0.18, 15.4], color: '#8FB7A6', radius: 0.9, moves: [{ from: 34, to: 76, offset: [7, 7, -9] }] },
    { id: 'cable', shape: 'tube', points: cable, color: '#F7F7F5', radius: 0.14 },
    { id: 'charger', shape: 'plate', at: [7.2, 0.5, 6.2], size: [2.6, 1.8, 2.6], color: '#F7F7F5', radius: 0.3 },
  ],
  camera: [
    { frame: 0, target: [0, 1, 1], zoom: 44 },
    { frame: 30, target: [0, 1, 1], zoom: 44 },
    { frame: 82, target: [1, 1, 0], zoom: 58 },
    { frame: 112, target: [-1.3, 1, 2.6], zoom: 112 },
    { frame: 160, target: [-1.3, 1, 2.6], zoom: 112 },
    { frame: 186, target: [1.95, 1, -1], zoom: 128 },
    { frame: 222, target: [0, 1, 1], zoom: 44 },
  ],
  flows: [{ points: current, from: 96, to: 170 }],
  highlights: [
    { id: 'battery', from: 104, to: 168 },
    { id: 'chip', from: 180, to: 222 },
  ],
  labels: [
    { text: 'Baterai', at: [-1.35, 1.3, 1.6], from: 112, to: 168 },
    { text: 'Chip pengatur daya', at: [1.95, 1.2, -2.6], from: 188, to: 222 },
  ],
};

const rootCode = `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { IsoStage } from '@/motion-kit/world/IsoStage';
import world from './world.json';

const Clip: React.FC = () => <IsoStage world={world as never} />;

registerRoot(() => <Composition id="Iso" component={Clip} durationInFrames={${DURATION}} fps={${FPS}} width={1080} height={1920} />);
`;

const seconds = (startedAt: number) => ((Date.now() - startedAt) / 1000).toFixed(1) + 's';

async function main() {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'world.json'), JSON.stringify(world, null, 2));
  const entryPoint = path.join(directory, 'Root.tsx');
  fs.writeFileSync(entryPoint, rootCode);

  const bundledAt = Date.now();
  const srcDir = path.join(process.cwd(), 'src');
  const serveUrl = await bundle({
    entryPoint,
    ignoreRegisterRootWarning: true,
    webpackOverride: (config) => ({ ...config, resolve: { ...config.resolve, alias: { ...(config.resolve?.alias || {}), '@': srcDir } } }),
  });
  console.log('ISO bundle', seconds(bundledAt));

  const chromiumOptions: ChromiumOptions = { gl };
  const composition = await selectComposition({ serveUrl, id: 'Iso', chromiumOptions });

  const stillsAt = Date.now();
  const samples = [10, 60, 130, 200];
  const frames: Buffer[] = [];
  for (const frame of samples) {
    const { buffer } = await renderStill({ composition, serveUrl, frame, output: null, imageFormat: 'png', chromiumOptions });
    frames.push(buffer as Buffer);
    fs.writeFileSync(path.join(directory, `frame-${gl}-${frame}.png`), buffer as Buffer);
  }
  console.log('ISO stills', samples.length, seconds(stillsAt));

  const { buffer: again } = await renderStill({ composition, serveUrl, frame: samples[2], output: null, imageFormat: 'png', chromiumOptions });
  const hash = (input: Buffer) => crypto.createHash('sha256').update(input).digest('hex');
  console.log('ISO deterministic', hash(again as Buffer) === hash(frames[2]));

  const thumbs = await Promise.all(frames.map((input) => sharp(input).resize(405, 720).toBuffer()));
  await sharp({ create: { width: 405 * thumbs.length, height: 720, channels: 3, background: '#000000' } })
    .composite(thumbs.map((input, index) => ({ input, left: index * 405, top: 0 })))
    .jpeg({ quality: 88 })
    .toFile(path.join(directory, `sheet-${gl}.jpg`));

  if (stillsOnly) return;
  const renderedAt = Date.now();
  await renderMedia({ composition, serveUrl, codec: 'h264', pixelFormat: 'yuv420p', outputLocation: path.join(directory, `clip-${gl}.mp4`), chromiumOptions });
  console.log('ISO render', `${DURATION} frames`, seconds(renderedAt));
}

main().catch((error) => {
  console.log('ISO FAILED', String(error?.stack ?? error).slice(0, 1200));
  process.exitCode = 1;
});
