import type { IsoCanvasFiles } from '../contract';

/** A small valid isometric canvas video: one desk fan in a room, one world and one detail scene. */
export const KIPAS_FILES: IsoCanvasFiles = {
  'IsoObjects.ts': `import type { Iso } from '@/motion-kit';

export function drawKipas(iso: Iso, state: Record<string, number>) {
  const spin = state.putar ?? 0;
  iso.shadow(-1, -1, 2, 2);
  iso.cyl('z', 0, 0, 0, 1, 0.2, '#E2E8F0');
  iso.cyl('z', 0, 0, 0.2, 0.15, 2.4, '#CBD5E1');
  iso.rotate('y', spin, [0, 0.3, 2.8], () => {
    for (let i = 0; i < 3; i += 1) {
      iso.rotate('y', (i * Math.PI * 2) / 3, [0, 0.3, 2.8], () => iso.box(-0.15, 0.25, 2.8, 0.3, 0.05, 1, '#38BDF8'));
    }
  });
}
`,
  'IsoWorld.ts': `import type { Iso, IsoStates } from '@/motion-kit';
import { drawKipas } from './IsoObjects';

export function drawWorld(iso: Iso, t: number, states: IsoStates) {
  iso.background('#EEF2F7', '#DCE4EE');
  iso.ground('#D9C3A5');
  iso.at(0, 0, 0, () => drawKipas(iso, { putar: (states.kipas?.putar ?? 0) * t * 12 }));
}
`,
  'IsoScenes.ts': `import type { IsoSceneSpec } from '@/motion-kit';
import { drawKipas } from './IsoObjects';

export const scenes: IsoSceneSpec[] = [
  {
    kind: 'world',
    start: 0,
    duration: 3,
    camera: [{ at: 0, look: [0, 0, 1.5], zoom: 120 }, { at: 3, look: [0, 0, 2.5], zoom: 160 }],
    states: { kipas: { putar: 0 } },
    changes: [{ object: 'kipas', key: 'putar', to: 1, from: 0.5, until: 1.5 }],
    labels: [{ at: [0, 0.3, 2.8], text: 'Baling-baling', from: 1, to: 3 }],
  },
  {
    kind: 'detail',
    start: 3,
    duration: 2,
    draw: (iso, t) => {
      iso.background('#F8FAFC');
      iso.look(0, 0, 2.8, 260);
      drawKipas(iso, { putar: t * 10 });
    },
  },
];
`,
};
