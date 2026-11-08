import React from 'react';

import { Surface, Block, Pipe, Bolt, Spring, Brake } from './car-svg-parts';
import { ElectricUnderfloor } from './ElectricCarMechanics';

const COS_30 = Math.sqrt(3) / 2;
const OUTLINE = '#2F3B40';

/** Simplified front-engine, rear-wheel-drive layout, independent of the painted shell. */
export const CarUnderbody: React.FC<{ powertrain?: 'petrol' | 'electric'; batteryCoverOpacity?: number }> = ({ powertrain = 'petrol', batteryCoverOpacity = 0.15 }) => (
  <g data-part="underbody">
    <g data-part="chassis-rails">
      {[-60, 50].map((y) => <Block key={y} at={[-202, y, 25]} size={[404, 10, 12]} color="#5F7379" top="#8C9B9D" side="#3E525A" />)}
      {[-174, -75, 40, 149, 190].map((x) => <Block key={x} at={[x, -60, 26]} size={[10, 120, 8]} color="#738589" top="#A9B4B3" />)}
      {[-174, -75, 40, 149].flatMap((x) => [-55, 55].map((y) => <Bolt key={`${x}-${y}`} at={[x + 5, y, 38]} />))}
    </g>

    {powertrain === 'petrol' ? <>
    <g data-part="fuel-tank">
      <Block at={[-95, -44, 30]} size={[72, 57, 15]} color="#82938C" top="#A6B2A7" side="#64766E" />
      {[-80, -43].map((x) => <Surface key={x} vertices={[[x, -44, 45.5], [x + 5, -44, 45.5], [x + 5, 13, 45.5], [x, 13, 45.5]]} color="#546A65" />)}
    </g>

    <g data-part="exhaust">
      <Pipe route={[[171, 29, 65], [179, 36, 48], [100, 36, 23], [40, 36, 23], [-70, 36, 23], [-155, 36, 23], [-200, 36, 23], [-220, 40, 21]]} width={5} color="#A3AAA5" />
      <Block at={[34, 28, 20]} size={[31, 15, 12]} color="#B9ADA0" top="#D4C9B9" />
      <Block at={[-145, 24, 17]} size={[51, 24, 17]} color="#A6AAA5" top="#D1D2C8" />
    </g>

    <g data-part="drivetrain">
      <Pipe route={[[-140, -82, 44], [-140, 82, 44]]} width={8} color="#667A80" />
      <Block at={[-154, -19, 32]} size={[29, 38, 24]} color="#60757C" top="#93A3A5" />
      <Pipe route={[[103, 0, 46], [-126, 0, 46]]} width={6} color="#A4B2B2" />
      {[-119, 82].map((x) => <Block key={x} at={[x, -6, 40]} size={[10, 12, 13]} color="#536970" />)}
      <g data-part="transmission">
        <Block at={[81, -13, 38]} size={[49, 26, 22]} color="#849396" top="#B2BDBA" />
        <Block at={[113, -20, 42]} size={[24, 40, 30]} color="#71858B" top="#A8B6B5" />
        {[90, 99, 108, 119].map((x) => <Pipe key={x} route={[[x, -13, 61], [x, 13, 61], [x, 13, 40]]} width={1.6} color="#CFD7D1" />)}
      </g>
    </g>

    </> : <ElectricUnderfloor coverOpacity={batteryCoverOpacity} />}

    <g data-part="front-subframe">
      <Pipe route={[[145, -83, 44], [145, 83, 44]]} width={5} color="#82969A" />
      {[-1, 1].map((sign) => <g key={sign}>
        <Pipe route={[[123, sign * 43, 30], [145, sign * 77, 38], [167, sign * 43, 30]]} width={4} color="#899A9B" />
        <Spring x={145} y={sign * 66} />
        <Spring x={-140} y={sign * 66} />
        <Brake x={145} y={sign * 85} />
        <Brake x={-140} y={sign * 85} />
      </g>)}
    </g>
  </g>
);

const Pulley: React.FC<{ y: number; z: number; radius: number; rotation: number }> = ({ y, z, radius, rotation }) => (
  <g transform={`translate(${y} ${z})`}>
    <circle r={radius} fill="#34464D" stroke="#A6B7B7" strokeWidth={1.4} />
    <g transform={`rotate(${rotation})`}>
      {[0, 120, 240].map((angle) => <path key={angle} transform={`rotate(${angle})`} d={`M 0 0 L ${radius - 2} 0`} stroke="#AABABA" strokeWidth={2} />)}
    </g>
    <circle r={2.3} fill="#CED8D2" stroke={OUTLINE} strokeWidth={0.6} />
  </g>
);

