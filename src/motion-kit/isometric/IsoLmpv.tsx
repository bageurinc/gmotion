import React, { useId } from 'react';
import { carPoints as points, projectCarPoint, type CarPoint as Point3 } from './car-geometry';
import { Surface, Block, Pipe, Bolt, Spring, Brake } from './car-svg-parts';

export { projectCarPoint } from './car-geometry';
export type { CarPoint } from './car-geometry';

export interface IsoLmpvProps extends Omit<React.SVGProps<SVGSVGElement>, 'color'> {
  /** Body paint, in #RGB or #RRGGBB notation. Default: Metallic Slate / Grey. */
  color?: string;
  /** 0 = closed, 1 = fully lowered. Applies to visible side windows. */
  windowOpen?: number;
  /** Wheel angle in degrees for drive animation. */
  wheelRotation?: number;
  /** Painted shell opacity. Mechanical parts remain independent. */
  bodyOpacity?: number;
  /** View angle: exterior shell, cutaway revealing 3-row interior & FWD engine, or chassis revealing suspension & underbody. */
  view?: 'exterior' | 'cutaway' | 'chassis';
  /** 0 = closed, 1 = open around rear hood hinge. */
  hoodOpen?: number;
  /** 0 = closed, 1 = open tailgate/hatchback around top roof hinge. */
  tailgateOpen?: number;
  /** 0 = closed, 1 = open driver door. */
  doorOpen?: number;
  /** Accessory serpentine belt and pulley rotation in degrees. */
  engineRotation?: number;
  /** Opacity of wheel assemblies. */
  wheelOpacity?: number;
  /** Turn on projector headlights and LED DRL eyebrows. */
  headlights?: boolean;
  /** Render soft isometric ground shadow. */
  shadow?: boolean;
  /** Accessible title for SVG graphic. */
  title?: string;
}

const COS_30 = Math.sqrt(3) / 2;
const INK = '#1A2328';
const TRIM = '#182025';
const CHROME = '#E2ECF0';
const CHROME_SHADOW = '#9BB0B7';

export const ISO_LMPV_ANCHORS = {
  front: [228, 0, 75],
  rear: [-232, 0, 80],
  frontWheel: [145, 82, 42],
  rearWheel: [-145, 82, 42],
  engine: [155, 0, 88],
  transaxle: [145, 22, 54],
  radiator: [214, 0, 72],
  battery: [180, -56, 80],
  airBox: [142, -58, 86],
  cabin: [-5, 0, 126],
  row1Seat: [42, 36, 118],
  row2Seat: [-42, 0, 118],
  row3Seat: [-128, 0, 118],
  doubleBlower: [-36, 0, 172],
  dashboard: [94, 0, 118],
  infotainment: [92, 0, 130],
  steering: [84, 38, 124],
  roof: [-15, 0, 180],
  tailgate: [-220, 0, 136],
  fuelTank: [-45, -12, 42],
  torsionBeam: [-145, 0, 44],
  exhaust: [-185, 36, 26],
} as const satisfies Record<string, Point3>;

