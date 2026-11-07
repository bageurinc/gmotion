import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { getLength, getPointAtLength } from '@remotion/paths';
import type { AssetManifest, GeneratedAssetProps } from '../../lib/explainer/asset-contract';
import type { WorldScript } from '../../lib/explainer/world-plan';
import type { WordTiming } from '../../types/studio';
import { ArtBounds, fitArtwork } from '../explainer/AssetStage';

export type TimedBeat = WorldScript['beats'][number] & {
  from: number;
  duration: number;
  audio: string;
  wordTimings: WordTiming[];
};

export interface WorldVideoProps {
  manifest: AssetManifest;
  script: Omit<WorldScript, 'beats'> & { beats: TimedBeat[] };
}

const MOVE_FRAMES = 26;
const WIDE_ZOOM = 1.3;
const VIEW_CENTER = 0.6;
const EASE = Easing.bezier(0.6, 0, 0.15, 1);
const FONT = '"Helvetica Neue", Arial, sans-serif';

const activeIndex = (beats: TimedBeat[], frame: number) =>
  Math.max(0, beats.findLastIndex((beat) => frame >= beat.from));

function cameraTarget(beat: TimedBeat, manifest: AssetManifest) {
  const part = manifest.parts.find((item) => item.id === beat.focus);
  return part
    ? { x: part.focus.x, y: part.focus.y, zoom: Math.max(1.4, beat.zoom) }
    : { x: 500, y: 500, zoom: WIDE_ZOOM };
}

function cameraAt(frame: number, beats: TimedBeat[], manifest: AssetManifest) {
  let camera = cameraTarget(beats[0], manifest);
  for (const beat of beats.slice(1)) {
    const progress = interpolate(frame, [beat.from - 6, beat.from - 6 + MOVE_FRAMES], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASE,
    });
    const target = cameraTarget(beat, manifest);
    camera = {
      x: camera.x + (target.x - camera.x) * progress,
      y: camera.y + (target.y - camera.y) * progress,
      zoom: camera.zoom + (target.zoom - camera.zoom) * progress,
    };
  }
  return camera;
}

const Flow: React.FC<{ d: string; color: string; frame: number }> = ({ d, color, frame }) => {
  const length = useMemo(() => getLength(d), [d]);
  return (
    <>
      {Array.from({ length: 12 }, (_, index) => {
        const point = getPointAtLength(d, (frame * 3 + (index * length) / 12) % length);
        return point ? <circle key={index} cx={point.x} cy={point.y} r={4} fill={color} /> : null;
      })}
    </>
  );
};

