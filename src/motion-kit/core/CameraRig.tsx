'use client';

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { SafeOverlayHost, useSceneLayout } from './SafeOverlay';

export interface CameraRigProps {
  children: React.ReactNode;
  mode?: 'static' | 'macro-zoom-in' | 'slow-push' | 'pan-parallax' | 'tilt-3d';
  fromScale?: number;
  toScale?: number;
  targetX?: number; // Target pan X in pixels or percent
  targetY?: number; // Target pan Y in pixels or percent
  microDrift?: boolean;
  blurDepth?: number;
  style?: React.CSSProperties;
}

export const CameraRig: React.FC<CameraRigProps> = ({
  children,
  mode = 'macro-zoom-in',
  fromScale = 1.0,
  toScale = 1.15,
  targetX = 0,
  targetY = 0,
  microDrift = true,
  blurDepth = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const inSceneLayout = useSceneLayout();

  // Baseline zoom progress
  let scale = fromScale;
  let translateX = 0;
  let translateY = 0;
  let rotateX = 0;
  let rotateY = 0;

  const springProgress = spring({
    frame,
    fps,
    config: { damping: 200, mass: 1 },
  });

  const linearProgress = frame / Math.max(1, durationInFrames);

  switch (mode) {
    case 'macro-zoom-in': {
      // Smooth dynamic zoom toward target
      scale = interpolate(springProgress, [0, 1], [fromScale, toScale]);
      translateX = interpolate(springProgress, [0, 1], [0, targetX]);
      translateY = interpolate(springProgress, [0, 1], [0, targetY]);
      break;
    }
    case 'slow-push': {
      // Cinematic slow continuous push-in
      scale = interpolate(linearProgress, [0, 1], [fromScale, toScale], {
        easing: Easing.out(Easing.quad),
      });
      translateX = interpolate(linearProgress, [0, 1], [0, targetX * 0.4]);
      translateY = interpolate(linearProgress, [0, 1], [0, targetY * 0.4]);
      break;
    }
    case 'pan-parallax': {
      scale = 1.05;
      translateX = interpolate(linearProgress, [0, 1], [-width * 0.05, width * 0.05]);
      translateY = interpolate(linearProgress, [0, 1], [0, targetY]);
      break;
    }
    case 'tilt-3d': {
      scale = interpolate(springProgress, [0, 1], [fromScale, toScale]);
      rotateX = interpolate(linearProgress, [0, 1], [6, -4]);
      rotateY = interpolate(linearProgress, [0, 1], [-8, 6]);
      break;
    }
    case 'static':
    default:
      scale = fromScale;
      break;
  }

  // Micro-drift adds subtle breathing motion so frame never feels dead
  if (microDrift && mode !== 'static') {
    const driftX = Math.sin((frame / fps) * 1.5) * 6;
    const driftY = Math.cos((frame / fps) * 1.2) * 4;
    translateX += driftX;
    translateY += driftY;
  }

  const transformStyle: React.CSSProperties = {
    transform: `perspective(1200px) scale(${scale}) translate3d(${translateX}px, ${translateY}px, 0px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
    transformOrigin: 'center center',
    filter: blurDepth > 0 ? `blur(${blurDepth}px)` : undefined,
    width: '100%',
    height: '100%',
    position: 'relative',
    ...style,
  };
  if (inSceneLayout) {
    // Animate towards full size rather than zooming beyond the reserved stage.
    // Percentage pan limits remain correct when a platform changes stage size.
    const envelope = Math.max(1, fromScale, toScale, mode === 'pan-parallax' ? 1.05 : 1);
    const fitScale = Math.min(1, Math.max(0.01, scale / envelope));
    const margin = (1 - fitScale) / 2;
    const panX = Math.max(-margin, Math.min(margin, translateX / width)) * 100;
    const panY = Math.max(-margin, Math.min(margin, translateY / height)) * 100;
    transformStyle.transform = `translate(${panX}%, ${panY}%) scale(${fitScale})`;
    transformStyle.transformOrigin = 'center center';
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {inSceneLayout ? <div style={transformStyle}>{children}</div> : (
        <SafeOverlayHost><div style={transformStyle}>{children}</div></SafeOverlayHost>
      )}
    </div>
  );
};
