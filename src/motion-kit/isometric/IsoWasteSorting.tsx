import React from 'react';
import { carPoints, projectCarPoint, type CarPoint } from './car-geometry';

export const ISO_WASTE_SORTING_ANCHORS = {
  organic: [-240, 0, 115], paper: [0, 0, 115], plastic: [240, 0, 115],
  input: [0, 0, 250],
} as const;

export interface IsoWasteSortingProps extends React.SVGProps<SVGSVGElement> {
  item?: 'leaf' | 'paper' | 'bottle';
  /** 0: above the input; 0.7: above the matching bin; 1: deposited. */
  progress?: number;
  organicColor?: string;
  paperColor?: string;
  plasticColor?: string;
}

const destinations = { leaf: -240, paper: 0, bottle: 240 } as const;

export function wasteItemPosition(item: NonNullable<IsoWasteSortingProps['item']>, progress: number) {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return { point: [destinations[item] * Math.min(1, p / 0.7), 0, p < 0.7 ? 250 : 250 - (p - 0.7) / 0.3 * 180] as CarPoint, opacity: p < 0.85 ? 1 : (1 - p) / 0.15 };
}

/** Three illustrative collection bins; labels and local collection rules belong to the scene content. */
export const IsoWasteSorting: React.FC<IsoWasteSortingProps> = ({
  item = 'leaf', progress = 0, organicColor = '#527A46', paperColor = '#A37438', plasticColor = '#367E98', style, ...svgProps
}) => {
  const position = wasteItemPosition(item, progress);
  const point = projectCarPoint(position.point);
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 480" role="img" aria-label="Pemilahan daun, kertas, dan botol ke wadah terpisah" {...svgProps} style={{ display: 'block', width: '100%', height: 'auto', ...style }}>
    <polygon points={carPoints([[-350, -85, 0], [350, -85, 0], [350, 100, 0], [-350, 100, 0]])} fill="#E1E6DE" />
    {(['organic', 'paper', 'plastic'] as const).map((kind, index) => {
      const x = (index - 1) * 240;
      const color = [organicColor, paperColor, plasticColor][index];
      const a: CarPoint = [x - 70, -55, 0], b: CarPoint = [x + 70, -55, 0], c: CarPoint = [x + 70, 55, 0], d: CarPoint = [x - 70, 55, 0];
      const top = ([px, py]: CarPoint): CarPoint => [px, py, 145];
      const label = projectCarPoint([x, 56, 75]);
      return <g key={kind} data-part={`bin-${kind}`}>
        <polygon points={carPoints([b, c, top(c), top(b)])} fill={color} />
        <polygon points={carPoints([b, c, top(c), top(b)])} fill="#000" opacity={0.22} />
        <polygon points={carPoints([d, c, top(c), top(d)])} fill={color} />
        <polygon points={carPoints([top(a), top(b), top(c), top(d)])} fill={color} stroke="#24363A" strokeWidth={2} />
        <polygon points={carPoints([[x - 50, -35, 145], [x + 50, -35, 145], [x + 50, 35, 145], [x - 50, 35, 145]])} fill="#24363A" />
        <g transform={`translate(${label.x} ${label.y})`} fill="#FFF" stroke="#FFF" strokeWidth={2}>
          {kind === 'organic' ? <path d="M-14 10 Q-18-15 14-18 Q20 12-14 10 M-12 9 L10-13" fill="none" /> : kind === 'paper' ? <path d="M-13-18 H8 L15-10 V18 H-13 Z M-7-5 H8 M-7 2 H8 M-7 9 H5" fill="none" /> : <path d="M-5-19 H5 V-11 L11-4 V18 H-11 V-4 L-5-11 Z" fill="none" />}
        </g>
      </g>;
    })}
    <g data-part="waste-item" opacity={position.opacity} transform={`translate(${point.x} ${point.y})`}>
      {item === 'leaf' ? <><path d="M-22 14 Q-32-25 23-25 Q32 16-22 14" fill="#75A252" stroke="#294D32" strokeWidth={2} /><path d="M-22 15 L18-20" stroke="#294D32" strokeWidth={2} /></> : item === 'paper' ? <><path d="M-23-26 H13 L24-15 V26 H-23 Z" fill="#FFF5DA" stroke="#765C39" strokeWidth={2} /><path d="M-15-10 H12 M-15 0 H14 M-15 10 H8" stroke="#765C39" strokeWidth={2} /></> : <><path d="M-7-30 H7 V-18 L16-7 V26 Q0 32-16 26 V-7 L-7-18 Z" fill="#A7D8E5" stroke="#24556A" strokeWidth={2} /><path d="M-8-30 H8" stroke="#24556A" strokeWidth={5} /><path d="M-15 0 H15 V15 H-15 Z" fill="#FFF" /></>}
    </g>
  </svg>;
};
