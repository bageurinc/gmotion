import React from 'react';
import { Block, Cylinder, Pipe, Surface } from './draft-kit';
import { carPoints, projectCarPoint, type CarPoint } from './car-geometry';

const COS_30 = Math.sqrt(3) / 2;
const COOL = '#2486A9';
const WARM = '#C87140';
const COPPER = '#BE804E';
const INDOOR = { evaporator: [-73, -63, 92], louver: [-69, -57, 67] } as const;
const OUTDOOR = { fan: [93, 72, 56], condenser: [161, 42, 60], servicePorts: [164, 8, 28] } as const;

const INDOOR_PARTS = {
  filter: [-92, -68, 124],
  evaporator: [-95, -76, 104],
  blower: [-91, -55, 81],
  blowerMotor: [-38, -57, 81],
  controlBoard: [5, -59, 95],
  drainPan: [-89, -53, 64],
} as const;

const OUTDOOR_PARTS = {
  condenser: [79, 17, 82],
  fan: [71, 61, 53],
  compressor: [132, 46, 47],
  expansionValve: [146, 74, 16],
  inverterBoard: [132, 17, 81],
} as const;

export const ISO_HOME_AC_CUTAWAY_ANCHORS = {
  ...INDOOR_PARTS, ...OUTDOOR_PARTS,
  servicePorts: OUTDOOR.servicePorts, refrigerantLines: [38, -74, 25],
} as const;

export const ISO_HOME_AC_ANCHORS = {
  ...INDOOR,
  ...OUTDOOR,
  refrigerantLines: [38, -74, 25],
} as const;

const LINES: { route: readonly CarPoint[]; color: string }[] = [
  { route: [[23, -74, 76], [38, -74, 76], [38, -74, 25], [164, -74, 25], OUTDOOR.servicePorts], color: COOL },
  { route: [[23, -82, 86], [47, -82, 86], [47, -82, 35], [174, -82, 35], [174, 8, 35], [164, 8, 35]], color: COPPER },
];

function AirStream({ start, end, color, phase }: { start: CarPoint; end: CarPoint; color: string; phase: number }) {
  const a = projectCarPoint(start);
  const b = projectCarPoint(end);
  const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  return (
    <g stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeDasharray="11 9" strokeDashoffset={-phase / 18} />
      <path d="M -9 -5 L 0 0 L -9 5" transform={`translate(${b.x} ${b.y}) rotate(${angle})`} />
    </g>
  );
}

function OutdoorFan({ phase, cutaway }: { phase: number; cutaway: boolean }) {
  const p = projectCarPoint(cutaway ? OUTDOOR_PARTS.fan : OUTDOOR.fan);
  return (
    <g data-part="outdoor-fan" transform={`matrix(${COS_30} 0.5 0 1 ${p.x} ${p.y}) scale(${cutaway ? 0.78 : 1})`}>
      <circle r={38} fill="#263D48" stroke="#80949E" strokeWidth={3} />
      <g transform={`rotate(${phase})`} fill="#9BACB4">
        {[0, 90, 180, 270].map(angle => (
          <path key={angle} transform={`rotate(${angle})`} d="M 0 -6 Q -20 -16 -12 -32 Q 11 -39 20 -23 Q 15 -10 4 -4 Z" />
        ))}
      </g>
      {!cutaway && [15, 24, 33].map(r => <circle key={r} r={r} fill="none" stroke="#D0DCE0" strokeOpacity={0.78} />)}
      <circle r={7} fill="#D3DFE2" />
    </g>
  );
}

function Coil({ at: [x, y, z], width, height, color }: { at: CarPoint; width: number; height: number; color: string }) {
  const tube = Array.from({ length: 5 }, (_, index): CarPoint[] => {
    const left = x + 3;
    const right = x + width - 3;
    const level = z + 4 + index * (height - 8) / 4;
    return index % 2 === 0 ? [[left, y + 5, level], [right, y + 5, level]] : [[right, y + 5, level], [left, y + 5, level]];
  }).flat();
  return (
    <g>
      <Block at={[x, y, z]} size={[width, 4, height]} color="#536B76" top="#BDCFD4" side="#768F99" />
      {Array.from({ length: Math.floor(width / 5) }, (_, index) => {
        const fin = x + 3 + index * 5;
        return <polyline key={fin} points={carPoints([[fin, y + 4, z + 1], [fin, y + 4, z + height - 1]])} stroke="#A3B8BF" strokeWidth={1.1} />;
      })}
      <Pipe route={tube} width={2.1} color={color} />
    </g>
  );
}

