import { describe, expect, it } from 'vitest';
import { markFade, spotlightGradient } from '@/motion-kit/explainer/image-camera';

describe('focus mark', () => {
  const box = { x: 0.2, y: 0.4, w: 0.2, h: 0.1 };
  const shots = [{ from: 0, pose: 0, box, label: null }, { from: 100, pose: 0, box: null, label: null }];

  it('settles in after the camera and leaves before the next move', () => {
    expect(markFade(5, shots[0], shots)).toBe(0);
    expect(markFade(50, shots[0], shots)).toBe(1);
    expect(markFade(100, shots[0], shots)).toBe(0);
  });

  it('stays on through the last shot', () => {
    expect(markFade(150, shots[1], shots)).toBe(1);
  });

  it('centers the soft spotlight on the object', () => {
    expect(spotlightGradient(box, 1000, 2000)).toMatch(/at 300(\.0+\d*)?px 900px/);
  });
});
