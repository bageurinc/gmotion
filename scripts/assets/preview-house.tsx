import fs from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { planDurationInFrames } from '../../src/motion-kit/assets/PlanVideo';
import { validateAssetPlan } from '../../src/lib/assets';

async function main() {
  const output = path.resolve('storage/assets/house');
  await fs.mkdir(output, { recursive: true });
  const started = performance.now();
  const action = (instanceId: string, prop: string, from: number, to: number) => ({
    instanceId, prop, from, to, startSec: 0.3, endSec: 2.7, easing: 'ease-in-out',
  });
  const scene = (id: string, instances: string[], narration: string, extra: Record<string, unknown> = {}) => ({
    id, layout: 'single', durationSec: 3, instances, narration, ...extra,
  });

  const result = validateAssetPlan({
    schemaVersion: 1,
    visualPolicy: 'library-only',
    presentation: { captions: false, labels: false, names: false },
    instances: [
      { id: 'house', assetId: 'building.house', assetVersion: '0.1.0', variant: 'residential', props: { carInGarage: true, garden: true } },
      { id: 'villa', assetId: 'building.house', assetVersion: '0.1.0', variant: 'luxury', props: { carInGarage: true, garden: true } },
      { id: 'sink-kitchen', assetId: 'building.sink', assetVersion: '0.1.0', variant: 'kitchen', props: { waterRunning: true } },
      { id: 'sink-bath', assetId: 'building.sink', assetVersion: '0.1.0', variant: 'bathroom', props: { waterRunning: true } },
    ],
    scenes: [
      scene('exterior', ['house'], 'Tampak depan rumah keluarga dengan taman asri, garasi mobil, dan atap pelana.', {
        actions: [action('house', 'doorOpen', 0, 1)],
      }),
      scene('interior-overview', ['house'], 'Potongan rumah menampilkan ruang keluarga, dapur di sisi kiri, dan kamar mandi di sisi kanan.', {
        set: [{ instanceId: 'house', props: { view: 'cutaway', windowLit: true } }],
      }),
      scene('villa-exterior', ['villa'], 'Tampak luar villa mewah modern 2 lantai dengan mobil di garasi, taman lanskap, dan kolam renang.', {
        actions: [action('villa', 'doorOpen', 0, 1)],
      }),
      scene('villa-cutaway', ['villa'], 'Potongan villa mewah 2 lantai dengan kitchen island, spa bathroom, garasi mobil, dan taman kolam renang.', {
        set: [{ instanceId: 'villa', props: { view: 'cutaway', windowLit: true, waterRunning: true } }],
      }),
      scene('sink-kitchen-detail', ['sink-kitchen'], 'Close-up wastafel cuci piring dapur dengan keran leher angsa dan aliran air.'),
    ],
  });

  if (!result.ok) throw new Error(result.errors.join('\n'));
  const frames = planDurationInFrames(result.plan, 24);
  await fs.writeFile(path.join(output, 'plan.json'), JSON.stringify(result.plan, null, 2));

  const entryPoint = path.join(output, 'Root.tsx');
  await fs.writeFile(
    entryPoint,
    `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { PlanVideo } from '@/motion-kit/assets/PlanVideo';
const plan = ${JSON.stringify(result.plan)};
registerRoot(() => <>{[[540,960],[640,800],[960,540]].map(([width,height]) => (
  <Composition key={width} id={'House'+width} component={PlanVideo} defaultProps={{plan}} durationInFrames={${frames}} fps={24} width={width} height={height}/>
))}</>);`
  );

  const serveUrl = await bundle({
    entryPoint,
    webpackOverride: (config) => ({
      ...config,
      resolve: { ...config.resolve, alias: { ...config.resolve?.alias, '@': path.resolve('src') } },
    }),
  });

  for (const width of [540, 640, 960]) {
    const composition = await selectComposition({ serveUrl, id: `House${width}` });
    let from = 0;
    for (const item of result.plan.scenes) {
      const duration = Math.round(item.durationSec * 24);
      await renderStill({
        serveUrl,
        composition,
        frame: from + Math.round(duration * 0.65),
        output: path.join(output, `${width}-${item.id}.png`),
      });
      from += duration;
    }
    if (width === 540) {
      await renderMedia({
        serveUrl,
        composition,
        codec: 'h264',
        concurrency: 2,
        outputLocation: path.join(output, 'rumah-dapur-kamar-mandi.mp4'),
      });
    }
  }

  await fs.writeFile(
    path.join(output, 'evidence.json'),
    JSON.stringify(
      {
        durationSec: frames / 24,
        elapsedSec: (performance.now() - started) / 1000,
        modelCalls: 0,
        ttsCalls: 0,
        imageCalls: 0,
        stills: result.plan.scenes.length * 3,
        ratios: ['9:16', '4:5', '16:9'],
      },
      null,
      2
    )
  );
  console.log('Finished rendering preview to:', output);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
