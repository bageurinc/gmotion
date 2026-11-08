import React from 'react';
import { Block, Bolt, Pipe, Surface } from './car-svg-parts';
import { carPoints, projectCarPoint, type CarPoint } from './car-geometry';

export const ISO_ELECTRIC_CAR_ANCHORS = {
  tractionBattery: [-10, 0, 62],
  batteryModules: [-45, 22, 60],
  electricMotor: [145, 0, 62],
  inverter: [166, -6, 92],
  reductionGear: [149, 44, 62],
  onboardCharger: [143, 49, 85],
  chargePort: [-195, 84, 95],
  cooling: [210, 0, 88],
} as const satisfies Record<string, CarPoint>;

export const ElectricUnderfloor: React.FC<{ coverOpacity: number }> = ({ coverOpacity }) => (
  <g data-part="electric-underfloor">
    <g data-part="traction-battery">
      <Block at={[-117, -61, 33]} size={[224, 122, 9]} color="#516A6C" top="#829B98" side="#344E55" />
      <Block at={[-113, -57, 42]} size={[216, 114, 9]} color="#718B83" top="#99B5A0" />
      <g data-part="battery-modules">
        {Array.from({ length: 5 }, (_, x) => [-1, 1].map((side) => (
          <g key={`${x}-${side}`}>
            <Block at={[-107 + x * 41, side < 0 ? -51 : 5, 51]} size={[35, 46, 9]} color="#3E8072" top="#72A88B" side="#32685D" />
            {[0, 1, 2, 3].map((cell) => <Pipe key={cell} route={[[-101 + x * 41 + cell * 7, side < 0 ? -46 : 10, 61], [-101 + x * 41 + cell * 7, side < 0 ? -10 : 46, 61]]} width={1} color="#B4CABC" />)}
            <Bolt at={[-78 + x * 41, side < 0 ? -47 : 9, 61]} color="#D5AE66" />
          </g>
        )))}
      </g>
      <g data-part="battery-cover" opacity={coverOpacity}>
        <Block at={[-114, -58, 62]} size={[218, 116, 3]} color="#6F9693" top="#BDD0C8" side="#4A7371" />
        {[-101, -61, -21, 19, 59, 94].map((x) => <Pipe key={x} route={[[x, -53, 65.5], [x, 53, 65.5]]} width={1.2} color="#5F807A" />)}
      </g>
      {[-117, 103].flatMap((x) => [-55, 0, 55].map((y) => <Bolt key={`${x}-${y}`} at={[x, y, 43]} />))}
      <Block at={[86, -18, 62]} size={[18, 36, 9]} color="#A05F37" top="#D8A15C" />
    </g>
    <g data-part="high-voltage-cables">
      <Pipe route={[[99, -10, 69], [118, -10, 69], [126, -35, 77], [161, -35, 84]]} width={4.5} color="#D77D36" />
      <Pipe route={[[99, -2, 69], [121, -2, 69], [133, -27, 77], [164, -27, 84]]} width={3} color="#D77D36" />
      <Pipe route={[[-109, 43, 49], [-177, 43, 49], [-194, 69, 67], [-195, 83, 94]]} width={3} color="#D77D36" />
    </g>
    <g data-part="battery-cooling">
      <Pipe route={[[97, -54, 47], [125, -54, 48], [189, -54, 49], [207, -42, 54]]} width={2.8} color="#659CA5" />
      <Pipe route={[[97, 54, 47], [119, 54, 47], [194, 58, 51], [207, 42, 54]]} width={2.8} color="#659CA5" />
    </g>
  </g>
);