function ControlBoard({ at: [x, y, z], width }: { at: CarPoint; width: number }) {
  return (
    <g>
      <Block at={[x, y, z]} size={[width, 23, 3]} color="#2C7567" top="#4F9A81" side="#2D655C" />
      <Block at={[x + 3, y + 8, z + 3]} size={[9, 10, 3]} color="#263D48" top="#3B525A" />
      {[5, 12, 19].map(offset => <Cylinder key={offset} at={[x + width - 6, y + offset, z + 3]} radius={2.8} height={6} color="#334D59" top="#B5C9CE" />)}
    </g>
  );
}

function IndoorInternals({ phase }: { phase: number }) {
  return (
    <g data-part="indoor-internals">
      <Block at={[-158, -103, 61]} size={[182, 5, 56]} color="#D4E3E6" top="#F0F6F7" side="#9DB4BD" />
      <g data-part="filter">
        <Surface vertices={[[-151, -94, 125], [-37, -94, 125], [-37, -66, 125], [-151, -66, 125]]} color="#658996" />
        {Array.from({ length: 18 }, (_, index) => {
          const x = -148 + index * 6.2;
          return <polyline key={x} points={carPoints([[x, -92, 126], [x, -68, 126]])} stroke="#D1E1E3" strokeWidth={0.8} />;
        })}
        {[-86, -79, -72].map(y => <polyline key={y} points={carPoints([[-150, y, 126], [-38, y, 126]])} stroke="#C4D8DC" strokeWidth={0.8} />)}
      </g>
      <g data-part="evaporator"><Coil at={[-151, -80, 90]} width={117} height={28} color="#71C7DD" /></g>
      <g data-part="drain-pan">
        <Block at={[-152, -68, 59]} size={[139, 21, 7]} color="#566E79" top="#9FB5BD" side="#688591" />
        <Pipe route={[[-13, -51, 62], [5, -51, 62], [5, -51, 32]]} width={3.5} color="#8BAAB6" />
      </g>
      <g data-part="crossflow-blower">
        <Pipe route={[[-145, -57, 81], [-41, -57, 81]]} width={14} color="#405B68" />
        {Array.from({ length: 17 }, (_, index) => {
          const x = -143 + index * 6;
          const offset = 4 * Math.cos(phase * Math.PI / 180);
          return <polyline key={x} points={carPoints([[x, -58 + offset, 87], [x + 2, -51, 80 + offset]])} stroke="#A8C5CC" strokeWidth={1.5} />;
        })}
        <Block at={[-43, -65, 74]} size={[14, 13, 14]} color="#657F8A" top="#AEC2CA" />
      </g>
      <g data-part="indoor-control-board"><ControlBoard at={[-15, -81, 94]} width={33} /></g>
    </g>
  );
}

function OutdoorInternals({ phase }: { phase: number }) {
  return (
    <g data-part="outdoor-internals">
      <g data-part="condenser-coil"><Coil at={[37, 11, 16]} width={122} height={79} color={COPPER} /></g>
      <g data-part="inverter-board"><ControlBoard at={[114, 13, 77]} width={41} /></g>
      <Pipe route={[[133, 45, 67], [135, 31, 74], [153, 18, 74]]} width={5} color={WARM} />
      <Pipe route={[OUTDOOR.servicePorts, [160, 43, 28], [146, 49, 29]]} width={5} color={COOL} />
      <g data-part="outdoor-compressor">
        <Cylinder at={[132, 46, 12]} radius={18} height={54} color="#344D5A" top="#718F9C" />
        <Cylinder at={[132, 46, 66]} radius={13} height={4} color="#527282" top="#A2BAC3" />
      </g>
      <g data-part="electronic-expansion-valve">
        <Pipe route={[[159, 16, 22], [157, 73, 17], [146, 74, 16], [163, 78, 13], [173, 8, 35], [164, 8, 35]]} width={4} color={COPPER} />
        <Cylinder at={[146, 74, 14]} radius={7} height={11} color="#936635" top="#D1A06A" />
        <Block at={[142, 70, 25]} size={[8, 8, 8]} color="#425C69" top="#8AA6B2" />
      </g>
      <OutdoorFan phase={phase} cutaway />
    </g>
  );
}

