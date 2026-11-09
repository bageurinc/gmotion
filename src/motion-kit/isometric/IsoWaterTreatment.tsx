import React from 'react';
import { carPoints, projectCarPoint } from './car-geometry';
import { unit, waterFlowPoint, WaterBlock } from './water-svg';

export const ISO_WATER_TREATMENT_ANCHORS = {
  inlet: [-335, 80, 48], coagulation: [-240, -28, 100], flocculation: [-240, 18, 70],
  sedimentation: [-80, 0, 55], sludge: [-80, 0, 8], filtration: [80, 0, 45],
  disinfection: [240, 0, 75], outlet: [335, 80, 48],
} as const;
export const WATER_TREATMENT_ROUTE = [[-335, 0, 65], [80, 0, 65], [80, 0, 10], [160, 0, 10], [160, 0, 65], [335, 0, 65]] as const;

type Point3 = readonly [number, number, number];

export const WATER_TREATMENT_CONNECTIONS: readonly (readonly Point3[])[] = [
  [[-335, 80, 48], [-320, 80, 48], [-320, 0, 48], [-300, 0, 48]],
  [[-180, 0, 48], [-168, 0, 48], [-168, 80, 48], [-152, 80, 48], [-152, 0, 48], [-140, 0, 48]],
  [[-20, 0, 48], [-8, 0, 48], [-8, 80, 48], [8, 80, 48], [8, 0, 48], [20, 0, 48]],
  [[140, 0, 16], [152, 0, 16], [152, 80, 16], [168, 80, 16], [168, 80, 48], [168, 0, 48], [180, 0, 48]],
  [[300, 0, 48], [320, 0, 48], [320, 80, 48], [335, 80, 48]],
];

function roundedPipe(path: readonly Point3[]) {
  const points = path.map(projectCarPoint);
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const incoming = Math.hypot(b.x - a.x, b.y - a.y);
    const outgoing = Math.hypot(c.x - b.x, c.y - b.y);
    const radius = Math.min(7, incoming / 3, outgoing / 3);
    const before = { x: b.x + (a.x - b.x) * radius / incoming, y: b.y + (a.y - b.y) * radius / incoming };
    const after = { x: b.x + (c.x - b.x) * radius / outgoing, y: b.y + (c.y - b.y) * radius / outgoing };
    d += ` L ${before.x} ${before.y} Q ${b.x} ${b.y} ${after.x} ${after.y}`;
  }
  return `${d} L ${points.at(-1)!.x} ${points.at(-1)!.y}`;
}

function TransferPipe({ path, phase, flowing, valve = false }: { path: readonly Point3[]; phase: number; flowing: boolean; valve?: boolean }) {
  const d = roundedPipe(path);
  const couplingPoints = [path[1], path[path.length - 2]];
  const valveAt = path[Math.floor(path.length / 2)];
  const wheel = projectCarPoint([valveAt[0], valveAt[1], valveAt[2] + 18]);
  const stem = projectCarPoint(valveAt);
  return <g data-part="transfer-pipe" strokeLinejoin="round" strokeLinecap="round">
    <path d={d} fill="none" stroke="#324C58" strokeWidth={14} />
    <path d={d} fill="none" stroke="#7194A3" strokeWidth={10} />
    <path d={d} fill="none" stroke="#C1D6DD" strokeWidth={3} transform="translate(-1 -1.5)" />
    {couplingPoints.map((point, i) => {
      const p = projectCarPoint(point);
      return <g key={i} data-part="pipe-coupling" transform={`translate(${p.x} ${p.y}) rotate(30)`}>
        <ellipse rx={4} ry={9} fill="#9CB4BE" stroke="#324C58" strokeWidth={1.5} />
        <ellipse rx={1.7} ry={6.5} fill="#577D8E" />
      </g>;
    })}
    {valve ? <g data-part="isolation-valve">
      <path d={`M ${stem.x} ${stem.y} L ${wheel.x} ${wheel.y}`} stroke="#3A535E" strokeWidth={3} />
      <ellipse cx={wheel.x} cy={wheel.y} rx={7} ry={4} fill="none" stroke="#B96B46" strokeWidth={2.5} />
      <path d={`M ${wheel.x - 6} ${wheel.y} h 12`} stroke="#B96B46" strokeWidth={1.5} />
    </g> : null}
    <path data-part="pipe-water" d={d} fill="none" stroke="#42C5DF" strokeWidth={5}
      strokeDasharray={flowing ? '12 22' : undefined} strokeDashoffset={flowing ? -phase * 34 : 0} opacity={flowing ? 0.95 : 0.45} />
    {flowing ? [0, 1 / 3, 2 / 3].map((offset) => {
      const p = projectCarPoint(waterFlowPoint(path, (((Number.isFinite(phase) ? phase : 0) + offset) % 1 + 1) % 1));
      return <circle key={offset} cx={p.x} cy={p.y} r={2.8} fill="#ECF9FB" />;
    }) : null}
  </g>;
}

