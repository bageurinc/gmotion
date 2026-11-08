import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { getLength, getPointAtLength } from '@remotion/paths';
import { activeShot, imageCameraAt, imageOffset, ImageShot, markFade, spotlightGradient } from '../explainer/image-camera';
import { WorldOverlay, WorldVideoProps } from './WorldStage';

export interface IsoPictureFlow {
  /** Picture fractions, from the top-left corner. */
  points: Array<{ x: number; y: number }>;
  from: number;
  to: number;
}

export interface IsoPicture {
  /** The main world first, then one picture per close-up. */
  images: string[];
  /** Share of each picture's height, from the top, that is an empty strip the camera must keep under the panel. */
  tops?: number[];
  shots: ImageShot[];
  flows: IsoPictureFlow[];
  background: string;
  accent: string;
  ink: string;
}

const CENTER_Y = 0.58;
/** Zoom share per second inside a shot, strong enough that the still check sees motion. */
const SHOT_PUSH = 0.035;
/** Screen share the headline panel and its fade always cover. */
const PANEL_COVER = 0.22;
const POSE_FADE_FRAMES = 12;
const MAX_MARKED_AREA = 0.2;
const FLOW_DOTS = 9;
const FLOW_SPEED = 0.012;
const FLOW_FADE_FRAMES = 10;
const RING_PERIOD_FRAMES = 36;
const FONT = '"Helvetica Neue", Arial, sans-serif';

/** A smooth curve through the points, bending gently so a flow reads as movement and not a ruler line. */
function flowPath(points: Array<{ x: number; y: number }>, width: number, height: number): string {
  const scaled = points.map((point) => ({ x: point.x * width, y: point.y * height }));
  return scaled.slice(1).reduce((d, point, index) => {
    const start = scaled[index];
    const bend = 0.18;
    const controlX = (start.x + point.x) / 2 - (point.y - start.y) * bend;
    const controlY = (start.y + point.y) / 2 + (point.x - start.x) * bend;
    return `${d} Q ${controlX} ${controlY} ${point.x} ${point.y}`;
  }, `M ${scaled[0].x} ${scaled[0].y}`);
}

const Flow: React.FC<{ flow: IsoPictureFlow; color: string; ink: string }> = ({ flow, color, ink }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (frame < flow.from || frame > flow.to) return null;
  const opacity = Math.min(
    interpolate(frame, [flow.from, flow.from + FLOW_FADE_FRAMES], [0, 1], { extrapolateRight: 'clamp' }),
    interpolate(frame, [flow.to - FLOW_FADE_FRAMES, flow.to], [1, 0], { extrapolateLeft: 'clamp' }),
  );
  const d = flowPath(flow.points, width, height);
  const radius = width * 0.011;
  const length = getLength(d);
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity, overflow: 'visible' }}>
      <path d={d} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={radius * 1.2} strokeLinecap="round" />
      {Array.from({ length: FLOW_DOTS }, (_, index) => {
        const point = getPointAtLength(d, ((frame * FLOW_SPEED + index / FLOW_DOTS) % 1) * length);
        if (!point) return null;
        return <circle key={index} cx={point.x} cy={point.y} r={radius} fill={color} stroke={ink} strokeWidth={radius * 0.35} />;
      })}
    </svg>
  );
};

/** One painted isometric world: the camera travels between parts, close-ups cross-fade in, and flows move over the art. */
export const IsoPictureStage: React.FC<{ picture: IsoPicture }> = ({ picture }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const { shots } = picture;
  const shot = activeShot(frame, shots);
  const markOpacity = markFade(frame, shot, shots);
  const { box } = shot;

  const poseOpacity = picture.images.map((_, pose) => shots.reduce((current, item) => {
    const progress = interpolate(frame, [item.from, item.from + POSE_FADE_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return current + ((item.pose === pose ? 1 : 0) - current) * progress;
  }, shots[0].pose === pose ? 1 : 0));

  const top = Math.max(0, ...poseOpacity.map((opacity, pose) => (opacity > 0.01 ? picture.tops?.[pose] ?? 0 : 0)));
  const moving = imageCameraAt(frame, shots, fps, SHOT_PUSH);
  // Zoom just enough that the picture below its empty strip still reaches from the panel to the bottom.
  const camera = { ...moving, scale: Math.max(moving.scale, (1 - PANEL_COVER) / (1 - top)) };
  const fitted = imageOffset(camera, width, height, CENTER_Y);
  const offset = { x: fitted.x, y: Math.min(fitted.y, height * (PANEL_COVER - top * camera.scale)) };

  const ringPhase = (frame % RING_PERIOD_FRAMES) / RING_PERIOD_FRAMES;
  const labelX = box ? Math.min(width * 0.74, Math.max(width * 0.26, (box.x + box.w / 2) * width * camera.scale + offset.x)) : 0;
  const labelY = box ? Math.max(height * 0.3, box.y * height * camera.scale + offset.y - 18) : height * 0.3;

  return (
    <AbsoluteFill style={{ background: picture.background, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width, height, transformOrigin: '0 0', transform: `translate(${offset.x}px, ${offset.y}px) scale(${camera.scale})` }}>
        {picture.images.map((src, pose) => (
          <Img key={src} src={src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: poseOpacity[pose] }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, opacity: poseOpacity[0] }}>
          {picture.flows.map((flow, index) => <Flow key={index} flow={flow} color={picture.accent} ink={picture.ink} />)}
        </div>
        {box && box.w * box.h <= MAX_MARKED_AREA && (
          <>
            <div style={{ position: 'absolute', inset: 0, background: spotlightGradient(box, width, height), opacity: markOpacity }} />
            <div style={{
              position: 'absolute',
              left: (box.x + box.w / 2) * width,
              top: (box.y + box.h / 2) * height,
              width: box.w * width * (1 + ringPhase * 0.25),
              height: box.h * height * (1 + ringPhase * 0.25),
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: `${width * 0.006 / camera.scale}px solid ${picture.accent}`,
              opacity: markOpacity * (1 - ringPhase) * 0.9,
            }} />
          </>
        )}
      </div>
      {box && shot.label ? (
        <div style={{ position: 'absolute', left: labelX, top: labelY, transform: 'translate(-50%, -100%)', opacity: markOpacity, background: picture.ink, color: '#FFFFFF', boxShadow: '0 0 0 3px #FFFFFF', borderRadius: 999, padding: '10px 26px', display: 'flex', alignItems: 'center', gap: 12, fontFamily: FONT, fontSize: width * 0.034, fontWeight: 800, whiteSpace: 'nowrap' }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: picture.accent }} />
          {shot.label}
        </div>
      ) : null}
      {!box && shot.pose > 0 && shot.label ? (
        <div style={{ position: 'absolute', left: width / 2, top: height * 0.3, transform: 'translate(-50%, 0)', opacity: poseOpacity[shot.pose], background: picture.ink, color: '#FFFFFF', boxShadow: '0 0 0 3px #FFFFFF', borderRadius: 999, padding: '10px 26px', fontFamily: FONT, fontSize: width * 0.034, fontWeight: 800, whiteSpace: 'nowrap' }}>
          {shot.label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const IsoPictureVideo: React.FC<{ picture: IsoPicture; script: WorldVideoProps['script'] }> = ({ picture, script }) => (
  <AbsoluteFill>
    <IsoPictureStage picture={picture} />
    <WorldOverlay script={script} />
  </AbsoluteFill>
);
