import React, { useId } from 'react';
import { CarEngine, CarUnderbody } from './CarMechanics';
import { ElectricDriveUnit, ElectricEnergyFlow } from './ElectricCarMechanics';
import { carPoints as points, type CarPoint as Point3 } from './car-geometry';

export { projectCarPoint } from './car-geometry';

export interface IsoCarProps extends Omit<React.SVGProps<SVGSVGElement>, 'color'> {
  powertrain?: 'petrol' | 'electric';
  /** Body paint, in #RGB or #RRGGBB notation. */
  color?: string;
  /** 0 = closed, 1 = fully lowered. Applies to the two visible side windows. */
  windowOpen?: number;
  /** Wheel angle in degrees; callers supply their own frame-based timing. */
  wheelRotation?: number;
  /** Painted shell opacity. Mechanical parts remain independent of the shell. */
  bodyOpacity?: number;
  /** A cutaway reveals the cabin and engine; chassis removes the entire shell and floor. */
  view?: 'exterior' | 'cutaway' | 'chassis';
  /** 0 = closed, 1 = raised 70 degrees around the rear hood hinge. */
  hoodOpen?: number;
  /** Accessory pulley angle in degrees, independent of wheel rotation. */
  engineRotation?: number;
  motorRotation?: number;
  batteryCoverOpacity?: number;
  chargePortOpen?: boolean;
  energyFlow?: boolean;
  energyPhase?: number;
  wheelOpacity?: number;
  headlights?: boolean;
  shadow?: boolean;
  title?: string;
}

const COS_30 = Math.sqrt(3) / 2;
const INK = '#263238';
const GLASS = '#416773';
const TRIM = '#26343B';

export const ISO_CAR_ANCHORS = {
  front: [222, 0, 74],
  rear: [-220, 0, 74],
  frontWheel: [145, 98, 44],
  rearWheel: [-140, 98, 44],
  frontWindow: [66, 80, 136],
  rearWindow: [-62, 80, 139],
  cabin: [-10, 0, 127],
  roof: [-8, 0, 177],
  engine: [163, 0, 95],
  radiator: [211, 0, 80],
  compressor: [180, 42, 70],
  battery: [187, -55, 82],
  transmission: [110, 0, 60],
  driveshaft: [-10, 0, 46],
  differential: [-140, 0, 56],
  fuelTank: [-60, -15, 45],
  exhaust: [-120, 36, 30],
} as const satisfies Record<string, Point3>;

