import React from 'react';
import { projectCarPoint } from './car-geometry';

const COS_30 = Math.sqrt(3) / 2;

export const ISO_HOME_AC_REMOTE_MODES = ['cool', 'dry', 'fan', 'auto'] as const;
export const ISO_HOME_AC_REMOTE_BUTTONS = ['power', 'temperature-up', 'temperature-down', 'mode'] as const;
type Mode = (typeof ISO_HOME_AC_REMOTE_MODES)[number];
type Button = (typeof ISO_HOME_AC_REMOTE_BUTTONS)[number];
const MODES: Record<Mode, string> = { cool: 'COOL', dry: 'DRY', fan: 'FAN', auto: 'AUTO' };

export const ISO_HOME_AC_REMOTE_ANCHORS = {
  display: [0, -81, 18],
  power: [-28, -25, 18],
  mode: [27, -25, 18],
  temperatureUp: [0, 26, 18],
  temperatureDown: [0, 64, 18],
  transmitter: [0, -137, 18],
} as const;

const BUTTONS: { id: Button; x: number; y: number; path: string }[] = [
  { id: 'power', x: -28, y: -25, path: 'M 0 -8 V -1 M -4 -5 A 6 6 0 1 0 4 -5' },
  { id: 'mode', x: 27, y: -25, path: 'M -6 -5 H 6 M -6 0 H 6 M -6 5 H 6' },
  { id: 'temperature-up', x: 0, y: 26, path: 'M -6 3 L 0 -3 L 6 3' },
  { id: 'temperature-down', x: 0, y: 64, path: 'M -6 -3 L 0 3 L 6 -3' },
];

export interface IsoHomeACRemoteProps extends React.SVGProps<SVGSVGElement> {
  temperature?: number;
  mode?: Mode;
  displayOn?: boolean;
  button?: Button;
  press?: number;
  title?: string;
}

export function IsoHomeACRemote({
  temperature = 24, mode = 'cool', displayOn = true, button = 'power', press = 0, title, ...svg
}: IsoHomeACRemoteProps) {
  const origin = projectCarPoint([0, 0, 0]);
  return (
    <svg width="100%" height="100%" {...svg} viewBox="0 0 760 480" role="img">
      <title>{title ?? 'Remote AC rumah'}</title>
      <g transform={`matrix(${COS_30} 0.5 ${-COS_30} 0.5 ${origin.x} ${origin.y})`}>
        <rect x={-59} y={-134} width={118} height={280} rx={25} fill="#375762" opacity={0.14} />
        <g>
          <rect x={-56} y={-136} width={112} height={272} rx={23} fill="#849AA4" stroke="#3E5964" strokeWidth={2} />
          <g transform="translate(-18 -18)">
            <rect x={-56} y={-136} width={112} height={272} rx={23} fill="#EBF1F2" stroke="#526F7B" strokeWidth={2} />
            <rect x={-18} y={-138} width={36} height={10} rx={4} fill="#314D5D" stroke="#546E77" />
            <rect x={-45} y={-120} width={90} height={76} rx={10} fill="#596F71" />
            <rect x={-40} y={-115} width={80} height={66} rx={6} fill={displayOn ? '#C2D8BC' : '#9CAF9D'} />
            {displayOn && (
              <g fill="#233D39" fontFamily="monospace">
                <text x={-29} y={-77} fontWeight={700} fontSize={31}>{Math.round(temperature)}</text>
                <text x={17} y={-85} fontSize={13}>°C</text>
                <text x={-28} y={-58} fontSize={11} fontWeight={700} letterSpacing={2}>{MODES[mode]}</text>
              </g>
            )}
            <rect x={-29} y={5} width={58} height={80} rx={19} fill="#C9D7DB" stroke="#A3B6BF" />
            {BUTTONS.map(({ id, x, y, path }) => {
              const depth = button === id ? press : 0;
              return (
                <g key={id} data-part={id} transform={`translate(${x + depth * 2} ${y + depth * 2})`}>
                  <rect x={-20} y={-13} width={40} height={26} rx={9} fill={id === 'power' ? '#C65442' : '#F9FCFC'} stroke="#8198A2" />
                  <path d={path} fill="none" stroke={id === 'power' ? '#FFF' : '#345562'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </g>
              );
            })}
            <path d="M -16 109 H 16 M -11 115 H 11" stroke="#A6B9C1" strokeWidth={2} strokeLinecap="round" />
            {press > 0 && [10, 17, 24].map((offset, index) => (
              <path key={offset} d={`M ${-10 - index * 5} ${-137 - offset} Q 0 ${-146 - offset} ${10 + index * 5} ${-137 - offset}`} fill="none" stroke="#2386A6" strokeWidth={2} opacity={press} />
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
}
