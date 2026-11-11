import { describe, expect, it } from 'vitest';
import { beatAt, emitParticles, flowParticles, pointAt, samplePath } from './motion';
import { createStory } from './engine';

const LINE = samplePath([[0, 0], [2, 0]], false);

describe('story canvas motion math', () => {
  it('measures paths and finds points at their ends', () => {
    expect(LINE.total).toBeCloseTo(2, 9);
    expect(pointAt(LINE, 0)).toMatchObject({ x: 0, y: 0 });
    expect(pointAt(LINE, 5).x).toBeCloseTo(2, 9);
    const curve = samplePath([[0, 0], [1, 1], [2, 0]]);
    expect(curve.points[0]).toEqual([0, 0]);
    expect(curve.points[curve.points.length - 1]).toEqual([2, 0]);
    expect(curve.total).toBeGreaterThan(2.8);
  });

  it('moves particles with t and repeats exactly for the same t', () => {
    const a = flowParticles(LINE, { t: 1.3, speed: 0.5, spacing: 0.2 });
    const b = flowParticles(LINE, { t: 1.3, speed: 0.5, spacing: 0.2 });
    const later = flowParticles(LINE, { t: 1.5, speed: 0.5, spacing: 0.2 });
    expect(a).toEqual(b);
    expect(later[0].x).not.toBeCloseTo(a[0].x, 6);
    // Same count at every moment, so the stream never flickers.
    expect(later).toHaveLength(a.length);
    expect(a).toHaveLength(10);
    // Particles near the ends fade instead of popping.
    expect(Math.min(...a.map((p) => p.alpha))).toBeLessThan(1);
  });

  it('keeps a still flow still and spreads particles inside the width', () => {
    const still = flowParticles(LINE, { t: 0, speed: 0, spacing: 0.25, width: 0.1 });
    expect(flowParticles(LINE, { t: 9, speed: 0, spacing: 0.25, width: 0.1 })).toEqual(still);
    expect(Math.max(...still.map((p) => Math.abs(p.y)))).toBeLessThanOrEqual(0.05 + 1e-9);
  });

  it('emits on a fixed schedule with ages between 0 and 1', () => {
    const particles = emitParticles({ t: 3, rate: 4, life: 1.5, speed: 0.3 });
    expect(particles.length).toBeGreaterThanOrEqual(6);
    expect(particles.every((p) => p.age >= 0 && p.age <= 1)).toBe(true);
    expect(emitParticles({ t: 3, rate: 4, life: 1.5, speed: 0.3 })).toEqual(particles);
    const falling = emitParticles({ t: 1, rate: 2, life: 2, speed: 0, gravity: -1 });
    expect(falling.every((p) => p.y <= 0)).toBe(true);
  });

  it('beats with a contraction early in each cycle', () => {
    expect(beatAt(0, 60).squeeze).toBe(0);
    expect(beatAt(0.2, 60).squeeze).toBeCloseTo(1, 6);
    expect(beatAt(0.7, 60).squeeze).toBe(0);
    expect(beatAt(1.2, 60).index).toBe(1);
  });
});

describe('story canvas motion primitives', () => {
  /** Canvas stand-in that records the numbers of every call, so two frames can be compared. */
  function recorder() {
    const calls: string[] = [];
    const gradient = { addColorStop: () => undefined };
    const target: Record<string, unknown> = {
      measureText: () => ({ width: 10 }),
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
    };
    const ctx = new Proxy(target, {
      get: (object, key) => (typeof key === 'string' && key in object ? object[key] : (...args: unknown[]) => calls.push(`${String(key)}(${args.map((value) => (typeof value === 'number' ? value.toFixed(2) : '')).join(',')})`)),
      set: (object, key, value) => {
        object[key as string] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, calls };
  }

  const frame = (t: number) => {
    const { ctx, calls } = recorder();
    const s = createStory(ctx, 1080, 1920);
    s.look(0.5, 0, 800);
    s.tube([[0, 0], [0.5, 0.2], [1, 0]], 0.06, '#C0392B');
    s.flow([[0, 0], [0.5, 0.2], [1, 0]], { kind: 'cells', t, speed: 0.2, size: 0.02, width: 0.03 });
    s.flowArrow([[0, -0.3], [1, -0.3]], { t, width: 0.05 });
    s.emit(0.5, 0.3, { kind: 'steam', t });
    return calls.join('|');
  };

  it('draws the same frame twice and a different one later', () => {
    expect(frame(1.25)).toBe(frame(1.25));
    expect(frame(1.5)).not.toBe(frame(1.25));
  });
});
