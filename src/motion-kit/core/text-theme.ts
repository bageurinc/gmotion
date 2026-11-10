import type { CSSProperties } from 'react';
import type { TextStyleId } from '@/types/studio';

export const TEXT_THEMES: Record<TextStyleId, {
  card: CSSProperties;
  headline: CSSProperties;
  activeCaption: CSSProperties;
  ink: string;
  highlight: string;
  weight: number;
}> = {
  editorial: {
    headline: { border: '5px double #87694C', padding: '16px 34px 20px' },
    activeCaption: { textDecoration: 'underline double', textUnderlineOffset: '0.16em' },
    card: {
      backgroundColor: '#F4E7CB',
      backgroundImage: 'linear-gradient(105deg, #F8EED9, #E9D5AE)',
      border: '3px double #87694C',
      borderRadius: 2,
      boxShadow: '0 5px 0 #725437, 0 10px 22px rgba(42,25,10,0.32)',
    },
    ink: '#36251B',
    highlight: '#8A351C',
    weight: 700,
  },
  teknis: {
    headline: { borderLeft: '10px solid #80DEEF', borderRadius: 0, padding: '12px 28px' },
    activeCaption: { backgroundColor: '#214657', boxShadow: 'inset 0 -2px currentColor' },
    card: {
      backgroundColor: '#112B3B',
      border: '1px solid #537D93',
      borderLeft: '6px solid #80DEEF',
      borderRadius: 4,
      textAlign: 'left',
      boxShadow: '0 5px 14px rgba(12,32,45,0.35)',
    },
    ink: '#EAF6FA',
    highlight: '#9BEAFF',
    weight: 700,
  },
  ramah: {
    headline: { borderRadius: '34px 34px 34px 10px', padding: '10px 30px 14px' },
    activeCaption: { backgroundColor: '#F5D7D8', borderRadius: '0.22em' },
    card: {
      backgroundColor: '#FFF3DE',
      border: '2px solid #CF9A72',
      borderRadius: '22px 22px 22px 6px',
      boxShadow: '0 5px 0 #A96D55',
    },
    ink: '#412C33',
    highlight: '#943B55',
    weight: 800,
  },
  tegas: {
    headline: { borderBottom: '9px solid #FFD461', padding: '10px 26px 14px' },
    activeCaption: { backgroundColor: '#FFD461', color: '#242035' },
    card: {
      backgroundColor: '#242035',
      borderRadius: 0,
      borderBottom: '5px solid #FFD461',
      boxShadow: '5px 5px 0 rgba(27,23,43,0.55)',
    },
    ink: '#FFF9EA',
    highlight: '#FFD461',
    weight: 700,
  },
};
