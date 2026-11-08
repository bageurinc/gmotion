import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { IsoCar, type IsoCarProps } from '../../src/motion-kit/isometric';
import { CarEngine } from '../../src/motion-kit/isometric/CarMechanics';
import { projectCarPoint } from '../../src/motion-kit/isometric/car-geometry';

function EngineDetail() {
  const labels = [
    { text: 'Blok mesin', at: [163, 0, 103] as const, x: 426, y: 231 },
    { text: 'Intake', at: [151, -43, 86] as const, x: 590, y: 227 },
    { text: 'Aki', at: [187, -55, 85] as const, x: 634, y: 278 },
    { text: 'Radiator', at: [214, 3, 81] as const, x: 628, y: 342 },
    { text: 'Kompresor AC', at: [177, 41, 75] as const, x: 400, y: 373 },
    { text: 'Sabuk / pulley', at: [195, 12, 65] as const, x: 557, y: 404 },
  ];
  return <>
    <CarEngine rotation={0} />
    {labels.map((label) => {
      const p = projectCarPoint(label.at);
      return <g key={label.text} fontFamily="Arial, sans-serif" fontSize={6.5} fill="#263238">
        <polyline points={`${p.x},${p.y} ${label.x + 4},${label.y + 6} ${label.x + 22},${label.y + 6}`} fill="none" stroke="#677B7E" strokeWidth={0.7} />
        <circle cx={p.x} cy={p.y} r={1.6} fill="#AA5C42" stroke="#F4F6F5" strokeWidth={0.6} />
        <text x={label.x} y={label.y}>{label.text}</text>
      </g>;
    })}
  </>;
}

const output = path.resolve('storage/assets/iso-car');
const variants: Array<{ name: string; label: string; note: string; props: IsoCarProps }> = [
  { name: 'mobil', label: '01 / Mobil utama', note: 'Jendela tertutup', props: {} },
  { name: 'mobil-kap-terbuka', label: '02 / Ruang mesin', note: 'Kap terangkat, mesin terlihat', props: { color: '#3C7985', hoodOpen: 1 } },
  { name: 'mobil-kabin', label: '03 / Tampilan potongan', note: 'Kabin dan mesin di balik bodi', props: { color: '#CF5A3C', view: 'cutaway', windowOpen: 1 } },
  { name: 'mobil-sasis', label: '04 / Sampai bagian bawah', note: 'Mesin, transmisi, sasis, dan suspensi', props: { color: '#3C7985', view: 'chassis', wheelOpacity: 0.15 } },
];

