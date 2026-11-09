import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IsoLmpv } from '../../src/motion-kit/isometric/IsoLmpv';

async function main() {
  const output = path.resolve('storage/assets/lmpv');
  await fs.mkdir(output, { recursive: true });

  const svg = renderToStaticMarkup(
    <IsoLmpv color="#4A5560" view="exterior" headlights={true} />
  );
  await fs.writeFile(path.join(output, 'preview-rendered.svg'), svg);
  console.log('Saved preview-rendered.svg');
}

main().catch(console.error);
