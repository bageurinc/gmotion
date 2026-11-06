'use client';

import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export interface PulseCTAButtonProps {
  buttonText: string;
  subtext?: string;
  bgColor?: string;
  textColor?: string;
  glowColor?: string;
  urlPlaceholder?: string;
  style?: React.CSSProperties;
}

export const PulseCTAButton: React.FC<PulseCTAButtonProps> = ({
  buttonText,
  subtext = 'Klik Link di Bio / DM Kami Sekarang',
  bgColor = '#22C55E', // High-converting emerald green
  textColor = '#052E16',
  glowColor = '#22C55E',
  urlPlaceholder = 'wa.link/bisnis-kamu',
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const entrance = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 130 },
  });

  // Continuous breathing pulse
  const pulseScale = 1 + Math.sin((frame / fps) * 6) * 0.05;
  const glowOpacity = 0.5 + Math.sin((frame / fps) * 6) * 0.3;

  const translateY = interpolate(entrance, [0, 1], [50, 0]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        padding: '0 24px',
        transform: `translate3d(0, ${translateY}px, 0)`,
        opacity: entrance,
        ...style,
      }}
    >
      {/* Clickable pill container with pulsating glow */}
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Glow Ring */}
        <div
          style={{
            position: 'absolute',
            inset: -12,
            borderRadius: 9999,
            backgroundColor: glowColor,
            filter: 'blur(20px)',
            opacity: glowOpacity,
            transform: `scale(${pulseScale * 1.05})`,
            pointerEvents: 'none',
          }}
        />

        {/* The Action Button */}
        <div
          style={{
            position: 'relative',
            backgroundColor: bgColor,
            color: textColor,
            padding: '20px 42px',
            borderRadius: 9999,
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: '-0.01em',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: `0 14px 35px ${glowColor}60, inset 0 2px 4px rgba(255,255,255,0.4)`,
            transform: `scale(${pulseScale})`,
            cursor: 'pointer',
          }}
        >
          <span>{buttonText}</span>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>

      {/* URL or Subtext Pill */}
      {subtext && (
        <div
          style={{
            color: '#CBD5E1',
            fontSize: 16,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            padding: '8px 20px',
            borderRadius: 9999,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <span style={{ color: glowColor }}>🔗</span>
          {urlPlaceholder ? `${subtext} (${urlPlaceholder})` : subtext}
        </div>
      )}
    </div>
  );
};
