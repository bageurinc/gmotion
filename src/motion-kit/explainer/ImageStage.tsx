import React from 'react';
import { Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { SceneBackground, SceneLayout } from '../core/SafeOverlay';
import { TEXT_STYLES } from '../core/text-style';
import type { TextStyleId } from '@/types/studio';
import { activeShot, imageCameraAt, imageOffset, ImageShot, markFade, spotlightGradient } from './image-camera';

const CENTER_Y = 0.48;
const POSE_FADE_FRAMES = 10;
const FONT = '"Helvetica Neue", Arial, sans-serif';
/** A spotlight on most of the picture points at nothing, so large boxes only get the camera move. */
const MAX_MARKED_AREA = 0.14;
const LABEL_BACKGROUND = '#111827';
const LABEL_TEXT = '#FFFFFF';
const HEADLINE_PLATE = 0.2;
const HEADLINE_PLATE_END = 0.32;

/** Full-frame pictures that change on spoken words: new poses, camera moves, and marked objects. */
export const ImageStage: React.FC<React.PropsWithChildren<{
  images: string[];
  shots: ImageShot[];
  backgroundColor: string;
  accent: string;
  /** Older scenes pass none of these and keep their original label. */
  textStyle?: TextStyleId;
  labelBackground?: string;
  labelText?: string;
  /** Pixel art pictures scale with hard edges, so camera zooms keep square pixels. */
  pixelated?: boolean;
}>> = ({ images, shots, backgroundColor, accent, textStyle, labelBackground = LABEL_BACKGROUND, labelText = LABEL_TEXT, pixelated = false, children }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const camera = imageCameraAt(frame, shots, fps);
  const offset = imageOffset(camera, width, height, CENTER_Y);
  const shot = activeShot(frame, shots);

  const poseOpacity = images.map((_, pose) => shots.reduce((current, item) => {
    const progress = interpolate(frame, [item.from, item.from + POSE_FADE_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return current + ((item.pose === pose ? 1 : 0) - current) * progress;
  }, shots[0].pose === pose ? 1 : 0));

  const markOpacity = markFade(frame, shot, shots);
  const { box } = shot;

  return (
    <SceneLayout backgroundColor={backgroundColor}>
      <SceneBackground scrim={false}>
        <div style={{ position: 'absolute', left: 0, top: 0, width, height, transformOrigin: '0 0', transform: `translate(${offset.x}px, ${offset.y}px) scale(${camera.scale})` }}>
          {images.map((src, pose) => (
            <Img key={src} src={src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: poseOpacity[pose], imageRendering: pixelated ? 'pixelated' : undefined }} />
          ))}
          {box && box.w * box.h <= MAX_MARKED_AREA && (
            <div style={{ position: 'absolute', inset: 0, background: spotlightGradient(box, width, height), opacity: markOpacity }} />
          )}
        </div>
        {/* A soft veil keeps the headline readable while the picture still shows through to the top edge. */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${backgroundColor}D9 0%, ${backgroundColor}B3 ${HEADLINE_PLATE * 100}%, transparent ${HEADLINE_PLATE_END * 100}%)` }} />
      </SceneBackground>
      {box && shot.label && (
        <div style={{ position: 'absolute', left: Math.min(width * 0.72, Math.max(width * 0.24, (box.x + box.w / 2) * width * camera.scale + offset.x)), top: Math.max(height * 0.3, box.y * height * camera.scale + offset.y - 18), transform: 'translate(-50%, -100%)', opacity: markOpacity, background: labelBackground, color: labelText, borderRadius: 999, padding: '10px 26px', display: 'flex', alignItems: 'center', gap: 12, fontFamily: textStyle ? TEXT_STYLES[textStyle].bodyFont() : FONT, fontSize: width * 0.034, fontWeight: 800, whiteSpace: 'nowrap', zIndex: 5 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: accent }} />
          {shot.label}
        </div>
      )}
      {children}
    </SceneLayout>
  );
};
