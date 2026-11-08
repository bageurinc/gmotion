import { describe, expect, it } from 'vitest';
import { screenPlacement, screenStateAt } from './iso-screen';

describe('screenPlacement', () => {
  it('uses the width and height of the chosen face, inside a bezel', () => {
    const left = screenPlacement([6, 12, 1], 'left');
    expect(left.width).toBeLessThan(6);
    expect(left.height).toBeLessThan(12);
    expect(left.height).toBeGreaterThan(left.width);
    const right = screenPlacement([1, 12, 6], 'right');
    expect(right.width).toBeCloseTo(left.width);
  });

  it('sits just outside the face so it never z-fights', () => {
    expect(screenPlacement([6, 2, 4], 'top').position[1]).toBeGreaterThan(2);
    expect(screenPlacement([6, 2, 4], 'left').position[2]).toBeGreaterThan(2);
    expect(screenPlacement([6, 2, 4], 'right').position[0]).toBeGreaterThan(3);
  });
});

describe('screenStateAt', () => {
  const states = [{ from: 30, title: 'a', items: [] }, { from: 90, title: 'b', items: [] }];

  it('picks the latest state that has started', () => {
    expect(screenStateAt(states, 100)).toBe(1);
    expect(screenStateAt(states, 60)).toBe(0);
  });

  it('shows the first state before it starts, so a screen is never blank', () => {
    expect(screenStateAt(states, 0)).toBe(0);
  });
});
