import { describe, expect, it } from 'vitest';
import { loadHumanRig } from '@/lib/explainer/human-rig-runtime';
import { HUMAN_RIG_POSES } from '@/lib/explainer/human-rig';
import { EXAMPLE_KITCHEN } from '@/lib/explainer/story-canvas/examples';
import { createStory } from './engine';
import { rigSolve, rigWalk } from './rig';

/** Canvas stand-in that accepts every call; records fills so tests can count shapes. */
function recorder() {
  let fills = 0;
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: String(text).length * 18 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    fill: () => {
      fills += 1;
    },
  };
  const ctx = new Proxy(target, {
    get: (object, key) => (typeof key === 'string' && key in object ? object[key] : () => undefined),
    set: (object, key, value) => {
      object[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, fills: () => fills };
}

describe('story canvas rig', () => {
  it('matches the HumanRig source for every pose and a walk', () => {
    const { HUMAN_RIG } = loadHumanRig();
    const cases: Record<string, unknown>[] = [
      ...HUMAN_RIG_POSES.map((pose) => ({ pose })),
      { pose: 'stand', poseTo: 'point', poseMix: 0.4 },
      { pose: 'stand', walkPhase: 0.37, walkMix: 1 },
    ];
    for (const options of cases) {
      const expected = HUMAN_RIG.solve(1.7, options);
      const actual = rigSolve(1.7, options as never);
      expect(actual.joints.headTop[0]).toBeCloseTo(expected.joints.headTop[0], 9);
      expect(actual.joints.near.wrist[1]).toBeCloseTo(expected.joints.near.wrist[1], 9);
      expect(actual.joints.far.toe[0]).toBeCloseTo(expected.joints.far.toe[0], 9);
      expect(actual.pelvisY).toBeCloseTo(expected.pelvisY, 9);
    }
  });

  it('walks with planted feet: phase follows distance', () => {
    const half = rigWalk({ progress: 0.5, fromX: 0, toX: 2.04, height: 1.7 });
    expect(half.x).toBeCloseTo(1.02, 6);
    expect(half.walkPhase).toBeCloseTo(1.02 / (1.2 * 0.48 * 1.7), 6);
    expect(rigWalk({ progress: 0, fromX: 0, toX: 2 }).walkMix).toBe(0);
  });
});

describe('story canvas engine', () => {
  it('runs the worked example at several times', () => {
    const draw = new Function(`${EXAMPLE_KITCHEN}\nreturn draw;`)() as (s: unknown, t: number) => void;
    for (const t of [0, 1.5, 2.97]) {
      const { ctx, fills } = recorder();
      const story = createStory(ctx, 1080, 1920);
      draw(story, t);
      story.finish();
      expect(fills()).toBeGreaterThan(40);
    }
  });

  it('puts the camera look point at the frame centre and keeps y up', () => {
    const story = createStory(recorder().ctx, 1080, 1920);
    story.look(1, 1, 500);
    expect(story.P(1, 1)).toEqual([540, 960]);
    expect(story.P(1, 2)[1]).toBe(460);
    story.at(0.5, 0, () => expect(story.P(0.5, 1)).toEqual([540, 960]));
  });

  it('keeps the new poses on the ground and lays a lying person flat on the surface', () => {
    for (const pose of ['bend', 'crouch', 'kneel', 'phone', 'wash', 'wave'] as const) {
      const solved = rigSolve(1.7, { pose });
      const lowest = Math.max(solved.joints.near.heel[1], solved.joints.near.toe[1], solved.joints.far.heel[1], solved.joints.far.toe[1]);
      expect(lowest).toBeCloseTo(0, 9);
    }
    expect(-rigSolve(1.7, { pose: 'crouch' }).joints.pelvis[1]).toBeLessThan(0.6);
    const story = createStory(recorder().ctx, 1080, 1920);
    const lying = story.person(1, 0.5, { pose: 'lie', facing: 1 });
    expect(lying.head[0]).toBeGreaterThan(1.6);
    expect(Math.abs(lying.head[1] - 0.5)).toBeLessThan(0.3);
    const left = story.person(1, 0.5, { pose: 'lie', facing: -1 });
    expect(left.head[0]).toBeLessThan(0.4);
  });

  it('returns the near hand in front of a pointing person', () => {
    const story = createStory(recorder().ctx, 1080, 1920);
    const right = story.person(0, 0, { pose: 'point', facing: 1 });
    const left = story.person(0, 0, { pose: 'point', facing: -1 });
    expect(right.hand[0]).toBeGreaterThan(0.5);
    expect(left.hand[0]).toBeCloseTo(-right.hand[0], 9);
    expect(right.head[1]).toBeCloseTo(1.7, 1);
  });
});
