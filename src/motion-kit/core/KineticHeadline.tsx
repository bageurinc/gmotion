'use client';

import React from 'react';
import { contrastRatio } from '../../lib/pipeline/anti-slop';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { SafeOverlay } from './SafeOverlay';

export interface KineticHeadlineProps {
  text: string;
  highlightWords?: string[];
  highlightColor?: string;
  textColor?: string;
  fontSize?: number;
  badgeText?: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  style?: React.CSSProperties;
}

export const KineticHeadline: React.FC<KineticHeadlineProps> = ({
  text,
  highlightWords = [],
  highlightColor = '#38BDF8',
  textColor = '#FFFFFF',
  fontSize = 54,
  badgeText,
  badgeBgColor = 'rgba(56, 189, 248, 0.15)',
  badgeTextColor = '#38BDF8',
  align = 'center',
  className = '',
  style,
}) => {
  const hasDarkText = /^#[0-9a-fA-F]{6}$/.test(textColor) && contrastRatio(textColor, '#000000') < 7;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = text.split(' ');

  // Badge spring entrance
  const badgeSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  return (
    <SafeOverlay slot="headline">
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        textAlign: align,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        padding: '0 32px',
        ...style,
      }}
    >
      {badgeText && (
        <div
          style={{
            transform: `scale(${badgeSpring})`,
            opacity: badgeSpring,
            backgroundColor: badgeBgColor,
            color: badgeTextColor,
            border: `1px solid ${badgeTextColor}40`,
            padding: '6px 16px',
            borderRadius: 9999,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflowWrap: 'anywhere',
            boxShadow: `0 0 20px ${badgeTextColor}25`,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: badgeTextColor,
              boxShadow: `0 0 8px ${badgeTextColor}`,
            }}
          />
          {badgeText}
        </div>
      )}

      <h1
        style={{
          fontSize,
          fontWeight: 900,
          lineHeight: 1.15,
          color: textColor,
          margin: 0,
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          gap: '0.28em',
          letterSpacing: '-0.02em',
        }}
      >
        {words.map((word, i) => {
          // Staggered entrance for each word
          const delay = i * 3;
          const wordSpring = spring({
            frame: frame - delay,
            fps,
            config: { damping: 12, stiffness: 150 },
          });

          const translateY = interpolate(wordSpring, [0, 1], [40, 0]);
          const opacity = interpolate(wordSpring, [0, 0.4, 1], [0, 0.8, 1]);
          const scale = interpolate(wordSpring, [0, 1], [0.8, 1]);

          const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '').toLowerCase();
          const isHighlighted = highlightWords.some(
            (hw) => hw.toLowerCase() === cleanWord || word.toLowerCase().includes(hw.toLowerCase())
          );

          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                maxWidth: '100%',
                minWidth: 0,
                overflowWrap: 'anywhere',
                transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
                opacity,
                color: isHighlighted ? highlightColor : textColor,
                textShadow: hasDarkText ? 'none' : isHighlighted ? `0 0 28px ${highlightColor}60` : '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              {word}
            </span>
          );
        })}
      </h1>
    </div>
    </SafeOverlay>
  );
};
