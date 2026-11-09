import type { TextStyleId } from '@/types/studio';

/** What the user reads about each text style. Fonts and sizes live in motion-kit/core/text-style.ts. */
export const TEXT_STYLE_OPTIONS: Array<{ id: TextStyleId; label: string; fonts: string; note: string }> = [
  { id: 'tegas', label: 'Tegas', fonts: 'Anton + Inter', note: 'Kapital tebal untuk topik mendesak dan olahraga' },
  { id: 'teknis', label: 'Teknis', fonts: 'Barlow Condensed + Inter', note: 'Rapi untuk sains dan cara kerja' },
  { id: 'editorial', label: 'Editorial', fonts: 'Playfair Display + Lora', note: 'Klasik untuk sejarah dan budaya' },
  { id: 'ramah', label: 'Ramah', fonts: 'Baloo 2', note: 'Bulat untuk topik sehari-hari dan anak' },
];
