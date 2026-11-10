/**
 * Spike for the fixed character rig (Fase 0, no AI): renders a hand-drawn person walking,
 * stopping, and moving between poses, plus a bare skeleton walking in place, to MP4.
 *
 *   npx tsx scripts/spike-human-rig.ts
 *
 * Output: storage/spike/human-rig/clip.mp4 and sheet.jpg.
 */
import fs from 'fs';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import sharp from 'sharp';
import { HUMAN_RIG_SOURCE } from '../src/lib/explainer/human-rig';

const FPS = 30;
const DURATION = 330;
const directory = path.join(process.cwd(), 'storage', 'spike', 'human-rig');

const ROOT = `import React from 'react';
import { AbsoluteFill, Composition, interpolate, Easing, registerRoot, useCurrentFrame } from 'remotion';
import { HUMAN_RIG, HumanRig } from './rig';
import { samplePersonParts, SamplePhone, SampleRifle } from ${JSON.stringify(path.join(process.cwd(), 'scripts', 'human-rig', 'sample-person'))};

const H = 780;
const SCALE = 0.62;
const CYCLE = 30;
const STRIDE = HUMAN_RIG.stride(H) * SCALE;
const ease = (frame, from, to) => interpolate(frame, [from, to], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });

// Timeline: walk right, settle, stand, point, explain, hold phone, aim rifle, raise hand, turn and walk back.
function timeline(f) {
  const stopPhase = 2.3;
  const stopFrame = stopPhase * CYCLE;
  if (f < stopFrame + 12) {
    const phase = Math.min(f, stopFrame) / CYCLE;
    return { x: 110 + phase * STRIDE, facing: 1, pose: 'stand', walkPhase: phase, walkMix: 1 - ease(f, stopFrame, stopFrame + 12), label: 'walk' };
  }
  const x = 110 + stopPhase * STRIDE;
  const steps = [
    [stopFrame + 12, 'stand', 'stand'], [105, 'stand', 'point'], [135, 'point', 'explain'], [165, 'explain', 'hold'],
    [195, 'hold', 'aim'], [225, 'aim', 'raiseHand'], [255, 'raiseHand', 'stand'],
  ];
  if (f >= 270) {
    const phase = (f - 270) / CYCLE;
    return { x: x - phase * STRIDE, facing: -1, pose: 'stand', walkPhase: phase, walkMix: ease(f, 270, 276), label: 'walk back' };
  }
  let current = steps[0];
  for (const step of steps) if (f >= step[0]) current = step;
  const mix = ease(f, current[0], current[0] + 14);
  const item = current[2] === 'hold' && mix > 0.5 ? { item: <SamplePhone />, hand: 'near', angle: 70 }
    : current[2] === 'aim' && mix > 0.5 ? { item: <SampleRifle />, hand: 'near', angle: 0 }
    : current[1] === 'hold' && mix < 0.5 ? { item: <SamplePhone />, hand: 'near', angle: 70 }
    : current[1] === 'aim' && mix < 0.5 ? { item: <SampleRifle />, hand: 'near', angle: 0 } : null;
  return { x, facing: 1, pose: current[1], poseTo: current[2], poseMix: mix, holding: item, label: current[2] };
}

const Spike = () => {
  const f = useCurrentFrame();
  const t = timeline(f);
  const groundY = 1500;
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(#dfe9ef, #f5efe4)' }}>
      <svg viewBox="0 0 1080 1920" width="1080" height="1920">
        <rect x="0" y={groundY} width="1080" height={1920 - groundY} fill="#b9a68a" />
        <line x1="0" y1={groundY} x2="1080" y2={groundY} stroke="#7a6a52" strokeWidth="4" />
        {Array.from({ length: 12 }, (_, i) => <line key={i} x1={i * 100} y1={groundY + 6} x2={i * 100} y2={groundY + 26} stroke="#7a6a52" strokeWidth="3" />)}
        <ellipse cx={t.x} cy={groundY} rx={70} ry={10} fill="#000" opacity="0.18" />
        <g transform={'translate(' + t.x + ' ' + groundY + ') scale(' + SCALE + ')'}>
          <HumanRig height={H} pose={t.pose} poseTo={t.poseTo} poseMix={t.poseMix} walkPhase={t.walkPhase} walkMix={t.walkMix} facing={t.facing} parts={samplePersonParts} holding={t.holding} />
        </g>
        <g transform={'translate(870 900) scale(0.4)'}>
          <line x1="-260" y1="0" x2="260" y2="0" stroke="#7a6a52" strokeWidth="6" />
          <HumanRig height={H} walkPhase={f / CYCLE} debugBones />
        </g>
        <text x="60" y="140" fontSize="54" fontFamily="sans-serif" fill="#24313a">HumanRig spike</text>
        <text x="60" y="210" fontSize="40" fontFamily="sans-serif" fill="#4a5a66">{t.label}</text>
      </svg>
    </AbsoluteFill>
  );
};

registerRoot(() => <Composition id="Spike" component={Spike} durationInFrames={${DURATION}} fps={${FPS}} width={1080} height={1920} />);
`;

async function main() {
  const startedAt = Date.now();
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'rig.tsx'), `import React from 'react';\n${HUMAN_RIG_SOURCE}\nexport { HUMAN_RIG, HumanRig };\n`);
  const entryPoint = path.join(directory, 'Root.tsx');
  fs.writeFileSync(entryPoint, ROOT);

  const serveUrl = await bundle({
    entryPoint,
    ignoreRegisterRootWarning: true,
    webpackOverride: (config) => ({ ...config, resolve: { ...config.resolve, alias: { ...(config.resolve?.alias || {}), '@': path.join(process.cwd(), 'src') } } }),
  });
  const composition = await selectComposition({ serveUrl, id: 'Spike' });

  const frames = [0, 8, 15, 22, 40, 100, 130, 160, 190, 220, 250, 290];
  const tiles: Buffer[] = [];
  for (const frame of frames) {
    const { buffer } = await renderStill({ composition, serveUrl, frame, output: null, imageFormat: 'jpeg' });
    tiles.push(await sharp(buffer as Buffer).extract({ left: 0, top: 500, width: 1080, height: 1100 }).resize(360, 367).toBuffer());
  }
  const columns = 6;
  await sharp({ create: { width: 360 * columns, height: 367 * Math.ceil(tiles.length / columns), channels: 3, background: '#000000' } })
    .composite(tiles.map((input, index) => ({ input, left: (index % columns) * 360, top: Math.floor(index / columns) * 367 })))
    .jpeg({ quality: 85 })
    .toFile(path.join(directory, 'sheet.jpg'));

  await renderMedia({ composition, serveUrl, codec: 'h264', pixelFormat: 'yuv420p', outputLocation: path.join(directory, 'clip.mp4') });
  console.log(`DONE ${Math.round((Date.now() - startedAt) / 1000)}s → ${path.join(directory, 'clip.mp4')}`);
}

main().catch((error) => {
  console.log('FAILED', String(error?.stack ?? error).slice(0, 900));
  process.exitCode = 1;
});
