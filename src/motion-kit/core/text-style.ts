import type React from 'react';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadBaloo } from '@remotion/google-fonts/Baloo2';
import { loadFont as loadBarlow } from '@remotion/google-fonts/BarlowCondensed';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadLora } from '@remotion/google-fonts/Lora';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { interpolate } from 'remotion';
import type { TextStyleId } from '@/types/studio';

type Entrance = 'slam' | 'wipe' | 'rise' | 'bounce';

interface TextStyle {
  headlineFont: () => string;
  bodyFont: () => string;
  headlineSize: number;
  headlineWeight: number;
  letterSpacing: string;
  sentenceCase: boolean;
  entrance: Entrance;
}

/** Fonts load once, and only those the video uses, because each one delays rendering. */
const once = (load: () => { fontFamily: string }) => {
  let family: string | undefined;
  return () => (family ??= load().fontFamily);
};

const anton = once(() => loadAnton('normal', { weights: ['400'], subsets: ['latin'] }));
const barlow = once(() => loadBarlow('normal', { weights: ['700'], subsets: ['latin'] }));
const playfair = once(() => loadPlayfair('normal', { weights: ['800'], subsets: ['latin'] }));
const baloo = once(() => loadBaloo('normal', { weights: ['800'], subsets: ['latin'] }));
const inter = once(() => loadInter('normal', { weights: ['700'], subsets: ['latin'] }));
const lora = once(() => loadLora('normal', { weights: ['700'], subsets: ['latin'] }));

export const TEXT_STYLES: Record<TextStyleId, TextStyle> = {
  tegas: { headlineFont: anton, bodyFont: inter, headlineSize: 70, headlineWeight: 400, letterSpacing: '0.01em', sentenceCase: false, entrance: 'slam' },
  teknis: { headlineFont: barlow, bodyFont: inter, headlineSize: 66, headlineWeight: 700, letterSpacing: '0.02em', sentenceCase: false, entrance: 'wipe' },
  editorial: { headlineFont: playfair, bodyFont: lora, headlineSize: 60, headlineWeight: 800, letterSpacing: '-0.01em', sentenceCase: true, entrance: 'rise' },
  ramah: { headlineFont: baloo, bodyFont: baloo, headlineSize: 62, headlineWeight: 800, letterSpacing: '0', sentenceCase: true, entrance: 'bounce' },
};

/** Directors write headlines in capitals, which reads as shouting in the calmer styles. */
export const toSentenceCase = (text: string) => {
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

/** How one headline word looks at a given spring progress. */
export function wordMotion(entrance: Entrance, progress: number): React.CSSProperties {
  const opacity = interpolate(progress, [0, 0.35], [0, 1], { extrapolateRight: 'clamp' });
  if (entrance === 'slam') return { opacity, transform: `scale(${interpolate(progress, [0, 1], [1.5, 1])})` };
  if (entrance === 'wipe') return { clipPath: `inset(-20% ${interpolate(progress, [0, 1], [100, -5])}% -20% -5%)` };
  if (entrance === 'rise') return { opacity, transform: `translate3d(0, ${interpolate(progress, [0, 1], [18, 0])}px, 0)` };
  return { opacity, transform: `translate3d(0, ${interpolate(progress, [0, 1], [46, 0])}px, 0) rotate(${interpolate(progress, [0, 1], [-5, 0])}deg)` };
}
