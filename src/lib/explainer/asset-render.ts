import fs from 'fs';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import sharp from 'sharp';
import type { GeneratedAsset } from './asset-generator';

const CLIP_FRAMES = 300;
const SHEET_FRAMES = [45, 130, 215, 285];

const ROOT_CODE = `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { AssetStage } from '@/motion-kit/explainer/AssetStage';
import { KineticHeadline } from '@/motion-kit/core/KineticHeadline';
import Asset from './Asset';
import manifest from './manifest.json';

const Clip: React.FC = () => (
  <AssetStage manifest={manifest as never} Asset={Asset}>
    <KineticHeadline text={manifest.title} highlightColor={manifest.palette.accent} />
  </AssetStage>
);

const Root: React.FC = () => (
  <Composition id="AssetClip" component={Clip} durationInFrames={${CLIP_FRAMES}} fps={30} width={1080} height={1920} />
);

registerRoot(Root);
`;

export async function bundleAsset(asset: GeneratedAsset, directory: string): Promise<string> {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'Asset.tsx'), asset.code);
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(asset.manifest, null, 2));
  const entryPoint = path.join(directory, 'Root.tsx');
  fs.writeFileSync(entryPoint, ROOT_CODE);

  const srcDir = path.join(process.cwd(), 'src');
  return bundle({
    entryPoint,
    ignoreRegisterRootWarning: true,
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: { ...(config.resolve?.alias || {}), '@': srcDir },
      },
    }),
  });
}

export async function renderContactSheet(serveUrl: string, directory: string): Promise<Buffer> {
  const composition = await selectComposition({ serveUrl, id: 'AssetClip' });
  const frames: Buffer[] = [];
  for (const frame of SHEET_FRAMES) {
    const output = path.join(directory, `frame-${frame}.jpg`);
    await renderStill({ composition, serveUrl, frame, output, imageFormat: 'jpeg', jpegQuality: 88 });
    frames.push(await sharp(output).resize(540, 960).toBuffer());
  }
  const sheet = await sharp({ create: { width: 540 * frames.length, height: 960, channels: 3, background: '#000000' } })
    .composite(frames.map((input, index) => ({ input, left: index * 540, top: 0 })))
    .jpeg({ quality: 84 })
    .toBuffer();
  fs.writeFileSync(path.join(directory, 'sheet.jpg'), sheet);
  return sheet;
}

export async function renderClip(serveUrl: string, outputLocation: string): Promise<void> {
  const composition = await selectComposition({ serveUrl, id: 'AssetClip' });
  await renderMedia({ composition, serveUrl, codec: 'h264', pixelFormat: 'yuv420p', outputLocation });
}
