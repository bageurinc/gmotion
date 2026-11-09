import fs from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { planDurationInFrames } from '../../src/motion-kit/assets/PlanVideo';
import { validateAssetPlan } from '../../src/lib/assets';

async function main() {
  const output = path.resolve('storage/assets/lmpv');
  await fs.mkdir(output, { recursive: true });
  const started = performance.now();

  const action = (instanceId: string, prop: string, from: number, to: number, startSec = 0.3, endSec = 2.7) => ({
    instanceId, prop, from, to, startSec, endSec, easing: 'ease-in-out',
  });

  const scene = (id: string, instances: string[], narration: string, extra: Record<string, unknown> = {}) => ({
    id, layout: 'single', durationSec: 3, instances, narration, ...extra,
  });

  const result = validateAssetPlan({
    schemaVersion: 1,
    visualPolicy: 'library-only',
    presentation: { captions: false, labels: false, names: false },
    instances: [
      {
        id: 'lmpv',
        assetId: 'vehicle.lmpv',
        assetVersion: '0.1.0',
        variant: 'family-7seater',
        props: {
          color: '#4A5560',
          view: 'exterior',
          headlights: true,
        },
      },
    ],
    scenes: [
      scene('exterior-fascia', ['lmpv'], 'Mobil LMPV 7-seater keluarga dengan fasad aerodinamis, grille krom, lampu proyektor LED, dan velg two-tone.', {
        actions: [action('lmpv', 'wheelRotation', 0, 720)],
      }),
      scene('interior-3row-cabin', ['lmpv'], 'Kabin lapang 3 baris kursi untuk 7 penumpang, dasbor floating head unit, dan AC double blower di plafon.', {
        set: [{ instanceId: 'lmpv', props: { view: 'cutaway', headlights: false } }],
      }),
      scene('engine-bay-transverse', ['lmpv'], 'Ruang mesin 1.5L melintang FWD bertenaga dengan radiator twin-fan, box filter udara, dan aki.', {
        set: [{ instanceId: 'lmpv', props: { view: 'exterior', hoodOpen: 1, headlights: false } }],
        actions: [action('lmpv', 'engineRotation', 0, 720)],
      }),
      scene('tailgate-cargo', ['lmpv'], 'Pintu bagasi hatchback terbuka ke atas dengan twin gas strut untuk akses praktis bagasi barang.', {
        set: [{ instanceId: 'lmpv', props: { view: 'exterior', hoodOpen: 0, tailgateOpen: 1 } }],
      }),
      scene('chassis-torsion-beam', ['lmpv'], 'Mekanisme sasis monocoque FWD dengan suspensi depan MacPherson, tangki BBM, knalpot lengkap, dan suspensi belakang torsion beam.', {
        set: [{ instanceId: 'lmpv', props: { view: 'chassis', hoodOpen: 0, tailgateOpen: 0 } }],
      }),
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
  <Composition key={width} id={'Lmpv'+width} component={PlanVideo} defaultProps={{plan}} durationInFrames={${frames}} fps={24} width={width} height={height}/>
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
    const composition = await selectComposition({ serveUrl, id: `Lmpv${width}` });
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
        outputLocation: path.join(output, 'mobil-lmpv-7seater.mp4'),
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
        plan: result.plan,
      },
      null,
      2
    )
  );

  console.log(`LMPV preview generated in ${(performance.now() - started).toFixed(0)} ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
