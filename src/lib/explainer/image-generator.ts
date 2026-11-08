import { recordUsage } from '@/lib/billing/usage';
import sharp from 'sharp';
import type { ArtStyle, AspectRatio, ColorPalette, Storyboard } from '@/types/studio';

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

const ART_STYLES: Record<ArtStyle, { kind: string; look: string }> = {
  flat: {
    kind: 'Flat editorial vector illustration',
    look: 'Clean flat vector shapes with thick, even, dark outlines and two or three flat tones per surface. No gradients, glow, photo textures, or 3D rendering.',
  },
  pixel: {
    kind: '16-bit pixel art scene, like a hand-made console game screen',
    look: 'Chunky square pixels on a strict grid, about 160 pixels across the whole picture. A limited palette of around 24 colors, one-pixel dark outlines, and hard-edged dithering for shading. No anti-aliasing, blur, smooth gradients, photo textures, or 3D rendering.',
  },
};

export function sceneImagePrompt(storyboard: Storyboard, index: number, show?: string): string {
  const scene = storyboard.scenes[index];
  const { palette }: { palette: ColorPalette } = storyboard;
  return `Paint over this entire canvas, keeping its exact shape. Its color is only a tone reference, and no blank area may remain.

${ART_STYLES[storyboard.artStyle ?? 'flat'].kind} for scene ${index + 1} of ${storyboard.scenes.length} of an explainer video titled "${storyboard.title}".

Show: ${show ?? scene.visualPrompt}
Narration for context: ${scene.voiceoverText}

STYLE, identical in every scene of this video
- ${ART_STYLES[storyboard.artStyle ?? 'flat'].look}
- Anatomy must be correct. Any hand has exactly five clearly separated fingers.
- The scene happens in a real place that fits the topic, painted from edge to edge on all four sides. Outdoors: sky with soft clouds, with the ground reaching the bottom edge. Indoors: a wall with wallpaper, tiles, or panels, with the floor reaching the bottom edge. Never leave a plain backdrop, an empty band, or a picture that fades into a flat color.
- Main colors come from ${palette.primary} and ${palette.secondary}, plus natural colors for skin and real materials.

LAYOUT
- One large, clear subject in the middle of the frame.
- The top 28 percent continues the place as a calm, light area in tones close to ${palette.background}, such as open sky or a plain wall, with no objects, because the headline sits there.
- The ground, floor, plants, and objects of the place continue down to the bottom edge with the same detail as the rest of the picture. Never end the picture with a flat strip of color, because captions have their own box and need no empty space.
- Absolutely no text, letters, numbers, labels, logos, or watermarks.`;
}

/** Pixel grid width per video shape, so pixels stay square and about the same size in every shape. */
const PIXEL_GRID_WIDTH: Record<AspectRatio, number> = { '9:16': 180, '4:5': 200, '16:9': 320 };
const PIXEL_COLORS = 32;
const PALETTE_ROUNDS = 8;

/** Reduces RGB pixels to a few colors with k-means, seeded across the brightness range so it is deterministic. */
export function quantizeColors(rgb: Buffer, colors: number): Buffer {
  const count = rgb.length / 3;
  const brightness = (at: number) => rgb[at * 3] * 0.3 + rgb[at * 3 + 1] * 0.59 + rgb[at * 3 + 2] * 0.11;
  const order = Array.from({ length: count }, (_, at) => at).sort((a, b) => brightness(a) - brightness(b));
  const centers = Array.from({ length: colors }, (_, k) => {
    const at = order[Math.floor(((k + 0.5) / colors) * count)];
    return [rgb[at * 3], rgb[at * 3 + 1], rgb[at * 3 + 2]];
  });
  const owner = new Uint16Array(count);
  const nearest = (at: number) => {
    let best = 0;
    let bestDistance = Infinity;
    for (let k = 0; k < centers.length; k += 1) {
      const dr = rgb[at * 3] - centers[k][0];
      const dg = rgb[at * 3 + 1] - centers[k][1];
      const db = rgb[at * 3 + 2] - centers[k][2];
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = k;
      }
    }
    return best;
  };
  for (let round = 0; round < PALETTE_ROUNDS; round += 1) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let at = 0; at < count; at += 1) {
      const k = nearest(at);
      owner[at] = k;
      sums[k][0] += rgb[at * 3];
      sums[k][1] += rgb[at * 3 + 1];
      sums[k][2] += rgb[at * 3 + 2];
      sums[k][3] += 1;
    }
    sums.forEach(([r, g, b, n], k) => {
      if (n) centers[k] = [r / n, g / n, b / n];
    });
  }
  const out = Buffer.alloc(rgb.length);
  for (let at = 0; at < count; at += 1) {
    const [r, g, b] = centers[nearest(at)];
    out[at * 3] = Math.round(r);
    out[at * 3 + 1] = Math.round(g);
    out[at * 3 + 2] = Math.round(b);
  }
  return out;
}

/**
 * Snaps a picture onto a real pixel grid with a limited palette. Image models draw soft, uneven
 * "pixel art", so the grid is enforced here instead of trusted to the prompt. Sharp's own palette
 * option leaves 256 colors on this build, so the palette is computed here.
 */
export async function pixelate(image: Buffer, aspectRatio: AspectRatio): Promise<Buffer> {
  const { width, height } = CANVAS_SIZES[aspectRatio];
  const gridWidth = PIXEL_GRID_WIDTH[aspectRatio];
  const gridHeight = Math.round((gridWidth * height) / width);
  const small = await sharp(image)
    .resize(gridWidth, gridHeight, { fit: 'cover', kernel: 'lanczos3' })
    .removeAlpha()
    .raw()
    .toBuffer();
  return sharp(quantizeColors(small, PIXEL_COLORS), { raw: { width: gridWidth, height: gridHeight, channels: 3 } })
    .resize(width, height, { fit: 'fill', kernel: 'nearest' })
    .png()
    .toBuffer();
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
    const startedAt = Date.now();
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
    // A failed attempt is recorded too: some providers bill rejected or empty generations.
    const recordImage = (ok: boolean) =>
      recordUsage({ kind: 'image', model: imageModel(), images: ok ? 1 : 0, durationMs: Date.now() - startedAt, ok });
    if (response.ok) {
      const data = (await response.json()) as { data?: Array<{ b64_json?: string }> };
      const encoded = data.data?.[0]?.b64_json;
      recordImage(Boolean(encoded));
      if (encoded) return Buffer.from(encoded, 'base64');
      lastError = 'Image response held no image';
    } else {
      recordImage(false);
      const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 200);
      lastError = `Image request failed with HTTP ${response.status}: ${detail}`;
      if (!RETRYABLE_STATUS.has(response.status)) break;
    }
  }
  throw new Error(lastError);
}
