import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { getLength, getPointAtLength } from '@remotion/paths';
import type { AssetFocus, AssetManifest, GeneratedAssetProps } from '../../lib/explainer/asset-contract';

export interface StageShot {
  from: number;
  to: number;
  view: string;
  focus: AssetFocus;
  highlightPart?: string;
  flowId?: string;
  headline?: string;
  kicker?: string;
  caption?: string;
}

const WIDE: AssetFocus = { x: 500, y: 500, scale: 1 };
const EASE = Easing.bezier(0.45, 0, 0.2, 1);

/** Builds a short topic-neutral shot list from a manifest. */
export function buildAssetShots(manifest: AssetManifest, fps = 30): StageShot[] {
  const [firstView, secondView] = manifest.views;
  const secondViewParts = manifest.parts.filter((part) => part.views.includes(secondView.id));
  const [partA, partB] = secondViewParts;
  const flows = manifest.flows.filter((flow) => flow.view === secondView.id);
  const seconds = (value: number) => Math.round(value * fps);

  return [
    {
      from: 0,
      to: seconds(2.5),
      view: firstView.id,
      focus: manifest.heroFocus,
      kicker: manifest.subtitle,
      headline: manifest.title,
    },
    { from: seconds(2.5), to: seconds(5), view: firstView.id, focus: WIDE, headline: manifest.title },
    {
      from: seconds(5),
      to: seconds(7.5),
      view: secondView.id,
      focus: { x: 500, y: 500, scale: 1.08 },
      highlightPart: partA.id,
      flowId: flows[0].id,
      caption: secondView.label,
    },
    {
      from: seconds(7.5),
      to: seconds(10),
      view: secondView.id,
      focus: partB.focus,
      highlightPart: partB.id,
      flowId: (flows[1] ?? flows[0]).id,
      caption: partB.label,
    },
  ];
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

const Bokeh: React.FC<{ manifest: AssetManifest; frame: number; width: number; height: number }> = ({
  manifest,
  frame,
  width,
  height,
}) => (
  <>
    {Array.from({ length: 34 }, (_, index) => {
      const seed = `${manifest.topic}-${index}`;
      const size = 8 + random(`${seed}-size`) * 70;
      const speed = 0.2 + random(`${seed}-speed`) * 0.8;
      const x = random(`${seed}-x`) * width;
      const y = (random(`${seed}-y`) * height - frame * speed + height * 2) % height;
      return (
        <div
          key={seed}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: size,
            height: size,
            borderRadius: '50%',
            background: index % 3 === 0 ? manifest.palette.accentAlt : manifest.palette.accent,
            opacity: 0.08 + random(`${seed}-opacity`) * 0.2,
            filter: `blur(${size / 5}px)`,
          }}
        />
      );
    })}
  </>
);

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
        return <circle key={index} cx={point.x} cy={point.y} r={7} fill={color} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2} />;
      })}
    </g>
  );
};

export const AssetStage: React.FC<{
  manifest: AssetManifest;
  Asset: React.ComponentType<GeneratedAssetProps>;
  shots?: StageShot[];
}> = ({ manifest, Asset, shots: providedShots }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const shots = useMemo(() => providedShots ?? buildAssetShots(manifest, fps), [providedShots, manifest, fps]);
  const shot = shots.find((item) => frame >= item.from && frame < item.to) ?? shots[shots.length - 1];
  const camera = cameraAt(frame, shots, fps);
  const fadeFrames = Math.round(fps * 0.6);

  const viewOpacity = Object.fromEntries(
    manifest.views.map((view) => {
      const entered = shots.reduce((opacity, item) => {
        const target = item.view === view.id ? 1 : 0;
        const progress = interpolate(frame, [item.from, item.from + fadeFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return opacity + (target - opacity) * progress;
      }, shots[0].view === view.id ? 1 : 0);
      return [view.id, entered];
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

  const stageSize = width;
  const stageTop = (height - stageSize) / 2 + 70;
  const pixelsPerUnit = stageSize / 1000;
  const translateX = stageSize / 2 - camera.x * pixelsPerUnit * camera.scale;
  const translateY = stageSize / 2 - camera.y * pixelsPerUnit * camera.scale;
  const activePart = manifest.parts.find((part) => part.id === shot.highlightPart);
  const activeFlow = manifest.flows.find((flow) => flow.id === shot.flowId);
  const textIn = interpolate(frame, [shot.from, shot.from + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const flowOpacity = interpolate(frame, [shot.from + 8, shot.from + 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 46%, ${manifest.palette.backgroundFrom} 0%, ${manifest.palette.backgroundTo} 72%)`,
        overflow: 'hidden',
        fontFamily: 'Helvetica Neue, Arial, sans-serif',
      }}
    >
      <Bokeh manifest={manifest} frame={frame} width={width} height={height} />
      <div style={{ position: 'absolute', top: stageTop, left: 0, width: stageSize, height: stageSize }}>
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
            {activeFlow && <FlowParticles d={activeFlow.d} color={activeFlow.color} frame={frame} opacity={flowOpacity} />}
          </svg>
        </div>
        {activePart && (
          <div
            style={{
              position: 'absolute',
              left: activePart.anchor.x * pixelsPerUnit * camera.scale + translateX,
              top: activePart.anchor.y * pixelsPerUnit * camera.scale + translateY,
              transform: 'translate(-50%, -50%)',
              opacity: flowOpacity,
              padding: '10px 22px',
              borderRadius: 16,
              background: 'rgba(12, 8, 20, 0.82)',
              border: `2px solid ${manifest.palette.accent}`,
              color: manifest.palette.text,
              fontSize: 34,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {activePart.label}
          </div>
        )}
      </div>
      {shot.headline && (
        <div
          style={{
            position: 'absolute',
            inset: '0 0 auto 0',
            height: 700,
            opacity: textIn,
            background: `linear-gradient(to bottom, ${manifest.palette.backgroundTo} 45%, transparent)`,
          }}
        />
      )}
      <div style={{ position: 'absolute', top: 170, left: 80, right: 80, textAlign: 'center', opacity: textIn, color: manifest.palette.text }}>
        {shot.kicker && <div style={{ fontSize: 38, fontWeight: 500, marginBottom: 12 }}>{shot.kicker}</div>}
        {shot.headline && <div style={{ fontSize: 88, lineHeight: 1.05, fontWeight: 300, letterSpacing: 4 }}>{shot.headline}</div>}
      </div>
      {shot.caption && (
        <div style={{ position: 'absolute', left: 90, right: 90, bottom: 300, display: 'flex', justifyContent: 'center', opacity: textIn }}>
          <div style={{ padding: '18px 34px', borderRadius: 20, background: 'rgba(12, 8, 20, 0.78)', color: manifest.palette.text, fontSize: 44, fontWeight: 700, textAlign: 'center' }}>
            {shot.caption}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
