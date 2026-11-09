import fs from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { planDurationInFrames } from '../../src/motion-kit/assets/PlanVideo';
import { validateAssetPlan } from '../../src/lib/assets';

async function main() {
  const output = path.resolve('storage/assets/business');
  await fs.mkdir(output, { recursive: true });
  const started = performance.now();
  const action = (instanceId: string, prop: string, from: number, to: number) => ({ instanceId, prop, from, to, startSec: 0.3, endSec: 2.7, easing: 'ease-in-out' });
  const scene = (id: string, instances: string[], narration: string, extra: Record<string, unknown> = {}) => ({ id, layout: 'single', durationSec: 3, instances, narration, ...extra });
  const result = validateAssetPlan({
    schemaVersion: 1, visualPolicy: 'library-only', presentation: { captions: false, labels: false, names: false },
    instances: [
      ['shop', 'business.shop', 'generic'], ['shelf', 'business.shelf', 'three-tier'], ['checkout', 'business.checkout', 'counter'],
      ['box', 'business.product', 'box'], ['bottle', 'business.product', 'bottle'], ['can', 'business.product', 'can'], ['pos', 'business.pos', 'desktop'],
    ].map(([id, assetId, variant]) => ({ id, assetId, assetVersion: '0.1.0', variant, props: {} })),
    scenes: [
      scene('storefront', ['shop'], 'Toko generik dengan pintu berengsel.', { actions: [action('shop', 'doorOpen', 0, 1)] }),
      scene('interior', ['shop'], 'Atap dan dinding depan disembunyikan untuk memperlihatkan rak serta kasir.', { set: [{ instanceId: 'shop', props: { view: 'cutaway', posActive: true } }], actions: [action('shop', 'scanProgress', 0, 1)] }),
      scene('shelf', ['shelf'], 'Rak tiga tingkat berisi kemasan generik.', { actions: [action('shelf', 'highlight', 0, 1)] }),
      scene('scan', ['checkout'], 'Produk bergerak melewati area pemindai.', { set: [{ instanceId: 'checkout', props: { active: true } }], actions: [action('checkout', 'scanProgress', 0, 1)] }),
      scene('drawer', ['checkout'], 'Laci kasir dapat dibuka, tanpa menggambarkan uang atau transaksi.', { actions: [action('checkout', 'drawerOpen', 0, 1)] }),
      scene('packages', ['box', 'bottle'], 'Kotak dan botol merupakan varian bentuk berbeda.', { layout: 'side-by-side', actions: [action('box', 'lift', 0, 45), action('bottle', 'lift', 0, 45)] }),
      scene('can', ['can'], 'Kemasan kaleng tanpa merek atau harga.', { actions: [action('can', 'lift', 0, 45)] }),
      scene('pos-off', ['pos'], 'Terminal POS dengan layar mati.', { durationSec: 1.5 }),
      scene('pos-on', ['pos'], 'Layar menyala tanpa angka transaksi atau klaim pembayaran berhasil.', { durationSec: 1.5, set: [{ instanceId: 'pos', props: { active: true } }] }),
    ],
  });
  if (!result.ok) throw new Error(result.errors.join('\n'));
  const frames = planDurationInFrames(result.plan, 24);
  await fs.writeFile(path.join(output, 'plan.json'), JSON.stringify(result.plan, null, 2));
  const entryPoint = path.join(output, 'Root.tsx');
  await fs.writeFile(entryPoint, `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { PlanVideo } from '@/motion-kit/assets/PlanVideo';
const plan = ${JSON.stringify(result.plan)};
registerRoot(() => <>{[[540,960],[640,800],[960,540]].map(([width,height]) => <Composition key={width} id={'Business'+width} component={PlanVideo} defaultProps={{plan}} durationInFrames={${frames}} fps={24} width={width} height={height}/>)}</>);`);
  const serveUrl = await bundle({ entryPoint, webpackOverride: (config) => ({ ...config, resolve: { ...config.resolve, alias: { ...config.resolve?.alias, '@': path.resolve('src') } } }) });
  for (const width of [540, 640, 960]) {
    const composition = await selectComposition({ serveUrl, id: `Business${width}` });
    let from = 0;
    for (const item of result.plan.scenes) {
      const duration = Math.round(item.durationSec * 24);
      await renderStill({ serveUrl, composition, frame: from + Math.round(duration * 0.65), output: path.join(output, `${width}-${item.id}.png`) });
      from += duration;
    }
    if (width === 540) await renderMedia({ serveUrl, composition, codec: 'h264', concurrency: 2, outputLocation: path.join(output, 'toko-dan-kasir.mp4') });
  }
  await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify({ durationSec: frames / 24, elapsedSec: (performance.now() - started) / 1000, modelCalls: 0, ttsCalls: 0, imageCalls: 0, stills: result.plan.scenes.length * 3, ratios: ['9:16', '4:5', '16:9'] }, null, 2));
  console.log(output);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
