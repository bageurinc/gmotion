import { describe, expect, it } from 'vitest';
import { mixColor } from '@/motion-kit/iso-canvas/engine';
import { LABEL_FORBIDDEN, objectProblems } from './build';
import { validateIsoCanvasFile } from './contract';
import type { IsoCanvasObject } from './plan';
import { dryRunIsoCanvas } from './dry-run';
import { EXAMPLE_AC_INDOOR, EXAMPLE_AC_OUTDOOR, EXAMPLE_WORLD, ISO_STYLE } from './examples';
import { DETAIL_SYSTEM, OBJECT_SYSTEM, WORLD_SYSTEM } from './prompts';

// The examples are shown to the model as the bar to reach, so they must pass every check the
// model's own code has to pass.
const files = {
  'IsoObjects.ts': `import type { Iso } from '@/motion-kit';\n\n${EXAMPLE_AC_OUTDOOR}\n\n${EXAMPLE_AC_INDOOR}\n`,
  'IsoWorld.ts': `import type { Iso, IsoStates } from '@/motion-kit';\nimport { drawAcIndoor } from './IsoObjects';\n\n${EXAMPLE_WORLD}\n`,
  'IsoScenes.ts': `import type { Iso, IsoSceneSpec } from '@/motion-kit';
import { drawAcOutdoor } from './IsoObjects';

export const scenes: IsoSceneSpec[] = [
  { kind: 'world', start: 0, duration: 2, camera: [{ at: 0, look: [0, -1.6, 1], zoom: 150 }], states: { 'ac-indoor': { nyala: 0 } }, changes: [{ object: 'ac-indoor', key: 'nyala', to: 1, from: 0.5, until: 1.5 }] },
  { kind: 'detail', start: 2, duration: 2, draw: (iso: Iso, t: number) => { iso.background('#F1F5F9'); iso.look(0, 0, 0.3, 600); iso.ground('#E2E8F0'); drawAcOutdoor(iso, { nyala: 1 }, t); } },
];
`,
};

describe('iso canvas house examples', () => {
  it('pass the validator and the dry run like model code', () => {
    for (const [name, code] of Object.entries(files)) expect(validateIsoCanvasFile(name as keyof typeof files, code).errors).toEqual([]);
    const report = dryRunIsoCanvas(files);
    expect(report.problems).toEqual([]);
    expect(report.drawCalls).toBeGreaterThan(100);
  });

  it('reach every writer prompt', () => {
    expect(OBJECT_SYSTEM).toContain(ISO_STYLE);
    expect(OBJECT_SYSTEM).toContain('export function drawAcOutdoor');
    expect(OBJECT_SYSTEM).toContain('export function drawAcIndoor');
    expect(WORLD_SYSTEM).toContain('export function drawWorld');
    expect(WORLD_SYSTEM).toContain(ISO_STYLE);
    expect(DETAIL_SYSTEM).toContain(ISO_STYLE);
  });
});

describe('labels outside scenes', () => {
  const object = { id: 'ac-indoor', label: 'AC', look: 'A wall-mounted split air conditioner unit.', size: [0.9, 0.25, 0.3], at: [0, 0, 2], states: [{ key: 'nyala', meaning: 'off to on' }] } as IsoCanvasObject;

  it('sends object code with a label back to the model', () => {
    expect(objectProblems(object, EXAMPLE_AC_INDOOR)).toEqual([]);
    const labelled = EXAMPLE_AC_INDOOR.replace("const on = state.nyala ?? 0;", "const on = state.nyala ?? 0;\n  iso.label(0, 0, 0.3, 'AC Inverter', { sub: 'Variable Speed' });");
    expect(objectProblems(object, labelled)).toEqual([LABEL_FORBIDDEN]);
  });

  it('tells the world writer that scenes own the labels', () => {
    expect(WORLD_SYSTEM).toMatch(/Never call iso\.label/);
    expect(EXAMPLE_WORLD).not.toMatch(/iso\.label/);
  });
});

describe('mixColor', () => {
  it('returns hex that shapes can shade', () => {
    expect(mixColor('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mixColor('#64748B', '#22C55E', 0)).toBe('#64748b');
    expect(mixColor('#64748B', '#22C55E', 1)).toBe('#22c55e');
  });
});