export const ElectricDriveUnit: React.FC<{ rotation: number }> = ({ rotation }) => (
  <g data-part="electric-drive-unit">
    <g data-part="ev-cooling-radiator">
      <Block at={[207, -57, 48]} size={[6, 114, 43]} color="#71898C" top="#ACBDB6" side="#4D696F" />
      {Array.from({ length: 13 }, (_, i) => <Pipe key={i} route={[[214, -50 + i * 8, 53], [214, -50 + i * 8, 86]]} width={1.1} color="#A4BAB4" />)}
    </g>

    <g data-part="electric-motor">
      <Surface vertices={Array.from({ length: 21 }, (_, i): CarPoint => {
        const a = Math.PI * i / 20;
        return [145 + Math.cos(a) * 22, -34, 60 + Math.sin(a) * 22];
      }).concat(Array.from({ length: 21 }, (_, i): CarPoint => {
        const a = Math.PI - Math.PI * i / 20;
        return [145 + Math.cos(a) * 22, 29, 60 + Math.sin(a) * 22];
      }))} color="#839B9C" />
      {[-28, -17, -6, 5, 16].map((y) => <Pipe key={y} route={Array.from({ length: 19 }, (_, i): CarPoint => {
        const a = Math.PI * i / 18;
        return [145 + Math.cos(a) * 22.5, y, 60 + Math.sin(a) * 22.5];
      })} width={1.2} color="#C3D0C9" />)}
      <g transform={`matrix(${Math.sqrt(3) / 2} 0.5 0 -1 ${380 - 30 * Math.sqrt(3) / 2} 315)`}>
        <circle cx={145} cy={60} r={22} fill="#687F86" stroke="#324C54" strokeWidth={1.2} />
        <circle cx={145} cy={60} r={15} fill="#91AAA7" stroke="#C3D0C9" />
        <g transform={`translate(145 60) rotate(${rotation})`}>
          {[0, 90, 180, 270].map((angle) => <path key={angle} d="M 5 0 H 12" transform={`rotate(${angle})`} stroke="#48636B" strokeWidth={2.4} />)}
        </g>
        <circle cx={145} cy={60} r={5} fill="#D1DBCF" />
      </g>
    </g>

    <g data-part="reduction-gear">
      <Block at={[134, 32, 38]} size={[33, 27, 26]} color="#6F898C" top="#A8BCB4" />
      <Pipe route={[[145, -80, 44], [145, -34, 44]]} width={5.5} color="#9EAEAD" />
      <Pipe route={[[149, 58, 44], [145, 81, 44]]} width={5.5} color="#9EAEAD" />
    </g>

    <g data-part="inverter">
      <Block at={[151, -29, 80]} size={[37, 49, 13]} color="#6D9996" top="#B2CBC0" side="#4A7475" />
      {[157, 163, 169, 175, 181].map((x) => <Pipe key={x} route={[[x, -25, 94], [x, 15, 94]]} width={1.3} color="#527C79" />)}
      {[-16, -6, 4].map((y) => <Pipe key={y} route={[[157, y, 81], [148, y, 81], [137, y, 74]]} width={2.4} color="#D77D36" />)}
      <Bolt at={[155, -24, 94]} /><Bolt at={[183, 15, 94]} />
    </g>

    <g data-part="onboard-charger">
      <Block at={[130, 34, 73]} size={[28, 29, 12]} color="#6E9495" top="#A7C0B6" />
      {[136, 142, 148, 154].map((x) => <Pipe key={x} route={[[x, 38, 86], [x, 58, 86]]} width={1.1} color="#456A70" />)}
      <Pipe route={[[131, 42, 79], [118, 42, 77], [103, 33, 69]]} width={3} color="#D77D36" />
    </g>

    <g data-part="auxiliary-battery">
      <Block at={[173, -69, 60]} size={[28, 28, 22]} color="#40585B" top="#263D42" />
      <Bolt at={[179, -62, 83]} color="#D18457" /><Bolt at={[194, -62, 83]} />
    </g>
    <g data-part="ev-coolant-reservoir">
      <Block at={[189, 42, 65]} size={[15, 24, 20]} color="#BBCAC1" top="#D9E1CE" />
      <Block at={[193, 48, 85]} size={[7, 9, 3]} color="#B49A4D" top="#D5BF70" />
    </g>
  </g>
);

export const ElectricEnergyFlow: React.FC<{ phase: number }> = ({ phase }) => {
  const route: CarPoint[] = [[-65, -10, 69], [99, -10, 69], [118, -10, 69], [126, -35, 80], [166, -16, 96], [145, 15, 83], [145, 49, 66], [145, 83, 44]];
  const projected = route.map(projectCarPoint);
  const lengths = projected.slice(1).map((p, i) => Math.hypot(p.x - projected[i].x, p.y - projected[i].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const normalized = Number.isFinite(phase) ? ((phase % 1) + 1) % 1 : 0;
  return <g data-part="electric-energy-flow">
    <polyline points={carPoints(route)} fill="none" stroke="#D69D43" strokeOpacity={0.65} strokeWidth={2} />
    {Array.from({ length: 7 }, (_, index) => {
      let distance = ((normalized + index / 7) % 1) * total;
      let segment = 0;
      while (segment < lengths.length - 1 && distance > lengths[segment]) distance -= lengths[segment++];
      const t = distance / lengths[segment];
      const a = projected[segment];
      const b = projected[segment + 1];
      return <circle key={index} cx={a.x + (b.x - a.x) * t} cy={a.y + (b.y - a.y) * t} r={3} fill="#EAC25F" stroke="#684D28" strokeWidth={0.7} />;
    })}
  </g>;
};
