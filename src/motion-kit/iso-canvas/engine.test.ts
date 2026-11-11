import { describe, expect, it } from 'vitest';
import { createIso, layoutLabels, type IsoLabelBox } from './engine';

type Call = { name: string; args: unknown[] };

/** Canvas stand-in that records every method call, enough for the engine's drawing paths. */
function recorder() {
  const calls: Call[] = [];
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: String(text).length * 18 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  const ctx = new Proxy(target, {
    get: (object, key) => {
      if (typeof key !== 'string') return undefined;
      if (key in object) return object[key];
      return (...args: unknown[]) => {
        calls.push({ name: key, args });
      };
    },
    set: (object, key, value) => {
      object[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

/** Screen points of each filled path, split at beginPath. */
function filledPaths(calls: Call[]): [number, number][][] {
  const paths: [number, number][][] = [];
  let current: [number, number][] = [];
  for (const call of calls) {
    if (call.name === 'beginPath') current = [];
    if (call.name === 'moveTo' || call.name === 'lineTo') current.push([call.args[0] as number, call.args[1] as number]);
    if (call.name === 'fill') paths.push(current);
  }
  return paths;
}

const W = 1080;
const H = 1920;

describe('iso canvas projection', () => {
  it('maps world axes to the 30 degree isometric screen directions', () => {
    const { ctx } = recorder();
    const iso = createIso(ctx, W, H);
    iso.cam(500, 900, 10);
    expect(iso.P(0, 0, 0)).toEqual([500, 900]);
    const [x, y] = iso.P(1, 0, 0);
    expect(x - 500).toBeCloseTo(Math.sqrt(3) / 2 * 10);
    expect(y - 900).toBeCloseTo(5);
    expect(iso.P(0, 0, 1)).toEqual([500, 890]);
  });

  it('look places the world point at the requested screen point', () => {
    const { ctx } = recorder();
    const iso = createIso(ctx, W, H);
    iso.look(3, -2, 1.5, 60);
    const [x, y] = iso.P(3, -2, 1.5);
    expect(x).toBeCloseTo(W / 2);
    expect(y).toBeCloseTo(H / 2);
  });

  it('applies at() offsets and rotate() turns', () => {
    const { ctx } = recorder();
    const iso = createIso(ctx, W, H);
    iso.cam(0, 0, 10);
    let shifted: [number, number] = [0, 0];
    iso.at(1, 0, 0, () => {
      shifted = iso.P(0, 0, 0);
    });
    expect(shifted).toEqual(iso.P(1, 0, 0));
    let turned: [number, number] = [0, 0];
    iso.rotate('z', Math.PI / 2, [0, 0, 0], () => {
      turned = iso.P(1, 0, 0);
    });
    expect(turned[0]).toBeCloseTo(iso.P(0, 1, 0)[0]);
    expect(turned[1]).toBeCloseTo(iso.P(0, 1, 0)[1]);
  });
});

describe('iso canvas solids', () => {
  it('draws only the three faces of a box that face the viewer', () => {
    const { ctx, calls } = recorder();
    const iso = createIso(ctx, W, H);
    iso.box(0, 0, 0, 2, 2, 2, '#4488CC');
    expect(calls.filter((call) => call.name === 'fill')).toHaveLength(3);
  });

  it('still culls back faces after a rotation', () => {
    const { ctx, calls } = recorder();
    const iso = createIso(ctx, W, H);
    iso.rotate('z', 0.4, [1, 1, 1], () => iso.box(0, 0, 0, 2, 2, 2, '#4488CC'));
    expect(calls.filter((call) => call.name === 'fill').length).toBeLessThanOrEqual(3);
  });

  it('renders the same frame identically twice', () => {
    const scene = (ctx: CanvasRenderingContext2D) => {
      const iso = createIso(ctx, W, H);
      iso.camPath([{ at: 0, look: [0, 0, 0], zoom: 40 }, { at: 2, look: [2, 1, 0], zoom: 80 }], 1.3);
      iso.ground('#88AA66');
      iso.cyl('z', 0, 0, 0, 1, 2, '#CC4444', { seg: ['#CC4444', '#EEEEEE'], rot: 1.3 });
      iso.pipe([[0, 0, 2], [2, 0, 2]], 0.2, '#B87333', { flow: 1.3 });
      iso.label(0, 0, 2, 'Kompresor', { sub: 'memompa freon' });
      iso.finish();
    };
    const first = recorder();
    const second = recorder();
    scene(first.ctx);
    scene(second.ctx);
    expect(JSON.stringify(first.calls)).toBe(JSON.stringify(second.calls));
  });
});

describe('iso canvas ground and camera', () => {
  const containsCorners = (path: [number, number][]) => {
    const xs = path.map(([x]) => x);
    const ys = path.map(([, y]) => y);
    // A convex quad covering the frame has every frame corner inside; check its bounding box
    // and that it is a diamond large enough to include the corners.
    return Math.min(...xs) <= 0 && Math.max(...xs) >= W && Math.min(...ys) <= 0 && Math.max(...ys) >= H;
  };

  it.each([
    [20, [0, 0, 0]],
    [140, [5, -3, 0]],
  ] as const)('ground covers the whole frame at zoom %s', (zoom, look) => {
    const { ctx, calls } = recorder();
    const iso = createIso(ctx, W, H);
    iso.look(look[0], look[1], look[2], zoom);
    iso.ground('#88AA66');
    const [path] = filledPaths(calls);
    expect(containsCorners(path)).toBe(true);
    // Every frame corner must sit inside the projected diamond.
    const inside = (px: number, py: number) => {
      let sign = 0;
      for (let i = 0; i < path.length; i += 1) {
        const [ax, ay] = path[i];
        const [bx, by] = path[(i + 1) % path.length];
        const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
        if (cross !== 0) {
          if (sign && Math.sign(cross) !== sign) return false;
          sign = Math.sign(cross);
        }
      }
      return true;
    };
    for (const [px, py] of [[0, 0], [W, 0], [0, H], [W, H]]) expect(inside(px, py)).toBe(true);
  });

  it('camPath holds before the first key, eases between, and arrives on time', () => {
    const { ctx } = recorder();
    const iso = createIso(ctx, W, H);
    const keys = [{ at: 1, look: [0, 0, 0] as [number, number, number], zoom: 40 }, { at: 3, look: [4, 0, 0] as [number, number, number], zoom: 80 }];
    iso.camPath(keys, 0);
    expect(iso.P(0, 0, 0)[0]).toBeCloseTo(W / 2);
    iso.camPath(keys, 3);
    expect(iso.P(4, 0, 0)[0]).toBeCloseTo(W / 2);
    iso.camPath(keys, 2);
    const midway = iso.P(2, 0, 0);
    expect(midway[0]).toBeCloseTo(W / 2);
    expect(midway[1]).toBeCloseTo(H / 2);
  });
});

describe('label layout', () => {
  const bounds = { left: 80, top: 200, right: 900, bottom: 1500 };
  const box = (x: number, y: number, w = 300, h = 90): IsoLabelBox => ({ anchorX: x, anchorY: y, x, y, w, h });

  it('pulls a box that leaves the frame back inside the bounds', () => {
    const [moved] = layoutLabels([box(850, 100)], bounds);
    expect(moved.x + moved.w).toBeLessThanOrEqual(bounds.right);
    expect(moved.y).toBeGreaterThanOrEqual(bounds.top);
  });

  it('separates overlapping boxes', () => {
    const boxes = layoutLabels([box(300, 700), box(350, 720), box(320, 740)], bounds);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const [a, b] = [boxes[i], boxes[j]];
        const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
        const overlapY = a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlapX && overlapY).toBe(false);
      }
    }
    boxes.forEach((item) => {
      expect(item.y).toBeGreaterThanOrEqual(bounds.top);
      expect(item.y + item.h).toBeLessThanOrEqual(bounds.bottom);
    });
  });

  it('keeps labels drawn by finish() inside the safe area', () => {
    const { ctx, calls } = recorder();
    const iso = createIso(ctx, W, H, { safe: { top: 0.12, right: 0.16, bottom: 0.22, left: 0.08 } });
    iso.look(0, 0, 0, 60);
    iso.label(0, 0, 0, 'Label yang cukup panjang di tepi', { dx: 600, dy: -900, sub: 'keterangan' });
    iso.label(0, 0, 0, 'Label kiri', { dx: -700 });
    iso.finish();
    const rects = calls.filter((call) => call.name === 'roundRect').map((call) => call.args as number[]);
    expect(rects).toHaveLength(2);
    for (const [x, y, w, h] of rects) {
      expect(x).toBeGreaterThanOrEqual(W * 0.08);
      expect(x + w).toBeLessThanOrEqual(W * 0.84 + 0.001);
      expect(y).toBeGreaterThanOrEqual(H * 0.12);
      expect(y + h).toBeLessThanOrEqual(H * 0.78 + 0.001);
    }
  });
});
