'use client';

import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export interface PhoneMockupProps {
  children?: React.ReactNode;
  width?: number; // e.g. 380 - 460
  height?: number; // e.g. 760 - 860
  notchType?: 'dynamic-island' | 'punch-hole';
  glowColor?: string;
  floatingBadge?: {
    text: string;
    subtext?: string;
    icon?: 'whatsapp' | 'bot' | 'bell' | 'dollar';
    position?: 'top-right' | 'top-left' | 'bottom-right';
  };
  style?: React.CSSProperties;
}

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  children,
  width = 400,
  height = 800,
  notchType = 'dynamic-island',
  glowColor = '#38BDF8',
  floatingBadge,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  const badgeSpring = spring({
    frame: frame - 15,
    fps,
    config: { damping: 12, stiffness: 140 },
  });

  const translateY = interpolate(entrance, [0, 1], [60, 0]);
  const scale = interpolate(entrance, [0, 1], [0.92, 1]);

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
        margin: '0 auto',
        ...style,
      }}
    >
      {/* Outer Glow Halo */}
      <div
        style={{
          position: 'absolute',
          inset: -24,
          borderRadius: 64,
          background: `radial-gradient(circle at 50% 30%, ${glowColor}35 0%, transparent 70%)`,
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}
      />

      {/* Titanium / Glass Bezel Frame */}
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#0F172A',
          borderRadius: 52,
          padding: 12,
          boxShadow: `
            0 25px 60px -15px rgba(0, 0, 0, 0.8),
            0 0 0 3px #334155,
            0 0 0 6px #1E293B,
            inset 0 0 12px rgba(255, 255, 255, 0.15)
          `,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Dynamic Island / Punch Hole */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            backgroundColor: '#000000',
            borderRadius: notchType === 'dynamic-island' ? 24 : 12,
            width: notchType === 'dynamic-island' ? 120 : 18,
            height: notchType === 'dynamic-island' ? 32 : 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: notchType === 'dynamic-island' ? '0 12px' : 0,
            boxShadow: '0 0 6px rgba(0,0,0,0.8)',
          }}
        >
          {notchType === 'dynamic-island' && (
            <>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: '#052E16',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    backgroundColor: '#22C55E',
                    boxShadow: '0 0 6px #22C55E',
                  }}
                />
              </div>
              <div
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  backgroundColor: '#1E293B',
                  border: '2px solid #0F172A',
                }}
              />
            </>
          )}
        </div>

        {/* Screen Content Area */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#090D16',
            borderRadius: 42,
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Status Bar */}
          <div
            style={{
              height: 48,
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
              fontWeight: 600,
              color: '#94A3B8',
              zIndex: 30,
            }}
          >
            <span>09:41</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
                <rect x="0" y="7" width="2.5" height="4" rx="0.5" fill="#94A3B8" />
                <rect x="4" y="5" width="2.5" height="6" rx="0.5" fill="#94A3B8" />
                <rect x="8" y="2.5" width="2.5" height="8.5" rx="0.5" fill="#94A3B8" />
                <rect x="12" y="0" width="2.5" height="11" rx="0.5" fill="#94A3B8" />
              </svg>
              <div
                style={{
                  width: 22,
                  height: 11,
                  border: '1.5px solid #94A3B8',
                  borderRadius: 3,
                  padding: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div style={{ width: '80%', height: '100%', backgroundColor: '#22C55E', borderRadius: 1 }} />
              </div>
            </div>
          </div>

          {/* Child app screen */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>{children}</div>
        </div>
      </div>

      {/* Floating Notification Badge */}
      {floatingBadge && (
        <div
          style={{
            position: 'absolute',
            top: floatingBadge.position === 'bottom-right' ? 'auto' : -20,
            bottom: floatingBadge.position === 'bottom-right' ? 40 : 'auto',
            right: floatingBadge.position === 'top-left' ? 'auto' : -30,
            left: floatingBadge.position === 'top-left' ? -30 : 'auto',
            transform: `scale(${badgeSpring})`,
            opacity: badgeSpring,
            backgroundColor: '#1E293B',
            border: `1.5px solid ${glowColor}60`,
            borderRadius: 18,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: `0 16px 36px rgba(0,0,0,0.6), 0 0 24px ${glowColor}30`,
            zIndex: 60,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: `${glowColor}25`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: glowColor,
            }}
          >
            {floatingBadge.icon === 'bot' ? (
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a2 2 0 0 1 2 2v1h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4V4a2 2 0 0 1 2-2zm-3 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
              </svg>
            ) : floatingBadge.icon === 'dollar' ? (
              <span style={{ fontWeight: 800, fontSize: 20 }}>Rp</span>
            ) : (
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
              </svg>
            )}
          </div>
          <div>
            <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 15 }}>
              {floatingBadge.text}
            </div>
            {floatingBadge.subtext && (
              <div style={{ color: '#94A3B8', fontSize: 12 }}>{floatingBadge.subtext}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
