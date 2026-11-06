'use client';

import React, { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { useVideoConfig } from 'remotion';
import type { SocialPlatform } from '@/types/studio';

export function getSocialSafeInsets(width: number, height: number, platform: SocialPlatform = 'generic') {
  if (height > width && platform !== 'generic') {
    const presets = {
      tiktok: { top: 0.12, right: 0.17, bottom: 0.25, left: 0.08 },
      instagram: { top: 0.12, right: 0.16, bottom: 0.23, left: 0.08 },
      shorts: { top: 0.12, right: 0.18, bottom: 0.25, left: 0.08 },
      facebook: { top: 0.12, right: 0.17, bottom: 0.24, left: 0.08 },
    };
    return presets[platform];
  }
  return height > width
    ? { top: 0.12, right: 0.16, bottom: 0.22, left: 0.08 }
    : { top: 0.05, right: 0.05, bottom: 0.1, left: 0.05 };
}

const OverlayTarget = createContext<HTMLDivElement | null>(null);
const SafeAreaContext = createContext<SocialPlatform>('generic');
export const SafeAreaProvider = SafeAreaContext.Provider;
const SceneLayoutContext = createContext(false);
export const useSceneLayout = () => useContext(SceneLayoutContext);

/** Keep essential copy outside camera transforms and scene overflow clips.
 * Each camera owns its overlay so sequence timing and transitions are retained.
 */
export const SafeOverlayHost: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const { width, height } = useVideoConfig();
  const platform = useContext(SafeAreaContext);
  const insets = getSocialSafeInsets(width, height, platform);
  return (
    <OverlayTarget.Provider value={target}>
      {children}
      <div ref={setTarget} data-safe-overlay style={{
        position: 'absolute',
        top: `${insets.top * 100}%`, right: `${insets.right * 100}%`,
        bottom: `${insets.bottom * 100}%`, left: `${insets.left * 100}%`,
        pointerEvents: 'none', zIndex: 50, fontFamily: 'Arial, sans-serif',
        display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto auto',
        rowGap: Math.min(28, height * 0.02),
        padding: 8, boxSizing: 'border-box',
      }} />
    </OverlayTarget.Provider>
  );
};

export const SafeOverlay: React.FC<React.PropsWithChildren<{
  slot: 'headline' | 'captions' | 'cta' | 'visual';
}>> = ({ slot, children }) => {
  const target = useContext(OverlayTarget);
  if (!target) return <>{children}</>;
  return createPortal(
    <div data-safe-slot={slot} style={{
      position: 'relative',
      gridRow: { headline: 1, visual: 2, cta: 3, captions: 4 }[slot],
      ...(slot === 'visual' ? { overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}),
      boxSizing: 'border-box', minWidth: 0,
      minHeight: 0,
    }}>{children}</div>,
    target,
  );
};

export const useSafeOverlay = () => useContext(OverlayTarget) !== null;

export const SceneLayout: React.FC<React.PropsWithChildren<{
  backgroundColor?: string;
  style?: React.CSSProperties;
}>> = ({ children, backgroundColor = '#0F172A', style }) => (
  <SceneLayoutContext.Provider value>
    <div style={{ backgroundColor, ...style, position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden', isolation: 'isolate' }}>
      <SafeOverlayHost>{children}</SafeOverlayHost>
    </div>
  </SceneLayoutContext.Provider>
);

/** Decorative scene layers fill the canvas independently of the safe content grid. */
export const SceneBackground: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) => (
  <div data-scene-background aria-hidden style={{ ...style, position: 'absolute', inset: 0,
    width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
    {children}
    <div style={{ position: 'absolute', inset: 0,
      background: 'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.18) 100%)' }} />
  </div>
);

export const SceneStage: React.FC<React.PropsWithChildren> = ({ children }) => (
  <SafeOverlay slot="visual">
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
  </SafeOverlay>
);
