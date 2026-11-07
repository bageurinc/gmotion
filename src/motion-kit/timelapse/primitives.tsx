'use client';

import React from 'react';
import {
  interpolate,
  interpolateColors,
  Easing,
  random,
} from 'remotion';
import { useTimelapseProgress, TimelapseClock, TimelapseProgress } from '../story/TimelapseClock';

export { useTimelapseProgress } from '../story/TimelapseClock';

/* -------------------------------------------------------------------------- */
/* 1. StagedReveal: Progressive reveal of multi-stage items (floors, steps, etc.) */
/* -------------------------------------------------------------------------- */
export interface StagedRevealProps {
  count: number;
  progress?: number;
  from?: number; // Normalized progress start (default: 0)
  to?: number;   // Normalized progress end (default: 1)
  renderItem: (index: number, itemProgress: number) => React.ReactNode;
  containerTag?: 'div' | 'g';
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Renders `count` items sequentially as progress advances from `from` to `to`.
 * `itemProgress` is 0.0 before item starts appearing, smoothly rises to 1.0, and stays at 1.0 afterwards.
 * Ideal for building floors rising, steps completing, trees sprouting branches, etc.
 */
export const StagedReveal: React.FC<StagedRevealProps> = ({
  count,
  progress: externalProgress,
  from = 0,
  to = 1,
  renderItem,
  containerTag: Tag = 'div',
  style,
  className,
}) => {
  const defaultProgress = useTimelapseProgress();
  const progress = externalProgress !== undefined ? externalProgress : defaultProgress;

  const validCount = Math.max(1, count);
  const range = Math.max(0.001, to - from);
  const step = range / validCount;

  const items = Array.from({ length: validCount }).map((_, index) => {
    const itemStart = from + index * step;
    const rawProgress = (progress - itemStart) / step;
    const itemProgress = Math.min(1, Math.max(0, rawProgress));

    return renderItem(index, itemProgress);
  });

  if (Tag === 'g') {
    return (
      <g className={className} style={style}>
        {items}
      </g>
    );
  }

  return (
    <div className={className} style={style}>
      {items}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. GrowAxis: Unidirectional growth along X, Y, or uniform scale           */
/* -------------------------------------------------------------------------- */
export interface GrowAxisProps {
  children?: React.ReactNode | ((growth: number) => React.ReactNode);
  axis?: 'y' | 'x' | 'scale' | 'height' | 'width';
  progress?: number;
  from?: number; // Initial factor (default: 0)
  to?: number;   // Final factor (default: 1)
  fromProgress?: number; // Normalized progress window start (default: 0)
  toProgress?: number;   // Normalized progress window end (default: 1)
  origin?: string; // e.g. "bottom center", "left center", "center center"
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Smoothly scales or stretches content along a single axis as progress moves forward.
 * Perfect for tree trunk growing upwards, foundation pouring, beam extending, etc.
 */
export const GrowAxis: React.FC<GrowAxisProps> = ({
  children,
  axis = 'y',
  progress: externalProgress,
  from = 0,
  to = 1,
  fromProgress = 0,
  toProgress = 1,
  origin,
  style,
  className,
}) => {
  const defaultProgress = useTimelapseProgress();
  const progress = externalProgress !== undefined ? externalProgress : defaultProgress;

  const clampedProgress = Math.min(
    1,
    Math.max(0, (progress - fromProgress) / Math.max(0.001, toProgress - fromProgress))
  );

  const growth = interpolate(clampedProgress, [0, 1], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const defaultOrigin =
    axis === 'y' || axis === 'height'
      ? 'bottom center'
      : axis === 'x' || axis === 'width'
      ? 'left center'
      : 'center center';

  const transformOrigin = origin || defaultOrigin;

  let transformValue: string | undefined = undefined;
  const dimensionStyle: React.CSSProperties = {};

  if (axis === 'y') {
    transformValue = `scaleY(${growth})`;
  } else if (axis === 'x') {
    transformValue = `scaleX(${growth})`;
  } else if (axis === 'scale') {
    transformValue = `scale(${growth})`;
  } else if (axis === 'height') {
    dimensionStyle.height = `${growth * 100}%`;
  } else if (axis === 'width') {
    dimensionStyle.width = `${growth * 100}%`;
  }

  return (
    <div
      className={className}
      style={{
        transform: transformValue,
        transformOrigin,
        ...dimensionStyle,
        ...style,
      }}
    >
      {typeof children === 'function' ? children(growth) : children}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. StateMorph: Multi-point value & color interpolation                     */
/* -------------------------------------------------------------------------- */
export interface MorphState {
  at: number; // Normalized progress (0.0 to 1.0)
  color?: string;
  opacity?: number;
  scale?: number;
  custom?: number;
}

export interface StateMorphProps {
  states: MorphState[];
  progress?: number;
  children: (interpolated: {
    color?: string;
    opacity: number;
    scale: number;
    custom: number;
    progress: number;
  }) => React.ReactNode;
}

/**
 * Interpolates color, opacity, scale, and custom values between discrete timeline waypoints.
 * Ideal for blooming petals, curing concrete, changing material phases, etc.
 */
export const StateMorph: React.FC<StateMorphProps> = ({
  states,
  progress: externalProgress,
  children,
}) => {
  const defaultProgress = useTimelapseProgress();
  const progress = externalProgress !== undefined ? externalProgress : defaultProgress;

  const sortedStates = [...states].sort((a, b) => a.at - b.at);
  if (sortedStates.length === 0) {
    return <>{children({ opacity: 1, scale: 1, custom: 0, progress })}</>;
  }

  const atPoints = sortedStates.map((s) => s.at);
  const opacities = sortedStates.map((s) => (s.opacity !== undefined ? s.opacity : 1));
  const scales = sortedStates.map((s) => (s.scale !== undefined ? s.scale : 1));
  const customs = sortedStates.map((s) => (s.custom !== undefined ? s.custom : 0));

  const opacity = interpolate(progress, atPoints, opacities, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(progress, atPoints, scales, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const custom = interpolate(progress, atPoints, customs, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  let color: string | undefined = undefined;
  const hasColor = sortedStates.some((s) => s.color !== undefined);
  if (hasColor) {
    const validColors = sortedStates.map((s) => s.color || '#FFFFFF');
    color = interpolateColors(progress, atPoints, validColors);
  }

  return <>{children({ color, opacity, scale, custom, progress })}</>;
};

/* -------------------------------------------------------------------------- */
/* 4. Repeat: Deterministic repeating elements with seed-based variation      */
/* -------------------------------------------------------------------------- */
export interface RepeatProps {
  count: number;
  seed?: string;
  renderItem: (index: number, randomValue: number, seedKey: string) => React.ReactNode;
  containerTag?: 'div' | 'g';
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Deterministically generates repeated elements (windows, leaves, rivets, crowd members)
 * with predictable pseudorandom variance controlled by Remotion `random(seed)`.
 */
export const Repeat: React.FC<RepeatProps> = ({
  count,
  seed = 'repeat',
  renderItem,
  containerTag: Tag = 'div',
  style,
  className,
}) => {
  const items = Array.from({ length: Math.max(0, count) }).map((_, i) => {
    const seedKey = `${seed}-${i}`;
    const rand = random(seedKey);
    return renderItem(i, rand, seedKey);
  });

  if (Tag === 'g') {
    return <g className={className} style={style}>{items}</g>;
  }

  return <div className={className} style={style}>{items}</div>;
};

/* -------------------------------------------------------------------------- */
/* 5. PathMover: Movement along a linear vector or path                      */
/* -------------------------------------------------------------------------- */
export interface CoordinatePoint {
  x: number | string;
  y: number | string;
}

export interface PathMoverProps {
  from: CoordinatePoint;
  to: CoordinatePoint;
  progress?: number;
  easing?: 'linear' | 'ease-in-out';
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

function parsePointVal(val: number | string): { num: number; unit: string } {
  if (typeof val === 'number') return { num: val, unit: 'px' };
  const str = String(val).trim();
  const match = str.match(/^(-?[\d.]+)(px|%|vw|vh)?$/);
  if (match) {
    return { num: parseFloat(match[1]), unit: match[2] || 'px' };
  }
  return { num: 0, unit: 'px' };
}

/**
 * Moves objects smoothly between two points (from -> to) as progress proceeds.
 * Essential for tower cranes slewing, concrete trucks moving, conveyor belts, etc.
 */
export const PathMover: React.FC<PathMoverProps> = ({
  from,
  to,
  progress: externalProgress,
  easing = 'linear',
  children,
  style,
  className,
}) => {
  const defaultProgress = useTimelapseProgress();
  const progress = externalProgress !== undefined ? externalProgress : defaultProgress;

  const easeProgress =
    easing === 'ease-in-out'
      ? interpolate(progress, [0, 1], [0, 1], {
          easing: Easing.inOut(Easing.cubic),
        })
      : progress;

  const startX = parsePointVal(from.x);
  const endX = parsePointVal(to.x);
  const startY = parsePointVal(from.y);
  const endY = parsePointVal(to.y);

  const curX = interpolate(easeProgress, [0, 1], [startX.num, endX.num]);
  const curY = interpolate(easeProgress, [0, 1], [startY.num, endY.num]);

  return (
    <div
      className={className}
      style={{
        transform: `translate3d(${curX}${startX.unit}, ${curY}${startY.unit}, 0px)`,
        position: 'relative',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 6. TimeHUD: Topic-Neutral Stage & Time HUD                                */
/* -------------------------------------------------------------------------- */
export interface TimeHUDProps {
  mode?: 'bar' | 'clock' | 'badge';
  progress?: number;
  label?: string;
  fromLabel?: string;
  toLabel?: string;
  accentColor?: string;
  speedMultiplier?: string;
  style?: React.CSSProperties;
}

/**
 * Versatile HUD component for timelapse scenes.
 * - `mode="bar"`: Sleek progress bar with percent counter and stage labels (e.g. "Lantai 1" -> "Lantai 24").
 * - `mode="badge"`: Compact floating stage badge for industrial/scientific processes.
 * - `mode="clock"`: High-detail analog & digital clock (when time-of-day is relevant).
 */
export const TimeHUD: React.FC<TimeHUDProps> = ({
  mode = 'bar',
  progress: externalProgress,
  label = 'PROGRES TIMELAPSE',
  fromLabel = 'Awal',
  toLabel = 'Selesai',
  accentColor = '#10B981',
  speedMultiplier = '100x Speed',
  style,
}) => {
  const defaultProgress = useTimelapseProgress();
  const progress = externalProgress !== undefined ? externalProgress : defaultProgress;
  const percent = Math.round(progress * 100);

  if (mode === 'clock') {
    return (
      <TimelapseClock
        progress={progress}
        fromTime={fromLabel.includes(':') ? fromLabel : '06:00'}
        toTime={toLabel.includes(':') ? toLabel : '20:00'}
        label={label}
        speedMultiplier={speedMultiplier}
        accentColor={accentColor}
        style={style}
      />
    );
  }

  if (mode === 'badge') {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 18px',
          borderRadius: 14,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          border: `1.5px solid ${accentColor}44`,
          boxShadow: `0 8px 24px rgba(0, 0, 0, 0.4), 0 0 16px ${accentColor}33`,
          color: '#F8FAFC',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          userSelect: 'none',
          ...style,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: accentColor,
            boxShadow: `0 0 8px ${accentColor}`,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: accentColor,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: '#FFFFFF',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fromLabel} &rarr; {toLabel} ({percent}%)
          </span>
        </div>
      </div>
    );
  }

  // mode="bar"
  return (
    <TimelapseProgress
      progress={progress}
      fromLabel={fromLabel}
      toLabel={toLabel}
      label={label}
      accentColor={accentColor}
      style={style}
    />
  );
};
