import fs from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

async function main() {
  const output = path.resolve('storage/assets/three-car');
  await fs.mkdir(output, { recursive: true });
  const started = performance.now();

  const entryPoint = path.join(output, 'Root.tsx');
  await fs.writeFile(
    entryPoint,
    `import React from 'react';
import { Composition, registerRoot, AbsoluteFill } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { ThreeCarScene } from '@/motion-kit/three/ThreeCar';

const ThreeCarComp: React.FC<{ color?: string }> = ({ color = '#C91D24' }) => {
  return (
    <AbsoluteFill style={{ background: '#CBD5E1' }}>
      <ThreeCanvas
        width={1280}
        height={720}
        shadows="soft"
        dpr={1}
      >
        <ThreeCarScene color={color} wheelSpeed={1} lightsOn={true} orbit={true} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

registerRoot(() => (
  <Composition
    id="ThreeCarDemo"
    component={ThreeCarComp}
    durationInFrames={120}
    fps={30}
    width={1280}
    height={720}
    defaultProps={{ color: '#C91D24' }}
  />
));`
  );

  console.log('Bundling Remotion Three.js composition...');
  const serveUrl = await bundle({
    entryPoint,
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: { ...config.resolve?.alias, '@': path.resolve('src') },
      },
    }),
  });

  console.log('Selecting composition...');
  const composition = await selectComposition({ serveUrl, id: 'ThreeCarDemo' });

  console.log('Rendering 3D stills at multiple camera angles...');
  // Frame 15 (front 3/4 angle)
  await renderStill({
    serveUrl,
    composition,
    frame: 15,
    output: path.join(output, 'three-car-front-quarter.png'),
  });

  // Frame 45 (side profile)
  await renderStill({
    serveUrl,
    composition,
    frame: 45,
    output: path.join(output, 'three-car-side.png'),
  });

  // Frame 85 (rear 3/4 angle)
  await renderStill({
    serveUrl,
    composition,
    frame: 85,
    output: path.join(output, 'three-car-rear-quarter.png'),
  });

  console.log('Rendering 4-second 60fps MP4 video with Three.js WebGL...');
  await renderMedia({
    serveUrl,
    composition,
    codec: 'h264',
    concurrency: 1, // WebGL headless uses 1 concurrency for clean GPU context
    outputLocation: path.join(output, 'mobil-3d-threejs.mp4'),
  });

  console.log(`Three.js Car preview generated successfully in ${((performance.now() - started) / 1000).toFixed(1)} s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
