import path from 'path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import sharp from 'sharp';
import type { FrameSize } from './assemble';

const FPS = 30;
let bundled: Promise<string> | null = null;

/** Bundles the preview root once per server process; later renders only pass new files. */
export function isoPreviewBundle(): Promise<string> {
  bundled ??= bundle({
    entryPoint: path.join(process.cwd(), 'src', 'lib', 'explainer', 'iso-canvas', 'preview-root.tsx'),
    ignoreRegisterRootWarning: true,
    webpackOverride: (config) => ({
      ...config,
      resolve: { ...config.resolve, alias: { ...(config.resolve?.alias || {}), '@': path.join(process.cwd(), 'src') } },
    }),
  }).catch((error) => {
    bundled = null;
    throw error;
  });
  return bundled;
}

export type IsoBrowser = Awaited<ReturnType<typeof openBrowser>>;

/** One headless browser for a whole job, so each still costs a page, not a launch. */
export async function withIsoBrowser<T>(job: (browser: IsoBrowser) => Promise<T>): Promise<T> {
  // Canvas 2D needs no WebGL; RENDER_GL is honoured the same way as in exports.
  const gl = process.env.RENDER_GL === 'swangle' || process.env.RENDER_GL === 'angle' ? process.env.RENDER_GL : undefined;
  const browser = await openBrowser('chrome', { chromiumOptions: gl ? { gl } : {} });
  try {
    return await job(browser);
  } finally {
    await browser.close({ silent: true }).catch(() => undefined);
  }
}

/**
 * Renders the given seconds of a Preview.tsx composition and returns them as one contact sheet
 * (frames side by side) plus the middle frame larger, both JPEG, for the critic and the model.
 */
export async function renderIsoSheet(
  browser: IsoBrowser,
  files: Record<string, string>,
  seconds: number[],
  frame: FrameSize,
): Promise<{ sheet: Buffer; still: Buffer; frames: Buffer[] }> {
  const serveUrl = await isoPreviewBundle();
  const durationInFrames = Math.ceil(Math.max(...seconds) * FPS) + 1;
  const inputProps = { files, width: frame.width, height: frame.height, durationInFrames };
  const composition = await selectComposition({ serveUrl, id: 'IsoPreview', inputProps, puppeteerInstance: browser });
  const frames: Buffer[] = [];
  for (const second of seconds) {
    const { buffer } = await renderStill({
      composition,
      serveUrl,
      inputProps,
      frame: Math.min(durationInFrames - 1, Math.round(second * FPS)),
      output: null,
      imageFormat: 'jpeg',
      jpegQuality: 88,
      puppeteerInstance: browser,
    });
    frames.push(buffer as Buffer);
  }
  const thumbHeight = 720;
  const thumbWidth = Math.round((thumbHeight * frame.width) / frame.height);
  const thumbs = await Promise.all(frames.map((input) => sharp(input).resize(thumbWidth, thumbHeight).toBuffer()));
  const sheet = await sharp({ create: { width: thumbWidth * thumbs.length, height: thumbHeight, channels: 3, background: '#000000' } })
    .composite(thumbs.map((input, index) => ({ input, left: index * thumbWidth, top: 0 })))
    .jpeg({ quality: 86 })
    .toBuffer();
  const middle = frames[Math.floor(frames.length / 2)];
  const still = await sharp(middle).resize(Math.round(frame.width / 2), Math.round(frame.height / 2)).jpeg({ quality: 85 }).toBuffer();
  return { sheet, still, frames };
}
