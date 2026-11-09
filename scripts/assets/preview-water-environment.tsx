import fs from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { validateAssetPlan } from '../../src/lib/assets';

async function main() {
  const noText = process.argv.includes('--no-text');
  const output = path.resolve('storage/assets/water-environment', noText ? 'no-text' : '.');
  await fs.mkdir(output, { recursive: true });
  const started = performance.now();
  const result = validateAssetPlan({
    schemaVersion: 1, visualPolicy: 'library-only',
    ...(noText ? { presentation: { captions: false, labels: false, names: false } } : {}),
    instances: [
      { id: 'river', assetId: 'environment.water-channel', assetVersion: '0.1.0', variant: 'river', props: {} },
      { id: 'canal', assetId: 'environment.water-channel', assetVersion: '0.1.0', variant: 'canal', props: { bankColor: '#B0B8AC' } },
      ...['coagulation', 'sedimentation', 'filtration', 'disinfection'].map((variant) => ({ id: variant, assetId: 'environment.water-treatment', assetVersion: '0.1.0', variant, props: {} })),
    ],
    scenes: [
      { id: 'river', instance: 'river', label: 'Hilir', anchor: 'outlet', narration: 'Air mengalir dari hulu ke hilir.' },
      { id: 'canal', instance: 'canal', label: 'Saluran', anchor: 'center', narration: 'Saluran terbuka mengarahkan aliran air.' },
      { id: 'mix', instance: 'coagulation', label: 'Koagulasi / flokulasi', anchor: 'coagulation', narration: 'Koagulasi dan flokulasi membantu membentuk gumpalan partikel.' },
      { id: 'settle', instance: 'sedimentation', label: 'Pengendapan', anchor: 'sedimentation', narration: 'Gumpalan mengendap di bak pengendapan.' },
      { id: 'filter', instance: 'filtration', label: 'Filtrasi', anchor: 'filtration', narration: 'Air melewati media penyaring.' },
      { id: 'disinfect', instance: 'disinfection', label: 'Disinfeksi', anchor: 'disinfection', narration: 'Disinfeksi adalah tahap berikutnya. Ilustrasi ini bukan jaminan air layak minum.' },
    ].map(({ id, instance, label, anchor, narration }) => ({
      id, layout: 'single', durationSec: 3, instances: [instance], narration,
      focus: [{ instanceId: instance, anchor, label }],
      actions: [
        ...(id === 'mix' ? [{ instanceId: instance, prop: 'flocculation', from: 0, to: 1, startSec: 0, endSec: 3, easing: 'linear' }] : []),
        ...(id === 'settle' ? [{ instanceId: instance, prop: 'settling', from: 0, to: 1, startSec: 0, endSec: 3, easing: 'linear' }] : []),
      ],
    })),
  });
  if (!result.ok) throw new Error(result.errors.join('\n'));
  await fs.writeFile(path.join(output, 'plan.json'), JSON.stringify(result.plan, null, 2));
  const entryPoint = path.join(output, 'Root.tsx');
  await fs.writeFile(entryPoint, `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { PlanVideo } from '@/motion-kit/assets/PlanVideo';
const plan = ${JSON.stringify(result.plan)};
registerRoot(() => <>{[[540,960],[640,800],[960,540]].map(([width,height]) => <Composition key={width} id={'Water'+width} component={PlanVideo} defaultProps={{plan}} durationInFrames={432} fps={24} width={width} height={height}/>)}</>);`);
  const serveUrl = await bundle({ entryPoint, webpackOverride: (config) => ({ ...config, resolve: { ...config.resolve, alias: { ...config.resolve?.alias, '@': path.resolve('src') } } }) });
  for (const width of [540, 640, 960]) {
    const composition = await selectComposition({ serveUrl, id: `Water${width}` });
    for (const [index, name] of ['river', 'canal', 'mix', 'settle', 'filter', 'disinfect'].entries()) {
      await renderStill({ serveUrl, composition, frame: index * 72 + 40, output: path.join(output, `${width}-${name}.png`) });
    }
    if (width === 540) await renderMedia({ serveUrl, composition, codec: 'h264', concurrency: 2, outputLocation: path.join(output, 'sungai-dan-pengolahan-air.mp4') });
  }
  await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify({ durationSec: 18, elapsedSec: (performance.now() - started) / 1000, modelCalls: 0, ttsCalls: 0, imageCalls: 0, stills: 18, ratios: ['9:16', '4:5', '16:9'] }, null, 2));
  console.log(output);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
