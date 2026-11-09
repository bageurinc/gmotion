import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { getLength, getPointAtLength } from '@remotion/paths';
import { SceneBackground, SceneLayout, useSafeInsets } from '../core/SafeOverlay';
import { TEXT_STYLES } from '../core/text-style';
import type { TextStyleId } from '@/types/studio';
import { actionProgressAt, type ActionCue } from '../../lib/explainer/choreography';
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
const TEXT_RESERVE = 0.17;
const MIN_SHOT_SECONDS = 2.2;
const MAX_ZOOM = 1.6;
const ART_FILL = 960;
const MAX_FIT = 1.5;

export interface ArtBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArtFit {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Environment may run far past the canvas, so only the part on the canvas decides the fit. */
function onCanvas(bounds: ArtBounds): ArtBounds {
  const x = Math.max(0, bounds.x);
  const y = Math.max(0, bounds.y);
  return {
    x,
    y,
    width: Math.min(1000, bounds.x + bounds.width) - x,
    height: Math.min(1000, bounds.y + bounds.height) - y,
  };
}

/** Centers the drawn artwork and scales it to fill the stage. */
export function fitArtwork(drawn: ArtBounds | null): ArtFit {
  const bounds = drawn && onCanvas(drawn);
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return { scale: 1, offsetX: 0, offsetY: 0 };
  const scale = Math.min(MAX_FIT, ART_FILL / Math.max(bounds.width, bounds.height));
  return {
    scale,
    offsetX: 500 - (bounds.x + bounds.width / 2) * scale,
    offsetY: 500 - (bounds.y + bounds.height / 2) * scale,
  };
}

/** Maps a focus through the fit and keeps the zoomed view inside the artwork. */
export function fitFocus(focus: AssetFocus, fit: ArtFit): AssetFocus {
  const margin = 500 / focus.scale;
  const place = (value: number) => Math.min(1000 - margin, Math.max(margin, value));
  return {
    x: place(focus.x * fit.scale + fit.offsetX),
    y: place(focus.y * fit.scale + fit.offsetY),
    scale: focus.scale,
  };
}

/** Splits a scene into a wide shot followed by a close look at each part it has time for. */
export function buildAssetShots(manifest: AssetManifest, durationInFrames = 300, fps = 30): StageShot[] {
  const [firstView] = manifest.views;
  if (manifest.choreography) return [{ from: 0, to: durationInFrames, view: firstView.id, focus: WIDE }];
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

/** A Full SVG scene's camera: where it starts (the previous scene's camera) and where it settles. */
export interface ScenePath {
  from?: AssetFocus;
  to: AssetFocus;
}

const CAMERA_MOVE_SECONDS = 1.3;

/** Flies from the previous scene's camera to this scene's, then holds still so the actions read. */
export function scenePathCamera(frame: number, fps: number, path?: ScenePath): AssetFocus {
  if (!path) return WIDE;
  const from = path.from ?? path.to;
  const moveFrames = Math.round(fps * CAMERA_MOVE_SECONDS);
  if (frame >= moveFrames) return path.to;
  const progress = interpolate(frame, [0, moveFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  // Zoom moves through log scale so a deep push in feels as even as a small one.
  const scale = Math.exp(Math.log(from.scale) + (Math.log(path.to.scale) - Math.log(from.scale)) * progress);
  return {
    x: from.x + (path.to.x - from.x) * progress,
    y: from.y + (path.to.y - from.y) * progress,
    scale,
  };
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
  actionCues?: ActionCue[];
  /** Lets the artwork reach the frame edges. Scenes drawn before the bleed rule stop at the canvas and need the fade. */
  fullBleed?: boolean;
  textStyle?: TextStyleId;
  /** Camera path in the shared world for a Full SVG scene. Without it the scene stays wide. */
  camera?: ScenePath;
}>> = ({ manifest, Asset, shots: providedShots, actionCues = [], fullBleed = false, textStyle, camera: path, children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const insets = useSafeInsets();
  const shots = useMemo(
    () => providedShots ?? buildAssetShots(manifest, durationInFrames, fps),
    [providedShots, manifest, durationInFrames, fps]
  );
  const shot = shots.find((item) => frame >= item.from && frame < item.to) ?? shots[shots.length - 1];
  const artRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<ArtBounds | null>(null);
  const fit = useMemo(() => fitArtwork(manifest.choreography ? null : bounds), [bounds, manifest.choreography]);
  const fittedShots = useMemo(
    () => shots.map((item) => ({ ...item, focus: fitFocus(item.focus, fit) })),
    [shots, fit]
  );
  const camera = manifest.choreography ? scenePathCamera(frame, fps, path) : cameraAt(frame, fittedShots, fps);

  useLayoutEffect(() => {
    if (manifest.choreography) return;
    const art = artRef.current?.querySelector<SVGSVGElement>('svg:not([data-flow-layer])');
    if (!art) return;
    const box = art.getBBox();
    setBounds((current) => current ?? { x: box.x, y: box.y, width: box.width, height: box.height });
  }, [manifest.choreography]);
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

  const safeHeight = height * (1 - insets.top - insets.bottom);
  const safeCenter = width * (insets.left + (1 - insets.left - insets.right) / 2);
  const stageSize = Math.min(width * 0.96, safeHeight - height * TEXT_RESERVE);
  const stageLeft = Math.max(0, safeCenter - stageSize / 2);
  const stageTop = height * insets.top + (safeHeight - stageSize) * 0.52;
  const pixelsPerUnit = stageSize / 1000;
  const translateX = stageSize / 2 - camera.x * pixelsPerUnit * camera.scale;
  const translateY = stageSize / 2 - camera.y * pixelsPerUnit * camera.scale;
  const activePart = manifest.parts.find((part) => part.id === shot.highlightPart);
  const activeFlow = manifest.flows.find((flow) => flow.id === shot.flowId);
  const labelOpacity = interpolate(frame, [shot.from + 8, shot.from + 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelLeft = activePart
    ? ((activePart.anchor.x * fit.scale + fit.offsetX) * pixelsPerUnit * camera.scale + translateX)
    : 0;
  const labelTop = activePart
    ? ((activePart.anchor.y * fit.scale + fit.offsetY) * pixelsPerUnit * camera.scale + translateY)
    : 0;
  // The wide shot shows the whole setting. Only a zoomed subject can rise behind the headline.
  const headlinePlate = interpolate(camera.scale, [1.05, 1.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const stageEdgeFade = 'linear-gradient(to bottom, transparent 0, #000 5%, #000 95%, transparent 100%)';

  return (
    <SceneLayout backgroundColor={manifest.palette.backgroundTo}>
      <SceneBackground
        scrim={false}
        style={{
          background: `radial-gradient(circle at 50% 48%, ${manifest.palette.backgroundFrom} 0%, ${manifest.palette.backgroundTo} 78%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: stageTop,
          left: 0,
          width,
          height: stageSize,
          zIndex: 1,
          ...(fullBleed ? {} : { overflow: 'hidden', maskImage: stageEdgeFade, WebkitMaskImage: stageEdgeFade }),
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: stageLeft, width: stageSize, height: stageSize }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transformOrigin: '0 0',
              transform: `translate(${translateX}px, ${translateY}px) scale(${camera.scale})`,
            }}
          >
            <div
              ref={artRef}
              style={{
                position: 'absolute',
                inset: 0,
                transformOrigin: '0 0',
                transform: `translate(${fit.offsetX * pixelsPerUnit}px, ${fit.offsetY * pixelsPerUnit}px) scale(${fit.scale})`,
              }}
            >
              <Asset viewOpacity={viewOpacity} highlight={highlight} actionProgress={actionProgressAt(actionCues, frame)} time={frame / fps} />
              <svg data-flow-layer viewBox="0 0 1000 1000" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                {activeFlow && <FlowParticles d={activeFlow.d} color={activeFlow.color} frame={frame} opacity={labelOpacity} />}
              </svg>
            </div>
          </div>
          {activePart && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(stageSize * 0.8, Math.max(stageSize * 0.2, labelLeft)),
                top: Math.min(stageSize * 0.92, Math.max(stageSize * 0.08, labelTop)),
                transform: 'translate(-50%, -50%)',
                opacity: labelOpacity,
                padding: '10px 22px',
                borderRadius: 16,
                background: manifest.palette.backgroundFrom,
                border: `3px solid ${manifest.palette.accent}`,
                color: manifest.palette.text,
                fontFamily: textStyle ? TEXT_STYLES[textStyle].bodyFont() : 'Arial, sans-serif',
                fontSize: Math.round(width * 0.03),
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {activePart.label}
            </div>
          )}
        </div>
      </div>
      {fullBleed && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            pointerEvents: 'none',
            opacity: headlinePlate,
            background: `linear-gradient(to bottom, ${manifest.palette.backgroundTo} ${stageTop}px, transparent ${stageTop + stageSize * 0.05}px)`,
          }}
        />
      )}
      {children}
    </SceneLayout>
  );
};
