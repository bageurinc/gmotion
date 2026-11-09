import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IsoAlternator } from '../../src/motion-kit/isometric/IsoAlternator';

async function main() {
  const output = path.resolve('storage/assets/alternator');
  await fs.mkdir(output, { recursive: true });

  // 1. Render SVG of the exploded alternator matching FIG.49
  const explodedSvg = renderToStaticMarkup(
    <IsoAlternator explode={1} showCallouts={true} />
  );
  await fs.writeFile(path.join(output, 'alternator-exploded.svg'), explodedSvg);

  // 2. Render SVG of the assembled alternator (explode = 0)
  const assembledSvg = renderToStaticMarkup(
    <IsoAlternator explode={0} showCallouts={false} />
  );
  await fs.writeFile(path.join(output, 'alternator-assembled.svg'), assembledSvg);

  // 3. Render 3 transition stages (0.25, 0.5, 0.75)
  for (const step of [0.25, 0.5, 0.75]) {
    const svg = renderToStaticMarkup(
      <IsoAlternator explode={step} showCallouts={true} />
    );
    await fs.writeFile(path.join(output, `alternator-step-${Math.round(step * 100)}.svg`), svg);
  }

  console.log('Alternator exploded spare parts preview generated successfully in storage/assets/alternator/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
