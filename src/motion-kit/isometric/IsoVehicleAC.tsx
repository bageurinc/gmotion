import React from 'react';
import { Block, Pipe, Surface } from './car-svg-parts';
import { carPoints, projectCarPoint, type CarPoint } from './car-geometry';

const COS_30 = Math.sqrt(3) / 2;
const METAL = '#9CAEB7';
const DARK = '#263640';
const HOT = '#D85531';
const LIQUID = '#D49132';
const COLD = '#197EB4';

export const ISO_VEHICLE_AC_ANCHORS = {
  compressor: [-110, 78, 40],
  condenser: [106, 64, 40],
  condenserFan: [106, 68, 40],
  expansionValve: [106, -90, 10],
  evaporator: [-100, -88, 46],
  blower: [-40, -94, 35],
  hotLine: [0, 87, 10],
  returnLine: [-155, -16, 10],
} as const;

const COMPRESSOR_SCALE = 1.85;
const COMPRESSOR_ANCHORS = {
  pulley: [0, 79, 58],
  suction: [-22, -36, 119],
  discharge: [22, -36, 119],
  housing: [0, -7, 102],
} as const;

const INTERNAL_ANCHORS = {
  shaft: [0, 2, 58],
  swashPlate: [0, 7, 81],
  pistons: [16, -28, 78],
} as const;

function scaleAnchors<Key extends string>(anchors: Readonly<Record<Key, CarPoint>>) {
  return Object.fromEntries(Object.entries<CarPoint>(anchors).map(([name, point]) => [
    name, [point[0] * COMPRESSOR_SCALE, point[1] * COMPRESSOR_SCALE, point[2] * COMPRESSOR_SCALE] as CarPoint,
  ])) as Record<Key, CarPoint>;
}

export const ISO_AC_COMPRESSOR_ANCHORS = scaleAnchors(COMPRESSOR_ANCHORS);
export const ISO_AC_COMPRESSOR_CUTAWAY_ANCHORS = scaleAnchors({ ...COMPRESSOR_ANCHORS, ...INTERNAL_ANCHORS });

function Face({ at, children }: { at: CarPoint; children: React.ReactNode }) {
  const { x, y } = projectCarPoint(at);
  return <g transform={`matrix(${COS_30} 0.5 0 1 ${x} ${y})`}>{children}</g>;
}

function Fan({ at, radius, rotation }: { at: CarPoint; radius: number; rotation: number }) {
  return (
    <Face at={at}>
      <circle r={radius} fill={DARK} stroke="#667D88" strokeWidth={3} />
      <g transform={`rotate(${rotation}) scale(${radius / 30})`} fill="#ABBEC4">
        {[0, 72, 144, 216, 288].map((angle) => (
          <path key={angle} transform={`rotate(${angle})`} d="M 1 -5 Q -10 -12 -8 -25 Q 4 -30 14 -20 Q 13 -11 5 -3 Z" />
        ))}
      </g>
      <circle r={radius * 0.18} fill="#E6ECEB" />
    </Face>
  );
}

function HeatExchanger({ at: [x, y, z], color }: { at: CarPoint; color: string }) {
  return (
    <g>
      <Block at={[x, y, z]} size={[108, 16, 70]} color="#415661" top="#C5D0D3" side="#718895" />
      {Array.from({ length: 16 }, (_, index) => {
        const fin = x + 9 + index * 6;
        return <polyline key={fin} points={carPoints([[fin, y + 16, z + 6], [fin, y + 16, z + 64]])} stroke="#859AA2" strokeWidth={1.4} />;
      })}
      {[12, 26, 40, 54].map((height) => (
        <polyline key={height} points={carPoints([[x + 6, y + 17, z + height], [x + 102, y + 17, z + height]])} stroke={color} strokeWidth={2.2} />
      ))}
    </g>
  );
}

const CIRCUIT: { route: CarPoint[]; color: string }[] = [
  { color: HOT, route: [[-87, 77, 36], [-87, 87, 10], [147, 87, 10], [147, 55, 21]] },
  { color: LIQUID, route: [[157, 49, 56], [163, 48, 10], [163, -90, 10], [106, -90, 10]] },
  { color: COLD, route: [[106, -90, 10], [72, -90, 10], [72, -116, 10], [-118, -116, 10], [-118, -103, 22]] },
  { color: COLD, route: [[-148, -104, 57], [-155, -104, 10], [-155, 70, 10], [-132, 76, 34]] },
];

export interface IsoVehicleACProps extends React.SVGProps<SVGSVGElement> {
  running?: boolean;
  phase?: number;
  title?: string;
}

