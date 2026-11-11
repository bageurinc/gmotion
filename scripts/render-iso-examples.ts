/**
 * Renders the hand-written isometric canvas examples (house style references) through the same
 * preview bundle the quality loop uses, so the reference shown to Gemini can be judged by eye.
 *
 * npx tsx scripts/render-iso-examples.ts --out storage/spike/canvas-iso/examples
 */
import fs from 'fs';
import path from 'path';
import { fitZoom, type FrameSize } from '@/lib/explainer/iso-canvas/assemble';
import { EXAMPLE_AC_INDOOR, EXAMPLE_AC_OUTDOOR, EXAMPLE_WORLD } from '@/lib/explainer/iso-canvas/examples';
import { renderIsoSheet, withIsoBrowser } from '@/lib/explainer/iso-canvas/render';

const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const objects = `import type { Iso } from '@/motion-kit';\n\n${EXAMPLE_AC_OUTDOOR}\n\n${EXAMPLE_AC_INDOOR}\n`;

/** One object, state 0 first and on later, like the object sheet the critic sees. */
const objectPreview = (name: string, size: [number, number, number], frame: FrameSize, lift = 0) => `import React from 'react';
import { CanvasScene } from '@/motion-kit';
import { ${name} } from './IsoObjects';

const levels = [0, 1, 1, 0.5];

export default function Preview() {
  return (
    <CanvasScene
      draw={(iso, t) => {
        const step = Math.min(3, Math.floor(t + 0.001));
        iso.background('#F1F5F9', '#E2E8F0');
        iso.look(0, 0, ${size[2] / 2 + lift}, ${fitZoom(size, frame, 0.8)});
        iso.ground('#E2E8F0');
        iso.at(0, 0, ${lift}, () => ${name}(iso, { nyala: levels[step] }, step * 0.4));
      }}
    />
  );
}
`;

const worldPreview = `import React from 'react';
import { CanvasScene } from '@/motion-kit';
import type { Iso, IsoStates } from '@/motion-kit';
import { drawAcIndoor } from './IsoObjects';

${EXAMPLE_WORLD.replace('export function drawWorld(iso: Iso, t: number, states: IsoStates)', 'function drawWorld(iso: Iso, t: number, states: IsoStates)')}

export default function Preview() {
  return (
    <CanvasScene
      draw={(iso, t) => {
        const on = t < 1 ? 0 : 1;
        if (t < 2) iso.look(-0.2, -1.6, 1.0, 150);
        else iso.look(0, -2.88, 2.25, 520);
        drawWorld(iso, t, { 'ac-indoor': { nyala: on } });
      }}
    />
  );
}
`;

async function main() {
  const out = path.resolve(argument('out', 'storage/spike/canvas-iso/examples'));
  fs.mkdirSync(out, { recursive: true });
  const frame: FrameSize = { width: 1080, height: 1920 };
  const jobs: Array<{ name: string; files: Record<string, string>; seconds: number[] }> = [
    { name: 'ac-outdoor', files: { 'IsoObjects.ts': objects, 'Preview.tsx': objectPreview('drawAcOutdoor', [0.86, 0.32, 0.6], frame) }, seconds: [0.2, 1.2, 2.2, 3.2] },
    // The wall unit hangs at 0.4 m so its falling air stays above the preview floor.
    { name: 'ac-indoor', files: { 'IsoObjects.ts': objects, 'Preview.tsx': objectPreview('drawAcIndoor', [0.9, 0.25, 0.7], frame, 0.4) }, seconds: [0.2, 1.2, 2.2, 3.2] },
    { name: 'world', files: { 'IsoObjects.ts': objects, 'Preview.tsx': worldPreview }, seconds: [0.5, 1.5, 2.5] },
  ];
  await withIsoBrowser(async (browser) => {
    for (const job of jobs) {
      const { sheet, frames } = await renderIsoSheet(browser, job.files, job.seconds, frame);
      fs.writeFileSync(path.join(out, `${job.name}-sheet.jpg`), sheet);
      frames.forEach((buffer, index) => fs.writeFileSync(path.join(out, `${job.name}-${index}.jpg`), buffer));
      console.log('RENDERED', job.name, out);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
