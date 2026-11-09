import React from 'react';
import { carPoints } from './car-geometry';

export const ISO_WATER_CHANNEL_ANCHORS = {
  inlet: [-300, 0, 8], center: [0, 0, 8], outlet: [300, 0, 8], bank: [0, 110, 8],
} as const;
export const WATER_CHANNEL_ROUTE = [[-300, 0, 8], [-150, 20, 8], [0, -10, 8], [150, 10, 8], [300, 0, 8]] as const;
export const CANAL_ROUTE = [[-300, 0, 8], [300, 0, 8]] as const;

export interface IsoWaterChannelProps extends React.SVGProps<SVGSVGElement> {
  variant?: 'river' | 'canal';
  flowPhase?: number;
  flowing?: boolean;
  /** Continue the water beyond the camera when placed in a continuous world. */
  continuous?: boolean;
  waterColor?: string;
  bankColor?: string;
}

export const IsoWaterChannel: React.FC<IsoWaterChannelProps> = ({ variant = 'river', flowPhase = 0, flowing = true, continuous = false, waterColor = '#6BABB4', bankColor = '#8DA574', style, ...svgProps }) => {
  const segment = variant === 'canal' ? CANAL_ROUTE : WATER_CHANNEL_ROUTE;
  const route: ReadonlyArray<readonly [number, number, number]> = continuous
    ? [[-10000, 0, 8], ...segment, [500, 0, 8], [700, 700, 8], [700, 10000, 8]]
    : segment;
  const phase = flowing && Number.isFinite(flowPhase) ? flowPhase : 0;
  const bank = (side: number) => route.map(([x, y]) => [x, y + side * 115, 0] as const);
  const edge = (side: number) => route.map(([x, y]) => [x, y + side * 65, 8] as const);
  return <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label={variant === 'river' ? 'Sungai ilustratif mengalir dari hulu ke hilir' : 'Saluran terbuka ilustratif'} viewBox="0 0 760 480" {...svgProps} style={{ display: 'block', width: '100%', height: 'auto', ...style }}>
    <g data-part="banks"><polygon points={carPoints([...bank(-1), ...bank(1).reverse()])} fill={bankColor} /></g>
    <polygon data-part="water" points={carPoints([...edge(-1), ...edge(1).reverse()])} fill={waterColor} />
    {[-1, 1].map((side) => <polyline key={side} points={carPoints(edge(side))} fill="none" stroke={variant === 'canal' ? '#66797A' : '#536F48'} strokeWidth={variant === 'canal' ? 12 : 4} />)}
    <g data-part="river-depth" fill="none" strokeLinecap="round">
      <polyline points={carPoints(route)} stroke="#153C49" strokeWidth={23} opacity={0.12} />
      <polyline points={carPoints(route.map(([x, y, z]) => [x, y - 38, z] as const))} stroke="#E4F9F7" strokeWidth={9} opacity={0.13} />
    </g>
    <g data-part="river-currents" fill="none" strokeLinecap="round">
      {[-2, -1, 0, 1, 2].map((lane) => {
        const laneRoute = route.map(([x, y, z]) => [x, y + lane * 21, z + 1] as const);
        // Fixed screen-space spacing keeps currents visible even on the extended world river.
        const offset = -phase * 80 + lane * 17;
        return <g key={lane} data-part="current-lane">
          <polyline points={carPoints(laneRoute)} stroke="#D9F5F4" strokeWidth={lane % 2 === 0 ? 2.5 : 1.8}
            strokeDasharray={`${18 + lane * 2} ${62 - lane * 2}`} strokeDashoffset={offset} opacity={flowing ? 0.7 : 0.25} />
          <polyline points={carPoints(laneRoute)} stroke="#F5FFFF" strokeWidth={1}
            strokeDasharray="3 77" strokeDashoffset={offset + 28} opacity={flowing ? 0.55 : 0.15} />
        </g>;
      })}
      {[-1, 1].map((side) => <polyline key={side} data-part="bank-ripples"
        points={carPoints(route.map(([x, y, z]) => [x, y + side * 58, z + 1] as const))}
        stroke="#D9F5F4" strokeWidth={1.6} strokeDasharray="9 31" strokeDashoffset={-phase * 80 + side * 13} opacity={0.45} />)}
    </g>
  </svg>;
};