function IndoorUnit({ opacity, running, phase }: { opacity: number; running: boolean; phase: number }) {
  if (opacity === 0) return <IndoorInternals phase={phase} />;
  return (
    <g data-part="indoor-unit">
      {opacity < 1 && <IndoorInternals phase={phase} />}
      <g data-part="indoor-casing" opacity={opacity}>
        <Block at={[-158, -103, 61]} size={[182, 40, 56]} color="#E8F0F2" top="#FAFCFC" side="#A5BBC4" />
        <Block at={[-150, -63, 66]} size={[164, 3, 13]} color="#293D46" top="#536C78" side="#3B505C" />
        {[69, 73, 77].map(z => (
          <polyline key={z} points={carPoints([[-147, -59, z], [11, -59, z]])} stroke="#A8BEC5" strokeWidth={1.2} />
        ))}
        <polyline points={carPoints([[-151, -62, 90], [16, -62, 90]])} stroke="#B5C9D0" strokeWidth={1.5} />
        <Block at={[-3, -63, 94]} size={[15, 2, 4]} color={running ? '#168372' : '#829BA4'} top="#A3B9BF" side="#829BA4" />
      </g>
    </g>
  );
}

function OutdoorUnit({ opacity, phase }: { opacity: number; phase: number }) {
  return (
    <g data-part="outdoor-unit">
      <Block at={[31, 11, 0]} size={[23, 63, 9]} color="#839AA4" />
      <Block at={[138, 11, 0]} size={[24, 63, 9]} color="#839AA4" />
      {opacity < 1 && (
        <>
          <Block at={[34, 8, 9]} size={[128, 63, 4]} color="#849EA9" top="#C0D2D7" />
          <OutdoorInternals phase={phase} />
        </>
      )}
      {opacity > 0 && (
        <g data-part="outdoor-casing" opacity={opacity}>
          <Block at={[34, 8, 9]} size={[128, 63, 95]} color="#DDE8EA" top="#F4F8F8" side="#A5BCC6" />
          <Surface vertices={[[162, 18, 23], [162, 62, 23], [162, 62, 92], [162, 18, 92]]} color="#4D6773" />
          {[21, 27, 33, 39, 45, 51, 57].map(y => (
            <polyline key={y} points={carPoints([[163, y, 26], [163, y, 89]])} stroke="#A4BAC1" strokeWidth={1.4} />
          ))}
          <OutdoorFan phase={phase} cutaway={false} />
        </g>
      )}
    </g>
  );
}

const UNIT_SCALE = 2.15;
const INDOOR_CENTER: CarPoint = [-65, -85, 80];
const OUTDOOR_CENTER: CarPoint = [114, 56, 58];

function unitAnchors<Key extends string>(anchors: Record<Key, CarPoint>, center: CarPoint) {
  return Object.fromEntries(Object.entries<CarPoint>(anchors).map(([key, point]) => [
    key, [
      (point[0] - center[0]) * UNIT_SCALE,
      (point[1] - center[1]) * UNIT_SCALE,
      (point[2] - center[2]) * UNIT_SCALE + 60,
    ] as CarPoint,
  ])) as Record<Key, CarPoint>;
}

export const ISO_HOME_INDOOR_ANCHORS = unitAnchors({ louver: INDOOR.louver }, INDOOR_CENTER);
export const ISO_HOME_INDOOR_CUTAWAY_ANCHORS = unitAnchors(INDOOR_PARTS, INDOOR_CENTER);
export const ISO_HOME_OUTDOOR_ANCHORS = unitAnchors(OUTDOOR, OUTDOOR_CENTER);
export const ISO_HOME_OUTDOOR_CUTAWAY_ANCHORS = unitAnchors(
  { ...OUTDOOR_PARTS, servicePorts: OUTDOOR.servicePorts }, OUTDOOR_CENTER,
);

function UnitCloseup({ center, children }: { center: CarPoint; children: React.ReactNode }) {
  const point = projectCarPoint(center);
  return <g transform={`translate(380 240) scale(${UNIT_SCALE}) translate(${-point.x} ${-point.y})`}>{children}</g>;
}

export interface IsoHomeACUnitProps extends React.SVGProps<SVGSVGElement> {
  variant?: 'exterior' | 'cutaway';
  casingOpacity?: number;
  running?: boolean;
  phase?: number;
  title?: string;
}

export function IsoHomeACIndoor({ variant = 'exterior', casingOpacity = 1, running = true, phase = 0, title, ...svg }: IsoHomeACUnitProps) {
  return (
    <svg width="100%" height="100%" {...svg} viewBox="0 0 760 480" role="img">
      <title>{title ?? 'Unit indoor AC rumah'}</title>
      <UnitCloseup center={INDOOR_CENTER}>
        <IndoorUnit opacity={variant === 'cutaway' ? 0 : casingOpacity} running={running} phase={running ? phase : 0} />
        {running && [-127, -87, -47].map(x => (
          <AirStream key={x} start={[x, -53, 68]} end={[x, 10, 36]} color={COOL} phase={phase} />
        ))}
      </UnitCloseup>
    </svg>
  );
}

