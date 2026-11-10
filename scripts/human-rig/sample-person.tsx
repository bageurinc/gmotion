import React from 'react';

/**
 * Hand-drawn skin for the HumanRig spike: a person in a shirt and trousers, side view facing +x.
 * Each slot is drawn in its bone's local space for height 780 (bones point down +y from the joint at 0,0;
 * torso, neck, and head point up -y). Shapes overrun each joint so rotation never opens a gap.
 */
const SKIN = '#b9825c';
const SKIN_DARK = '#8a5a3c';
const SHIRT = '#3f7fa8';
const SHIRT_DARK = '#2b5c7c';
const PANTS = '#3a3f4b';
const PANTS_DARK = '#272b33';
const SHOE = '#2a1d17';
const HAIR = '#231815';
const id = (name: string) => `asset-world-sampleperson-${name}`;

const Defs = () => (
  <defs>
    <linearGradient id={id('shirt')} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor={SHIRT_DARK} />
      <stop offset="55%" stopColor={SHIRT} />
      <stop offset="100%" stopColor="#5b9cc4" />
    </linearGradient>
    <linearGradient id={id('pants')} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor={PANTS_DARK} />
      <stop offset="60%" stopColor={PANTS} />
      <stop offset="100%" stopColor="#4c5363" />
    </linearGradient>
    <linearGradient id={id('skin')} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor={SKIN_DARK} />
      <stop offset="60%" stopColor={SKIN} />
      <stop offset="100%" stopColor="#d39f78" />
    </linearGradient>
  </defs>
);

