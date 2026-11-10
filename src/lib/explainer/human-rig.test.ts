import React from 'react';
import { describe, expect, it } from 'vitest';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { renderSvgMarkup } from '@/lib/assets/draft-runtime';
import { HUMAN_RIG_POSES, HUMAN_RIG_SOURCE } from './human-rig';
import { loadHumanRig } from './human-rig-runtime';

const HEIGHT = 780;
const { HUMAN_RIG, HumanRig } = loadHumanRig();
const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function boneLengths(options: Record<string, unknown>) {
  const { joints } = HUMAN_RIG.solve(HEIGHT, options);
  return (['near', 'far'] as const).flatMap((side) => {
    const limb = joints[side];
    return [
      distance(limb.hip, limb.knee), distance(limb.knee, limb.ankle),
      distance(limb.shoulder, limb.elbow), distance(limb.elbow, limb.wrist), distance(limb.wrist, limb.fingers),
    ];
  }).concat(distance(joints.pelvis, joints.neckBase), distance(joints.neckBase, joints.headBase), distance(joints.headBase, joints.headTop));
}

const lowestSole = (options: Record<string, unknown>) => {
  const { joints } = HUMAN_RIG.solve(HEIGHT, options);
  return Math.max(joints.near.heel[1], joints.near.toe[1], joints.far.heel[1], joints.far.toe[1]);
};

describe('HumanRig', () => {
  it('passes the Full SVG validator with no imports', () => {
    const result = validateSceneCode(HUMAN_RIG_SOURCE, 'HumanRig.tsx', { svgOnly: true, allowedImports: [] });
    expect(result.errors).toEqual([]);
    expect(HUMAN_RIG_SOURCE).not.toContain('`');
  });

  it('lists every documented pose', () => {
    expect(HUMAN_RIG.poses).toEqual([...HUMAN_RIG_POSES]);
  });

  it('keeps every bone the same length across poses, blends, and the walk cycle', () => {
    const reference = boneLengths({ pose: 'stand' });
    const cases: Record<string, unknown>[] = [
      ...HUMAN_RIG_POSES.map((pose) => ({ pose })),
      { pose: 'stand', poseTo: 'aim', poseMix: 0.5 },
      { pose: 'hold', poseTo: 'raiseHand', poseMix: 0.37 },
      ...Array.from({ length: 24 }, (_, index) => ({ walkPhase: index / 24 })),
      { pose: 'point', walkPhase: 0.3, walkMix: 0.5 },
    ];
    for (const options of cases) {
      boneLengths(options).forEach((length, index) => expect(length).toBeCloseTo(reference[index], 6));
    }
  });

  it('rests the lowest sole on the ground in every pose and walk phase', () => {
    for (const pose of HUMAN_RIG_POSES) expect(lowestSole({ pose })).toBeCloseTo(0, 6);
    for (let index = 0; index < 30; index += 1) expect(lowestSole({ walkPhase: index / 30 })).toBeCloseTo(0, 6);
  });

  it('keeps the stance foot planted while the body advances one stride per cycle', () => {
    const stride = HUMAN_RIG.stride(HEIGHT);
    // During near-leg stance (phase 0.06..0.4) the ankle's world x must stay put.
    const worldAnkle = (phase: number) => HUMAN_RIG.solve(HEIGHT, { walkPhase: phase }).joints.near.ankle[0] + phase * stride;
    const start = worldAnkle(0.06);
    for (let phase = 0.08; phase <= 0.4; phase += 0.02) {
      expect(Math.abs(worldAnkle(phase) - start)).toBeLessThan(HEIGHT * 0.004);
    }
  });

  it('bends knees forward, never backward', () => {
    for (let index = 0; index < 24; index += 1) {
      const { pose } = HUMAN_RIG.solve(HEIGHT, { walkPhase: index / 24 });
      expect(pose.knN).toBeLessThanOrEqual(0.001);
      expect(pose.knF).toBeLessThanOrEqual(0.001);
    }
  });

  it('renders skin slots for both sides and the held item in the chosen hand', () => {
    const part = (name: string) => function Part(side: string) {
      return React.createElement('rect', { 'data-part': `${name}-${side}`, width: 10, height: 10 });
    };
    const parts = Object.fromEntries(['head', 'neck', 'torso', 'pelvis', 'upperArm', 'foreArm', 'hand', 'thigh', 'shin', 'foot', 'coatTail'].map((name) => [name, part(name)]));
    const svg = renderSvgMarkup(React.createElement(HumanRig, {
      height: HEIGHT, pose: 'hold', walkPhase: 0.2, facing: -1, parts,
      holding: { item: React.createElement('circle', { 'data-item': 'phone', r: 4 }), hand: 'far' },
    }));
    for (const name of ['upperArm', 'foreArm', 'hand', 'thigh', 'shin', 'foot']) {
      expect(svg).toContain(`data-part="${name}-near"`);
      expect(svg).toContain(`data-part="${name}-far"`);
    }
    expect(svg).toContain('data-item="phone"');
    expect(svg).toContain('scale(-1 1)');
    expect(svg).not.toMatch(/NaN|Infinity|undefined/);
  });
});

describe('HUMAN_RIG.walk', () => {
  it('stands at both ends and faces the direction of travel', () => {
    expect(HUMAN_RIG.walk({ progress: 0, fromX: 100, toX: 500 })).toMatchObject({ x: 100, walkMix: 0, facing: 1 });
    expect(HUMAN_RIG.walk({ progress: 1, fromX: 100, toX: 500 })).toMatchObject({ x: 500, walkMix: 0 });
    expect(HUMAN_RIG.walk({ progress: 0.5, fromX: 500, toX: 100 })).toMatchObject({ walkMix: 1, facing: -1 });
  });

  it('keeps the stance foot planted under eased motion at any scale', () => {
    const scale = 0.5;
    const options = { fromX: 0, toX: 2000, height: HEIGHT, scale };
    // Sample densely; inside each near-leg stance window the foot's world x must not drift.
    const samples = Array.from({ length: 2001 }, (_, index) => HUMAN_RIG.walk({ ...options, progress: 0.2 + 0.6 * index / 2000 }));
    let worst = 0;
    let anchor: number | null = null;
    for (const sample of samples) {
      const phase = sample.walkPhase - Math.floor(sample.walkPhase);
      const ankle = HUMAN_RIG.solve(HEIGHT, { walkPhase: sample.walkPhase }).joints.near.ankle[0];
      if (phase > 0.08 && phase < 0.4) {
        const world = sample.x + ankle * scale;
        anchor ??= world;
        worst = Math.max(worst, Math.abs(world - anchor));
      } else anchor = null;
    }
    expect(worst).toBeLessThan(HEIGHT * scale * 0.004);
  });
});
