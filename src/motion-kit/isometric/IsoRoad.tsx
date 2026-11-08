import React, { useId } from 'react';
import { carPoints, projectCarPoint, type CarPoint } from './car-geometry';

export interface IsoRoadProps extends React.SVGProps<SVGSVGElement> {
  lanes?: 1 | 2 | 3 | 4;
  length?: number;
  laneWidth?: number;
  /** Travel distance in car-world units. Increasing values move lane marks backwards. */
  distance?: number;
  asphalt?: string;
  shoulderColor?: string;
}

const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;

/** The road's own viewBox, so callers can map car-world points to screen coordinates. */
export function roadGeometry({ lanes = 2, length = 1100, laneWidth = 240 }: Pick<IsoRoadProps, 'lanes' | 'length' | 'laneWidth'> = {}) {
  const count = Math.max(1, Math.min(4, Math.round(finite(lanes, 2))));
  const span = Math.max(600, Math.min(2400, finite(length, 1100)));
  const lane = Math.max(220, Math.min(360, finite(laneWidth, 240)));
  const width = lane * count;
  const corners = [[-span / 2, -width / 2 - 24], [span / 2, -width / 2 - 24], [span / 2, width / 2 + 24], [-span / 2, width / 2 + 24]]
    .map(([x, y]) => projectCarPoint([x, y, 0]));
  const minX = Math.min(...corners.map((p) => p.x)) - 30;
  const maxX = Math.max(...corners.map((p) => p.x)) + 30;
  const minY = Math.min(...corners.map((p) => p.y)) - 220;
  const maxY = Math.max(...corners.map((p) => p.y)) + 40;
  /** World y of each lane centre, far lane first. */
  const laneCenters = Array.from({ length: count }, (_, index) => -width / 2 + (index + 0.5) * lane);
  return { count, span, width, minX, minY, viewWidth: maxX - minX, viewHeight: maxY - minY, laneCenters };
}

/** Shares the car's projection and coordinate origin. Children use the same world canvas. */
export const IsoRoad: React.FC<IsoRoadProps> = ({
  lanes = 2, length = 1100, laneWidth = 240, distance = 0,
  asphalt = '#58676B', shoulderColor = '#BEC7BB', children, style, ...svgProps
}) => {
  const id = `road-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { count, span, width, minX, minY, viewWidth, viewHeight } = roadGeometry({ lanes, length, laneWidth });
  const offset = ((finite(distance, 0) % 120) + 120) % 120;
  const rect = (x: number, y: number, w: number, h: number): CarPoint[] => [[x, y, 0], [x + w, y, 0], [x + w, y + h, 0], [x, y + h, 0]];

  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${minX} ${minY} ${viewWidth} ${viewHeight}`} role="img" aria-label="Jalan raya isometrik" {...svgProps} style={{ display: 'block', width: '100%', height: 'auto', ...style }}>
    <defs><clipPath id={id}><polygon points={carPoints(rect(-span / 2, -width / 2, span, width))} /></clipPath></defs>
    <g data-part="road">
      <polygon points={carPoints(rect(-span / 2, -width / 2 - 24, span, width + 48))} fill={shoulderColor} />
      <polygon points={carPoints(rect(-span / 2, -width / 2, span, width))} fill={asphalt} />
      {[-1, 1].map((side) => <polygon key={side} points={carPoints(rect(-span / 2, side * (width / 2 - 14) - 2, span, 4))} fill="#E8EDE6" />)}
      <g data-part="lane-markings" clipPath={`url(#${id})`}>
        {Array.from({ length: count - 1 }, (_, lane) => {
          const y = -width / 2 + (lane + 1) * width / count;
          return Array.from({ length: Math.ceil(span / 120) + 3 }, (_, index) => <polygon key={`${lane}-${index}`} points={carPoints(rect(-span / 2 - 120 + index * 120 - offset, y - 2, 54, 4))} fill="#EEF2E9" />);
        })}
      </g>
    </g>
    {children}
  </svg>;
};