export const samplePersonParts = {
  thigh: (
    <g>
      <path d="M -33 -22 C -36 40, -30 130, -24 200 C -10 208, 12 208, 24 200 C 30 130, 36 40, 33 -22 C 10 -30, -10 -30, -33 -22 Z" fill={`url(#${id('pants')})`} stroke={PANTS_DARK} strokeWidth="2" />
      <path d="M 8 30 C 14 80, 14 130, 10 180" stroke={PANTS_DARK} strokeWidth="2" fill="none" opacity="0.6" />
    </g>
  ),
  shin: (
    <g>
      <path d="M -25 -16 C -24 50, -20 130, -18 186 C -6 192, 8 192, 19 186 C 22 130, 26 50, 25 -16 C 8 -24, -8 -24, -25 -16 Z" fill={`url(#${id('pants')})`} stroke={PANTS_DARK} strokeWidth="2" />
      <path d="M -18 172 C -6 178, 8 178, 19 172" stroke={PANTS_DARK} strokeWidth="2" fill="none" />
    </g>
  ),
  foot: (
    <g>
      <path d="M -27 4 C -30 18, -30 30, -26 35 L 86 35 C 94 35, 96 26, 88 20 C 70 10, 44 4, 22 -4 C 6 -10, -16 -8, -27 4 Z" fill={SHOE} stroke="#120c09" strokeWidth="2" />
      <path d="M -26 30 L 90 30" stroke="#4a372d" strokeWidth="3" />
    </g>
  ),
  pelvis: (
    <g>
      <path d="M -40 -46 C -44 -10, -40 22, -30 34 C 0 42, 30 40, 42 30 C 48 6, 46 -22, 42 -46 Z" fill={`url(#${id('pants')})`} stroke={PANTS_DARK} strokeWidth="2" />
      <rect x="-41" y="-50" width="84" height="12" rx="4" fill="#5a3b28" />
      <rect x="20" y="-51" width="12" height="14" rx="2" fill="#c9a24a" />
    </g>
  ),
  torso: (
    <g>
      <path d="M -38 -30 C -46 -90, -44 -170, -34 -222 C -10 -236, 24 -236, 40 -222 C 52 -180, 54 -110, 46 -30 C 20 -20, -14 -20, -38 -30 Z" fill={`url(#${id('shirt')})`} stroke={SHIRT_DARK} strokeWidth="2.2" />
      <path d="M 30 -210 C 34 -160, 36 -100, 34 -40" stroke={SHIRT_DARK} strokeWidth="2" fill="none" />
      {[-190, -150, -110, -70].map((y) => <circle key={y} cx="34" cy={y} r="3" fill="#e8eef2" />)}
      <path d="M -6 -228 L 18 -206 L 34 -226 Z" fill="#e8eef2" stroke={SHIRT_DARK} strokeWidth="1.5" />
    </g>
  ),
  neck: <path d="M -14 8 L -12 -36 L 14 -36 L 16 8 Z" fill={`url(#${id('skin')})`} stroke={SKIN_DARK} strokeWidth="1.5" />,
  head: (
    <g>
      <Defs />
      <path d="M -40 -40 C -46 -80, -26 -108, 6 -106 C 38 -104, 50 -78, 48 -52 C 50 -44, 58 -38, 54 -32 C 50 -28, 46 -28, 46 -22 C 46 -6, 32 6, 12 6 C -6 6, -20 0, -26 -10 C -38 -18, -40 -28, -40 -40 Z" fill={`url(#${id('skin')})`} stroke={SKIN_DARK} strokeWidth="2" />
      <path d="M -44 -42 C -50 -88, -20 -116, 14 -110 C 40 -106, 52 -90, 50 -72 C 30 -84, 10 -80, -6 -72 C -14 -60, -18 -48, -26 -40 Z" fill={HAIR} />
      <ellipse cx="-14" cy="-44" rx="8" ry="11" fill={SKIN_DARK} />
      <circle cx="32" cy="-56" r="4" fill="#1b1310" />
      <path d="M 24 -68 C 30 -71, 38 -70, 42 -66" stroke={HAIR} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M 30 -18 C 36 -16, 40 -18, 42 -20" stroke="#6e3d2b" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </g>
  ),
  upperArm: (
    <path d="M -20 -18 C -22 40, -18 100, -15 150 C -5 156, 7 156, 15 150 C 18 100, 22 40, 20 -18 C 6 -26, -6 -26, -20 -18 Z" fill={`url(#${id('shirt')})`} stroke={SHIRT_DARK} strokeWidth="2" />
  ),
  foreArm: (
    <g>
      <path d="M -15 -12 C -14 40, -12 90, -10 124 C -3 128, 4 128, 10 124 C 12 90, 15 40, 15 -12 C 4 -18, -4 -18, -15 -12 Z" fill={`url(#${id('shirt')})`} stroke={SHIRT_DARK} strokeWidth="2" />
      <rect x="-12" y="100" width="24" height="12" rx="3" fill="#e8eef2" />
    </g>
  ),
  hand: (
    <path d="M -10 -6 C -14 14, -12 40, -6 62 C -2 70, 8 70, 10 60 C 14 40, 14 16, 11 -6 C 4 -10, -4 -10, -10 -6 Z M 9 10 C 18 18, 20 30, 14 36" fill={`url(#${id('skin')})`} stroke={SKIN_DARK} strokeWidth="1.8" />
  ),
};

/** Phone held in the hand: drawn along +y from the grip. */
export const SamplePhone = () => (
  <g>
    <rect x="-14" y="-10" width="28" height="56" rx="5" fill="#15171c" stroke="#05060a" strokeWidth="1.5" />
    <rect x="-11" y="-6" width="22" height="46" rx="3" fill="#5fb2ff" opacity="0.9" />
  </g>
);

/** Rifle held in the near hand: barrel toward +y, stock toward -y. */
export const SampleRifle = () => (
  <g>
    <path d="M -9 -150 L 9 -150 L 12 -40 L 6 20 L -6 20 L -10 -40 Z" fill="#5a3724" stroke="#24120a" strokeWidth="2" />
    <rect x="-3.5" y="10" width="7" height="300" rx="3" fill="#7d8896" stroke="#3a424d" strokeWidth="1.5" />
    <path d="M -2 310 L 0 360 L 2 310 Z" fill="#c9d2dc" />
  </g>
);