export function IsoHomeACOutdoor({ variant = 'exterior', casingOpacity = 1, running = true, phase = 0, title, ...svg }: IsoHomeACUnitProps) {
  return (
    <svg width="100%" height="100%" {...svg} viewBox="0 0 760 480" role="img">
      <title>{title ?? 'Unit outdoor AC rumah'}</title>
      <UnitCloseup center={OUTDOOR_CENTER}>
        <OutdoorUnit opacity={variant === 'cutaway' ? 0 : casingOpacity} phase={running ? phase : 0} />
      </UnitCloseup>
    </svg>
  );
}

export interface IsoHomeACProps extends React.SVGProps<SVGSVGElement> {
  variant?: 'split' | 'cutaway';
  casingOpacity?: number;
  running?: boolean;
  phase?: number;
  title?: string;
}

export function IsoHomeAC({ variant = 'split', casingOpacity = 1, running = true, phase = 0, title, ...svg }: IsoHomeACProps) {
  const opacity = variant === 'cutaway' ? 0 : casingOpacity;
  const rotation = running ? phase : 0;
  return (
    <svg width="100%" height="100%" {...svg} viewBox="0 0 760 480" role="img">
      <title>{title ?? 'AC split rumah'}</title>
      <Surface vertices={[[-177, -113, 0], [192, -113, 0], [192, 90, 0], [-177, 90, 0]]} color="#E1E9E9" />
      <Block at={[-168, -116, 0]} size={[204, 13, 142]} color="#D1DFE1" top="#EDF3F3" side="#9FB7BE" />
      {LINES.map(({ route, color }) => <Pipe key={color} route={route} width={6} color={color} />)}
      {opacity < 1 && (
        <>
          <Pipe route={[[-148, -75, 94], [-154, -75, 94], [-154, -83, 73], [18, -83, 73], LINES[0].route[0]]} width={3.5} color={COOL} />
          <Pipe route={[[-37, -75, 114], [-27, -75, 114], [-27, -83, 109], [23, -83, 109], LINES[1].route[0]]} width={3.5} color={COPPER} />
        </>
      )}
      <IndoorUnit opacity={opacity} running={running} phase={rotation} />
      <OutdoorUnit opacity={opacity} phase={rotation} />
      {running && [-127, -87, -47].map(x => (
        <AirStream key={x} start={[x, -53, 68]} end={[x, 14, 29]} color={COOL} phase={phase} />
      ))}
      {running && [-22, 0, 22].map(offset => (
        <AirStream key={offset} start={[(93 - 22 * (1 - opacity)) + offset, 78, 52]} end={[(93 - 22 * (1 - opacity)) + offset, 138, 56]} color={WARM} phase={phase} />
      ))}
    </svg>
  );
}

const PORTS = { suction: [-24, 89, 68], discharge: [15, -13, 182] } as const;
const MOTOR = [0, 0, 69] as const;
const CHAMBER = [0, 0, 116] as const;

export const ISO_HOME_COMPRESSOR_ANCHORS = { ...PORTS, shell: [0, 56, 105], terminals: [29, 34, 153] } as const;
export const ISO_HOME_COMPRESSOR_CUTAWAY_ANCHORS = {
  ...PORTS, motor: MOTOR, stator: [6, 36, 78], rotor: [13, 6, 78],
  shaft: [0, 0, 91], chamber: CHAMBER, vane: [35, 0, 116],
  reedValve: [26, -25, 118], oilSump: [0, 50, 23],
} as const;

function MotorSection({ rotation }: { rotation: number }) {
  const p = projectCarPoint([0, 0, 78]);
  return (
    <g transform={`matrix(${COS_30} 0.5 ${-COS_30} 0.5 ${p.x} ${p.y})`}>
      <circle r={39} fill="#405966" stroke="#BDCFD6" strokeWidth={2} />
      <g fill="none" stroke="#D39D62" strokeWidth={4}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
          <path key={angle} d="M 26 -3 H 35 V 3 H 26" transform={`rotate(${angle})`} />
        ))}
      </g>
      <circle r={21} fill="#A4BDC6" stroke="#253C46" strokeWidth={2} />
      <path d="M 12 0 H 18" stroke="#253C46" strokeWidth={3} transform={`rotate(${rotation})`} />
    </g>
  );
}

