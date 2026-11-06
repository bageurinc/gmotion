'use client';

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { WordTiming } from '@/types/studio';

export interface SyncedCaptionsProps {
  text: string;
  wordTimings?: WordTiming[];
  activeColor?: string;
  inactiveColor?: string;
  fontSize?: number;
  bottomOffset?: number; // Distance from bottom (Safe Zone: e.g. 260px for 9:16)
  style?: React.CSSProperties;
}

export const SyncedCaptions: React.FC<SyncedCaptionsProps> = ({
  text,
  wordTimings = [],
  activeColor = '#FBBF24', // Warm gold / yellow highlight
  inactiveColor = '#FFFFFF',
  fontSize = 32,
  bottomOffset = 260,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const currentTimeMs = (frame / fps) * 1000;
  const words = text.split(' ').filter(Boolean);

  // If wordTimings are provided from Edge TTS / Whisper, find active word
  let activeIndex = -1;

  if (wordTimings.length > 0) {
    activeIndex = wordTimings.findIndex(
      (wt) => currentTimeMs >= wt.startMs && currentTimeMs <= wt.endMs + 100
    );
    // If between words, keep the closest recent word
    if (activeIndex === -1 && currentTimeMs > 0) {
      for (let i = wordTimings.length - 1; i >= 0; i--) {
        if (currentTimeMs >= wordTimings[i].startMs) {
          activeIndex = i;
          break;
        }
      }
    }
  } else {
    // Fallback: distribute evenly over durationInFrames
    const progress = Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames)));
    activeIndex = Math.min(words.length - 1, Math.floor(progress * words.length));
  }

  // Group words into chunks of ~5-7 words so subtitles don't overwhelm screen
  const chunkSize = 6;
  const currentChunkIndex = Math.floor(Math.max(0, activeIndex) / chunkSize);
  const startWordIdx = currentChunkIndex * chunkSize;
  const chunkWords = words.slice(startWordIdx, startWordIdx + chunkSize);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 32px',
        zIndex: 50,
        pointerEvents: 'none',
        ...style,
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          padding: '12px 24px',
          borderRadius: 20,
          border: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0.35em',
          maxWidth: '85%',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}
      >
        {chunkWords.map((word, idx) => {
          const globalWordIdx = startWordIdx + idx;
          const isActive = globalWordIdx === activeIndex;

          return (
            <span
              key={globalWordIdx}
              style={{
                fontSize,
                fontWeight: 800,
                color: isActive ? activeColor : inactiveColor,
                transform: isActive ? 'scale(1.12)' : 'scale(1.0)',
                transition: 'transform 0.1s ease',
                textShadow: isActive
                  ? `0 0 16px ${activeColor}80, 0 2px 4px rgba(0,0,0,0.8)`
                  : '0 2px 4px rgba(0,0,0,0.8)',
                display: 'inline-block',
                letterSpacing: '-0.01em',
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
