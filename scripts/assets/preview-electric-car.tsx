import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { IsoCar, IsoRoad, type IsoCarProps } from '../../src/motion-kit/isometric';

const output = path.resolve('storage/assets/iso-electric-car');
const variants: Array<{ name: string; label: string; note: string; props: IsoCarProps }> = [
  { name: 'mobil-listrik', label: '01 / Mobil listrik', note: 'Bodi bersama, panel depan dan port pengisian berbeda', props: {} },
  { name: 'mobil-listrik-kap', label: '02 / Kap terbuka', note: 'Motor, inverter, pengisi daya, dan pendinginan', props: { hoodOpen: 1, chargePortOpen: true } },
  { name: 'mobil-listrik-potongan', label: '03 / Tampilan potongan', note: 'Paket baterai berada di bawah lantai kabin', props: { view: 'cutaway', windowOpen: 1, energyFlow: true } },
  { name: 'mobil-listrik-sasis', label: '04 / Platform listrik', note: 'Modul baterai, kabel tegangan tinggi, dan penggerak', props: { view: 'chassis', wheelOpacity: 0.15, chargePortOpen: true, energyFlow: true, batteryCoverOpacity: 0 } },
];

async function save(name: string, element: React.ReactElement) {
  const svg = renderToStaticMarkup(element);
  await fs.writeFile(path.join(output, `${name}.svg`), svg);
  await sharp(Buffer.from(svg)).png().toFile(path.join(output, `${name}.png`));
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  for (const item of variants) await save(item.name, <IsoCar powertrain="electric" color="#367E83" title="Mobil listrik isometrik" {...item.props} width={1520} height={960} />);
  await save('jalan-raya', <IsoRoad width={1800} height={1300} />);

  await save('pratinjau', <svg xmlns="http://www.w3.org/2000/svg" width={1600} height={1160} viewBox="0 0 1600 1160">
    <rect width={1600} height={1160} fill="#F4F6F5" />
    <g fontFamily="Arial, sans-serif" fill="#263238">
      <text x={64} y={63} fontSize={18} letterSpacing={3}>GMOTION / PUSTAKA ASET</text>
      <text x={64} y={117} fontSize={40} fontWeight={700}>Varian mobil listrik</text>
      <text x={1536} y={111} fontSize={17} textAnchor="end">Aset 001 / Varian EV · Full SVG</text>
      <path d="M 64 147 H 1536" stroke="#CBD4D0" />
      {variants.map((item, i) => {
        const x = 64 + i % 2 * 780;
        const y = 184 + Math.floor(i / 2) * 459;
        return <g key={item.name}>
          <text x={x} y={y} fontSize={21} fontWeight={700}>{item.label}</text>
          <text x={x} y={y + 28} fontSize={16} fill="#536560">{item.note}</text>
          <IsoCar powertrain="electric" color="#367E83" {...item.props} x={x - 24} y={y + 34} width={740} height={390} style={{ width: 740, height: 390 }} />
        </g>;
      })}
      <path d="M 64 1094 H 1536" stroke="#CBD4D0" />
      <text x={64} y={1130} fontSize={16}>Baterai · Motor · Inverter · Pengisi daya · Port pengisian · Kabel tegangan tinggi</text>
      <text x={1536} y={1130} fontSize={16} textAnchor="end">Konfigurasi penggerak depan ilustratif</text>
    </g>
  </svg>);

  await save('perbandingan-di-jalan', <svg xmlns="http://www.w3.org/2000/svg" width={1800} height={1300} viewBox="0 0 1800 1300">
    <rect width={1800} height={1300} fill="#F4F6F5" />
    <g fontFamily="Arial, sans-serif" fill="#263238">
      <text x={64} y={63} fontSize={18} letterSpacing={3}>GMOTION / ASET 001 + 002</text>
      <text x={64} y={119} fontSize={40} fontWeight={700}>Satu jalan, dua jenis penggerak</text>
      <text x={64} y={158} fontSize={20} fill="#536560">Mobil bensin dan listrik memakai bodi serta sudut isometrik yang sama.</text>
      <IsoRoad x={50} y={190} width={1700} height={960} style={{ width: 1700, height: 960 }}>
        <IsoCar powertrain="petrol" x={104} y={-60} width={760} height={480} style={{ width: 760, height: 480 }} />
        <IsoCar powertrain="electric" color="#367E83" x={-104} y={60} width={760} height={480} style={{ width: 760, height: 480 }} />
        <rect x={468} y={2} width={140} height={39} fill="#F4F6F5" />
        <text x={480} y={30} fontSize={28} fontWeight={700}>BENSIN</text>
        <rect x={178} y={137} width={140} height={39} fill="#F4F6F5" />
        <text x={190} y={165} fontSize={28} fontWeight={700}>LISTRIK</text>
      </IsoRoad>
      <path d="M 64 1165 H 1736" stroke="#CBD4D0" />
      <text x={64} y={1211} fontSize={21} fontWeight={700}>Jalan raya adalah aset terpisah.</text>
      <text x={64} y={1244} fontSize={18}>Dapat dipakai ulang untuk adegan melaju; tidak wajib untuk close-up komponen.</text>
    </g>
  </svg>);
  console.log(`SVG dan PNG: ${output}`);
  if (process.argv.includes('--stills-only')) return;

  const entryPoint = path.join(output, 'Root.tsx');
  await fs.writeFile(entryPoint, `import React from 'react';
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from 'remotion';
import { IsoCar, IsoRoad } from '@/motion-kit/isometric';
const Clip = () => {
 const frame = useCurrentFrame();
 const view = frame < 100 ? 'exterior' : frame < 210 ? 'cutaway' : 'chassis';
 const distance = frame * 3;
 const wheelRotation = -distance / 40 * 180 / Math.PI;
 const status = frame < 100 ? 'Bodi bersama, dua jenis penggerak' : frame < 210 ? 'Bodi dibuka untuk memperlihatkan komponennya' : 'Bensin: mesin dan tangki / Listrik: motor dan baterai';
 return <AbsoluteFill style={{background: '#F4F6F5', fontFamily: 'Arial, sans-serif', color: '#263238'}}>
  <div style={{position:'absolute', left:64, top:58, fontSize:19, letterSpacing:3}}>GMOTION / ASET MOBIL + JALAN</div>
  <div style={{position:'absolute', left:64, top:102, fontSize:48, fontWeight:700}}>Listrik dan bensin</div>
  <div style={{position:'absolute', left:64, top:170, fontSize:23, maxWidth:950}}>{status}</div>
  <div style={{position:'absolute', left:0, right:0, top:225}}>
   <IsoRoad distance={distance}>
    <IsoCar view={view} wheelRotation={wheelRotation} engineRotation={frame * -9} x={104} y={-60} width={760} height={480} style={{width:760,height:480}} />
    <IsoCar powertrain="electric" color="#367E83" view={view} wheelRotation={wheelRotation} motorRotation={frame * -12} chargePortOpen={view !== 'exterior'} energyFlow={view !== 'exterior'} energyPhase={frame / 60} batteryCoverOpacity={0} x={-104} y={60} width={760} height={480} style={{width:760,height:480}} />
    <rect x={468} y={0} width={145} height={42} fill="#F4F6F5" />
    <text x={480} y={30} fontFamily="Arial" fontSize={30} fontWeight={700} fill="#263238">BENSIN</text>
    <rect x={178} y={135} width={145} height={42} fill="#F4F6F5" />
    <text x={190} y={165} fontFamily="Arial" fontSize={30} fontWeight={700} fill="#263238">LISTRIK</text>
   </IsoRoad>
  </div>
  <div style={{position:'absolute',left:64,bottom:69,fontSize:20}}>Full SVG · Komponen listrik dan bensin terpisah</div>
 </AbsoluteFill>;
};
registerRoot(() => <Composition id="ElectricComparison" component={Clip} durationInFrames={360} fps={30} width={1080} height={1080} />);
`);
  const serveUrl = await bundle({ entryPoint, webpackOverride: (config) => ({
    ...config, resolve: { ...config.resolve, alias: { ...config.resolve?.alias, '@': path.resolve('src') } },
  }) });
  const composition = await selectComposition({ serveUrl, id: 'ElectricComparison' });
  await renderMedia({ composition, serveUrl, codec: 'h264', pixelFormat: 'yuv420p', concurrency: 2, outputLocation: path.join(output, 'listrik-dan-bensin.mp4') });
  console.log(`Video: ${path.join(output, 'listrik-dan-bensin.mp4')}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
