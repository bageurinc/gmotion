'use client';

import React from 'react';
import { useTextStyle } from './TextStyleContext';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { DataVisual, TextStyleId } from '@/types/studio';
import { SafeOverlay } from './SafeOverlay';
import { TEXT_STYLES } from './text-style';

const asNumber = (value: string) => Number(value.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));

/** Counts up to the spoken value, then shows it exactly as the narration wrote it. */
function countedValue(value: string, progress: number): string {
  const target = asNumber(value);
  if (!Number.isFinite(target) || progress >= 1) return value;
  const decimals = value.match(/,(\d+)$/)?.[1].length ?? 0;
  return (target * progress).toFixed(decimals).replace('.', ',');
}

/** Optional stat, comparison, or step strip, shown once the narration reaches it. */
export const DataCard: React.FC<{
  visual: DataVisual;
  from: number;
  background: string;
  textColor: string;
  accent: string;
  textStyle?: TextStyleId;
}> = ({ visual, from, background, textColor, accent, textStyle: ownStyle }) => {
  const textStyle = useTextStyle(ownStyle) ?? 'teknis';
  const frame = useCurrentFrame() - from;
  const { fps, width } = useVideoConfig();
  const look = TEXT_STYLES[textStyle];
  const entrance = spring({ frame, fps, config: { damping: 16, stiffness: 130 } });
  const fill = interpolate(frame, [4, 4 + fps * 0.9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - (1 - fill) ** 3;
  const unit = visual.kind === 'steps' ? '' : visual.unit ?? '';
  const small = width * 0.03;

  return (
    <SafeOverlay slot="cta">
      <div
        style={{
          opacity: entrance,
          transform: `translate3d(0, ${interpolate(entrance, [0, 1], [30, 0])}px, 0)`,
          background,
          color: textColor,
          borderRadius: 24,
          borderLeft: `8px solid ${accent}`,
          padding: '18px 26px',
          boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
          fontFamily: look.bodyFont(),
          fontWeight: 700,
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        {visual.kind === 'stat' && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
            <span style={{ fontFamily: look.headlineFont(), fontSize: width * 0.1, lineHeight: 1, color: accent, fontVariantNumeric: 'tabular-nums' }}>
              {countedValue(visual.value, eased)}
            </span>
            <span style={{ fontSize: small * 1.15, lineHeight: 1.2 }}>
              {unit && <span style={{ color: accent }}>{unit} </span>}
              {visual.label}
            </span>
          </div>
        )}
        {visual.kind === 'compare' && (() => {
          const peak = Math.max(...visual.items.map((item) => asNumber(item.value)));
          return (
            <div style={{ display: 'grid', rowGap: 10 }}>
              {visual.items.map((item) => (
                <div key={item.label} style={{ fontSize: small }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                    <span>{item.label}</span>
                    <span style={{ color: accent, fontVariantNumeric: 'tabular-nums' }}>{countedValue(item.value, eased)} {unit}</span>
                  </div>
                  <div style={{ height: 12, marginTop: 4, borderRadius: 6, background: `${textColor}22` }}>
                    <div style={{ height: '100%', borderRadius: 6, background: accent, width: `${(asNumber(item.value) / peak) * eased * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        {visual.kind === 'steps' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: small * 0.92, lineHeight: 1.15 }}>
            {visual.items.map((item, index) => {
              const lit = eased * visual.items.length > index;
              return (
                <React.Fragment key={item}>
                  {index > 0 && <span style={{ color: accent }}>→</span>}
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '10px 8px', borderRadius: 14, background: lit ? accent : 'transparent', color: lit ? background : textColor, border: `2px solid ${accent}` }}>
                    {item}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </SafeOverlay>
  );
};
