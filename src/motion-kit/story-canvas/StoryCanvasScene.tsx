'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { loadFont } from '@remotion/google-fonts/Inter';
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';
import { useSafeInsets } from '../core/SafeOverlay';
import { createStory, type StoryDraw } from './engine';

let interLoad: Promise<unknown> | null = null;
const loadInter = () => (interLoad ??= loadFont('normal', { weights: ['500', '700'], subsets: ['latin'] }).waitUntilDone());

/** Bridges the story canvas engine to Remotion: redraws the whole canvas for the current frame. */
export const StoryCanvasScene: React.FC<{ draw: StoryDraw; timeOffset?: number; labelTop?: number }> = ({ draw, timeOffset = 0, labelTop = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const insets = useSafeInsets();
  const top = Math.max(insets.top, labelTop);
  const { right, bottom, left } = insets;
  const ref = useRef<HTMLCanvasElement>(null);
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    const handle = delayRender('Loading Inter for story canvas labels');
    let active = true;
    loadInter()
      .catch((error: unknown) => console.warn('[StoryCanvasScene] Inter failed to load, using a fallback font.', error))
      .finally(() => {
        if (active) setFontReady(true);
        continueRender(handle);
      });
    return () => {
      active = false;
    };
  }, []);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const story = createStory(ctx, width, height, { safe: { top, right, bottom, left } });
    draw(story, frame / fps + timeOffset);
    story.finish();
  }, [draw, frame, fps, width, height, top, right, bottom, left, timeOffset, fontReady]);

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={width} height={height} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
};
