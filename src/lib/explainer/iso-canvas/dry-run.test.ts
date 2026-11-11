import { describe, expect, it } from 'vitest';
import { dryRunIsoCanvas } from './dry-run';
import { validateIsoCanvasFile } from './contract';
import { parseNamedBlocks, writeUntilValid } from './writer';
import { statesAt, type IsoWorldScene } from '@/motion-kit/iso-canvas/scenes';
import { isVirtualFileName } from '@/lib/security/project-input';
import { KIPAS_FILES } from './__fixtures__/kipas';

const withFile = (name: keyof typeof KIPAS_FILES, code: string) => ({ ...KIPAS_FILES, [name]: code });

describe('iso canvas contract', () => {
  it('accepts a valid video and reports draw detail', () => {
    const report = dryRunIsoCanvas(KIPAS_FILES);
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.drawCalls).toBeGreaterThan(20);
  });

  it('accepts the module names for bundling', () => {
    for (const name of ['IsoObjects.ts', 'IsoWorld.ts', 'IsoScenes.ts']) expect(isVirtualFileName(name)).toBe(true);
    expect(isVirtualFileName('IsoHack.ts')).toBe(false);
  });

  it('rejects canvas members that reach the DOM or pixels', () => {
    const result = validateIsoCanvasFile('IsoWorld.ts', `export function drawWorld(iso: any) { const c = iso.ctx.canvas; c.toDataURL(); }`);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/canvas/);
    expect(result.errors.join(' ')).toMatch(/toDataURL/);
  });

  it('rejects imports outside the allowed order', () => {
    const result = validateIsoCanvasFile('IsoObjects.ts', `import { drawWorld } from './IsoWorld';\nexport function drawA() { drawWorld; }`);
    expect(result.errors.join(' ')).toMatch(/Forbidden import '\.\/IsoWorld'/);
  });

  it('rejects randomness before running anything', () => {
    const report = dryRunIsoCanvas(withFile('IsoWorld.ts', KIPAS_FILES['IsoWorld.ts'].replace("iso.ground('#D9C3A5');", "iso.ground('#D9C3A5'); const r = Math.random();")));
    expect(report.ok).toBe(false);
    expect(report.problems.join(' ')).toMatch(/Math\.random/);
  });

  it('stops a frame that never finishes', () => {
    const report = dryRunIsoCanvas(withFile('IsoWorld.ts', KIPAS_FILES['IsoWorld.ts'].replace("iso.ground('#D9C3A5');", 'while (true) {}')));
    expect(report.ok).toBe(false);
    expect(report.problems.join(' ')).toMatch(/longer than/);
  }, 20_000);

  it('reports NaN coordinates', () => {
    const report = dryRunIsoCanvas(withFile('IsoObjects.ts', KIPAS_FILES['IsoObjects.ts'].replace("iso.cyl('z', 0, 0, 0, 1, 0.2, '#E2E8F0');", "iso.cyl('z', 0, 0, 0, Number('x'), 0.2, '#E2E8F0');")));
    expect(report.problems.join(' ')).toMatch(/NaN/);
  });

  it('reports a missing drawWorld export', () => {
    const report = dryRunIsoCanvas(withFile('IsoWorld.ts', `import type { Iso } from '@/motion-kit';\nexport function paintWorld(iso: Iso) { iso.background('#fff'); }\n`));
    expect(report.problems.join(' ')).toMatch(/drawWorld/);
  });

  it('catches state kept between frames', () => {
    const report = dryRunIsoCanvas(withFile('IsoWorld.ts', KIPAS_FILES['IsoWorld.ts'].replace('export function drawWorld(iso: Iso, t: number, states: IsoStates) {', 'let frames = 0;\nexport function drawWorld(iso: Iso, t: number, states: IsoStates) {\n  frames += 1;\n  iso.box(frames, 0, 0, 1, 1, 1, "#000000");')));
    expect(report.problems.join(' ')).toMatch(/drew differently twice/);
  });

  it('asks scenes to start where the previous one ended', () => {
    const report = dryRunIsoCanvas(withFile('IsoScenes.ts', KIPAS_FILES['IsoScenes.ts'].replace('start: 3,', 'start: 4,')));
    expect(report.problems.join(' ')).toMatch(/scenes\[1\]\.start should be 3\.00/);
  });

  it('eases object state changes inside a world scene', () => {
    const scene: IsoWorldScene = {
      kind: 'world', start: 0, duration: 3, camera: [{ at: 0, look: [0, 0, 0], zoom: 50 }],
      states: { lampu: { nyala: 0 } },
      changes: [{ object: 'lampu', key: 'nyala', to: 1, from: 1, until: 2 }],
    };
    expect(statesAt(scene, 0.5).lampu.nyala).toBe(0);
    expect(statesAt(scene, 1.5).lampu.nyala).toBeCloseTo(0.5);
    expect(statesAt(scene, 2.5).lampu.nyala).toBe(1);
    expect(scene.states.lampu.nyala).toBe(0);
  });
});

describe('writeUntilValid', () => {
  it('sends the problems and previous answer back until the checks pass', async () => {
    const prompts: string[] = [];
    const answers = ['no blocks here', '```ts\n// A.ts\nbad\n```', '```ts\n// A.ts\ngood\n```'];
    const result = await writeUntilValid({
      ask: async (feedback) => {
        prompts.push(feedback);
        return answers[prompts.length - 1];
      },
      parse: (text) => parseNamedBlocks(text, ['A.ts']),
      check: (files) => (files['A.ts'].includes('bad') ? ['A.ts says bad.'] : []),
      show: (files) => files['A.ts'],
    });
    expect(result.value).toEqual({ 'A.ts': 'good\n' });
    expect(result.attempts).toBe(3);
    expect(prompts[0]).toBe('');
    expect(prompts[1]).toMatch(/required format/);
    expect(prompts[2]).toMatch(/A\.ts says bad\./);
    expect(prompts[2]).toMatch(/Previous answer:\nbad/);
    expect(result.notes).toHaveLength(2);
  });

  it('returns the last attempt with its problems when every attempt fails', async () => {
    const result = await writeUntilValid({
      ask: async () => '```ts\n// A.ts\nbad\n```',
      parse: (text) => parseNamedBlocks(text, ['A.ts']),
      check: () => ['still bad'],
      show: (files) => files['A.ts'],
      attempts: 2,
    });
    expect(result.value).toEqual({ 'A.ts': 'bad\n' });
    expect(result.problems).toEqual(['still bad']);
    expect(result.attempts).toBe(2);
  });
});
