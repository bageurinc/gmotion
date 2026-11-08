import sharp from 'sharp';
import type { AspectRatio, ColorPalette, Storyboard } from '@/types/studio';

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 4000;
const REQUEST_TIMEOUT_MS = 120_000;

const IMAGE_SIZES: Record<AspectRatio, string> = {
  '9:16': '1024x1792',
  '4:5': '1024x1024',
  '16:9': '1792x1024',
};

/** The gemini/ route ignores size and aspect_ratio, but a reference picture fixes the shape. */
const CANVAS_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  '9:16': { width: 768, height: 1376 },
  '4:5': { width: 1024, height: 1280 },
  '16:9': { width: 1376, height: 768 },
};
const ASPECT_TOLERANCE = 0.1;

export function imageModel(): string {
  return process.env.IMAGE_MODEL || 'gemini/gemini-3.1-flash-lite-image';
}

/** An empty picture in the video's shape and background color, used as the first reference. */
export function blankCanvas(aspectRatio: AspectRatio, color: string): Promise<Buffer> {
  const { width, height } = CANVAS_SIZES[aspectRatio];
  return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
}

export async function matchesAspect(image: Buffer, aspectRatio: AspectRatio): Promise<boolean> {
  const { width, height } = await sharp(image).metadata();
  const wanted = CANVAS_SIZES[aspectRatio];
  if (!width || !height) return false;
  return Math.abs(width / height - wanted.width / wanted.height) <= ASPECT_TOLERANCE;
}

export function sceneImagePrompt(storyboard: Storyboard, index: number, show?: string): string {
  const scene = storyboard.scenes[index];
  const { palette }: { palette: ColorPalette } = storyboard;
  return `Paint over this entire canvas, keeping its exact shape. Its color is only a tone reference, and no blank area may remain.

Flat editorial vector illustration for scene ${index + 1} of ${storyboard.scenes.length} of an explainer video titled "${storyboard.title}".

Show: ${show ?? scene.visualPrompt}
Narration for context: ${scene.voiceoverText}

STYLE, identical in every scene of this video
- Clean flat vector shapes with thick, even, dark outlines and two or three flat tones per surface. No gradients, glow, photo textures, or 3D rendering.
- Anatomy must be correct. Any hand has exactly five clearly separated fingers.
- The scene happens in a real place that fits the topic, painted from edge to edge on all four sides. Outdoors: sky with soft clouds, with the ground reaching the bottom edge. Indoors: a wall with wallpaper, tiles, or panels, with the floor reaching the bottom edge. Never leave a plain backdrop, an empty band, or a picture that fades into a flat color.
- Main colors come from ${palette.primary} and ${palette.secondary}, plus natural colors for skin and real materials.

LAYOUT
- One large, clear subject in the middle of the frame.
- The top 28 percent continues the place as a calm, light area in tones close to ${palette.background}, such as open sky or a plain wall, with no objects, because the headline sits there.
- The ground, floor, plants, and objects of the place continue down to the bottom edge with the same detail as the rest of the picture. Never end the picture with a flat strip of color, because captions have their own box and need no empty space.
- Absolutely no text, letters, numbers, labels, logos, or watermarks.`;
}

/** Redraws a picture with one change, so states of a scene stay in the same framing and style. */
export function imageChangePrompt(change: string): string {
  return `Keep this exact illustration: the same camera angle, framing, style, colors, background, and every object in the same place. Change only this: ${change}
Absolutely no text, letters, numbers, labels, logos, or watermarks.`;
}

/** Pass a reference to draw on it. The gemini/ route accepts references, and the ag/ route is unproven. */
export async function generateImage(prompt: string, aspectRatio: AspectRatio, reference?: Buffer): Promise<Buffer> {
  const baseUrl = (process.env.OPENAI_BASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!baseUrl || !apiKey) throw new Error('OPENAI_BASE_URL and OPENAI_API_KEY are required');

  let lastError = 'Image request failed';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: imageModel(),
        prompt,
        n: 1,
        size: IMAGE_SIZES[aspectRatio],
        response_format: 'b64_json',
        ...(reference ? { image: `data:image/png;base64,${reference.toString('base64')}` } : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.ok) {
      const data = (await response.json()) as { data?: Array<{ b64_json?: string }> };
      const encoded = data.data?.[0]?.b64_json;
      if (encoded) return Buffer.from(encoded, 'base64');
      lastError = 'Image response held no image';
    } else {
      const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 200);
      lastError = `Image request failed with HTTP ${response.status}: ${detail}`;
      if (!RETRYABLE_STATUS.has(response.status)) break;
    }
  }
  throw new Error(lastError);
}
