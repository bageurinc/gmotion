import React from 'react';
import { carPoints, projectCarPoint, type CarPoint } from './car-geometry';

export const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Arc-length interpolation keeps a particle on its registered pipe, including vertical segments. */
export function waterFlowPoint(path: readonly CarPoint[], progress: number): CarPoint {
  if (path.length === 0) throw new Error('Water flow needs a path');
  const lengths = path.slice(1).map((b, i) => Math.hypot(...b.map((v, axis) => v - path[i][axis])));
  let distance = unit(progress) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] && lengths[i] > 0) {
      const t = distance / lengths[i];
      return path[i].map((v, axis) => v + (path[i + 1][axis] - v) * t) as unknown as CarPoint;
    }
    distance -= lengths[i];
  }
  return path[path.length - 1];
}

export function WaterRoute({ path, phase, color = '#23728B', active = true }: { path: readonly CarPoint[]; phase: number; color?: string; active?: boolean }) {
  return <g data-part="flow-route">
    <polyline points={carPoints(path)} fill="none" stroke="#F3F5F2" strokeWidth={12} strokeLinejoin="round" />
    <polyline points={carPoints(path)} fill="none" stroke={color} strokeWidth={7} strokeLinejoin="round" />
    {active ? [0, 0.25, 0.5, 0.75].map((offset) => {
      const p = projectCarPoint(waterFlowPoint(path, ((Number.isFinite(phase) ? phase : 0) % 1 + 1 + offset) % 1));
      return <circle key={offset} cx={p.x} cy={p.y} r={3} fill="#FFF" />;
    }) : null}
  </g>;
}

export function WaterBlock({ x, y, z = 0, width, depth, height, color }: { x: number; y: number; z?: number; width: number; depth: number; height: number; color: string }) {
  const a: CarPoint = [x, y, z], b: CarPoint = [x + width, y, z], c: CarPoint = [x + width, y + depth, z], d: CarPoint = [x, y + depth, z];
  const top = ([px, py, pz]: CarPoint): CarPoint => [px, py, pz + height];
  return <g stroke="#334D50" strokeWidth={1.5} strokeLinejoin="round">
    <polygon points={carPoints([b, c, top(c), top(b)])} fill={color} />
    <polygon points={carPoints([b, c, top(c), top(b)])} fill="#000" opacity={0.15} />
    <polygon points={carPoints([d, c, top(c), top(d)])} fill={color} />
    <polygon points={carPoints([top(a), top(b), top(c), top(d)])} fill={color} />
  </g>;
}