export const CarEngine: React.FC<{ rotation: number }> = ({ rotation }) => (
  <g data-part="engine-bay">
    <g data-part="radiator">
      <Block at={[207, -57, 48]} size={[6, 114, 45]} color="#74858A" top="#A9B6B4" side="#43575E" />
      {Array.from({ length: 13 }, (_, i) => <Pipe key={i} route={[[214, -50 + i * 8, 53], [214, -50 + i * 8, 88]]} width={1.4} color="#9AADA9" />)}
      <Pipe route={[[207, -41, 85], [195, -42, 90], [184, -23, 88]]} width={5} color="#34494B" />
      <Pipe route={[[207, 41, 54], [196, 42, 51], [180, 20, 55]]} width={5} color="#34494B" />
    </g>

    <g data-part="engine-block">
      <Block at={[134, -22, 53]} size={[58, 44, 34]} color="#87979B" top="#AEBBBC" side="#61777E" />
      <Block at={[137, -20, 44]} size={[48, 40, 10]} color="#4D626B" top="#73888F" />
      {[140, 153, 166, 179].map((x) => <g key={x}>
        <Pipe route={[[x, 22.5, 57], [x, 22.5, 82]]} width={2} color="#C7D0CA" />
        <Bolt at={[x, 23, 57]} />
      </g>)}
      <Block at={[132, -24, 86]} size={[62, 48, 8]} color="#8B9A9B" top="#C0CBC6" />
      <Block at={[137, -15, 94]} size={[52, 30, 8]} color="#A95B43" top="#D2865E" side="#7B483D" />
      {[143, 154, 165, 176].map((x) => <g key={x}>
        <Bolt at={[x, -7, 103]} color="#3C4B4A" />
        <Pipe route={[[x, 5, 103], [x, 11, 103]]} width={2.2} color="#593F38" />
      </g>)}
      <Bolt at={[182, -8, 103]} color="#DDC56B" />
    </g>

    <g data-part="intake">
      {[141, 154, 167, 180].map((x) => <Pipe key={x} route={[[x, -16, 89], [x, -29, 95], [x, -38, 87], [x, -38, 76]]} width={4} color="#A1B3B5" />)}
      <Block at={[132, -49, 70]} size={[54, 13, 12]} color="#82999D" top="#B3C0BE" />
      <Pipe route={[[136, -44, 78], [126, -44, 80], [126, -61, 80], [143, -61, 80]]} width={7} color="#3C5158" dashed />
      <Block at={[140, -72, 67]} size={[29, 22, 18]} color="#3D5056" top="#63797D" />
    </g>

    <g data-part="battery">
      <Block at={[173, -69, 60]} size={[28, 28, 22]} color="#40585B" top="#263D42" />
      <Block at={[177, -65, 82]} size={[5, 6, 4]} color="#B35B43" top="#D4835A" />
      <Block at={[192, -65, 82]} size={[5, 6, 4]} color="#334950" top="#92A3A5" />
      <Pipe route={[[179, -62, 85], [179, -37, 85], [185, -25, 74]]} width={1.8} color="#AC604A" />
    </g>

    <g data-part="coolant-reservoir">
      <Block at={[189, 42, 65]} size={[15, 24, 20]} color="#BBCAC1" top="#D9E1CE" />
      <Block at={[193, 48, 85]} size={[7, 9, 3]} color="#B49A4D" top="#D5BF70" />
    </g>

    <g data-part="ac-compressor">
      <Block at={[166, 30, 53]} size={[26, 22, 23]} color="#708A8C" top="#A1B8B3" />
      <Pipe route={[[170, 48, 71], [153, 55, 76], [133, 55, 90], [128, 55, 103]]} width={2.8} color="#B2C5C3" />
      <Pipe route={[[177, 49, 64], [188, 58, 59], [207, 58, 54]]} width={2.4} color="#789594" />
    </g>

    <g data-part="accessory-belt" transform={`matrix(${-COS_30} 0.5 0 -1 ${380 + 195 * COS_30} ${300 + 195 / 2})`}>
      <path d="M -18 87 Q -30 88 -30 76 L -14 52 Q -4 43 6 51 L 39 56 Q 49 58 47 69 Q 46 79 36 79 Z" fill="none" stroke="#1B2F36" strokeWidth={3.8} strokeLinejoin="round" />
      <Pulley y={-19} z={76} radius={9} rotation={rotation * 1.4} />
      <Pulley y={-4} z={58} radius={10} rotation={rotation} />
      <Pulley y={37} z={67} radius={9} rotation={rotation * 1.1} />
    </g>
  </g>
);
