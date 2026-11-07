import React, { useMemo } from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { getLength, getPointAtLength } from '@remotion/paths';
import { SceneBackground, SceneLayout, useSafeInsets } from '../core/SafeOverlay';
import type { AssetFocus, AssetManifest, GeneratedAssetProps } from '../../lib/explainer/asset-contract';

export interface StageShot {
  from: number;
  to: number;
  view: string;
  focus: AssetFocus;
  highlightPart?: string;
  flowId?: string;
}

const WIDE: AssetFocus = { x: 500, y: 500, scale: 1 };
const EASE = Easing.bezier(0.45, 0, 0.2, 1);
const MIN_SHOT_SECONDS = 2.2;
const MAX_ZOOM = 1.6;

/** Splits a scene into a wide shot followed by a close look at each part it has time for. */
export function buildAssetShots(manifest: AssetManifest, durationInFrames = 300, fps = 30): StageShot[] {
  const [firstView] = manifest.views;
  const revealed = manifest.parts.filter((part) => part.views.some((view) => view !== firstView.id));
  const parts = revealed.length ? revealed : manifest.parts;
  const shotCount = Math.max(1, Math.min(parts.length + 1, Math.floor(durationInFrames / (MIN_SHOT_SECONDS * fps))));
  const boundary = (index: number) => Math.round((index * durationInFrames) / shotCount);

  return Array.from({ length: shotCount }, (_, index) => {
    const range = { from: boundary(index), to: boundary(index + 1) };
    if (index === 0) return { ...range, view: firstView.id, focus: WIDE };

    const part = parts[index - 1];
    const view = part.views.find((id) => id !== firstView.id) ?? part.views[0];
    const flows = manifest.flows.filter((flow) => flow.view === view);
    return {
      ...range,
      view,
      focus: { ...part.focus, scale: Math.min(part.focus.scale, MAX_ZOOM) },
      highlightPart: part.id,
      flowId: flows.length ? flows[index % flows.length].id : undefined,
    };
  });
}

function cameraAt(frame: number, shots: StageShot[], fps: number): AssetFocus {
  const transition = Math.round(fps * 0.8);
  let camera = shots[0].focus;
  for (const shot of shots) {
    if (frame < shot.from) break;
    const progress = interpolate(frame, [shot.from, shot.from + transition], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASE,
    });
    camera = {
      x: camera.x + (shot.focus.x - camera.x) * progress,
      y: camera.y + (shot.focus.y - camera.y) * progress,
      scale: camera.scale + (shot.focus.scale - camera.scale) * progress,
    };
  }
  const shot = shots.find((item) => frame >= item.from && frame < item.to) ?? shots[shots.length - 1];
  const drift = interpolate(frame, [shot.from, shot.to], [1, 1.035], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { ...camera, scale: camera.scale * drift };
}

const FlowParticles: React.FC<{ d: string; color: string; frame: number; opacity: number }> = ({
  d,
  color,
  frame,
  opacity,
}) => {
  const length = useMemo(() => getLength(d), [d]);
  return (
    <g opacity={opacity}>
      {Array.from({ length: 14 }, (_, index) => {
        const offset = ((frame * 5 + (index * length) / 14) % length + length) % length;
        const point = getPointAtLength(d, offset);
        if (!point) return null;
        return <circle key={index} cx={point.x} cy={point.y} r={7} fill={color} stroke={color} strokeOpacity={0.35} strokeWidth={6} />;
      })}
    </g>
  );
};

export const AssetStage: React.FC<React.PropsWithChildren<{
  manifest: AssetManifest;
  Asset: React.ComponentType<GeneratedAssetProps>;
  shots?: StageShot[];
}>> = ({ manifest, Asset, shots: providedShots, children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const insets = useSafeInsets();
  const shots = useMemo(
    () => providedShots ?? buildAssetShots(manifest, durationInFrames, fps),
    [providedShots, manifest, durationInFrames, fps]
  );
  const shot = shots.find((item) => frame >= item.from && frame < item.to) ?? shots[shots.length - 1];
  const camera = cameraAt(frame, shots, fps);
  const fadeFrames = Math.round(fps * 0.6);

  const viewOpacity = Object.fromEntries(
    manifest.views.map((view) => {
      const opacity = shots.reduce((current, item) => {
        const target = item.view === view.id ? 1 : 0;
        const progress = interpolate(frame, [item.from, item.from + fadeFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return current + (target - current) * progress;
      }, shots[0].view === view.id ? 1 : 0);
      return [view.id, opacity];
    })
  );

  const highlight = Object.fromEntries(
    manifest.parts.map((part) => {
      const active = shots.find((item) => item.highlightPart === part.id && frame >= item.from && frame < item.to);
      const value = active
        ? interpolate(frame, [active.from, active.from + fadeFrames, active.to - 6, active.to], [0, 1, 1, 0.2], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        : 0;
      return [part.id, value];
    })
  );

  const safeWidth = width * (1 - insets.left - insets.right);
  const safeHeight = height * (1 - insets.top - insets.bottom);
  const stageSize = Math.min(safeWidth, safeHeight * 0.72);
  const stageLeft = width * insets.left + (safeWidth - stageSize) / 2;
  const stageTop = height * insets.top + (safeHeight - stageSize) * 0.55;
  const pixelsPerUnit = stageSize / 1000;
  const translateX = stageSize / 2 - camera.x * pixelsPerUnit * camera.scale;
  const translateY = stageSize / 2 - camera.y * pixelsPerUnit * camera.scale;
  const activePart = manifest.parts.find((part) => part.id === shot.highlightPart);
  const activeFlow = manifest.flows.find((flow) => flow.id === shot.flowId);
  const labelOpacity = interpolate(frame, [shot.from + 8, shot.from + 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <SceneLayout backgroundColor={manifest.palette.backgroundTo}>
      <SceneBackground
        scrim={false}
        style={{
          background: `radial-gradient(circle at 50% 48%, ${manifest.palette.backgroundFrom} 0%, ${manifest.palette.backgroundTo} 78%)`,
        }}
      />
      <div style={{ position: 'absolute', top: stageTop, left: stageLeft, width: stageSize, height: stageSize, zIndex: 1 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformOrigin: '0 0',
            transform: `translate(${translateX}px, ${translateY}px) scale(${camera.scale})`,
          }}
        >
          <Asset viewOpacity={viewOpacity} highlight={highlight} time={frame / fps} />
          <svg viewBox="0 0 1000 1000" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
            {activeFlow && <FlowParticles d={activeFlow.d} color={activeFlow.color} frame={frame} opacity={labelOpacity} />}
          </svg>
        </div>
        {activePart && (
          <div
            style={{
              position: 'absolute',
              left: activePart.anchor.x * pixelsPerUnit * camera.scale + translateX,
              top: activePart.anchor.y * pixelsPerUnit * camera.scale + translateY,
              transform: 'translate(-50%, -50%)',
              opacity: labelOpacity,
              padding: '10px 22px',
              borderRadius: 16,
              background: manifest.palette.backgroundFrom,
              border: `3px solid ${manifest.palette.accent}`,
              color: manifest.palette.text,
              fontFamily: 'Arial, sans-serif',
              fontSize: Math.round(width * 0.03),
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {activePart.label}
          </div>
        )}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: height * (insets.top + 0.14),
          zIndex: 2,
          background: `linear-gradient(to bottom, ${manifest.palette.backgroundTo} 62%, transparent)`,
        }}
      />
      {children}
    </SceneLayout>
  );
};
