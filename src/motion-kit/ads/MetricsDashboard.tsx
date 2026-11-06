'use client';

import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion';

export interface MetricCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  changePercent?: number;
  color?: string;
  icon?: 'trend-up' | 'users' | 'cart' | 'clock';
  style?: React.CSSProperties;
}

export const AnimatedCounter: React.FC<{
  from?: number;
  to: number;
  durationInFrames?: number;
  formatter?: (val: number) => string;
  style?: React.CSSProperties;
}> = ({ from = 0, to, durationInFrames = 45, formatter, style }) => {
  const frame = useCurrentFrame();

  const progress = Math.min(1, frame / durationInFrames);
  const eased = Easing.out(Easing.cubic)(progress);
  const currentVal = Math.round(interpolate(eased, [0, 1], [from, to]));

  const displayString = formatter
    ? formatter(currentVal)
    : currentVal.toLocaleString('id-ID');

  return <span style={style}>{displayString}</span>;
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  prefix = '',
  suffix = '',
  changePercent = 0,
  color = '#10B981',
  icon = 'trend-up',
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  const translateY = interpolate(entrance, [0, 1], [40, 0]);

  return (
    <div
      style={{
        backgroundColor: '#1E293B',
        border: `1.5px solid ${color}40`,
        borderRadius: 24,
        padding: '24px 28px',
        boxShadow: `0 20px 40px rgba(0,0,0,0.5), 0 0 30px ${color}15`,
        transform: `translate3d(0, ${translateY}px, 0)`,
        opacity: entrance,
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: color, fontSize: 18 }}>
            {icon === 'trend-up' && '📈'}
            {icon === 'users' && '👥'}
            {icon === 'cart' && '🛒'}
            {icon === 'clock' && '⏱️'}
          </span>
          <span style={{ color: '#94A3B8', fontSize: 16, fontWeight: 600 }}>{label}</span>
        </div>
        {changePercent !== 0 && (
          <div
            style={{
              backgroundColor: changePercent > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: changePercent > 0 ? '#10B981' : '#EF4444',
              borderRadius: 9999,
              padding: '4px 12px',
              fontSize: 14,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {changePercent > 0 ? '▲ +' : '▼ '}
            {Math.abs(changePercent)}%
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        {prefix && <span style={{ color: color, fontSize: 26, fontWeight: 800 }}>{prefix}</span>}
        <span style={{ color: '#FFFFFF', fontSize: 44, fontWeight: 900, letterSpacing: '-0.03em' }}>
          <AnimatedCounter to={value} />
        </span>
        {suffix && <span style={{ color: '#94A3B8', fontSize: 20, fontWeight: 600 }}>{suffix}</span>}
      </div>
    </div>
  );
};

export interface TrendLineChartProps {
  data: number[];
  labels?: string[];
  lineColor?: string;
  fillColor?: string;
  glowColor?: string;
  peakLabel?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  labels = [],
  lineColor = '#38BDF8',
  fillColor = 'rgba(56, 189, 248, 0.15)',
  glowColor = '#38BDF8',
  peakLabel,
  width = 600,
  height = 280,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = Math.max(1, maxVal - minVal);

  const paddingX = 40;
  const paddingY = 40;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  // Build points
  const points = data.map((val, idx) => {
    const x = paddingX + (idx / Math.max(1, data.length - 1)) * chartW;
    const y = height - paddingY - ((val - minVal) / range) * chartH;
    return { x, y, val };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  // Draw-on line animation
  const drawProgress = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const totalLength = 1200;
  const strokeDashoffset = interpolate(drawProgress, [0, 1], [totalLength, 0]);

  const peakPoint = points[points.length - 1];

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        backgroundColor: '#0F172A',
        borderRadius: 24,
        padding: '16px',
        border: '1.5px solid #1E293B',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        ...style,
      }}
    >
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Subtle Horizontal Grid lines */}
        {[0.25, 0.5, 0.75].map((pct, i) => (
          <line
            key={i}
            x1={paddingX}
            y1={paddingY + chartH * pct}
            x2={width - paddingX}
            y2={paddingY + chartH * pct}
            stroke="#1E293B"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
        ))}

        {/* Filled gradient area */}
        <path d={areaD} fill="url(#chartGradient)" opacity={drawProgress} />

        {/* Animated Glow Line */}
        <path
          d={pathD}
          fill="none"
          stroke={glowColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={totalLength}
          strokeDashoffset={strokeDashoffset}
          filter="url(#glow)"
        />

        {/* Bottom Labels if provided */}
        {labels.map((lbl, idx) => (
          <text
            key={idx}
            x={paddingX + (idx / Math.max(1, labels.length - 1)) * chartW}
            y={height - 12}
            textAnchor="middle"
            fill="#64748B"
            fontSize="12"
          >
            {lbl}
          </text>
        ))}

        {/* Peak indicator dot */}
        {drawProgress > 0.8 && (
          <circle
            cx={peakPoint.x}
            cy={peakPoint.y}
            r="8"
            fill="#FFFFFF"
            stroke={lineColor}
            strokeWidth="4"
          />
        )}
      </svg>

      {/* Floating Peak Badge */}
      {peakLabel && drawProgress > 0.85 && (
        <div
          style={{
            position: 'absolute',
            left: peakPoint.x - 70,
            top: peakPoint.y - 45,
            backgroundColor: lineColor,
            color: '#000000',
            fontWeight: 800,
            fontSize: 13,
            padding: '4px 12px',
            borderRadius: 8,
            boxShadow: `0 4px 15px ${lineColor}80`,
            pointerEvents: 'none',
          }}
        >
          {peakLabel}
        </div>
      )}
    </div>
  );
};
