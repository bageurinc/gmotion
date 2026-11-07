import { describe, expect, it } from 'vitest';
import { ghostAt, ISO_DIRECTION, ISO_RIGHT, ISO_UP, isoCameraAt, offsetAt, pointAlong, polylineLength, projectIso, shadeForNormal } from './iso-math';

const view = { width: 1000, height: 2000, centerY: 0.5 };

describe('shadeForNormal', () => {
  it('gives the top, left, and right faces three descending tones', () => {
    const top = shadeForNormal([0, 1, 0]);
    const left = shadeForNormal([0, 0, 1]);
    const right = shadeForNormal([1, 0, 0]);
    expect(top).toBeGreaterThan(left);
    expect(left).toBeGreaterThan(right);
  });

  it('stays within the visible range on a curved side', () => {
    const shade = shadeForNormal([Math.SQRT1_2, 0, Math.SQRT1_2]);
    expect(shade).toBeGreaterThan(shadeForNormal([1, 0, 0]));
    expect(shade).toBeLessThan(shadeForNormal([0, 0, 1]));
  });
});

describe('isometric axes', () => {
  it('are unit length and perpendicular', () => {
    const dot = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);
    expect(dot(ISO_RIGHT, ISO_RIGHT)).toBeCloseTo(1);
    expect(dot(ISO_UP, ISO_UP)).toBeCloseTo(1);
    expect(dot(ISO_DIRECTION, ISO_RIGHT)).toBeCloseTo(0);
    expect(dot(ISO_DIRECTION, ISO_UP)).toBeCloseTo(0);
  });

  it('land world axes 30 degrees from the horizontal', () => {
    const camera = { target: [0, 0, 0] as [number, number, number], zoom: 100 };
    const point = projectIso([1, 0, 0], camera, view);
    const angle = Math.atan2(point.y - 1000, point.x - 500) * (180 / Math.PI);
    expect(angle).toBeCloseTo(30);
  });
});

describe('projectIso', () => {
  it('puts the camera target at the view center', () => {
    expect(projectIso([3, 2, 1], { target: [3, 2, 1], zoom: 80 }, view)).toEqual({ x: 500, y: 1000 });
  });
});

describe('isoCameraAt', () => {
  const keys = [
    { frame: 0, target: [0, 0, 0] as [number, number, number], zoom: 40 },
    { frame: 30, target: [10, 0, 0] as [number, number, number], zoom: 100 },
  ];

  it('holds before the first key and after the last key', () => {
    expect(isoCameraAt(-5, keys)).toEqual({ target: [0, 0, 0], zoom: 40 });
    expect(isoCameraAt(99, keys)).toEqual({ target: [10, 0, 0], zoom: 100 });
  });

  it('returns the same camera for the same frame', () => {
    expect(isoCameraAt(13, keys)).toEqual(isoCameraAt(13, keys));
  });
});

describe('offsetAt', () => {
  it('adds up finished moves in order', () => {
    const moves = [
      { from: 0, to: 10, offset: [1, 0, 0] as [number, number, number] },
      { from: 10, to: 20, offset: [0, 2, 0] as [number, number, number] },
    ];
    expect(offsetAt(0, moves)).toEqual([0, 0, 0]);
    expect(offsetAt(30, moves)).toEqual([1, 2, 0]);
  });

  it('treats a solid without moves as still', () => {
    expect(offsetAt(50)).toEqual([0, 0, 0]);
  });
});

describe('ghostAt', () => {
  it('fades in and back out inside its window', () => {
    const windows = [{ from: 100, to: 200 }];
    expect(ghostAt(50, windows)).toBe(0);
    expect(ghostAt(150, windows)).toBe(1);
    expect(ghostAt(250, windows)).toBe(0);
  });
});

describe('polyline helpers', () => {
  const line: Array<[number, number, number]> = [[0, 0, 0], [3, 0, 0], [3, 4, 0]];

  it('measures the full length', () => {
    expect(polylineLength(line)).toBe(7);
  });

  it('finds points on later segments and clamps past the end', () => {
    expect(pointAlong(line, 5)).toEqual([3, 2, 0]);
    expect(pointAlong(line, 99)).toEqual([3, 4, 0]);
  });
});
