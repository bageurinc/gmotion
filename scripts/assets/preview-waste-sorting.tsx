import fs from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { validateAssetPlan } from '../../src/lib/assets';

async function main() {
  const output = path.resolve('storage/assets/waste-sorting');
  await fs.mkdir(output, { recursive: true });
  const result = validateAssetPlan({
    schemaVersion: 1, visualPolicy: 'library-only',
    instances: [{ id: 'bins', assetId: 'environment.waste-sorting', assetVersion: '0.1.0', variant: 'three-stream', props: {} }],
    scenes: [
      ['leaf', 'organic', 'Daun', 'Daun masuk ke wadah bertanda daun.'],
      ['paper', 'paper', 'Kertas', 'Kertas dipisahkan ke wadah bertanda kertas.'],
      ['bottle', 'plastic', 'Botol', 'Botol dipisahkan. Ikuti aturan pengumpulan setempat.'],
    ].map(([item, anchor, label, narration], index) => ({
      id: `sort-${index}`, layout: 'single', durationSec: 2, instances: ['bins'], narration,
      set: [{ instanceId: 'bins', props: { item, progress: 0 } }],
      focus: [{ instanceId: 'bins', anchor, label }],
      actions: [{ instanceId: 'bins', prop: 'progress', from: 0, to: 1, startSec: 0.3, endSec: 1.7, easing: 'linear' }],
    })),
  });
  if (!result.ok) throw new Error(result.errors.join('\n'));
  await fs.writeFile(path.join(output, 'plan.json'), JSON.stringify(result.plan, null, 2));
  const entryPoint = path.join(output, 'Root.tsx');
  await fs.writeFile(entryPoint, `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { PlanVideo } from '@/motion-kit/assets/PlanVideo';
const plan = ${JSON.stringify(result.plan)};
registerRoot(() => <>{[[540,960],[640,800],[960,540]].map(([width,height]) => <Composition key={width} id={'Sorting'+width} component={PlanVideo} defaultProps={{plan}} durationInFrames={144} fps={24} width={width} height={height}/>)}</>);`);
  const serveUrl = await bundle({ entryPoint, webpackOverride: (config) => ({ ...config, resolve: { ...config.resolve, alias: { ...config.resolve?.alias, '@': path.resolve('src') } } }) });
  for (const width of [540, 640, 960]) {
    const composition = await selectComposition({ serveUrl, id: `Sorting${width}` });
    for (const [name, frame] of [['leaf', 24], ['paper', 72], ['bottle', 120]] as const) {
      await renderStill({ serveUrl, composition, frame, output: path.join(output, `${width}-${name}.png`) });
    }
    if (width === 540) await renderMedia({ serveUrl, composition, codec: 'h264', concurrency: 2, outputLocation: path.join(output, 'pemilahan-sampah.mp4') });
  }
  console.log(output);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