const clamp = (value: number | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

function paintPalette(input: string) {
  const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(input);
  const color = short ? `#${short[1].repeat(2)}${short[2].repeat(2)}${short[3].repeat(2)}` : input;
  const valid = /^#[\da-f]{6}$/i.test(color) ? color : '#4A5560';
  const channels = [1, 3, 5].map((offset) => parseInt(valid.slice(offset, offset + 2), 16));
  const mix = (target: number, share: number) =>
    `#${channels.map((channel) => Math.round(channel + (target - channel) * share).toString(16).padStart(2, '0')).join('')}`;
  return {
    main: valid,
    top: mix(255, 0.32),
    highlight: mix(255, 0.45),
    light: mix(255, 0.16),
    dark: mix(0, 0.25),
    shadow: mix(0, 0.48),
    deepShadow: mix(0, 0.70),
    edge: mix(0, 0.65),
  };
}

const Face: React.FC<{ vertices: readonly Point3[]; fill: string; stroke?: string; strokeWidth?: number; opacity?: number }> = ({
  vertices, fill, stroke = INK, strokeWidth = 1, opacity,
}) => (
  <polygon points={points(vertices)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" opacity={opacity} />
);

function sideTransform(y: number) {
  return `matrix(${COS_30} 0.5 0 -1 ${380 - y * COS_30} ${300 + y / 2})`;
}

/** 15-inch Dual-Tone Diamond-Cut Alloy Wheel with ventilated brake disc & caliper */
const ErtigaWheel: React.FC<{ x: number; y: number; angle: number }> = ({ x, y, angle }) => (
  <g data-part={x > 0 ? 'front-wheel' : 'rear-wheel'}>
    {/* Inner tire shadow & tread thickness */}
    <g transform={sideTransform(y - 12)}>
      <circle cx={x} cy={42} r={37} fill="#0F1418" stroke="#080C0E" strokeWidth={1.5} />
    </g>
    {/* Outer wheel assembly */}
    <g transform={sideTransform(y)}>
      {/* Outer tire rubber with tread pattern */}
      <circle cx={x} cy={42} r={37} fill="#1E262B" stroke="#12181C" strokeWidth={2} />
      {/* Tire sidewall groove */}
      <circle cx={x} cy={42} r={30.5} fill="#141B20" stroke="#2C373E" strokeWidth={1.2} />
      {/* Brake rotor behind rim */}
      <circle cx={x} cy={42} r={21.5} fill="#697B82" stroke="#37454B" strokeWidth={0.8} />
      {/* Brake caliper */}
      <path
        d={`M ${x + 12} 55 L ${x + 21} 51 L ${x + 21} 33 L ${x + 12} 29 Z`}
        fill="#9E3A2B"
        stroke="#1E262B"
        strokeWidth={0.8}
      />
      {/* 5-Split-Spoke Dual-Tone Diamond Cut Rim */}
      <g transform={`translate(${x} 42) rotate(${angle})`}>
        {/* Dark gunmetal inner pocket wheel rim */}
        <circle r={24.5} fill="#182025" stroke="#CAD6DB" strokeWidth={1.5} />
        {/* 5 Machined Alloy Split Spokes */}
        {Array.from({ length: 5 }, (_, index) => (
          <g key={index} transform={`rotate(${index * 72})`}>
            {/* Split twin machined spokes */}
            <path d="M -3 6 L -6.5 21 L -3.5 22.5 L -1 7 Z" fill="#E8F1F5" stroke="#8CA1A8" strokeWidth={0.4} />
            <path d="M 3 6 L 6.5 21 L 3.5 22.5 L 1 7 Z" fill="#E8F1F5" stroke="#8CA1A8" strokeWidth={0.4} />
            {/* Dark recessed pocket accent */}
            <path d="M -1 7 L 1 7 L 2.5 22.5 L -2.5 22.5 Z" fill="#0E1418" />
          </g>
        ))}
        {/* Center hub & 5 lug nuts */}
        <circle r={8} fill="#82979E" stroke="#E3EDF0" strokeWidth={1} />
        {Array.from({ length: 5 }, (_, index) => {
          const a = index * (Math.PI * 2 / 5);
          return (
            <circle
              key={index}
              cx={Math.cos(a) * 4.8}
              cy={Math.sin(a) * 4.8}
              r={1}
              fill="#F0F6F7"
              stroke="#263338"
              strokeWidth={0.4}
            />
          );
        })}
        {/* Center cap emblem */}
        <circle r={3} fill="#202C32" />
        <circle r={1.5} fill="#C6D6DB" />
      </g>
    </g>
  </g>
);

/** 3-Row Interior Cabin with AC Double Blower */
const LmpvCabin: React.FC<{ view: 'exterior' | 'cutaway' | 'chassis' }> = ({ view }) => {
  const cabinOpacity = view === 'chassis' ? 0 : view === 'cutaway' ? 0.95 : 1;
  if (cabinOpacity === 0) return null;

  return (
    <g data-part="cabin" opacity={cabinOpacity}>
      {/* Carpet floor */}
      <Face vertices={[[-190, -70, 82], [112, -70, 82], [112, 70, 82], [-190, 70, 82]]} fill="#242E33" />

      {/* Dashboard */}
      <g data-part="dashboard">
        <Face vertices={[[90, -68, 106], [116, -68, 116], [116, 68, 116], [90, 68, 106]]} fill="#354248" />
        <Face vertices={[[90, -68, 92], [116, -68, 106], [116, 68, 106], [90, 68, 92]]} fill="#222C31" />
        <Face vertices={[[95, -66, 107], [114, -66, 111], [114, 66, 111], [95, 66, 107]]} fill="#8C9CA2" />

        {/* 8-inch Floating Touchscreen Infotainment */}
        <Face vertices={[[97, -12, 117], [100, -12, 133], [100, 12, 133], [97, 12, 117]]} fill="#141C20" stroke="#60737A" strokeWidth={1} />
        <Face vertices={[[97.5, -10, 119], [99.5, -10, 131], [99.5, 10, 131], [97.5, 10, 119]]} fill="#1E3E4F" stroke="none" />
        <Face vertices={[[98, -6, 122], [98.5, -6, 128], [98.5, -1, 128], [98, -1, 122]]} fill="#2EB4D4" stroke="none" />
        <Face vertices={[[98, 1, 122], [98.5, 1, 128], [98.5, 6, 128], [98, 6, 122]]} fill="#E0A030" stroke="none" />

        {/* Steering Wheel & Controls */}
        <g data-part="steering-wheel">
          <Pipe route={[[86, 38, 108], [76, 38, 122]]} width={4} color="#303E45" />
          <Face vertices={[[75, 26, 121], [77, 26, 137], [77, 50, 137], [75, 50, 121]]} fill="none" stroke="#1E272B" strokeWidth={3.5} />
          <Face vertices={[[75, 30, 120], [77, 30, 122], [77, 46, 122], [75, 46, 120]]} fill="none" stroke="#1E272B" strokeWidth={3.5} />
          <Face vertices={[[76, 33, 126], [78, 33, 132], [78, 43, 132], [76, 43, 126]]} fill="#273238" stroke="#7C8F96" strokeWidth={0.8} />
        </g>
      </g>

      {/* Row 1 Seats */}
      <g data-part="row-1-seats">
        {[-38, 38].map((y) => (
          <g key={`row1-${y}`}>
            <Face vertices={[[24, y - 18, 84], [62, y - 18, 84], [62, y + 18, 84], [24, y + 18, 84]]} fill="#2F393F" />
            <Face vertices={[[26, y - 16, 88], [58, y - 16, 92], [58, y + 16, 92], [26, y + 16, 88]]} fill="#4E5E65" />
            <Face vertices={[[20, y - 17, 88], [24, y - 17, 136], [24, y + 17, 136], [20, y + 17, 88]]} fill="#414F56" stroke="#252F34" strokeWidth={1} />
            <Pipe route={[[22, y - 5, 136], [22, y - 5, 142]]} width={2} color="#CBD6D9" />
            <Pipe route={[[22, y + 5, 136], [22, y + 5, 142]]} width={2} color="#CBD6D9" />
            <Block at={[19, y - 10, 142]} size={[7, 20, 12]} color="#414F56" top="#62747B" side="#2F393F" />
          </g>
        ))}
      </g>

      {/* Row 2 Seats: 60:40 Split Bench */}
      <g data-part="row-2-seats">
        <Face vertices={[[-60, -58, 84], [-24, -58, 84], [-24, 58, 84], [-60, 58, 84]]} fill="#2F393F" />
        <Face vertices={[[-58, -56, 88], [-26, -56, 92], [-26, 56, 92], [-58, 56, 88]]} fill="#4E5E65" />
        <Face vertices={[[-64, -56, 88], [-60, -56, 136], [-60, 56, 136], [-64, 56, 88]]} fill="#414F56" stroke="#252F34" strokeWidth={1} />
        <Pipe route={[[-60, 10, 88], [-60, 10, 136]]} width={1.8} color="#252F34" />
        {/* 3 Headrests */}
        {[-38, 0, 38].map((y) => (
          <g key={`row2-h-${y}`}>
            <Pipe route={[[-62, y - 4, 136], [-62, y - 4, 142]]} width={1.8} color="#CBD6D9" />
            <Pipe route={[[-62, y + 4, 136], [-62, y + 4, 142]]} width={1.8} color="#CBD6D9" />
            <Block at={[-65, y - 9, 142]} size={[7, 18, 11]} color="#414F56" top="#62747B" side="#2F393F" />
          </g>
        ))}
      </g>

      {/* Ceiling AC Double Blower */}
      <g data-part="double-blower">
        <Face vertices={[[-48, -44, 172], [-22, -44, 172], [-22, 44, 172], [-48, 44, 172]]} fill="#B8C6CB" stroke="#7A8D94" strokeWidth={1} />
        <Face vertices={[[-46, -42, 169], [-24, -42, 169], [-24, 42, 169], [-46, 42, 169]]} fill="#D9E4E8" stroke="#7A8D94" strokeWidth={0.8} />
        {[-32, -11, 11, 32].map((y) => (
          <Face key={`vent-${y}`} vertices={[[-42, y - 8, 169.2], [-28, y - 8, 169.2], [-28, y + 8, 169.2], [-42, y + 8, 169.2]]} fill="#1E272B" stroke="#8EA2A8" strokeWidth={0.6} />
        ))}
      </g>

      {/* Row 3 Seats: 50:50 Split */}
      <g data-part="row-3-seats">
        <Face vertices={[[-146, -50, 86], [-112, -50, 86], [-112, 50, 86], [-146, 50, 86]]} fill="#2F393F" />
        <Face vertices={[[-144, -48, 90], [-114, -48, 93], [-114, 48, 93], [-144, 48, 90]]} fill="#4E5E65" />
        <Face vertices={[[-150, -48, 90], [-146, -48, 134], [-146, 48, 134], [-150, 48, 90]]} fill="#414F56" stroke="#252F34" strokeWidth={1} />
        <Pipe route={[[-146, 0, 90], [-146, 0, 134]]} width={1.8} color="#252F34" />
        {[-26, 26].map((y) => (
          <g key={`row3-h-${y}`}>
            <Pipe route={[[-148, y - 4, 134], [-148, y - 4, 140]]} width={1.8} color="#CBD6D9" />
            <Pipe route={[[-148, y + 4, 134], [-148, y + 4, 140]]} width={1.8} color="#CBD6D9" />
            <Block at={[-151, y - 9, 140]} size={[7, 18, 11]} color="#414F56" top="#62747B" side="#2F393F" />
          </g>
        ))}
      </g>

      {/* Cargo Luggage Floor */}
      <g data-part="cargo-luggage">
        <Face vertices={[[-190, -54, 83], [-152, -54, 83], [-152, 54, 83], [-190, 54, 83]]} fill="#242E33" />
      </g>
    </g>
  );
};

/** Transverse FWD 1.5L Engine Bay */
const LmpvEngineBay: React.FC<{ rotation: number }> = ({ rotation }) => (
  <g data-part="engine-bay">
    <g data-part="radiator">
      <Block at={[212, -56, 46]} size={[7, 112, 44]} color="#627175" top="#92A09F" side="#34454B" />
      {Array.from({ length: 13 }, (_, i) => (
        <Pipe key={i} route={[[219.5, -50 + i * 8.3, 51], [219.5, -50 + i * 8.3, 85]]} width={1.3} color="#8E9F9D" />
      ))}
      <Pipe route={[[212, -34, 84], [198, -34, 88], [178, -12, 85]]} width={5.5} color="#253236" />
      <Pipe route={[[212, 38, 52], [198, 40, 50], [175, 20, 52]]} width={5.5} color="#253236" />
    </g>

    <g data-part="engine-block">
      <Block at={[136, -34, 50]} size={[44, 68, 32]} color="#758386" top="#9DAAAA" side="#4E5D63" />
      <Block at={[134, -36, 82]} size={[48, 72, 10]} color="#333E43" top="#526268" side="#242E32" />
      <Face vertices={[[138, -32, 92.5], [178, -32, 92.5], [178, 32, 92.5], [138, 32, 92.5]]} fill="#66767C" stroke="#2B363C" strokeWidth={1} />
      {[-22, -7, 8, 23].map((y) => (
        <g key={`plug-${y}`}>
          <Block at={[153, y - 4, 93]} size={[14, 8, 4]} color="#182024" top="#273237" />
          <Bolt at={[160, y, 97.5]} color="#D4AF37" />
          <Pipe route={[[160, y, 95], [167, y, 95], [167, 33, 93]]} width={1.8} color="#E8A838" />
        </g>
      ))}
      <Bolt at={[144, -26, 94]} color="#F0C330" />
    </g>

    <g data-part="intake">
      <Block at={[138, -70, 68]} size={[30, 26, 22]} color="#263034" top="#3E4B51" side="#1A2225" />
      <Pipe route={[[210, -50, 84], [185, -60, 84], [170, -60, 82]]} width={6} color="#1E262A" dashed />
      <Pipe route={[[138, -56, 80], [124, -56, 80], [124, -10, 84]]} width={7} color="#242E32" />
      {[-20, -6, 8, 22].map((y) => (
        <Pipe key={`intake-r-${y}`} route={[[124, y, 84], [135, y, 86]]} width={4.2} color="#90A4A8" />
      ))}
    </g>

    <g data-part="battery">
      <Block at={[176, -70, 60]} size={[28, 26, 24]} color="#1E282D" top="#303E44" side="#161F23" />
      <Bolt at={[182, -65, 85]} color="#D33F36" />
      <Bolt at={[198, -52, 85]} color="#405055" />
      <Pipe route={[[176, -58, 84.5], [204, -58, 84.5]]} width={2} color="#C4D0D4" />
    </g>
  </g>
);

/** Chassis Underbody */
const LmpvUnderbody: React.FC = () => (
  <g data-part="underbody">
    <g data-part="chassis-platform">
      {[-68, 58].map((y) => (
        <Block key={`rail-${y}`} at={[-212, y, 26]} size={[424, 11, 14]} color="#4C5C62" top="#758588" side="#334247" />
      ))}
      {[-180, -95, 20, 140, 195].map((x) => (
        <Block key={`cross-${x}`} at={[x, -68, 27]} size={[11, 137, 9]} color="#5E6F74" top="#8E9D9D" />
      ))}
    </g>
    <g data-part="fwd-drivetrain">
      <Block at={[134, 14, 42]} size={[34, 28, 28]} color="#68777A" top="#93A2A5" side="#49575B" />
      <Pipe route={[[145, 14, 42], [145, -78, 42]]} width={6} color="#455459" />
      <Pipe route={[[145, 42, 42], [145, 78, 42]]} width={6} color="#455459" />
      {[-1, 1].map((sign) => (
        <g key={`front-susp-${sign}`}>
          <Pipe route={[[124, sign * 38, 30], [145, sign * 75, 36], [168, sign * 38, 30]]} width={4.5} color="#6C7E83" />
          <Spring x={145} y={sign * 68} />
          <Brake x={145} y={sign * 82} />
        </g>
      ))}
    </g>
    <g data-part="fuel-tank">
      <Block at={[-82, -48, 32]} size={[68, 56, 16]} color="#5D6D6A" top="#808F8A" side="#42524E" />
    </g>
    <g data-part="exhaust">
      <Pipe route={[[140, 0, 52], [128, 12, 38], [110, 16, 25], [88, 17, 24], [-20, 17, 24]]} width={4.5} color="#949B97" />
      <Block at={[88, 10, 21]} size={[24, 14, 10]} color="#AC9F94" top="#C8BCB1" />
      <Block at={[-44, 10, 20]} size={[28, 14, 11]} color="#9FA5A0" top="#BAC0BB" />
      <Block at={[-196, 12, 18]} size={[36, 26, 17]} color="#A7B0AC" top="#C6CFCB" side="#7E8B87" />
      <Pipe route={[[[-196, 26, 23], [-224, 28, 23]]]} width={4.8} color={CHROME} />
    </g>
    <g data-part="rear-torsion-beam">
      <Pipe route={[[-145, -72, 42], [-145, 72, 42]]} width={8} color="#3E4E53" />
      {[-1, 1].map((sign) => (
        <g key={`rear-susp-${sign}`}>
          <Spring x={-145} y={sign * 62} />
          <Brake x={-145} y={sign * 82} />
        </g>
      ))}
    </g>
  </g>
);

/**
 * IsoLmpv: High-fidelity Suzuki Ertiga (2023) 7-Seater Family LMPV in 30° Isometric Projection.
 * Features organic curved surfaces, aerodynamic Bézier silhouette, authentic front fascia with
 * crystal projector headlamps & chrome grille, signature floating-roof D-pillar, 3-row interior,
 * and dark inner wheel tubs that snugly embrace the diamond-cut alloy wheels.
 */
export const IsoLmpv: React.FC<IsoLmpvProps> = ({
  color = '#4A5560',
  windowOpen = 0,
  wheelRotation = 0,
  bodyOpacity = 1,
  view = 'exterior',
  hoodOpen = 0,
  tailgateOpen = 0,
  doorOpen = 0,
  engineRotation = 0,
  wheelOpacity,
  headlights = false,
  shadow = true,
  title = 'Mobil LMPV 7-Seater (Ertiga 2023)',
  style,
  ...svgProps
}) => {
  const id = `lmpv-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const paint = paintPalette(color);
  const open = clamp(windowOpen, 0);
  const shellOpacity = clamp(bodyOpacity, 1) * (view === 'chassis' ? 0 : view === 'cutaway' ? 0.12 : 1);
  const wheelsOpacity = clamp(wheelOpacity ?? (view === 'chassis' ? 0.35 : 1), 1);
  const rotation = Number.isFinite(wheelRotation) ? wheelRotation % 360 : 0;
  const engineAngle = Number.isFinite(engineRotation) ? engineRotation % 360 : 0;

  // Hood hinge transformation (pivots up around cowl hinge at x=126, z=116)
  const hoodAngle = clamp(hoodOpen, 0) * 65 * (Math.PI / 180);
  const hoodPoint = ([x, y, z]: Point3): Point3 => [
    126 + (x - 126) * Math.cos(hoodAngle) - (z - 116) * Math.sin(hoodAngle),
    y,
    116 + (x - 126) * Math.sin(hoodAngle) + (z - 116) * Math.cos(hoodAngle),
  ];

  // Tailgate hinge transformation (swings outward and up around roof hinge at x=-188, z=178)
  const tailgateAngle = clamp(tailgateOpen, 0) * 75 * (Math.PI / 180);
  const tailgatePoint = ([x, y, z]: Point3): Point3 => [
    -188 + (x - -188) * Math.cos(tailgateAngle) + (z - 178) * Math.sin(tailgateAngle),
    y,
    178 - (x - -188) * Math.sin(tailgateAngle) + (z - 178) * Math.cos(tailgateAngle),
  ];

  // Driver door hinge transformation (swings outward around A-pillar hinge at x=92, y=82)
  const doorAngle = clamp(doorOpen, 0) * 55 * (Math.PI / 180);
  const doorPoint = ([x, y, z]: Point3): Point3 => [
    92 + (x - 92) * Math.cos(doorAngle) - (y - 82) * Math.sin(doorAngle),
    82 + (x - 92) * Math.sin(doorAngle) + (y - 82) * Math.cos(doorAngle),
    z,
  ];

  // 3-Row Side Windows SVG Path with Suzuki Ertiga DLO (Day Light Opening) Curves
  const sideWindowPath =
    // Row 3 rear quarter glass with signature backward taper & rounded apex
    'M -172 122 L -172 134 Q -171 146 -156 162 L -140 168 L -82 168 L -82 122 Z ' +
    // Row 2 middle passenger window
    'M -72 122 L -72 168 L -6 168 L -6 122 Z ' +
    // Row 1 front door window
    'M 4 122 L 4 168 L 68 168 Q 80 168 88 160 L 88 122 Z ' +
    // A-pillar delta triangle glass
    'M 94 122 L 94 154 L 118 122 Z';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 760 480"
      role="img"
      aria-labelledby={`${id}-title`}
      {...svgProps}
      style={{ display: 'block', width: '100%', height: 'auto', ...style }}
    >
      <title id={`${id}-title`}>{title}</title>

      <defs>
        {/* Soft realistic ground shadow filter */}
        <radialGradient id={`${id}-ground-shadow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0B1317" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#0B1317" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0B1317" stopOpacity="0" />
        </radialGradient>

        {/* Paint surface gradient highlights */}
        <linearGradient id={`${id}-hood-grad`} x1="0%" y1="0%" x2="100%" y2="80%">
          <stop offset="0%" stopColor={paint.highlight} />
          <stop offset="45%" stopColor={paint.top} />
          <stop offset="100%" stopColor={paint.light} />
        </linearGradient>

        <linearGradient id={`${id}-roof-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={paint.top} />
          <stop offset="60%" stopColor={paint.light} />
          <stop offset="100%" stopColor={paint.dark} />
        </linearGradient>

        <linearGradient id={`${id}-glass-grad`} x1="0%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#6C8F9C" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#4A6E7C" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#2A4854" stopOpacity="0.96" />
        </linearGradient>

        <clipPath id={`${id}-windows`}>
          <path d={sideWindowPath} />
        </clipPath>

        <mask id={`${id}-window-cut`} maskUnits="userSpaceOnUse" x={-260} y={0} width={520} height={230}>
          <rect x={-260} y={0} width={520} height={230} fill="white" />
          <path d={sideWindowPath} fill="black" />
        </mask>
      </defs>

      {/* 1. Realistic Soft Ground Shadow */}
      {shadow && (
        <ellipse
          data-part="shadow"
          cx={370}
          cy={345}
          rx={280}
          ry={75}
          fill={`url(#${id}-ground-shadow)`}
        />
      )}

      {/* 2. Far Side Wheels (tucked realistically behind body) */}
      <g opacity={wheelsOpacity}>
        <ErtigaWheel x={-145} y={-78} angle={rotation} />
        <ErtigaWheel x={145} y={-78} angle={rotation} />
      </g>

      {/* 3. Chassis & Underbody */}
      <LmpvUnderbody />

      {/* 4. 3-Row Interior Cabin */}
      <LmpvCabin view={view} />

      {/* 5. Transverse 1.5L Engine Bay */}
      <LmpvEngineBay rotation={engineAngle} />

      {/* 6. Far Side Body Shell (visible through window glass) */}
      <g data-part="body-far" opacity={shellOpacity}>
        <Face vertices={[[-224, -78, 86], [222, -78, 86], [222, -78, 48], [-224, -78, 48]]} fill={paint.deepShadow} />
        <Face vertices={[[-180, -76, 176], [68, -76, 176], [68, -76, 168], [-180, -76, 168]]} fill={paint.dark} />
      </g>

      {/* 7. Near Side Dark Wheel Arch Housing Tubs (Covers suspension so wheels sit naturally) */}
      <g data-part="wheel-tubs" opacity={shellOpacity} transform={sideTransform(81)}>
        {/* Front wheel housing cavity */}
        <path d="M 194 44 Q 192 90 145 90 Q 98 90 96 44 Z" fill="#11181C" stroke="#0A0E11" strokeWidth={1} />
        {/* Rear wheel housing cavity */}
        <path d="M -96 44 Q -98 90 -145 90 Q -192 90 -194 44 Z" fill="#11181C" stroke="#0A0E11" strokeWidth={1} />
      </g>

      {/* 8. Main Exterior Body Shell (Ertiga 2023 Curves) */}
      <g data-part="body" opacity={shellOpacity}>
        {/* Rear Tailgate Panel (when closed) */}
        {tailgateOpen === 0 && (
          <g data-part="rear-fascia">
            {/* Lower bumper curved contour */}
            <Face
              vertices={[
                [-228, -76, 82],
                [-224, -76, 114],
                [-224, 76, 114],
                [-228, 76, 82],
                [-228, 76, 48],
                [-228, -76, 48],
              ]}
              fill={paint.dark}
            />

            {/* Rear Hatch Windshield Glass (curved slope) */}
            <Face
              vertices={[
                [-182, -70, 174],
                [-222, -74, 118],
                [-222, 74, 118],
                [-182, 70, 174],
              ]}
              fill={`url(#${id}-glass-grad)`}
              stroke={TRIM}
              strokeWidth={1.2}
            />

            {/* Rear window defroster lines */}
            {[-192, -202, -212].map((x) => (
              <Face
                key={`defrost-${x}`}
                vertices={[[x, -62, 160 + (x + 192) * 0.8], [x, 62, 160 + (x + 192) * 0.8], [x, 62, 159 + (x + 192) * 0.8], [x, -62, 159 + (x + 192) * 0.8]]}
                fill="#C67D5A"
                stroke="none"
                opacity={0.6}
              />
            ))}

            {/* Rear Wiper */}
            <Pipe route={[[-221, 0, 120], [-208, 18, 142]]} width={2.4} color="#182025" />

            {/* Chrome Tailgate Garnish Bar above license plate */}
            <Face vertices={[[-225, -34, 90], [-225, 34, 90], [-225, 34, 83], [-225, -34, 83]]} fill={CHROME} stroke={CHROME_SHADOW} strokeWidth={0.8} />

            {/* License plate recessed housing */}
            <Face vertices={[[-225.2, -24, 80], [-225.2, 24, 80], [-225.2, 24, 66], [-225.2, -24, 66]]} fill="#141C20" />
            <Face vertices={[[-225.4, -20, 78], [-225.4, 20, 78], [-225.4, 20, 68], [-225.4, -20, 68]]} fill="#F2F6F8" stroke="#182226" strokeWidth={0.6} />

            {/* Signature Ertiga L-shaped LED Tail Lamps (ascending up D-pillar) */}
            {[-76, 68].map((y) => (
              <g key={`taillight-${y}`}>
                {/* Horizontal lower pod */}
                <Face
                  vertices={[
                    [-225, y, 96],
                    [-225, y + 8, 96],
                    [-225, y + 8, 78],
                    [-225, y, 78],
                  ]}
                  fill="#C92626"
                  stroke="#681515"
                  strokeWidth={0.8}
                />
                {/* Vertical light blade climbing up D-pillar */}
                <Face
                  vertices={[
                    [-225, y, 134],
                    [-225, y + 4.5, 134],
                    [-225, y + 4.5, 96],
                    [-225, y, 96],
                  ]}
                  fill="#E53935"
                  stroke="#681515"
                  strokeWidth={0.8}
                />
              </g>
            ))}

            {/* Reverse & Turn Signals */}
            {[-75, 69].map((y) => (
              <Face
                key={`taillight-sig-${y}`}
                vertices={[
                  [-225.2, y, 94],
                  [-225.2, y + 6, 94],
                  [-225.2, y + 6, 86],
                  [-225.2, y, 86],
                ]}
                fill="#F7FAFC"
                stroke="#A0AEC0"
                strokeWidth={0.5}
              />
            ))}

            {/* Rear Bumper Corner Vertical Reflectors */}
            {[-72, 64].map((y) => (
              <g key={`refl-${y}`}>
                <Face vertices={[[-227, y - 1, 64], [-227, y + 5, 64], [-227, y + 5, 52], [-227, y - 1, 52]]} fill="#141C20" />
                <Face vertices={[[-227.2, y, 62], [-227.2, y + 4, 62], [-227.2, y + 4, 54], [-227.2, y, 54]]} fill="#EF4444" stroke="#991B1B" strokeWidth={0.5} />
              </g>
            ))}
          </g>
        )}

        {/* Front Windshield Glass with Ceramic Frit Border */}
        <Face
          vertices={[
            [68, -74, 174],
            [126, -74, 116],
            [126, 74, 116],
            [68, 74, 174],
          ]}
          fill={`url(#${id}-glass-grad)`}
          stroke={TRIM}
          strokeWidth={1.5}
        />
        {/* Dynamic diagonal sky reflection across windshield */}
        <Face
          vertices={[
            [72, -64, 170],
            [120, -64, 120],
            [120, -42, 120],
            [72, -42, 170],
          ]}
          fill="#D6EEF5"
          stroke="none"
          opacity={0.35}
        />

        {/* Aerodynamic Crowned Roof with Aero Ribs */}
        <Face
          vertices={[
            [-182, -76, 176],
            [68, -76, 176],
            [68, 76, 176],
            [-182, 76, 176],
          ]}
          fill={`url(#${id}-roof-grad)`}
        />
        {/* Roof longitudinal stiffening aero ribs (Ertiga 2023 signature) */}
        {[-44, -18, 18, 44].map((y) => (
          <Face
            key={`roof-rib-${y}`}
            vertices={[
              [-160, y - 2, 176.6],
              [48, y - 2, 176.6],
              [48, y + 2, 176.6],
              [-160, y + 2, 176.6],
            ]}
            fill={paint.highlight}
            stroke="none"
            opacity={0.65}
          />
        ))}

        {/* Shark Fin Antenna */}
        <g data-part="shark-fin-antenna">
          <Face
            vertices={[
              [-168, 0, 176],
              [-154, -2, 176],
              [-152, 0, 187],
              [-165, 2, 176],
            ]}
            fill={paint.dark}
            stroke={paint.edge}
            strokeWidth={0.8}
          />
        </g>

        {/* Rear Roof Spoiler Lip with LED High-Mount Stop Lamp */}
        <Face
          vertices={[
            [-190, -74, 180],
            [-180, -74, 176],
            [-180, 74, 176],
            [-190, 74, 180],
          ]}
          fill={paint.dark}
          stroke={paint.edge}
          strokeWidth={1}
        />
        <Face vertices={[[-189, -16, 178.5], [-189, 16, 178.5], [-189, 16, 176.8], [-189, -16, 176.8]]} fill="#E53935" />

        {/* Near Side Aerodynamic Flank Panel (Clipped for Windows) */}
        <g transform={sideTransform(81.5)} mask={`url(#${id}-window-cut)`}>
          {/* Smooth Continuous Bézier Side Silhouette matching 2023 Ertiga CAD */}
          <path
            d="M -228 48 
               L -228 76 
               Q -228 84 -224 88 
               L -220 116 
               L -182 172 
               Q -174 178 -162 178 
               L 66 178 
               Q 78 176 90 164 
               L 128 114 
               Q 146 112 186 106 
               Q 216 101 224 88 
               L 226 66 
               Q 227 52 224 48 
               L 190 48 
               Q 188 92 145 92 
               Q 102 92 100 48 
               L -100 48 
               Q -102 92 -145 92 
               Q -188 92 -190 48 
               Z"
            fill={paint.main}
            stroke={paint.edge}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />

          {/* Blacked-out window frame surrounds & D-pillar floating roof strip */}
          <path
            d="M -220 116 L -182 172 Q -174 178 -162 178 L 66 178 Q 78 176 90 164 L 128 114 Z"
            fill={TRIM}
            stroke={paint.edge}
            strokeWidth={1.2}
          />
          {/* Floating roof D-pillar black accent */}
          <polygon points="-162,176 -142,176 -170,122 -186,122" fill="#11181C" />

          {/* Concentric Flared Wheel Arch Creases (Lekukan Spakbor Fender Arches) */}
          <path d="M 194 48 Q 192 96 145 96 Q 98 96 96 48" fill="none" stroke={paint.light} strokeWidth={2} />
          <path d="M 191 48 Q 189 93 145 93 Q 101 93 99 48" fill="none" stroke={paint.shadow} strokeWidth={1} />
          <path d="M -96 48 Q -98 96 -145 96 Q -192 96 -194 48" fill="none" stroke={paint.light} strokeWidth={2} />
          <path d="M -99 48 Q -101 93 -145 93 Q -189 93 -191 48" fill="none" stroke={paint.shadow} strokeWidth={1} />

          {/* Shoulder crease flowing through both door handles into tail lamp */}
          <path d="M -220 101 L -174 101 M -98 101 L 98 101 M 188 98 L 222 92" fill="none" stroke={paint.highlight} strokeWidth={2.4} />

          {/* Dynamic lower door rocker concavity (Lekukan Pintu Bawah Ertiga) */}
          <path d="M 94 56 Q 0 53 -94 62" fill="none" stroke={paint.shadow} strokeWidth={2.6} />
          <path d="M 94 58 Q 0 55 -94 64" fill="none" stroke={paint.light} strokeWidth={1.5} />

          {/* Door panel shut lines */}
          <path d="M 4 122 L 4 48" fill="none" stroke={paint.edge} strokeWidth={1.2} />
          <path d="M -72 122 L -72 68 Q -72 58 -92 50" fill="none" stroke={paint.edge} strokeWidth={1.2} />
          <path d="M -180 122 L -180 82 L -220 82" fill="none" stroke={paint.edge} strokeWidth={1.1} />

          {/* Ergonomic pull door handles centered on shoulder crease */}
          <rect x={26} y={97.5} width={22} height={6.5} rx={3} fill={paint.light} stroke={paint.edge} strokeWidth={0.8} />
          <line x1={29} y1={100.5} x2={45} y2={100.5} stroke="#141C20" strokeWidth={1.2} />
          <rect x={-52} y={97.5} width={22} height={6.5} rx={3} fill={paint.light} stroke={paint.edge} strokeWidth={0.8} />
          <line x1={-49} y1={100.5} x2={-33} y2={100.5} stroke="#141C20" strokeWidth={1.2} />

          {/* Fuel filler flap on rear quarter */}
          <rect x={-168} y={88} width={18} height={16} rx={3} fill="none" stroke={paint.edge} strokeWidth={1} />

          {/* Side wrap-around tail lamp lens */}
          <path d="M -220 101 L -208 101 L -208 86 L -222 86 Z" fill="#DC2626" stroke="#991B1B" strokeWidth={0.8} />
          <path d="M -218 126 L -212 126 L -212 101 L -218 101 Z" fill="#EF4444" stroke="#991B1B" strokeWidth={0.6} />

          {/* Front fog lamp bezel profile */}
          <path d="M 224 74 L 210 74 L 206 54 L 222 54" fill="none" stroke="#141C20" strokeWidth={2} />
        </g>

        {/* Front Fascia: Ertiga 2023 Hexagonal Chrome Grille & Projector Headlights */}
        <g data-part="front-fascia">
          {/* Front nose curved face */}
          <Face
            vertices={[
              [226, -72, 94],
              [226, 72, 94],
              [226, 78, 84],
              [226, 78, 46],
              [226, -78, 46],
              [226, -78, 84],
            ]}
            fill={paint.dark}
          />
          {/* Lower air dam intake mesh */}
          <Face vertices={[[227, -58, 56], [227, 58, 56], [227, 58, 48], [227, -58, 48]]} fill="#141C20" />
          {/* Front silver aerodynamic chin spoiler */}
          <Face vertices={[[227.5, -36, 50], [227.5, 36, 50], [227.5, 36, 46], [227.5, -36, 46]]} fill="#BACAD0" stroke="#687A80" strokeWidth={0.8} />

          {/* Hexagonal Chrome Front Grille */}
          <Face vertices={[[227, -46, 88], [227, 46, 88], [227, 40, 64], [227, -40, 64]]} fill="#1A2429" />
          {/* Top thick chrome grille garnish */}
          <Face vertices={[[227.4, -48, 89], [227.4, 48, 89], [227.4, 46, 85], [227.4, -46, 85]]} fill={CHROME} stroke={CHROME_SHADOW} strokeWidth={0.8} />
          {/* 3 Horizontal Chrome Segmented Slats */}
          {[80, 75, 70].map((z) => (
            <Face
              key={`grille-slat-${z}`}
              vertices={[
                [227.3, -44, z + 1.8],
                [227.3, 44, z + 1.8],
                [227.3, 44, z],
                [227.3, -44, z],
              ]}
              fill={CHROME}
              stroke="none"
            />
          ))}

          {/* Swept-Back Crystal Projector LED Headlamps */}
          {/* Left Headlamp */}
          <Face
            vertices={[
              [227, -72, 90],
              [227, -48, 87],
              [227, -48, 74],
              [227, -72, 76],
            ]}
            fill={headlights ? '#FFF8C4' : '#E6EEF0'}
            stroke="#5A6D74"
            strokeWidth={1}
          />
          <Bolt at={[227.2, -60, 82]} color={headlights ? '#FFE359' : '#A0B2B6'} />
          {/* Left LED DRL Eyebrow */}
          <Face vertices={[[227.3, -71, 89], [227.3, -50, 86.5], [227.3, -50, 85], [227.3, -71, 87.5]]} fill={headlights ? '#FFFDE6' : '#FFFFFF'} stroke="none" />

          {/* Right Headlamp */}
          <Face
            vertices={[
              [227, 48, 87],
              [227, 72, 90],
              [227, 72, 76],
              [227, 48, 74],
            ]}
            fill={headlights ? '#FFF8C4' : '#E6EEF0'}
            stroke="#5A6D74"
            strokeWidth={1}
          />
          <Bolt at={[227.2, 60, 82]} color={headlights ? '#FFE359' : '#A0B2B6'} />
          {/* Right LED DRL Eyebrow */}
          <Face vertices={[[227.3, 50, 86.5], [227.3, 71, 89], [227.3, 71, 87.5], [227.3, 50, 85]]} fill={headlights ? '#FFFDE6' : '#FFFFFF'} stroke="none" />

          {/* Dynamic C-shaped Fog Lamp Bezels */}
          {[-66, 62].map((y) => (
            <g key={`fog-${y}`}>
              <Face vertices={[[227.2, y - 6, 62], [227.2, y + 6, 62], [227.2, y + 6, 54], [227.2, y - 6, 54]]} fill="#141C20" stroke="#3D4E54" strokeWidth={0.8} />
              <circle cx={projectCarPoint([227.4, y, 58]).x} cy={projectCarPoint([227.4, y, 58]).y} r={2.4} fill={headlights ? '#FFF9CC' : '#D0DEE2'} />
            </g>
          ))}
        </g>
      </g>

      {/* 9. Sculpted Curved Hood Assembly */}
      <g data-part="hood" opacity={shellOpacity}>
        <Face
          vertices={([
            [128, -76, 114],
            [216, -72, 102],
            [226, -68, 94],
            [226, 68, 94],
            [216, 72, 102],
            [128, 76, 114],
          ] as const).map(hoodPoint)}
          fill={`url(#${id}-hood-grad)`}
          stroke={paint.edge}
          strokeWidth={1.2}
        />
        {/* Hood twin aerodynamic character creases */}
        {[-40, 40].map((y) => (
          <Face
            key={`hood-crease-${y}`}
            vertices={([
              [132, y - 2, 114.5],
              [218, y - 2, 98],
              [218, y + 2, 98],
              [132, y + 2, 114.5],
            ] as const).map(hoodPoint)}
            fill={paint.highlight}
            stroke="none"
            opacity={0.7}
          />
        ))}
        {/* Hood Gas Struts when open */}
        {hoodOpen > 0 && [-70, 70].map((y) => (
          <Pipe
            key={`hood-strut-${y}`}
            route={[
              [140, y, 106],
              hoodPoint([180, y, 104]),
            ]}
            width={2.5}
            color="#CCD8DC"
          />
        ))}
      </g>

      {/* 10. Tailgate Hatchback (opens with tailgateOpen prop) */}
      {tailgateOpen > 0 && (
        <g data-part="tailgate-open" opacity={shellOpacity}>
          <Face
            vertices={([
              [-188, -78, 178],
              [-225, -78, 112],
              [-225, 78, 112],
              [-188, 78, 178],
            ] as const).map(tailgatePoint)}
            fill={paint.top}
            stroke={paint.edge}
            strokeWidth={1.3}
          />
          <Face
            vertices={([
              [-192, -68, 174],
              [-220, -68, 120],
              [-220, 68, 120],
              [-192, 68, 174],
            ] as const).map(tailgatePoint)}
            fill={`url(#${id}-glass-grad)`}
            stroke={TRIM}
            strokeWidth={1.2}
          />
          {[-76, 76].map((y) => (
            <Pipe
              key={`tailgate-strut-${y}`}
              route={[
                [-184, y, 160],
                tailgatePoint([-205, y, 130]),
              ]}
              width={2.5}
              color="#CCD8DC"
            />
          ))}
        </g>
      )}

      {/* Driver Door Open Assembly (if doorOpen > 0) */}
      {doorOpen > 0 && (
        <g data-part="driver-door-open" opacity={shellOpacity}>
          <Face
            vertices={([
              [4, 82, 122],
              [4, 82, 48],
              [92, 82, 48],
              [92, 82, 110],
            ] as const).map(doorPoint)}
            fill={paint.main}
            stroke={paint.edge}
            strokeWidth={1.3}
          />
          <Face
            vertices={([
              [4, 82, 122],
              [4, 82, 168],
              [70, 82, 168],
              [92, 82, 110],
            ] as const).map(doorPoint)}
            fill={`url(#${id}-glass-grad)`}
            stroke={TRIM}
            strokeWidth={1.2}
          />
        </g>
      )}

      {/* 11. 3-Row Side Windows with Lowering Mechanism */}
      <g
        data-part="side-windows"
        opacity={view === 'chassis' ? 0 : view === 'cutaway' ? 0.12 : 1}
        transform={sideTransform(82)}
      >
        <g clipPath={`url(#${id}-windows)`}>
          <g transform={`translate(0 ${-open * 64})`}>
            {/* Tinted glass background */}
            <path d={sideWindowPath} fill={`url(#${id}-glass-grad)`} />
            {/* Diagonal sheen reflections across all 3 rows */}
            <path
              d="M -150 122 L -110 168 L -85 168 L -125 122 Z M -50 122 L -10 168 L 10 168 L -30 122 Z M 20 122 L 60 168 L 72 168 L 32 122 Z"
              fill="#D6EEF5"
              opacity={0.3}
            />
            {/* Dark sunshade top tint band */}
            <path d="M -175 166 L 70 166" stroke="#162930" strokeWidth={3} />
          </g>
        </g>
        {/* Window borders & division pillars */}
        <path d={sideWindowPath} fill="none" stroke="#162228" strokeWidth={1.6} />
        {/* A-pillar delta bar */}
        <line x1={91} y1={120} x2={91} y2={156} stroke={TRIM} strokeWidth={4} />
        {/* B-Pillar */}
        <line x1={-1} y1={120} x2={-1} y2={170} stroke={TRIM} strokeWidth={8} />
        {/* C-Pillar */}
        <line x1={-77} y1={120} x2={-77} y2={170} stroke={TRIM} strokeWidth={8} />
      </g>

      {/* 12. Near Side Wheels (tucked neatly into dark wheel housing tubs) */}
      <g opacity={wheelsOpacity}>
        <ErtigaWheel x={-145} y={82} angle={rotation} />
        <ErtigaWheel x={145} y={82} angle={rotation} />
      </g>

      {/* 13. Flag-Mounted Door Mirror with Amber LED Turn Signal */}
      <g data-part="side-mirror" opacity={shellOpacity}>
        {/* Mirror mount base on front door skin */}
        <Face
          vertices={[
            [104, 82, 116],
            [110, 98, 115],
            [100, 106, 124],
            [94, 90, 126],
          ]}
          fill={paint.light}
          stroke={paint.edge}
          strokeWidth={0.8}
        />
        {/* Inner black bezel */}
        <Face
          vertices={[
            [110, 98, 115],
            [100, 106, 124],
            [100, 106, 117],
            [110, 98, 110],
          ]}
          fill={TRIM}
        />
        {/* Integrated amber LED turn signal strip */}
        <Face
          vertices={[
            [106, 94, 118],
            [102, 102, 122],
            [102, 102, 119],
            [106, 94, 116],
          ]}
          fill="#F59E0B"
          stroke="none"
        />
      </g>
    </svg>
  );
};