function DosingTank({ x, y }: { x: number; y: number }) {
  const base = projectCarPoint([x, y, 98]);
  const top = projectCarPoint([x, y, 122]);
  return <g data-part="dosing-tank" stroke="#78623D" strokeWidth={1.2}>
    <path d={`M ${top.x - 11} ${top.y} L ${base.x - 11} ${base.y} A 11 5 0 0 0 ${base.x + 11} ${base.y} L ${top.x + 11} ${top.y}`} fill="#C7AE77" />
    <ellipse cx={top.x} cy={top.y} rx={11} ry={5} fill="#E9D9AF" />
    <path d={`M ${top.x - 6} ${top.y + 5} v 15`} stroke="#F5E8C8" strokeWidth={2} />
    <ellipse cx={top.x} cy={top.y - 2} rx={3} ry={1.5} fill="#8D805F" />
  </g>;
}

export type WaterTreatmentStage = 'coagulation' | 'sedimentation' | 'filtration' | 'disinfection';
const UNIT_STAGES: WaterTreatmentStage[] = ['coagulation', 'sedimentation', 'filtration', 'disinfection'];
const unitAnchor = ([x, y, z]: Point3): Point3 => [x * 2 + 35, y * 2 + 35, z * 2];
export const ISO_WATER_TREATMENT_UNIT_ANCHORS = {
  inlet: unitAnchor([-100, 80, 48]), outlet: unitAnchor([100, 80, 48]),
  coagulation: unitAnchor([-34, -27, 100]), flocculation: unitAnchor([10, 5, 35]),
  sedimentation: unitAnchor([0, 0, 55]), sludge: unitAnchor([0, 0, 12]),
  filtration: unitAnchor([0, 0, 45]), disinfection: unitAnchor([-14, -24, 75]),
} as const;
export const ISO_WATER_FILTER_OUTLET = unitAnchor([100, 80, 16]);

export interface IsoWaterTreatmentProps extends React.SVGProps<SVGSVGElement> {
  variant?: WaterTreatmentStage | 'conventional';
  dosing?: boolean;
  flocculation?: number;
  flowPhase?: number;
  flowing?: boolean;
  settling?: number;
  tankColor?: string;
  waterColor?: string;
}

