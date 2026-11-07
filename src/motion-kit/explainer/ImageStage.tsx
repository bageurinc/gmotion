import React from 'react';
import { Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { SceneBackground, SceneLayout } from '../core/SafeOverlay';
import { activeShot, imageCameraAt, imageOffset, ImageShot } from './image-camera';

const CENTER_Y = 0.48;
const POSE_FADE_FRAMES = 10;
const MARK_DELAY_FRAMES = 14;
const MARK_FADE_FRAMES = 8;
const FONT = '"Helvetica Neue", Arial, sans-serif';
/** A mark around most of the picture points at nothing, so large boxes only get the camera move. */
const MAX_MARKED_AREA = 0.14;
const LABEL_BACKGROUND = '#111827';
const LABEL_TEXT = '#FFFFFF';
const HEADLINE_PLATE = 0.27;

/** Full-frame pictures that change on spoken words: new poses, camera moves, and marked objects. */
export const ImageStage: React.FC<React.PropsWithChildren<{
  images: string[];
  shots: ImageShot[];
  backgroundColor: string;
  accent: string;
}>> = ({ images, shots, backgroundColor, accent, children }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const camera = imageCameraAt(frame, shots, fps);
  const offset = imageOffset(camera, width, height, CENTER_Y);
  const shot = activeShot(frame, shots);

  const poseOpacity = images.map((_, pose) => shots.reduce((current, item) => {
    const progress = interpolate(frame, [item.from, item.from + POSE_FADE_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return current + ((item.pose === pose ? 1 : 0) - current) * progress;
  }, shots[0].pose === pose ? 1 : 0));

  const markOpacity = interpolate(frame, [shot.from + MARK_DELAY_FRAMES, shot.from + MARK_DELAY_FRAMES + MARK_FADE_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const { box } = shot;

  return (
    <SceneLayout backgroundColor={backgroundColor}>
      <SceneBackground scrim={false}>
        <div style={{ position: 'absolute', left: 0, top: 0, width, height, transformOrigin: '0 0', transform: `translate(${offset.x}px, ${offset.y}px) scale(${camera.scale})` }}>
          {images.map((src, pose) => (
            <Img key={src} src={src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: poseOpacity[pose] }} />
          ))}
          {box && box.w * box.h <= MAX_MARKED_AREA && (
            <div style={{ position: 'absolute', left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`, boxSizing: 'border-box', border: `${9 / camera.scale}px solid ${accent}`, borderRadius: 18 / camera.scale, opacity: markOpacity }} />
          )}
        </div>
        {/* Pictures fill the frame, so the headline gets its own plate instead of hoping for empty space. */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${backgroundColor} 0%, ${backgroundColor} ${HEADLINE_PLATE * 100}%, transparent ${(HEADLINE_PLATE + 0.04) * 100}%)` }} />
      </SceneBackground>
      {box && shot.label && (
        <div style={{ position: 'absolute', left: Math.min(width * 0.72, Math.max(width * 0.24, (box.x + box.w / 2) * width * camera.scale + offset.x)), top: Math.max(height * 0.3, box.y * height * camera.scale + offset.y - 18), transform: 'translate(-50%, -100%)', opacity: markOpacity, background: LABEL_BACKGROUND, color: LABEL_TEXT, borderRadius: 999, padding: '10px 26px', fontFamily: FONT, fontSize: width * 0.034, fontWeight: 800, whiteSpace: 'nowrap', zIndex: 5 }}>
          {shot.label}
        </div>
      )}
      {children}
    </SceneLayout>
  );
};
