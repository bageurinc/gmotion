/** A small valid draft: the format example the model sees, and a test fixture. */
export const EXAMPLE_DRAFT_CODE = `import React from 'react';
import { Block, Cylinder, projectPoint, shade } from '@/motion-kit/isometric/draft-kit';

export default function Asset({ variant = 'single', state = 'off', poleColor = '#5B676B' }: Record<string, any>) {
  const heads = variant === 'double' ? [0, 90] : [0];
  const glow = state === 'on' ? '#F2C14E' : '#3A4448';
  const lamp = projectPoint([0, 30, 250]);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 480">
      <Cylinder at={[0, 0, 0]} radius={10} height={220} color={poleColor} />
      {heads.map((offset) => <Block key={offset} at={[-25, -15 + offset, 220]} size={[50, 30, 60]} color={shade(poleColor, 0.2)} />)}
      <circle cx={lamp.x} cy={lamp.y} r={12} fill={glow} />
    </svg>
  );
}
`;

export const EXAMPLE_DRAFT_META = {
  label: 'Tiang lampu contoh',
  aliases: ['tiang lampu'],
  defaultVariant: 'single',
  variants: {
    single: { label: 'Satu kepala', capabilities: ['pole', 'lamp'], anchors: { lamp: [0, 30, 250] }, limitations: [] },
    double: { label: 'Dua kepala', capabilities: ['pole', 'lamp'], anchors: { lamp: [0, 30, 250] }, limitations: [] },
  },
  props: {
    state: { type: 'enum', values: ['off', 'on'], default: 'off', description: 'Lamp state' },
    poleColor: { type: 'color', default: '#5B676B', material: 'material.metal', description: 'Pole color' },
  },
  limitations: ['Illustrative only'],
};
