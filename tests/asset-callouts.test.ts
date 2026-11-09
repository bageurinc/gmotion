import { describe, expect, it } from 'vitest';
import { layoutCallouts } from '../src/motion-kit/assets/PlanVideo';

describe('asset callout safe area', () => {
  it('keeps high anchors labels inside the top edge without overlapping on either side', () => {
    const labels = [40, 150, 800, 910].map((x, i) => ({ point: { x, y: 15 + i * 10 }, text: `Bagian ${i}` }));
    const result = layoutCallouts(labels, 960);
    for (const item of result) {
      expect(item.boxY).toBeGreaterThanOrEqual(960 * 0.03);
      expect(item.leader[0]).toEqual([item.point.x, item.point.y]);
      expect(item.leader.at(-1)![1]).toBeGreaterThanOrEqual(item.boxY);
    }
    for (const side of [true, false]) {
      const items = result.filter((item) => item.left === side).sort((a, b) => a.boxY - b.boxY);
      expect(items[0].boxY + items[0].boxHeight).toBeLessThan(items[1].boxY);
    }
  });
});
