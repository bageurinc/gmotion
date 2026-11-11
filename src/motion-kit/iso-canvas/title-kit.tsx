'use client';

import React, { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { TITLE_FONTS, type TitleFontName } from './title-fonts';

type FontModule = {
  getInfo: () => { fonts: Record<string, Record<string, unknown>> };
  loadFont: (style?: string, options?: { weights?: string[]; subsets?: string[] }) => { fontFamily: string; waitUntilDone: () => Promise<unknown> };
};


const FALLBACK_STACK = '"Helvetica Neue", Arial, sans-serif';
const loaded = new Map<string, Promise<string>>();

/** The available weight closest to the one asked for, so a wrong guess never throws. */
function nearestWeight(module: FontModule, weight: number): string {
  const weights = Object.keys(module.getInfo().fonts.normal ?? {}).map(Number).filter(Number.isFinite);
  if (!weights.length) return String(weight);
  return String(weights.reduce((best, item) => (Math.abs(item - weight) < Math.abs(best - weight) ? item : best)));
}

function loadTitleFont(family: TitleFontName, weight: number): Promise<string> {
  const key = `${family}:${weight}`;
  let pending = loaded.get(key);
  if (!pending) {
    pending = (TITLE_FONTS[family]() as Promise<FontModule>).then(async (module) => {
      const font = module.loadFont('normal', { weights: [nearestWeight(module, weight)], subsets: ['latin'] });
      await font.waitUntilDone();
      return `"${font.fontFamily}", ${FALLBACK_STACK}`;
    });
    loaded.set(key, pending);
  }
  return pending;
}

/**
 * Loads one title font and returns a CSS font-family value. The frame waits until the font is
 * ready; an unknown name or a failed download falls back to a plain sans-serif.
 */
export function useTitleFont(family: TitleFontName, weight = 700): string {
  const known = Object.prototype.hasOwnProperty.call(TITLE_FONTS, family);
  const [value, setValue] = useState(FALLBACK_STACK);
  useEffect(() => {
    if (!known) return;
    const handle = delayRender(`Loading title font ${family}`);
    let active = true;
    loadTitleFont(family, weight)
      .then((next) => {
        if (active) setValue(next);
      })
      .catch((error: unknown) => console.warn(`[TitleFont] ${family} failed to load, using a fallback font.`, error))
      .finally(() => continueRender(handle));
    return () => {
      active = false;
    };
  }, [family, weight, known]);
  return value;
}

/** Keeps a broken model-written title from taking the video down: it simply disappears. */
export class TitleBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('[TitleCard] The title failed and is hidden.', error);
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