const Hud: React.FC<{ script: WorldVideoProps['script']; beat: TimedBeat; index: number; frame: number; width: number; height: number; fps: number }> = ({
  script, beat, index, frame, width, height, fps,
}) => {
  const previous = script.beats[index - 1]?.value ?? beat.value;
  const value = Math.round(
    interpolate(frame, [beat.from, beat.from + Math.min(beat.duration, fps * 1.4)], [previous, beat.value], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const history = script.beats.slice(0, index + 1).map((item) => item.value);
  const top = Math.max(...script.beats.map((item) => item.value), 1);
  const bottom = Math.min(...script.beats.map((item) => item.value), 0);
  const chartWidth = width * 0.36;
  const points = history
    .map((item, position) => {
      const x = (position / Math.max(script.beats.length - 1, 1)) * chartWidth;
      const y = 44 - ((item - bottom) / Math.max(top - bottom, 1)) * 40;
      return `${x},${y}`;
    })
    .join(' ');
  const [before, after] = beat.accent && beat.headline.includes(beat.accent)
    ? beat.headline.split(beat.accent)
    : [beat.headline, ''];

  return (
    <>
      <div style={{ position: 'absolute', inset: '0 0 auto 0', height: height * 0.285, background: script.palette.hud }} />
      <div style={{ position: 'absolute', top: height * 0.285, left: 0, right: 0, height: height * 0.05, background: `linear-gradient(to bottom, ${script.palette.hud}, transparent)` }} />
      <div style={{ position: 'absolute', top: height * 0.075, left: width * 0.07, right: width * 0.07, fontFamily: FONT, color: script.palette.hudText }}>
        <div style={{ fontSize: width * 0.052, lineHeight: 1.16, fontWeight: 800, minHeight: width * 0.122 }}>
          {before}
          {beat.accent && after !== undefined && beat.headline.includes(beat.accent) ? <span style={{ color: script.palette.accent }}>{beat.accent}</span> : null}
          {after}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: height * 0.014 }}>
          <div style={{ fontSize: width * 0.085, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {value}
            <span style={{ fontSize: width * 0.036, marginLeft: 8 }}>{script.unit}</span>
          </div>
          <svg width={chartWidth} height={48} style={{ overflow: 'visible' }}>
            <polyline points={points} fill="none" stroke={script.palette.hudText} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ textAlign: 'right' }}>
            <div style={{ border: `2px solid ${script.palette.accent}`, color: script.palette.accent, borderRadius: 999, padding: '6px 16px', fontSize: width * 0.024, fontWeight: 700 }}>
              {beat.status}
            </div>
            <div style={{ fontSize: width * 0.022, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{beat.clock}</div>
          </div>
        </div>
      </div>
    </>
  );
};

const CaptionPill: React.FC<{ beat: TimedBeat; frame: number; fps: number; width: number; height: number; palette: WorldScript['palette'] }> = ({
  beat, frame, fps, width, height, palette,
}) => {
  const timeMs = ((frame - beat.from) / fps) * 1000;
  const current = Math.max(0, beat.wordTimings.findLastIndex((word) => timeMs >= word.startMs));
  const chunkStart = Math.floor(current / 5) * 5;
  const words = beat.wordTimings.slice(chunkStart, chunkStart + 5);
  return (
    <div style={{ position: 'absolute', left: width * 0.08, right: width * 0.17, top: height * 0.72, display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: '#FFFFFF', color: palette.ink, borderRadius: 18, padding: '10px 18px', fontFamily: FONT, fontSize: width * 0.04, fontWeight: 800, textAlign: 'center', lineHeight: 1.3, boxShadow: `0 3px 0 ${palette.ink}55` }}>
        {words.map((word, position) => {
          const isActive = chunkStart + position === current;
          return (
            <span key={position} style={{ padding: '2px 6px', borderRadius: 8, background: isActive ? palette.ink : 'transparent', color: isActive ? '#FFFFFF' : palette.ink }}>
              {word.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const WorldVideo: React.FC<{ world: WorldVideoProps; Asset: React.ComponentType<GeneratedAssetProps> }> = ({ world, Asset }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const { manifest, script } = world;
  const artRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<ArtBounds | null>(null);
  const fit = useMemo(() => fitArtwork(bounds), [bounds]);

  useLayoutEffect(() => {
    const art = artRef.current?.querySelector<SVGSVGElement>('svg:not([data-flow])');
    if (!art) return;
    const box = art.getBBox();
    setBounds((current) => current ?? { x: box.x, y: box.y, width: box.width, height: box.height });
  }, []);

  const index = activeIndex(script.beats, frame);
  const beat = script.beats[index];
  const camera = cameraAt(frame, script.beats, manifest);
  const unit = (width / 1000) * camera.zoom;
  const fittedX = camera.x * fit.scale + fit.offsetX;
  const fittedY = camera.y * fit.scale + fit.offsetY;
  const translateX = width / 2 - fittedX * unit;
  const translateY = height * VIEW_CENTER - fittedY * unit;

  const viewOpacity = Object.fromEntries(
    manifest.views.map((view) => [
      view.id,
      script.beats.reduce((current, item) => {
        const progress = interpolate(frame, [item.from, item.from + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return current + ((item.view === view.id ? 1 : 0) - current) * progress;
      }, script.beats[0].view === view.id ? 1 : 0),
    ])
  );
  const highlight = Object.fromEntries(
    manifest.parts.map((part) => [
      part.id,
      part.id === beat.focus
        ? interpolate(frame, [beat.from + 10, beat.from + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        : 0,
    ])
  );

  const part = manifest.parts.find((item) => item.id === beat.focus);
  const labelOpacity = interpolate(frame, [beat.from + 16, beat.from + 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const stickerScale = spring({ frame: frame - beat.from - 4, fps, config: { damping: 11, stiffness: 180 } });
  const stickerFade = interpolate(frame, [beat.from + 32, beat.from + 42], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: script.palette.ground, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1000, height: 1000, transformOrigin: '0 0', transform: `translate(${translateX}px, ${translateY}px) scale(${unit})` }}>
        <div ref={artRef} style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${fit.offsetX}px, ${fit.offsetY}px) scale(${fit.scale})` }}>
          <Asset viewOpacity={viewOpacity} highlight={highlight} time={frame / fps} />
          <svg data-flow viewBox="0 0 1000 1000" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
            {manifest.flows.filter((flow) => flow.view === beat.view).map((flow) => (
              <Flow key={flow.id} d={flow.d} color={script.palette.accent} frame={frame} />
            ))}
          </svg>
        </div>
      </div>

      {part && beat.label && (
        <div style={{ position: 'absolute', left: Math.min(width * 0.74, Math.max(width * 0.2, (part.anchor.x * fit.scale + fit.offsetX) * unit + translateX)), top: Math.max(height * 0.36, Math.min(height * 0.68, (part.anchor.y * fit.scale + fit.offsetY) * unit + translateY)), transform: 'translate(-50%, -50%)', opacity: labelOpacity, background: script.palette.hud, color: script.palette.hudText, borderRadius: 999, padding: '8px 20px', fontFamily: FONT, fontSize: width * 0.028, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {beat.label}
        </div>
      )}

      {beat.sticker && (
        <div style={{ position: 'absolute', top: height * 0.34, left: 0, right: 0, textAlign: 'center', fontFamily: FONT, fontSize: width * 0.085, fontWeight: 900, color: script.palette.accent, WebkitTextStroke: `4px ${script.palette.ink}`, paintOrder: 'stroke fill', transform: `rotate(-6deg) scale(${stickerScale})`, opacity: stickerFade }}>
          {beat.sticker}
        </div>
      )}

      <Hud script={script} beat={beat} index={index} frame={frame} width={width} height={height} fps={fps} />
      <CaptionPill beat={beat} frame={frame} fps={fps} width={width} height={height} palette={script.palette} />

      {script.beats.map((item) => (
        <Sequence key={item.from} from={item.from} durationInFrames={item.duration}>
          <Audio src={staticFile(item.audio)} />
        </Sequence>
      ))}
      <Audio src={staticFile('audio/music/upbeat-saas.wav')} loop volume={0.1} />
    </AbsoluteFill>
  );
};
