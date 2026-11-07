import type { ColorPalette } from '@/types/studio';

/**
 * Video-specific rules adapted from antislop (MIT): https://github.com/miqdadbadjuber/anti-slop
 * It rejects technique without purpose and does not prescribe one look.
 */
export const VISUAL_ANTI_SLOP_RULES = `
VISUAL QUALITY FILTER
- Take colors from the subject's real materials, place, and mood. Two videos on different topics must not share a palette.
- Choose dark or bright from what suits the topic and its mood. Both are welcome when the topic justifies them: space, night, the deep sea, horror, or a cinematic drama can be dark; daylight scenes, food, nature, and everyday subjects are usually bright.
- Never pick a look out of habit. Slate or navy as an automatic default is forbidden, and every video needs its own colors.
- Do not use blue-to-cyan, blue-to-purple, or purple-to-pink gradients, neon colors, or rainbow palettes as a default treatment.
- Use one main color, one supporting color, and neutrals. Reserve the accent for the thing being explained.
- Glow, blur, particles, and decorative shapes need a reason in the explanation. Never stack them for looks.
- The subject must stay clearly readable, with visible light and shadow, in both dark and bright looks. Avoid murky images where the subject disappears into its background.
- Motion must explain something: what moves, flows, opens, or changes. Remove motion that only decorates.
`;

export const COPY_ANTI_SLOP_RULES = `
CONTENT QUALITY FILTER
- Never invent statistics, prices, discounts, free trials, guarantees, testimonials, customer names, certifications, or performance claims. Use only facts the user gave or well-established general knowledge.
- A CTA uses only the offer the user stated. If no offer was stated, use a plain action such as "Coba sekarang".
- Avoid empty marketing words such as revolusioner, terbaik, canggih, generasi baru, and solusi lengkap. Say the specific thing instead.
- Write like a knowledgeable person talking. No hype or filler.
`;

const FALLBACK_LIGHT = { background: '#F2F5F1', surface: '#FFFFFF', text: '#1C2520' };
const GENERIC_DARK_BACKGROUNDS = new Set(['#0f172a', '#090d16', '#1e293b', '#020617', '#0b1120', '#111827']);

function channels(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([red, green, blue]: number[]): string {
  return `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex: string): number {
  const [red, green, blue] = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/** Moves a color toward black or white until it reads against the background. */
export function ensureContrast(color: string, background: string, minimum: number): string {
  const target = luminance(background) > 0.4 ? [0, 0, 0] : [255, 255, 255];
  const source = channels(color);
  for (let step = 0; step <= 10; step += 1) {
    const candidate = toHex(source.map((value, index) => value + ((target[index] - value) * step) / 10));
    if (contrastRatio(candidate, background) >= minimum) return candidate;
  }
  return toHex(target);
}

const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

export function normalizePalette(palette: ColorPalette, look: 'dark' | 'bright' = 'bright'): ColorPalette {
  const isGenericDark =
    !isHexColor(palette.background) ||
    (look !== 'dark' && GENERIC_DARK_BACKGROUNDS.has(palette.background.toLowerCase()));
  const background = isGenericDark ? FALLBACK_LIGHT.background : palette.background;
  const surface = isGenericDark || !isHexColor(palette.surface) ? FALLBACK_LIGHT.surface : palette.surface;
  const usable = (color: string, fallback: string) => (isHexColor(color) ? color : fallback);

  return {
    background,
    surface,
    text: ensureContrast(usable(palette.text, FALLBACK_LIGHT.text), background, 4.5),
    primary: ensureContrast(usable(palette.primary, '#C2410C'), background, 3),
    secondary: ensureContrast(usable(palette.secondary, '#0F766E'), background, 3),
    alert: ensureContrast(usable(palette.alert, '#B42318'), background, 3),
  };
}
