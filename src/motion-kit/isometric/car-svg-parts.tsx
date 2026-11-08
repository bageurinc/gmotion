import React from 'react';
import { carPoints, projectCarPoint, type CarPoint } from './car-geometry';

const COS_30 = Math.sqrt(3) / 2;
const OUTLINE = '#2F3B40';

export const Surface: React.FC<{ vertices: readonly CarPoint[]; color: string }> = ({ vertices, color }) => (
  <polygon points={carPoints(vertices)} fill={color} stroke={OUTLINE} strokeWidth={0.85} strokeLinejoin="round" />
);

export const Block: React.FC<{ at: CarPoint; size: CarPoint; color?: string; top?: string; side?: string }> = ({ at: [x, y, z], size: [w, d, h], color = '#76858A', top = '#A7B3B5', side = '#54656C' }) => (
  <g>
    <Surface vertices={[[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]} color={side} />
    <Surface vertices={[[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]} color={color} />
    <Surface vertices={[[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]} color={top} />
  </g>
);

export const Pipe: React.FC<{ route: readonly CarPoint[]; width: number; color: string; dashed?: boolean }> = ({ route, width, color, dashed }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <polyline points={carPoints(route)} stroke={OUTLINE} strokeWidth={width + 1.8} />
    <polyline points={carPoints(route)} stroke={color} strokeWidth={width} strokeDasharray={dashed ? '2 3' : undefined} />
    {!dashed && <polyline points={carPoints(route)} stroke="#EFF5F1" strokeOpacity={0.25} strokeWidth={Math.max(0.6, width * 0.22)} />}
  </g>
);

export const Bolt: React.FC<{ at: CarPoint; color?: string }> = ({ at, color = '#DBE3DD' }) => {
  const p = projectCarPoint(at);
  return <circle cx={p.x} cy={p.y} r={1.4} fill={color} stroke={OUTLINE} strokeWidth={0.55} />;
};

export const Spring: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const coil: CarPoint[] = Array.from({ length: 81 }, (_, i) => {
    const t = i / 80;
    return [x + Math.cos(t * Math.PI * 12) * 6, y + Math.sin(t * Math.PI * 12) * 6, 42 + t * 35];
  });
  return <g data-part="suspension">
    <Pipe route={[[x, y, 30], [x, y, 86]]} width={4} color="#91A3A8" />
    <Pipe route={coil} width={2} color="#D69A4A" />
    <Block at={[x - 8, y - 8, 78]} size={[16, 16, 3]} color="#5C6D72" />
  </g>;
};

export const Brake: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g data-part="brake" transform={`matrix(${COS_30} 0.5 0 -1 ${380 - y * COS_30} ${300 + y / 2})`}>
    <circle cx={x} cy={44} r={24} fill="#9CA9AA" stroke={OUTLINE} strokeWidth={1.5} />
    <circle cx={x} cy={44} r={18} fill="none" stroke="#D1DAD7" strokeWidth={1.3} />
    {Array.from({ length: 8 }, (_, i) => {
      const a = i * Math.PI / 4;
      return <circle key={i} cx={x + Math.cos(a) * 19} cy={44 + Math.sin(a) * 19} r={1.3} fill="#58696D" />;
    })}
    <circle cx={x} cy={44} r={7} fill="#4B5E65" />
    <path d={`M ${x + 15} 59 L ${x + 25} 56 L ${x + 25} 36 L ${x + 15} 32 Z`} fill="#AF674C" stroke={OUTLINE} />
  </g>
);

