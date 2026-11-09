import React from 'react';
import { carPoints, projectCarPoint, type CarPoint } from './car-geometry';
import { Block, Bolt, Pipe, Surface } from './car-svg-parts';

/**
 * The only module a draft asset may import besides React. It shares the library's
 * isometric projection (760x480 canvas, ground axes at ±30°, origin at 380,300), so a
 * draft lines up with the car, road, and other registered assets.
 */
export type IsoPoint = CarPoint;
export const projectPoint = projectCarPoint;
export const points = carPoints;
export { Block, Bolt, Pipe, Surface };

const COS_30 = Math.sqrt(3) / 2;
const OUTLINE = '#2F3B40';

/** Mixes a #RRGGBB color toward white (positive amount) or black (negative), for faces. */
export function shade(color: string, amount: number): string {
  const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(color);
  const hex = short ? `#${short[1].repeat(2)}${short[2].repeat(2)}${short[3].repeat(2)}` : color;
  if (!/^#[\da-f]{6}$/i.test(hex)) return color;
  const target = amount >= 0 ? 255 : 0;
  const share = Math.min(1, Math.abs(amount));
  return `#${[1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(channel + (target - channel) * share).toString(16).padStart(2, '0');
  }).join('')}`;
}

/** Upright cylinder standing on the ground plane at its base centre. */
export const Cylinder: React.FC<{ at: IsoPoint; radius: number; height: number; color: string; top?: string }> = ({ at: [x, y, z], radius, height, color, top }) => {
  const base = projectCarPoint([x, y, z]);
  const cap = projectCarPoint([x, y, z + height]);
  // A ground circle of radius r projects to an ellipse r·√2·cos30 wide and r·√2/2 tall.
  const rx = radius * Math.SQRT2 * COS_30;
  const ry = radius * Math.SQRT2 / 2;
  return (
    <g>
      <path d={`M ${base.x - rx} ${base.y} A ${rx} ${ry} 0 0 0 ${base.x + rx} ${base.y} L ${cap.x + rx} ${cap.y} L ${cap.x - rx} ${cap.y} Z`} fill={color} stroke={OUTLINE} strokeWidth={0.85} strokeLinejoin="round" />
      <ellipse cx={cap.x} cy={cap.y} rx={rx} ry={ry} fill={top ?? shade(color, 0.25)} stroke={OUTLINE} strokeWidth={0.85} />
    </g>
  );
};

/** A disc facing the viewer on the +y side face, for lamps, dials, and wheels seen side on. */
export const SideDisc: React.FC<{ at: IsoPoint; radius: number; color: string; stroke?: string }> = ({ at, radius, color, stroke = OUTLINE }) => {
  const centre = projectCarPoint(at);
  // The +y face is the x–z plane: x runs along (cos30, 0.5) on screen and z straight up.
  return (
    <g transform={`matrix(${COS_30} 0.5 0 1 ${centre.x} ${centre.y})`}>
      <circle r={radius} fill={color} stroke={stroke} strokeWidth={1} />
    </g>
  );
};

export const CANVAS = { width: 760, height: 480 } as const;
