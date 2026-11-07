'use client';

import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  interpolateColors,
  Easing,
  random,
} from 'remotion';

export interface UseTimelapseProgressOptions {
  easing?: 'linear' | 'ease-in-out';
  durationInFrames?: number;
}

/**
 * Deterministic frame-to-progress calculation for Remotion timelapse scenes.
 * Returns normalized progress strictly between 0.0 and 1.0.
 */
export function useTimelapseProgress(options: UseTimelapseProgressOptions = {}): number {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const total = Math.max(1, (options.durationInFrames || config.durationInFrames || 120) - 1);
  const linear = Math.min(1, Math.max(0, frame / total));

  if (options.easing === 'linear') {
    return linear;
  }

  // Default smooth ease-in-out
  return interpolate(linear, [0, 1], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
  });
}

export interface DayNightSkyProps {
  progress?: number;
  showSunMoon?: boolean;
  showStars?: boolean;
  starCount?: number;
  seed?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Cinematic full-frame Day-to-Night sky component for timelapse scenes.
 * Interpolates smoothly from warm morning dawn -> vibrant noon -> golden hour / sunset -> deep starry night.
 */
export const DayNightSky: React.FC<DayNightSkyProps> = ({
  progress: externalProgress,
  showSunMoon = true,
  showStars = true,
  starCount = 45,
  seed = 'timelapse-sky',
  style,
}) => {
  const defaultProgress = useTimelapseProgress();
  const progress = externalProgress !== undefined ? externalProgress : defaultProgress;

  // Key Sky Color Progression:
  // 0.00: Early Morning Sunrise (Soft peach / pink / light blue)
  // 0.35: Midday Bright Sky (Vibrant cyan-blue)
  // 0.65: Late Afternoon Golden Amber
  // 0.78: Sunset / Dusk (Deep magenta / burnt orange)
  // 0.90: Twilight Navy
  // 1.00: Deep Starry Midnight
  const stages = [0.0, 0.35, 0.65, 0.78, 0.9, 1.0];
  const topColors = ['#F97316', '#0284C7', '#D97706', '#991B1B', '#311042', '#050814'];
  const bottomColors = ['#93C5FD', '#38BDF8', '#FBBF24', '#EA580C', '#1E1B4B', '#0F172A'];

  const currentTopColor = interpolateColors(progress, stages, topColors);
  const currentBottomColor = interpolateColors(progress, stages, bottomColors);

  // Celestial mechanics:
  // Sun travels from left horizon (low) up to zenith, then descends into right horizon
  const sunX = interpolate(progress, [0, 0.75], [12, 88], {
    extrapolateRight: 'clamp',
  });
  const sunY = interpolate(progress, [0, 0.35, 0.75], [70, 18, 75], {
    extrapolateRight: 'clamp',
  });
  const sunOpacity = interpolate(progress, [0, 0.08, 0.65, 0.78], [0.3, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sunScale = interpolate(progress, [0, 0.35, 0.75], [1.3, 1.0, 1.4]);

  // Moon rises as twilight sets in (0.70 -> 1.00)
  const moonX = interpolate(progress, [0.7, 1.0], [25, 75], {
    extrapolateLeft: 'clamp',
  });
  const moonY = interpolate(progress, [0.7, 0.88, 1.0], [78, 26, 20], {
    extrapolateLeft: 'clamp',
  });
  const moonOpacity = interpolate(progress, [0.7, 0.82], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Stars glow when sky is dark enough (0.75 -> 1.0)
  const starsOpacity = interpolate(progress, [0.72, 0.9], [0, 0.95], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const stars = Array.from({ length: starCount }).map((_, i) => {
    const sSeed = `${seed}-star-${i}`;
    const x = random(`${sSeed}-x`) * 100;
    const y = random(`${sSeed}-y`) * 65; // keep in upper sky
    const r = 0.6 + random(`${sSeed}-r`) * 1.5;
    const flicker = 0.5 + random(`${sSeed}-flicker`) * 0.5;

    return (
      <circle
        key={i}
        cx={`${x}%`}
        cy={`${y}%`}
        r={r}
        fill="#FFFFFF"
        opacity={flicker}
      />
    );
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(to bottom, ${currentTopColor}, ${currentBottomColor})`,
        ...style,
      }}
    >
      <svg
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Sun Glow */}
          <radialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFBEB" stopOpacity="1" />
            <stop offset="40%" stopColor="#FDE047" stopOpacity="0.8" />
            <stop offset="75%" stopColor="#F59E0B" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
          </radialGradient>
          {/* Moon Glow */}
          <radialGradient id="moon-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#E2E8F0" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Stars */}
        {showStars && (
          <g opacity={starsOpacity}>
            {stars}
          </g>
        )}

        {/* Sun */}
        {showSunMoon && (
          <g
            opacity={sunOpacity}
            transform={`translate(${sunX * 10}, ${sunY * 10}) scale(${sunScale})`}
          >
            <circle cx="0" cy="0" r="110" fill="url(#sun-glow)" />
            <circle cx="0" cy="0" r="32" fill="#FFFBEB" />
          </g>
        )}

        {/* Moon */}
        {showSunMoon && (
          <g
            opacity={moonOpacity}
            transform={`translate(${moonX * 10}, ${moonY * 10})`}
          >
            <circle cx="0" cy="0" r="80" fill="url(#moon-glow)" />
            <circle cx="0" cy="0" r="28" fill="#F8FAFC" />
            {/* Crater shadows */}
            <circle cx="-8" cy="-6" r="6" fill="#CBD5E1" opacity="0.6" />
            <circle cx="9" cy="8" r="7" fill="#CBD5E1" opacity="0.5" />
            <circle cx="-4" cy="11" r="4" fill="#CBD5E1" opacity="0.4" />
          </g>
        )}
      </svg>
    </div>
  );
};

export interface TimelapseClockProps {
  progress?: number;
  fromTime?: string; // e.g. "06:00"
  toTime?: string;   // e.g. "20:00"
  label?: string;
  speedMultiplier?: string; // e.g. "60x Speed"
  accentColor?: string;
  size?: number;
  showAnalog?: boolean;
  showDigital?: boolean;
  style?: React.CSSProperties;
}

function parseTimeToMinutes(timeStr: string): number | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes: number): string {
  const norm = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(norm / 60);
  const minutes = norm % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Dynamic HUD clock and timer badge for timelapse scenes.
 * Features spinning analog hands and live progressing digital readout.
 */
export const TimelapseClock: React.FC<TimelapseClockProps> = ({
  progress: externalProgress,
  fromTime = '06:00',
  toTime = '20:00',
  label = 'TIMELAPSE',
  speedMultiplier = '60x Speed',
  accentColor = '#38BDF8',
  size = 180,
  showAnalog = true,
  showDigital = true,
  style,
}) => {
  const defaultProgress = useTimelapseProgress();
  const progress = externalProgress !== undefined ? externalProgress : defaultProgress;

  const startMins = parseTimeToMinutes(fromTime) ?? 360; // 06:00
  let endMins = parseTimeToMinutes(toTime) ?? 1200;      // 20:00
  if (endMins < startMins) {
    endMins += 1440; // crosses midnight
  }

  const currentMinutes = interpolate(progress, [0, 1], [startMins, endMins]);
  const formattedTime = formatMinutesToTime(currentMinutes);

  // Analog hands:
  // Hour hand: 360 deg per 720 minutes (12 hours)
  const hourRotation = (currentMinutes / 720) * 360;
  // Minute hand: 360 deg per 60 minutes
  const minuteRotation = (currentMinutes / 60) * 360;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 22px',
        borderRadius: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(14px)',
        border: `1.5px solid ${accentColor}44`,
        boxShadow: `0 12px 32px rgba(0, 0, 0, 0.45), 0 0 24px ${accentColor}33`,
        color: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Top Header Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
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
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: accentColor,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        {speedMultiplier && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              padding: '2px 8px',
              borderRadius: 8,
              color: '#CBD5E1',
            }}
          >
            {speedMultiplier}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Analog Clock Face */}
        {showAnalog && (
          <svg
            width={size * 0.55}
            height={size * 0.55}
            viewBox="0 0 100 100"
            style={{ flexShrink: 0 }}
          >
            {/* Outer Bezel */}
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="#0F172A"
              stroke={accentColor}
              strokeWidth="2.5"
            />
            {/* Hour Markers */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
              <line
                key={deg}
                x1="50"
                y1="12"
                x2="50"
                y2={deg % 90 === 0 ? "17" : "14"}
                stroke={deg % 90 === 0 ? accentColor : '#64748B'}
                strokeWidth={deg % 90 === 0 ? "2" : "1.2"}
                transform={`rotate(${deg} 50 50)`}
              />
            ))}
            {/* Hour Hand */}
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="28"
              stroke="#F8FAFC"
              strokeWidth="3.5"
              strokeLinecap="round"
              transform={`rotate(${hourRotation} 50 50)`}
            />
            {/* Minute Hand */}
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="18"
              stroke={accentColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              transform={`rotate(${minuteRotation} 50 50)`}
            />
            {/* Center Pin */}
            <circle cx="50" cy="50" r="3.5" fill={accentColor} />
          </svg>
        )}

        {/* Digital Clock Readout */}
        {showDigital && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#F8FAFC',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {formattedTime}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#94A3B8',
                marginTop: 4,
                fontWeight: 500,
              }}
            >
              {fromTime} &rarr; {toTime}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export interface TimelapseProgressProps {
  progress?: number;
  fromLabel?: string;
  toLabel?: string;
  label?: string;
  accentColor?: string;
  width?: number | string;
  style?: React.CSSProperties;
}

/**
 * Clean linear progress bar for timelapse scenes showing overall 0 -> 100% transition.
 */
export const TimelapseProgress: React.FC<TimelapseProgressProps> = ({
  progress: externalProgress,
  fromLabel = 'Awal',
  toLabel = 'Selesai',
  label = 'Progres Timelapse',
  accentColor = '#10B981',
  width = 340,
  style,
}) => {
  const defaultProgress = useTimelapseProgress();
  const progress = externalProgress !== undefined ? externalProgress : defaultProgress;
  const percent = Math.round(progress * 100);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width,
        padding: '12px 18px',
        borderRadius: 14,
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        color: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span style={{ color: '#E2E8F0' }}>{label}</span>
        <span style={{ color: accentColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {percent}%
        </span>
      </div>

      {/* Progress Track */}
      <div
        style={{
          width: '100%',
          height: 8,
          borderRadius: 4,
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            borderRadius: 4,
            backgroundColor: accentColor,
            boxShadow: `0 0 10px ${accentColor}`,
          }}
        />
      </div>

      {/* Sublabels */}
      {(fromLabel || toLabel) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 6,
            fontSize: 11,
            color: '#94A3B8',
          }}
        >
          <span>{fromLabel}</span>
          <span>{toLabel}</span>
        </div>
      )}
    </div>
  );
};

export interface TimelapseShadowProps {
  progress?: number;
  baseWidth?: number;
  baseHeight?: number;
  color?: string;
  style?: React.CSSProperties;
}

/**
 * Animated cast shadow that swings and stretches based on sun angle during timelapse.
 */
export const TimelapseShadow: React.FC<TimelapseShadowProps> = ({
  progress: externalProgress,
  baseWidth = 120,
  baseHeight = 24,
  color = 'rgba(0, 0, 0, 0.45)',
  style,
}) => {
  const defaultProgress = useTimelapseProgress();
  const progress = externalProgress !== undefined ? externalProgress : defaultProgress;

  // Morning (progress 0): Long shadow to the right (angle ~ +60 deg, stretch 2.4x)
  // Noon (progress 0.4): Short shadow directly below (angle ~ 0 deg, stretch 0.7x)
  // Sunset (progress 0.8): Long shadow to the left (angle ~ -60 deg, stretch 2.5x)
  const skewX = interpolate(progress, [0, 0.4, 0.8], [45, 0, -45], {
    extrapolateRight: 'clamp',
  });
  const scaleX = interpolate(progress, [0, 0.4, 0.8], [2.2, 0.8, 2.4], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(progress, [0, 0.1, 0.7, 0.85], [0.3, 0.6, 0.5, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: baseWidth,
        height: baseHeight,
        borderRadius: '50%',
        backgroundColor: color,
        filter: 'blur(6px)',
        transformOrigin: 'center center',
        transform: `skewX(${skewX}deg) scaleX(${scaleX})`,
        opacity,
        ...style,
      }}
    />
  );
};