function RotaryChamber({ rotation }: { rotation: number }) {
  const p = projectCarPoint(CHAMBER);
  const angle = rotation * Math.PI / 180;
  const x = 10 * Math.cos(angle);
  const y = 10 * Math.sin(angle);
  const vaneTip = x + Math.sqrt(28 ** 2 - y ** 2);
  return (
    <g data-part="rotary-chamber" transform={`matrix(${COS_30} 0.5 ${-COS_30} 0.5 ${p.x} ${p.y})`}>
      <circle r={43} fill="#B3C7CD" stroke="#2F3B40" strokeWidth={1.5} />
      <circle r={38} fill="#253D48" />
      <circle cx={x} cy={y} r={28} fill="#94B3BE" stroke="#DCE7E9" strokeWidth={2} />
      <circle r={8} fill="#233742" stroke="#DEE8E8" strokeWidth={2} />
      <path d={`M ${vaneTip} 0 H 43`} stroke="#E5A858" strokeWidth={6} />
      <circle cx={x} cy={y} r={3} fill="#365C6C" />
      <g data-part="discharge-reed">
        <circle cx={26} cy={-25} r={3.5} fill="#263D48" stroke="#D6E3E5" />
        <path d="M 30 -29 Q 25 -31 22 -25" fill="none" stroke="#E1AA61" strokeWidth={2.5} />
      </g>
    </g>
  );
}

export interface IsoHomeCompressorProps extends React.SVGProps<SVGSVGElement> {
  variant?: 'exterior' | 'cutaway';
  casingOpacity?: number;
  rotation?: number;
  title?: string;
}

export function IsoHomeCompressor({ variant = 'exterior', casingOpacity = 1, rotation = 0, title, ...svg }: IsoHomeCompressorProps) {
  const opacity = variant === 'cutaway' ? 0 : casingOpacity;
  return (
    <svg width="100%" height="100%" {...svg} viewBox="0 0 760 480" role="img">
      <title>{title ?? 'Kompresor rotary AC rumah'}</title>
      <Block at={[-92, -75, 0]} size={[184, 150, 10]} color="#829AA6" top="#BECED3" side="#637C89" />
      <Cylinder at={[0, 0, 10]} radius={58} height={18} color="#253946" top="#617C89" />
      {opacity < 1 && (
        <g data-part="cutaway">
          <path data-part="oil-sump" d="M 313 278 A 67 36 0 0 0 447 278" fill="none" stroke="#C88D49" strokeWidth={3} />
          <Cylinder at={[0, 0, 28]} radius={40} height={50} color="#607D89" top="#B4C7CE" />
          {[-27, -18, -9, 0, 9, 18, 27].map(x => (
            <Pipe key={x} route={[[x, Math.sqrt(40 ** 2 - x ** 2), 36], [x, Math.sqrt(40 ** 2 - x ** 2), 68]]} width={4} color={COPPER} />
          ))}
          <MotorSection rotation={rotation} />
          <Cylinder at={[0, 0, 78]} radius={10} height={23} color="#7397A7" top="#C1D5DC" />
          <Cylinder at={[0, 0, 101]} radius={45} height={15} color="#577581" />
          <RotaryChamber rotation={rotation} />
          <Pipe route={[[26, -25, 118], [26, -25, 155], [15, -13, 155], PORTS.discharge]} width={7} color={COPPER} />
        </g>
      )}
      {opacity > 0 && (
        <g data-part="sealed-shell" opacity={opacity}>
          <Cylinder at={[0, 0, 28]} radius={57} height={116} color="#2E4351" top="#587380" />
          <path d="M 310 240 A 70 40 0 0 0 450 240" fill="none" stroke="#1E313B" strokeWidth={3} />
          <Cylinder at={[0, 0, 144]} radius={49} height={9} color="#415D6A" top="#6A8694" />
          <Pipe route={[[15, -13, 153], PORTS.discharge]} width={8} color={COPPER} />
          <Block at={[15, 22, 143]} size={[29, 25, 15]} color="#21323C" top="#506A76" side="#324C5A" />
          {[21, 30, 39].map(x => <Cylinder key={x} at={[x, 35, 158]} radius={2.5} height={6} color="#AF7845" top="#DEB27F" />)}
        </g>
      )}
      <Pipe route={[PORTS.suction, [-24, 89, 49], [-24, 32 + 19 * opacity, 49]]} width={11} color={COPPER} />
    </svg>
  );
}