/** One configurable process basin; conventional preserves previously saved four-basin plans. */
export const IsoWaterTreatment: React.FC<IsoWaterTreatmentProps> = ({ variant = 'coagulation', dosing = true, flocculation = 0, flowPhase = 0, flowing = true, settling = 0, tankColor = '#9AAEB2', waterColor = '#80B6C1', style, ...svgProps }) => {
  const legacy = variant === 'conventional';
  const stageIndex = legacy ? 0 : UNIT_STAGES.indexOf(variant);
  const positions: readonly (readonly [number, number])[] = legacy ? [[-240, 0], [-80, 1], [80, 2], [240, 3]] : [[0, stageIndex]];
  const exitHeight = variant === 'filtration' ? 16 : 48;
  const pipes: readonly (readonly Point3[])[] = legacy ? WATER_TREATMENT_CONNECTIONS : [
    [[-100, 80, 48], [-80, 80, 48], [-80, 0, 48], [-60, 0, 48]],
    [[60, 0, exitHeight], [80, 0, exitHeight], [80, 80, exitHeight], [100, 80, exitHeight]],
  ];
  const settled = unit(settling);
  const phase = flowing && Number.isFinite(flowPhase) ? flowPhase : 0;
  return <svg xmlns="http://www.w3.org/2000/svg" role="img" fill="none" aria-label={legacy ? "Potongan pengolahan air: koagulasi dan flokulasi, pengendapan, filtrasi, disinfeksi" : `Unit bak pengolahan air: ${variant}`} viewBox="0 0 760 480" {...svgProps} style={{ display: 'block', width: '100%', height: 'auto', ...style }}>
    <g transform={legacy ? undefined : 'translate(380 335) scale(2) translate(-380 -300)'} data-part={legacy ? 'legacy-treatment-line' : 'treatment-unit'}>
    <polygon points={carPoints(legacy ? [[-355, -85, -5], [355, -85, -5], [355, 85, -5], [-355, 85, -5]] : [[-115, -80, -5], [115, -80, -5], [115, 105, -5], [-115, 105, -5]])} fill="#DDE4DF" />
    {positions.map(([x, index]) => <g key={x} data-part={['coagulation-flocculation', 'sedimentation', 'filtration', 'disinfection'][index]}>
      <WaterBlock x={x - 60} y={-55} width={120} depth={110} height={8} color={tankColor} />
      <WaterBlock x={x - 60} y={-55} z={8} width={120} depth={8} height={85} color={tankColor} />
      <WaterBlock x={x - 60} y={-47} z={8} width={8} depth={102} height={85} color={tankColor} />
      <WaterBlock x={x - 62} y={-57} z={93} width={124} depth={12} height={4} color="#B8C8CA" />
      <WaterBlock x={x - 62} y={-45} z={93} width={12} depth={100} height={4} color="#B8C8CA" />
      <g data-part="water-volume" fill={waterColor} stroke="#497784" strokeWidth={1} opacity={0.38}>
        <polygon points={carPoints([[x - 52, 47, 10], [x + 52, 47, 10], [x + 52, 47, 60], [x - 52, 47, 60]])} />
        <polygon points={carPoints([[x + 52, -47, 10], [x + 52, 47, 10], [x + 52, 47, 60], [x + 52, -47, 60]])} />
      </g>
      {index === 0 ? <g>
        <g data-part="forming-flocs">
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const progress = unit(flocculation);
            const x0 = -36 + (i % 3) * 30, y0 = -24 + Math.floor(i / 3) * 40;
            const p = projectCarPoint([x + x0 * (1 - progress * 0.6), y0 * (1 - progress * 0.45) + Math.sin(phase * Math.PI * 2 + i) * 3, 42]);
            return <circle key={i} cx={p.x} cy={p.y} r={2 + progress * 3} fill="#9C7950" />;
          })}
        </g>
        <WaterBlock x={x - 52} y={-40} z={93} width={104} depth={12} height={5} color={tankColor} />
        <DosingTank x={x - 34} y={-27} />
        <polyline points={carPoints([[x - 34, -27, 100], [x - 34, -27, 65]])} stroke="#6F5C38" strokeWidth={4} />
        {dosing && flowing ? <polyline data-part="dosing-flow" points={carPoints([[x - (index === 0 ? 34 : 14), index === 0 ? -27 : -24, 95], [x - (index === 0 ? 34 : 14), index === 0 ? -27 : -24, 62]])} fill="none" stroke="#F1D789" strokeWidth={2} strokeDasharray="3 5" strokeDashoffset={-phase * 24} /> : null}
        <WaterBlock x={x + 3} y={-35} z={98} width={18} depth={24} height={12} color="#526C72" />
        <polyline points={carPoints([[x + 10, -20, 98], [x + 10, 5, 85], [x + 10, 5, 25]])} stroke="#334D50" strokeWidth={4} />
        {[-1, 1].map((side) => {
          const angle = phase * Math.PI * 2;
          const dx = Math.cos(angle) * 30 * side, dy = Math.sin(angle) * 30 * side;
          return <polyline key={side} points={carPoints([[x + 10, 5, 35], [x + 10 + dx, 5 + dy, 35]])} stroke="#334D50" strokeWidth={8} />;
        })}
      </g> : null}
      {index === 1 ? <g>
        <WaterBlock x={x - 48} y={-43} z={8} width={96} depth={86} height={4 + settled * 8} color="#9A7851" />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const p = projectCarPoint([x - 35 + (i % 3) * 32, -25 + Math.floor(i / 3) * 40, 55 - settled * (32 + i * 2)]);
          return <circle key={i} cx={p.x} cy={p.y} r={4} fill="#795B39" />;
        })}
      </g> : null}
      {index === 2 ? <g>
        <WaterBlock x={x - 48} y={-43} z={10} width={96} depth={86} height={13} color="#79776D" />
        <WaterBlock x={x - 48} y={-43} z={23} width={96} depth={86} height={13} color="#C6AD77" />
        <WaterBlock x={x - 48} y={-43} z={36} width={96} depth={86} height={12} color="#4E5558" />
        {flowing ? <g data-part="filter-percolation" fill="none" stroke="#54BED2" strokeWidth={2} strokeLinecap="round" opacity={0.8}>
          {[-24, 0, 24].map((offset) => <polyline key={offset} points={carPoints([[x + offset, 0, 62], [x + offset, 0, 12]])}
            strokeDasharray="3 8" strokeDashoffset={-phase * 22} />)}
        </g> : null}
      </g> : null}
      {index === 3 ? <g>
        <WaterBlock x={x - 52} y={-40} z={93} width={104} depth={12} height={5} color={tankColor} />
        <DosingTank x={x - 14} y={-24} />
        <polyline points={carPoints([[x - 14, -24, 98], [x - 14, -24, 65]])} stroke="#6F5C38" strokeWidth={4} />
        {dosing && flowing ? <polyline data-part="dosing-flow" points={carPoints([[x - 14, -24, 95], [x - 14, -24, 62]])} fill="none" stroke="#F1D789" strokeWidth={2} strokeDasharray="3 5" strokeDashoffset={-phase * 24} /> : null}
      </g> : null}
      <polygon data-part="water-surface" points={carPoints([[x - 52, -47, 60], [x + 52, -47, 60], [x + 52, 47, 60], [x - 52, 47, 60]])} fill={waterColor} opacity={0.2} stroke="#497784" strokeWidth={1.5} />
      {flowing ? <g data-part="surface-ripples" fill="none" stroke="#D7F6F9" strokeWidth={1.8}>
        {[-1, 0, 1].map((offset) => {
          const progress = ((phase + (offset + 1) / 3) % 1 + 1) % 1;
          const center = projectCarPoint([x + offset * 27, offset * 18, 61]);
          const radius = 5 + progress * 13;
          return <ellipse key={offset} cx={center.x} cy={center.y} rx={radius} ry={radius * 0.577} opacity={(1 - progress) * 0.85} />;
        })}
      </g> : null}
      <g data-part="cutaway-wall">
        <WaterBlock x={x - 60} y={47} z={8} width={120} depth={8} height={14} color={tankColor} />
        <WaterBlock x={x + 52} y={-55} z={8} width={8} depth={102} height={14} color={tankColor} />
        <WaterBlock x={x + 52} y={-12} z={8} width={8} depth={24} height={index === 2 ? 20 : 54} color={tankColor} />
        <polyline points={carPoints([[x - 60, 55, 93], [x + 60, 55, 93], [x + 60, -55, 93]])} fill="none" stroke={tankColor} strokeWidth={2} strokeDasharray="5 5" opacity={0.7} />
      </g>

    </g>)}
    <g data-part="pipe-wall-sockets" stroke="#324C58" strokeWidth={1.4}>
      {positions.flatMap(([x, index]) => [[x - 60, 0, 48], [x + 60, 0, index === 2 ? 16 : 48]] as Point3[]).map((point, i) => {
        const p = projectCarPoint(point);
        return <g key={i} transform={`translate(${p.x} ${p.y}) rotate(30)`}>
          <ellipse rx={5} ry={10} fill="#ADC0C7" />
          <ellipse rx={3} ry={6} fill="#355565" />
          <circle cy={-8} r={1} fill="#EAF1F1" stroke="none" />
          <circle cy={8} r={1} fill="#EAF1F1" stroke="none" />
        </g>;
      })}
    </g>
    <g data-part="inter-basin-pipes">
      {pipes.map((path, i) => <TransferPipe key={i} path={path} phase={phase} flowing={flowing} valve={legacy ? i > 0 && i < 4 : true} />)}
    </g>
    </g>
  </svg>;
};
