'use client';

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, random } from 'remotion';

export interface ParallaxWorldProps {
  children?: React.ReactNode;
  skyColors?: [string, string];
  hillsColors?: [string, string, string];
  showSun?: boolean;
  sunPosition?: { x: number; y: number };
  cloudCount?: number;
  style?: React.CSSProperties;
}

export const SvgParticles: React.FC<{
  count?: number;
  color?: string;
  seed?: string;
  sizeRange?: [number, number];
  speedRange?: [number, number];
}> = ({
  count = 25,
  color = '#FEF08A',
  seed = 'particles',
  sizeRange = [2, 6],
  speedRange = [0.3, 1.2],
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const particles = Array.from({ length: count }).map((_, i) => {
    const pSeed = `${seed}-${i}`;
    const initialX = random(`${pSeed}-x`) * width;
    const initialY = random(`${pSeed}-y`) * height;
    const size = interpolate(random(`${pSeed}-size`), [0, 1], sizeRange);
    const speed = interpolate(random(`${pSeed}-speed`), [0, 1], speedRange);
    const opacityBase = 0.3 + random(`${pSeed}-op`) * 0.7;

    // Continuous floating upward with gentle horizontal sway
    const y = (initialY - frame * speed * 2) % height;
    const normalizedY = y < 0 ? y + height : y;
    const sway = Math.sin((frame / 30) + i) * 15;
    const x = (initialX + sway) % width;

    return (
      <circle
        key={i}
        cx={x}
        cy={normalizedY}
        r={size}
        fill={color}
        opacity={opacityBase}
        filter="blur(0.5px)"
      />
    );
  });

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {particles}
    </svg>
  );
};

export const ParallaxWorld: React.FC<ParallaxWorldProps> = ({
  children,
  skyColors = ['#0F172A', '#1E293B'],
  hillsColors = ['#1E3A8A', '#1E40AF', '#1D4ED8'],
  showSun = true,
  sunPosition = { x: 540, y: 350 },
  cloudCount = 4,
  style,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Parallax layer movements
  const cloudsOffset = (frame * 0.8) % (width + 300);
  const distantHillsOffset = Math.sin(frame / 60) * 15;
  const nearHillsOffset = Math.sin(frame / 45) * 30;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: `linear-gradient(to bottom, ${skyColors[0]}, ${skyColors[1]})`,
        overflow: 'hidden',
        ...style,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FDE047" stopOpacity="0.9" />
            <stop offset="35%" stopColor="#F59E0B" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sun / Aura */}
        {showSun && (
          <>
            <circle cx={sunPosition.x} cy={sunPosition.y} r="180" fill="url(#sunGlow)" />
            <circle cx={sunPosition.x} cy={sunPosition.y} r="45" fill="#FEF08A" />
          </>
        )}

        {/* Floating Clouds */}
        {Array.from({ length: cloudCount }).map((_, i) => {
          const cloudY = 160 + i * 80;
          const cloudX = ((cloudsOffset + i * 320) % (width + 400)) - 200;
          return (
            <g key={i} transform={`translate(${cloudX}, ${cloudY})`} opacity="0.35">
              <ellipse cx="60" cy="30" rx="60" ry="22" fill="#FFFFFF" />
              <ellipse cx="40" cy="20" rx="35" ry="25" fill="#FFFFFF" />
              <ellipse cx="85" cy="22" rx="40" ry="28" fill="#FFFFFF" />
            </g>
          );
        })}

        {/* Distant Hills (Back Layer) */}
        <path
          d={`M 0 ${height * 0.72} 
              Q ${width * 0.25 + distantHillsOffset} ${height * 0.58}, ${width * 0.5} ${height * 0.7} 
              T ${width} ${height * 0.65} 
              L ${width} ${height} 
              L 0 ${height} Z`}
          fill={hillsColors[0]}
          opacity="0.6"
        />

        {/* Mid Hills */}
        <path
          d={`M 0 ${height * 0.8} 
              Q ${width * 0.35 - distantHillsOffset} ${height * 0.68}, ${width * 0.7} ${height * 0.78} 
              T ${width} ${height * 0.75} 
              L ${width} ${height} 
              L 0 ${height} Z`}
          fill={hillsColors[1]}
          opacity="0.85"
        />

        {/* Foreground Layer */}
        <path
          d={`M 0 ${height * 0.88} 
              Q ${width * 0.45 + nearHillsOffset} ${height * 0.82}, ${width} ${height * 0.9} 
              L ${width} ${height} 
              L 0 ${height} Z`}
          fill={hillsColors[2]}
        />
      </svg>

      {/* Foreground Content (Characters, Text, Products) */}
      <div style={{ position: 'relative', width: '100%', height: '100%', zIndex: 10 }}>
        {children}
      </div>
    </div>
  );
};