export function IsoVehicleAC({ running = false, phase = 0, title, ...svg }: IsoVehicleACProps) {
  return (
    <svg width="100%" height="100%" {...svg} viewBox="0 0 760 480" role="img">
      <title>{title ?? 'Sirkuit AC kendaraan'}</title>
      <Surface vertices={[[-179, -128, 0], [185, -128, 0], [185, 110, 0], [-179, 110, 0]]} color="#E1E8E8" />
      {CIRCUIT.map(({ route, color }, index) => (
        <g key={index}>
          <Pipe route={route} width={6} color={color} />
          {running && <polyline points={carPoints(route)} fill="none" stroke="#FFF9E8" strokeWidth={3} strokeDasharray="4 16" strokeDashoffset={-phase / 4} />}
        </g>
      ))}
      <g data-part="evaporator">
        <HeatExchanger at={[-154, -104, 4]} color="#61C4DF" />
      </g>
      <g data-part="blower">
        <Fan at={ISO_VEHICLE_AC_ANCHORS.blower} radius={24} rotation={running ? phase : 0} />
      </g>
      <g data-part="expansion-valve">
        <Block at={[96, -99, 5]} size={[20, 18, 15]} color="#A37842" top="#F1CE8B" side="#80603C" />
      </g>
      <g data-part="compressor">
        <Block at={[-134, 52, 4]} size={[48, 26, 37]} color={METAL} top="#DCE3E5" side="#617987" />
        <Face at={[-110, 80, 24]}><circle r={17} fill={DARK} /><circle r={10} fill="#8CA0AA" /><circle r={4} fill="#DBE4E5" /></Face>
      </g>
      <g data-part="condenser">
        <HeatExchanger at={[52, 48, 4]} color="#F09B65" />
        <Fan at={ISO_VEHICLE_AC_ANCHORS.condenserFan} radius={29} rotation={running ? phase : 0} />
      </g>
    </svg>
  );
}

function housingArc(y: number, radius: number): CarPoint[] {
  return Array.from({ length: 21 }, (_, index) => {
    const angle = Math.PI * (index / 20 - 0.25);
    return [Math.cos(angle) * radius, y, 58 + Math.sin(angle) * radius];
  });
}

function Housing({ y, depth, radius, color }: { y: number; depth: number; radius: number; color: string }) {
  return (
    <g>
      <Face at={[0, y, 58]}><circle r={radius} fill={color} stroke={DARK} /></Face>
      <Surface vertices={[...housingArc(y, radius), ...housingArc(y + depth, radius).reverse()]} color={color} />
      <Face at={[0, y + depth, 58]}><circle r={radius} fill={color} stroke={DARK} /></Face>
    </g>
  );
}

export interface IsoACCompressorProps extends React.SVGProps<SVGSVGElement> {
  variant?: 'exterior' | 'cutaway';
  rotation?: number;
  title?: string;
}

export function IsoACCompressor({ variant = 'exterior', rotation = 0, title, ...svg }: IsoACCompressorProps) {
  const cutaway = variant === 'cutaway';
  const pistonTravel = 10 * Math.cos(rotation * Math.PI / 180);
  return (
    <svg width="100%" height="100%" {...svg} viewBox="0 0 760 480" role="img">
      <title>{title ?? 'Kompresor AC kendaraan'}</title>
      <g transform={`translate(380 300) scale(${COMPRESSOR_SCALE}) translate(-380 -300)`}>
        <Block at={[-57, -56, 0]} size={[114, 119, 10]} color="#75858C" top="#AEBCC0" />
        <Housing y={-57} depth={26} radius={46} color="#8DA3AE" />
        {cutaway ? (
          <g data-part="cutaway">
            <Block at={[-40, -31, 14]} size={[80, 84, 20]} color="#768D98" top="#AABCC2" />
            <Pipe route={[[0, -36, 58], [0, 58, 58]]} width={12} color="#91ABBA" />
            <Surface vertices={[[-26, -9, 35], [26, 20, 35], [26, 20, 81], [-26, -9, 81]]} color="#C18D43" />
            {[-1, 1].map((direction) => {
              const x = direction * 17;
              const y = -36 + direction * pistonTravel;
              return <g key={direction} data-part="piston">
                <Pipe route={[[x, y + 17, 78], [x, direction * 9, 75]]} width={6} color="#D4DEE1" />
                <Block at={[x - 7, y, 72]} size={[14, 19, 13]} color="#A6B9C2" top="#D5E2E4" side="#67818D" />
              </g>;
            })}
          </g>
        ) : (
          <g data-part="housing">
            <Housing y={-31} depth={84} radius={46} color={METAL} />
            {[-20, -4, 12, 28, 44].map((y) => (
              <polyline key={y} points={carPoints(housingArc(y, 46))} fill="none" stroke="#DDE6E8" strokeWidth={2.5} />
            ))}
          </g>
        )}
        <Housing y={53} depth={15} radius={cutaway ? 28 : 42} color="#718995" />
        <g data-part="pulley">
          <Housing y={68} depth={11} radius={32} color={DARK} />
          <Face at={COMPRESSOR_ANCHORS.pulley}>
            <circle r={26} fill="#465C67" stroke="#A9BAC2" strokeWidth={1.5} />
            <g transform={`rotate(${rotation})`}>
              {[0, 90, 180, 270].map((angle) => <circle key={angle} transform={`rotate(${angle})`} cx={15} r={4} fill={DARK} />)}
              <path d="M 16 0 H 23" stroke="#E1AF57" strokeWidth={3} />
            </g>
            <circle r={7} fill="#C7D4DA" stroke={DARK} />
          </Face>
        </g>
        <Block at={[-29, -49, 96]} size={[58, 18, 12]} color="#8199A4" top="#BFCFD3" />
        <Pipe route={[[-22, -36, 106], COMPRESSOR_ANCHORS.suction]} width={12} color={COLD} />
        <Pipe route={[[22, -36, 106], COMPRESSOR_ANCHORS.discharge]} width={9} color={HOT} />
      </g>
    </svg>
  );
}