async function main() {
  await fs.mkdir(output, { recursive: true });
  for (const variant of variants) {
    const svg = renderToStaticMarkup(<IsoCar {...variant.props} width={1520} height={960} />);
    await fs.writeFile(path.join(output, `${variant.name}.svg`), svg);
    await sharp(Buffer.from(svg)).resize(1520, 960).png().toFile(path.join(output, `${variant.name}.png`));
  }

  const sheet = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width={1600} height={1160} viewBox="0 0 1600 1160">
      <rect width={1600} height={1160} fill="#F4F6F5" />
      <g fontFamily="Arial, sans-serif" fill="#263238">
        <text x={64} y={63} fontSize={18} letterSpacing={3}>GMOTION / PUSTAKA ASET</text>
        <text x={64} y={117} fontSize={40} fontWeight={700}>Mobil isometrik</text>
        <text x={1536} y={111} fontSize={17} textAnchor="end">Aset 001 · Full SVG</text>
        <path d="M 64 147 H 1536" stroke="#CBD4D0" />
        {variants.map((variant, index) => {
          const x = 64 + (index % 2) * 780;
          const y = 184 + Math.floor(index / 2) * 459;
          return <g key={variant.name}>
            <text x={x} y={y} fontSize={21} fontWeight={700}>{variant.label}</text>
            <text x={x} y={y + 28} fontSize={16} fill="#536560">{variant.note}</text>
            <IsoCar {...variant.props} x={x - 24} y={y + 34} width={740} height={390} style={{ width: 740, height: 390 }} />
          </g>;
        })}
        <path d="M 64 1094 H 1536" stroke="#CBD4D0" />
        <text x={64} y={1130} fontSize={16}>Kap terbuka · Mesin · Transmisi · Sasis · Knalpot · Suspensi</text>
        <text x={1536} y={1130} fontSize={16} textAnchor="end">Susunan mekanis ilustratif / Sudut tetap</text>
      </g>
    </svg>,
  );
  await fs.writeFile(path.join(output, 'pratinjau.svg'), sheet);
  await sharp(Buffer.from(sheet)).png().toFile(path.join(output, 'pratinjau.png'));
  const engine = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" viewBox="385 205 300 220" width={1500} height={1100} role="img" aria-label="Detail ruang mesin"><EngineDetail /></svg>);
  await fs.writeFile(path.join(output, 'mesin-detail.svg'), engine);
  await sharp(Buffer.from(engine)).png().toFile(path.join(output, 'mesin-detail.png'));
  const mechanics = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width={1800} height={1060} viewBox="0 0 1800 1060">
      <rect width={1800} height={1060} fill="#F4F6F5" />
      <g fontFamily="Arial, sans-serif" fill="#263238">
        <text x={64} y={62} fontSize={18} letterSpacing={3}>GMOTION / ASET 001</text>
        <text x={64} y={118} fontSize={40} fontWeight={700}>Dari ruang mesin sampai sasis</text>
        <path d="M 64 150 H 1736" stroke="#CBD4D0" />
        <text x={64} y={202} fontSize={25} fontWeight={700}>Ruang mesin / diperbesar</text>
        <svg viewBox="385 205 300 220" x={45} y={235} width={790} height={620}><EngineDetail /></svg>
        <text x={910} y={202} fontSize={25} fontWeight={700}>Rangka dan bagian bawah</text>
        <IsoCar view="chassis" wheelOpacity={0.1} shadow={false} x={850} y={230} width={900} height={640} style={{ width: 900, height: 640 }} />
        <text x={64} y={890} fontSize={19}>Blok mesin · Radiator · Aki · Intake</text>
        <text x={64} y={923} fontSize={19}>Kompresor AC · Pulley dan sabuk · Reservoir</text>
        <text x={910} y={890} fontSize={19}>Transmisi · Poros penggerak · Diferensial</text>
        <text x={910} y={923} fontSize={19}>Tangki · Knalpot · Suspensi · Rem</text>
        <path d="M 64 978 H 1736" stroke="#CBD4D0" />
        <text x={64} y={1018} fontSize={16}>Full SVG / Komponen terpisah / Susunan mesin depan dan penggerak belakang yang disederhanakan</text>
      </g>
    </svg>,
  );
  await fs.writeFile(path.join(output, 'pratinjau-mekanik.svg'), mechanics);
  await sharp(Buffer.from(mechanics)).png().toFile(path.join(output, 'pratinjau-mekanik.png'));
  console.log(`SVG dan PNG: ${output}`);
  if (process.argv.includes('--stills-only')) return;

  const root = `import React from 'react';
import { AbsoluteFill, Composition, interpolate, registerRoot, useCurrentFrame } from 'remotion';
import { IsoCar } from '@/motion-kit/isometric';

const Clip = () => {
  const frame = useCurrentFrame();
  const windowOpen = interpolate(frame, [40, 85, 195, 230], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const hoodOpen = interpolate(frame, [30, 70], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const bodyOpacity = interpolate(frame, [120, 155], [1, 0.1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const view = frame >= 210 ? 'chassis' : 'exterior';
  const status = frame < 30 ? 'Mobil utuh' : frame < 120 ? 'Kap dibuka · ruang mesin terlihat' : frame < 210 ? 'Bodi transparan · bagian dalam' : 'Sasis · transmisi · suspensi · knalpot';
  return <AbsoluteFill style={{background: '#F4F6F5', color: '#263238', fontFamily: 'Arial, sans-serif'}}>
    <div style={{position: 'absolute', left: 64, top: 68, fontSize: 20, letterSpacing: 3}}>GMOTION / ASET 001</div>
    <div style={{position: 'absolute', left: 64, top: 115, fontSize: 54, fontWeight: 700}}>Mobil isometrik</div>
    <div style={{position: 'absolute', left: 64, top: 192, fontSize: 26, color: '#536560'}}>{status}</div>
    <div style={{position: 'absolute', left: 10, right: 10, top: 292}}><IsoCar view={view} hoodOpen={hoodOpen} windowOpen={windowOpen} bodyOpacity={bodyOpacity} wheelOpacity={view === 'chassis' ? 0.12 : 1} wheelRotation={frame * -6} engineRotation={frame * -9} /></div>
    <div style={{position: 'absolute', left: 64, bottom: 78, fontSize: 21}}>Full SVG · Susunan mekanis ilustratif</div>
    <div style={{position: 'absolute', left: 64, right: 64, bottom: 47, height: 3, background: '#D7DFDB'}}><div style={{height: '100%', width: (frame / 299 * 100) + '%', background: '#CF5A3C'}} /></div>
  </AbsoluteFill>;
};
registerRoot(() => <Composition id="IsoCar" component={Clip} durationInFrames={300} fps={30} width={1080} height={1080} />);
`;
  const entryPoint = path.join(output, 'Root.tsx');
  await fs.writeFile(entryPoint, root);
  const serveUrl = await bundle({ entryPoint, webpackOverride: (config) => ({
    ...config, resolve: { ...config.resolve, alias: { ...config.resolve?.alias, '@': path.resolve('src') } },
  }) });
  const composition = await selectComposition({ serveUrl, id: 'IsoCar' });
  await renderMedia({ composition, serveUrl, codec: 'h264', pixelFormat: 'yuv420p', outputLocation: path.join(output, 'mobil-demo.mp4'), concurrency: 2 });
  console.log(`Video: ${path.join(output, 'mobil-demo.mp4')}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