const clamp = (value: number, fallback: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
function paintPalette(input: string) {
  const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(input);
  const color = short ? `#${short[1].repeat(2)}${short[2].repeat(2)}${short[3].repeat(2)}` : input;
  const valid = /^#[\da-f]{6}$/i.test(color) ? color : '#CF5A3C';
  const channels = [1, 3, 5].map((offset) => parseInt(valid.slice(offset, offset + 2), 16));
  const mix = (target: number, share: number) => `#${channels.map((channel) => Math.round(channel + (target - channel) * share).toString(16).padStart(2, '0')).join('')}`;
  return { main: valid, top: mix(255, 0.25), light: mix(255, 0.12), dark: mix(0, 0.19), edge: mix(0, 0.42) };
}

const Face: React.FC<{ vertices: readonly Point3[]; fill: string; stroke?: string; opacity?: number }> = ({ vertices, fill, stroke = INK, opacity }) => (
  <polygon points={points(vertices)} fill={fill} stroke={stroke} strokeWidth={1.3} strokeLinejoin="round" opacity={opacity} />
);

function sideTransform(y: number) {
  return `matrix(${COS_30} 0.5 0 -1 ${380 - y * COS_30} ${300 + y / 2})`;
}

const Wheel: React.FC<{ x: number; y: number; angle: number }> = ({ x, y, angle }) => (
  <g data-part={x > 0 ? 'front-wheel' : 'rear-wheel'}>
    <g transform={sideTransform(y - 13)}>
      <circle cx={x} cy={44} r={40} fill="#111A20" stroke={INK} strokeWidth={2} />
    </g>
    <g transform={sideTransform(y)}>
      <circle cx={x} cy={44} r={40} fill="#273139" stroke="#172126" strokeWidth={2} />
      <circle cx={x} cy={44} r={32} fill="#1B252D" stroke="#465159" strokeWidth={1.3} />
      <g transform={`translate(${x} 44) rotate(${angle})`}>
        <circle r={25.5} fill="#66767C" stroke="#D8E1E1" strokeWidth={1.5} />
        {Array.from({ length: 5 }, (_, index) => (
          <g key={index} transform={`rotate(${index * 72})`}>
            <path d="M -4 8 L -8 22 Q -2 26 4 23 L 5 9 Z" fill="#26343D" />
            <path d="M 0 7 L 5 22 L 10 19 L 5 5 Z" fill="#E3EBE9" />
          </g>
        ))}
        <circle r={8} fill="#A6B7BA" stroke="#E5ECEA" />
        <circle r={3} fill="#405259" />
      </g>
    </g>
  </g>
);

/** A fixed-view vector MPV. State comes entirely from props, so Remotion can seek any frame. */
export const IsoCar: React.FC<IsoCarProps> = ({
  powertrain = 'petrol', color = '#CF5A3C', windowOpen = 0, wheelRotation = 0, bodyOpacity = 1,
  view = 'exterior', hoodOpen = 0, engineRotation = 0, wheelOpacity,
  motorRotation = 0, batteryCoverOpacity = 0.15, chargePortOpen = false, energyFlow = false, energyPhase = 0,
  headlights = false, shadow = true, title = 'Mobil isometrik', style, ...svgProps
}) => {
  const id = `car-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const paint = paintPalette(color);
  const open = clamp(windowOpen, 0);
  const opacity = clamp(bodyOpacity, 1) * (view === 'chassis' ? 0 : view === 'cutaway' ? 0.1 : 1);
  const wheels = clamp(wheelOpacity ?? (view === 'chassis' ? 0.25 : 1), 1);
  const rotation = Number.isFinite(wheelRotation) ? wheelRotation % 360 : 0;
  const engineAngle = Number.isFinite(engineRotation) ? engineRotation % 360 : 0;
  const hoodAngle = clamp(hoodOpen, 0) * 70 * Math.PI / 180;
  const hoodPoint = ([x, y, z]: Point3): Point3 => [132 + (x - 132) * Math.cos(hoodAngle) - (z - 109) * Math.sin(hoodAngle), y, 109 + (x - 132) * Math.sin(hoodAngle) + (z - 109) * Math.cos(hoodAngle)];
  const sideWindow = 'M -178 113 L -137 165 L -25 165 L -25 113 Z M -13 113 L -13 165 L 63 165 L 111 113 Z';

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 480" role="img" aria-labelledby={`${id}-title`} {...svgProps} style={{ display: 'block', width: '100%', height: 'auto', ...style }}>
      <title id={`${id}-title`}>{title}</title>
      <defs>
        <clipPath id={`${id}-windows`}><path d={sideWindow} /></clipPath>
        <mask id={`${id}-window-openings`} maskUnits="userSpaceOnUse" x={-250} y={0} width={500} height={220}>
          <rect x={-250} y={0} width={500} height={220} fill="white" />
          <path d={sideWindow} fill="black" />
        </mask>
      </defs>
      {shadow && <polygon data-part="shadow" points={points([[-228, -88, 0], [220, -88, 0], [239, 75, 0], [225, 112, 0], [-215, 112, 0], [-236, 87, 0]])} fill="#142B31" opacity={0.12} />}

      <g opacity={wheels}>
        <Wheel x={-140} y={-78} angle={rotation} />
        <Wheel x={145} y={-78} angle={rotation} />
      </g>

      <CarUnderbody powertrain={powertrain} batteryCoverOpacity={clamp(batteryCoverOpacity, 0.15)} />
      <g data-part="floor" opacity={view === 'chassis' ? 0 : view === 'cutaway' ? 0.08 : 1}>
        <Face vertices={[[-190, -74, 80], [127, -74, 80], [127, 74, 80], [-190, 74, 80]]} fill="#45565A" />
      </g>

      <g data-part="cabin" opacity={view === 'chassis' ? 0 : view === 'cutaway' ? 0.65 : 1}>
        <Face vertices={[[-139, -70, 102], [105, -70, 102], [105, 70, 102], [-139, 70, 102]]} fill="#28373B" />
        {[-72, 35].flatMap((x) => [-40, 36].map((y) => (
          <g key={`${x}-${y}`}>
            <Face vertices={[[x - 23, y - 20, 108], [x + 23, y - 20, 108], [x + 23, y + 20, 108], [x - 23, y + 20, 108]]} fill="#718180" />
            <Face vertices={[[x - 21, y - 20, 108], [x - 21, y - 20, 148], [x - 21, y + 20, 148], [x - 21, y + 20, 108]]} fill="#536565" />
            <Face vertices={[[x - 25, y - 14, 148], [x - 25, y - 14, 158], [x - 25, y + 14, 158], [x - 25, y + 14, 148]]} fill="#83918B" />
          </g>
        )))}
        <Face vertices={[[89, -70, 105], [112, -70, 116], [112, 70, 116], [89, 70, 105]]} fill="#3A494E" />
      </g>

      {powertrain === 'electric'
        ? <ElectricDriveUnit rotation={Number.isFinite(motorRotation) ? motorRotation % 360 : 0} />
        : <CarEngine rotation={engineAngle} />}

      <g data-part="body" opacity={opacity}>
        <Face vertices={[[-220, -81, 85], [-204, -81, 104], [-195, -81, 108], [-195, 81, 108], [-204, 81, 104], [-220, 81, 85]]} fill={paint.top} />
        <Face vertices={[[-195, -81, 108], [132, -81, 109], [211, -81, 101], [222, -81, 84], [222, -81, 45], [-220, -81, 45], [-220, -81, 85]]} fill={paint.dark} />
        <Face vertices={[[-195, -81, 108], [-125, -81, 177], [-125, 81, 177], [-195, 81, 108]]} fill={GLASS} />
        <Face vertices={[[-125, -81, 177], [65, -81, 177], [65, 81, 177], [-125, 81, 177]]} fill={paint.top} />
        <Face vertices={[[65, -81, 177], [132, -81, 109], [132, 81, 109], [65, 81, 177]]} fill={paint.light} />
        <Face vertices={[[72, -73, 169], [123, -73, 116], [123, 73, 116], [72, 73, 169]]} fill={GLASS} />
        <Face vertices={[[74, -65, 165], [119, -65, 119], [119, -48, 119], [74, -48, 165]]} fill="#B9D3D6" stroke="none" opacity={0.36} />

        <g transform={sideTransform(81)} mask={`url(#${id}-window-openings)`}>
          <path d="M -220 45 L -220 84 Q -220 99 -204 104 L -195 108 L -145 167 Q -137 177 -125 177 L 65 177 Q 75 176 84 164 L 132 109 L 205 104 Q 222 102 222 86 L 222 45 L 190 45 Q 188 92 145 92 Q 102 92 100 45 L -95 45 Q -97 92 -140 92 Q -183 92 -185 45 Z" fill={paint.main} stroke={paint.edge} strokeWidth={1.7} strokeLinejoin="round" />
          <path d="M -195 108 L -145 167 Q -137 177 -125 177 L 65 177 Q 75 176 84 164 L 132 109 Z" fill={TRIM} stroke={paint.edge} strokeWidth={1.5} />
          <path d="M -220 79 L -186 77 M -96 76 L 100 76 M 191 76 L 222 79" fill="none" stroke={paint.light} strokeWidth={2.5} />
          <path d="M -90 108 L -91 55 L -21 55 L -21 108 M -13 108 L -13 55 L 96 55 L 117 104" fill="none" stroke={paint.edge} strokeWidth={1.15} />
          <path d="M -94 48 L 96 48" stroke={TRIM} strokeWidth={8} />
          <path d="M -94 52 L 96 52" stroke="#A9B8B7" strokeWidth={1.5} />
          <path d="M -220 86 L -204 90 L -204 78 L -220 76 Z" fill="#A83E30" stroke={paint.edge} />
          <path d="M -218 87 L -207 89" stroke="#F7A385" strokeWidth={2} />
          <path d="M -52 99 L -34 99 M 73 99 L 91 99" stroke={paint.edge} strokeWidth={5} strokeLinecap="round" />
          <path d="M -51 100 L -35 100 M 74 100 L 90 100" stroke="#DBE3E0" strokeWidth={2} strokeLinecap="round" />
        </g>

        <Face vertices={[[222, -71, 95], [222, 71, 95], [222, 81, 84], [222, 81, 45], [222, -81, 45], [222, -81, 84]]} fill={paint.dark} />
        <Face vertices={[[223, -77, 61], [223, 77, 61], [223, 77, 48], [223, -77, 48]]} fill={TRIM} />
        <Face vertices={[[224, -42, 83], [224, 42, 83], [224, 38, 67], [224, -38, 67]]} fill={powertrain === 'electric' ? paint.light : '#26343A'} />
        {powertrain === 'petrol' && [-32, -17, -2, 13, 28].map((y) => <Face key={y} vertices={[[224.3, y, 81], [224.3, y + 5, 81], [224.3, y + 5, 69], [224.3, y, 69]]} fill="#788B8D" stroke="none" />)}
        <Face vertices={[[224, -72, 88], [224, -46, 85], [224, -46, 75], [224, -72, 77]]} fill={headlights ? '#FFF0B4' : '#DFE9DC'} />
        <Face vertices={[[224, 46, 85], [224, 72, 88], [224, 72, 77], [224, 46, 75]]} fill={headlights ? '#FFF0B4' : '#DFE9DC'} />
        <Face vertices={[[224, -23, 62], [224, 23, 62], [224, 23, 52], [224, -23, 52]]} fill="#C3CECC" />
      </g>

      <g data-part="hood" opacity={opacity}>
        <Face vertices={([[132, -81, 109], [205, -81, 104], [222, -71, 95], [222, 71, 95], [205, 81, 104], [132, 81, 109]] as const).map(hoodPoint)} fill={paint.top} />
        {hoodOpen > 0 && [-55, 55].map((y) => <Face key={y} vertices={([[140, y, 110], [200, y, 106], [200, y + 3, 106], [140, y + 3, 110]] as const).map(hoodPoint)} fill={paint.light} stroke={paint.edge} />)}
      </g>

      <g data-part="side-windows" opacity={view === 'chassis' ? 0 : view === 'cutaway' ? 0.1 : 1} transform={sideTransform(81.5)}>
        <g clipPath={`url(#${id}-windows)`}>
          <g transform={`translate(0 ${-open * 62})`}>
            <path d={sideWindow} fill={GLASS} opacity={0.88} />
            <path d="M -151 113 L -99 172 L -68 172 L -120 113 Z M -15 113 L 35 172 L 53 172 L 3 113 Z" fill="#BBD8DC" opacity={0.28} />
            <path d="M -140 164 L 110 164" stroke="#BBD8DC" strokeWidth={1.5} />
          </g>
        </g>
        <path d={sideWindow} fill="none" stroke="#1C3037" strokeWidth={2} />
        <path d="M -20 113 L -20 166" stroke={TRIM} strokeWidth={8} />
      </g>

      <g opacity={wheels}>
        <Wheel x={-140} y={98} angle={rotation} />
        <Wheel x={145} y={98} angle={rotation} />
      </g>

      {powertrain === 'electric' && <g data-part="charge-port" opacity={view === 'chassis' ? 1 : view === 'cutaway' ? 0.5 : 1} transform={sideTransform(84)}>
        <rect x={-207} y={86} width={20} height={18} rx={2} fill={chargePortOpen ? '#263E45' : paint.light} stroke={paint.edge} strokeWidth={1.1} />
        {chargePortOpen && <>
          <circle cx={-197} cy={95} r={6.5} fill="#A9BEB5" stroke="#DCE5DC" strokeWidth={0.8} />
          {[-1, 0, 1].map((i) => <circle key={i} cx={-197 + i * 3.2} cy={96} r={1} fill="#314D54" />)}
          <circle cx={-199} cy={92} r={1} fill="#314D54" /><circle cx={-195} cy={92} r={1} fill="#314D54" />
          <path d="M -207 86 L -216 93 L -216 109 L -207 104 Z" fill={paint.main} stroke={paint.edge} />
        </>}
      </g>}

      {powertrain === 'electric' && energyFlow && <ElectricEnergyFlow phase={energyPhase} />}

      <g data-part="mirror" opacity={opacity}>
        <Face vertices={[[107, 82, 119], [112, 99, 118], [102, 107, 127], [94, 91, 130]]} fill={paint.light} />
        <Face vertices={[[112, 99, 118], [102, 107, 127], [102, 107, 120], [112, 99, 113]]} fill={TRIM} />
      </g>
    </svg>
  );
};
