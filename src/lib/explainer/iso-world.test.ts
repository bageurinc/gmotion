import { describe, expect, it, vi } from 'vitest';
import { buildIsoWorld, IsoObject, IsoPlan, IsoPlanSchema, resolveIsoPlan } from './iso-world';

// Next route handlers crash on the Remotion runtime, and these modules run inside them.
vi.mock('remotion', () => {
  throw new Error('Server world code must not import remotion');
});

const object = (id: string, overrides: Partial<IsoObject> = {}): IsoObject => ({
  id, label: id, shape: 'box', size: [2, 1, 2], color: '#88AA66', on: null, x: 0, z: 0, ...overrides,
});

const beat = (focus: string | null, label: string | null = null) => ({
  text: 'Kalimat', headline: 'Judul', accent: '', value: 1, status: '', clock: '', focus, label, sticker: null,
});

const plan = (objects: IsoObject[], overrides: Partial<IsoPlan> = {}): IsoPlan => ({
  look: 'bright',
  unit: '%',
  palette: { ground: '#F4EEE2', surface: '#E4C49B', hud: '#1F4D3A', hudText: '#FFFFFF', accent: '#F2542D', ink: '#1F2A37' },
  objects,
  links: [],
  beats: [beat(null), beat(null), beat(null), beat(null)],
  ...overrides,
});

const timing = [0, 60, 120, 180].map((from) => ({ from, duration: 60 }));
const view = { width: 1080, height: 1920, centerY: 0.55 };
const find = (resolved: ReturnType<typeof resolveIsoPlan>, id: string) => resolved.placements.find((item) => item.object.id === id)!;

describe('resolveIsoPlan', () => {
  it('stacks children on their parent without the model computing height', () => {
    const resolved = resolveIsoPlan(plan([object('a', { size: [6, 1, 6] }), object('b', { on: 'a' }), object('c', { on: 'b', size: [1, 1, 1] })]));
    expect(resolved.errors).toEqual([]);
    expect(find(resolved, 'b').center[1]).toBe(find(resolved, 'a').center[1] + 1);
    expect(find(resolved, 'c').center[1]).toBe(find(resolved, 'b').center[1] + 1);
  });

  it('keeps a child inset from its parent so visible sides are never coplanar', () => {
    const resolved = resolveIsoPlan(plan([object('a', { size: [6, 1, 6] }), object('b', { on: 'a', x: 40, size: [2, 1, 2] })]));
    const child = find(resolved, 'b');
    expect(child.center[0] + child.size[0] / 2).toBeLessThan(3);
  });

  it('places children on a tray floor and inside its walls', () => {
    const resolved = resolveIsoPlan(plan([object('tray', { size: [6, 2, 6], wall: 0.5 }), object('b', { on: 'tray', x: 40, size: [2, 1, 2] })]));
    const tray = find(resolved, 'tray');
    const child = find(resolved, 'b');
    expect(child.center[1]).toBeLessThan(tray.center[1] + tray.size[1]);
    expect(child.center[0] + child.size[0] / 2).toBeLessThan(2.5);
  });

  it('reports overlapping siblings as errors for a retry', () => {
    const resolved = resolveIsoPlan(plan([object('a'), object('b', { x: 1 })]));
    expect(resolved.errors.join()).toContain('"b" overlaps "a"');
  });

  it('pushes overlapping siblings apart when repairing', () => {
    const resolved = resolveIsoPlan(plan([object('a'), object('b', { x: 1 })]), { repair: true });
    expect(resolved.errors).toEqual([]);
    expect(find(resolved, 'b').center[0]).toBeGreaterThanOrEqual(2);
  });

  it('drops an object with no room and tells what it lost', () => {
    const resolved = resolveIsoPlan(plan([
      object('table', { size: [2.2, 1, 2.2] }),
      object('a', { on: 'table', size: [2, 1, 2] }),
      object('b', { on: 'table', size: [2, 1, 2] }),
      object('on-b', { on: 'b' }),
    ], { beats: [beat('b'), beat(null), beat(null), beat(null)] }), { repair: true });
    expect(resolved.placements.map((item) => item.object.id)).toEqual(['table', 'a']);
    expect(resolved.focus[0]).toBeNull();
    expect(resolved.warnings.join()).toContain('"b" dropped');
  });

  it('rejects a parent that is not declared first', () => {
    const resolved = resolveIsoPlan(plan([object('b', { on: 'a' }), object('a')]));
    expect(resolved.errors.join()).toContain('must exist earlier');
  });

  it('rejects an unknown focus unless repairing', () => {
    const objects = [object('a')];
    const beats = [beat('ghost'), beat(null), beat(null), beat(null)];
    expect(resolveIsoPlan(plan(objects, { beats })).errors.join()).toContain('ghost');
    expect(resolveIsoPlan(plan(objects, { beats }), { repair: true }).focus[0]).toBeNull();
  });

  it('opens a lid on the beat that first looks inside', () => {
    const resolved = resolveIsoPlan(plan([
      object('tray', { size: [6, 2, 6], wall: 0.5 }),
      object('inside', { on: 'tray' }),
      object('lid', { on: 'tray', lid: true, size: [1, 0.2, 1] }),
    ], { beats: [beat(null), beat(null), beat('inside'), beat(null)] }));
    const lid = find(resolved, 'lid');
    expect(lid.size[0]).toBe(6);
    expect(lid.lifts[0].beat).toBe(2);
  });

  it('carries children along when their parent lifts', () => {
    const resolved = resolveIsoPlan(plan([
      object('a', { size: [6, 1, 6], liftAtBeat: 1 }),
      object('b', { on: 'a' }),
    ]));
    expect(find(resolved, 'b').lifts).toEqual(find(resolved, 'a').lifts);
  });

  it('routes a link over anything standing between its ends', () => {
    const resolved = resolveIsoPlan(plan([object('a', { x: -6 }), object('wall', { size: [1, 5, 3] }), object('b', { x: 6 })], {
      links: [{ id: 'pipe', through: ['a', 'b'], color: '#FFFFFF', radius: null, activeBeats: [0] }],
    }));
    expect(Math.max(...resolved.links[0].points.map((point) => point[1]))).toBeGreaterThan(5.5);
  });

  it('reports a link to an unknown object', () => {
    const resolved = resolveIsoPlan(plan([object('a')], {
      links: [{ id: 'pipe', through: ['a', 'ghost'], color: '#FFFFFF', radius: null, activeBeats: [] }],
    }));
    expect(resolved.errors.join()).toContain('ghost');
  });
});

describe('resolveIsoPlan look and subject checks', () => {
  const darkPalette = { ground: '#0B101B', surface: '#1E1B18', hud: '#161E2E', hudText: '#F1F5F9', accent: '#10B981', ink: '#090D16' };

  it('rejects a dark palette on a world declared bright', () => {
    const resolved = resolveIsoPlan(plan([object('a')], { palette: darkPalette }));
    expect(resolved.errors.join()).toContain('look "bright"');
  });

  it('replaces the palette and says so when repairing', () => {
    const resolved = resolveIsoPlan(plan([object('a')], { palette: darkPalette }), { repair: true });
    expect(resolved.plan.palette.ground).not.toBe(darkPalette.ground);
    expect(resolved.warnings.join()).toContain('replaced');
  });

  it('accepts a dark palette on a world declared dark', () => {
    expect(resolveIsoPlan(plan([object('a')], { look: 'dark', palette: darkPalette })).errors).toEqual([]);
  });

  it('rejects a small subject among scattered side objects', () => {
    const resolved = resolveIsoPlan(plan([object('a', { x: -10, z: -10 }), object('b', { x: 10, z: 10 })]));
    expect(resolved.errors.join()).toContain('too small');
  });
});

describe('buildIsoWorld', () => {
  const objects = [object('a', { size: [8, 1, 8] }), object('b', { on: 'a', size: [1, 1, 1] }), object('c', { x: 7, z: 7 })];

  it('adds a base under the whole world', () => {
    const world = buildIsoWorld(resolveIsoPlan(plan(objects)), timing, view);
    const base = world.solids[0];
    expect(base.id).toBe('world-base');
    expect(base.size![0]).toBeGreaterThan(11);
  });

  it('zooms closer on a small focus than on the wide shot', () => {
    const resolved = resolveIsoPlan(plan(objects, { beats: [beat(null), beat('b'), beat(null), beat(null)] }));
    const world = buildIsoWorld(resolved, timing, view);
    const wide = world.camera[0].zoom;
    const close = world.camera.find((key) => key.frame === 60 + 26)!.zoom;
    expect(close).toBeGreaterThan(wide);
  });

  it('keeps pushing in while a shot holds, so no beat is frozen', () => {
    const world = buildIsoWorld(resolveIsoPlan(plan(objects, { beats: [beat(null), beat('b'), beat(null), beat(null)] })), timing, view);
    expect(world.camera.find((key) => key.frame === 60)!.zoom).toBeGreaterThan(world.camera[0].zoom);
    expect(world.camera.at(-1)).toMatchObject({ frame: 240 });
    expect(world.camera.at(-1)!.zoom).toBeGreaterThan(world.camera[0].zoom);
  });

  it('turns a focused beat into a timed highlight and label', () => {
    const resolved = resolveIsoPlan(plan(objects, { beats: [beat(null), beat('b', 'Bagian B'), beat(null), beat(null)] }));
    const world = buildIsoWorld(resolved, timing, view);
    expect(world.highlights).toEqual([{ id: 'b', from: 70, to: 119 }]);
    expect(world.labels![0].text).toBe('Bagian B');
  });

  it('draws a tray as a floor and a wall, with the wall keeping the id', () => {
    const world = buildIsoWorld(resolveIsoPlan(plan([object('tray', { size: [6, 2, 6], wall: 0.5 }), object('b'), object('c', { x: 6 })])), timing, view);
    expect(world.solids.find((solid) => solid.id === 'tray')?.wall).toBe(0.5);
    expect(world.solids.some((solid) => solid.id === 'tray-floor')).toBe(true);
  });

  it('runs flows only during their beats', () => {
    const resolved = resolveIsoPlan(plan([object('a', { x: -4 }), object('b', { x: 4 })], {
      links: [{ id: 'pipe', through: ['a', 'b'], color: '#FFFFFF', radius: null, activeBeats: [2] }],
    }));
    const world = buildIsoWorld(resolved, timing, view);
    expect(world.flows).toHaveLength(1);
    expect(world.flows![0]).toMatchObject({ from: 120, to: 179 });
  });
});

describe('occlusion', () => {
  const beats = [beat(null), beat('small'), beat(null), beat(null)];

  it('fades an object standing between the camera and the focus', () => {
    const resolved = resolveIsoPlan(plan([object('small', { size: [1, 1, 1] }), object('house', { size: [4, 8, 4], x: 3, z: 3 })], { beats }));
    expect(buildIsoWorld(resolved, timing, view).ghosts).toEqual([{ id: 'house', from: 60, to: 119 }]);
  });

  it('fades neighbors behind the focus too, so a close-up holds one subject', () => {
    const resolved = resolveIsoPlan(plan([object('small', { size: [1, 1, 1] }), object('back', { size: [4, 8, 4], x: -3, z: -3 })], { beats }));
    expect(buildIsoWorld(resolved, timing, view).ghosts).toEqual([{ id: 'back', from: 60, to: 119 }]);
  });

  it('leaves objects outside the shot alone', () => {
    const resolved = resolveIsoPlan(plan([object('small', { size: [1, 1, 1] }), object('far', { size: [2, 1, 2], x: 30, z: -30 })], { beats }));
    expect(buildIsoWorld(resolved, timing, view).ghosts).toEqual([]);
  });

  it('keeps a link that reaches the focus and fades one that does not', () => {
    const resolved = resolveIsoPlan(plan([
      object('small', { size: [1, 1, 1] }), object('near', { x: 3 }), object('p', { x: -3 }), object('q', { z: 3 }),
    ], {
      beats,
      links: [
        { id: 'kept', through: ['small', 'near'], color: '#FFFFFF', radius: null, activeBeats: [] },
        { id: 'gone', through: ['p', 'q'], color: '#FFFFFF', radius: null, activeBeats: [] },
      ],
    }));
    const ids = buildIsoWorld(resolved, timing, view).ghosts!.map((ghost) => ghost.id);
    expect(ids).toContain('link-gone');
    expect(ids).not.toContain('link-kept');
  });

  it('stops the flow of a faded link', () => {
    const resolved = resolveIsoPlan(plan([object('small', { size: [1, 1, 1] }), object('p', { x: -3 }), object('q', { z: 3 })], {
      beats,
      links: [{ id: 'gone', through: ['p', 'q'], color: '#FFFFFF', radius: null, activeBeats: [1, 2] }],
    }));
    expect(buildIsoWorld(resolved, timing, view).flows!.map((flow) => flow.from)).toEqual([120]);
  });

  it('stays faded across beats instead of blinking at the cut', () => {
    const resolved = resolveIsoPlan(plan([object('small', { size: [1, 1, 1] }), object('near', { x: 2 })], { beats: [beat(null), beat('small'), beat('small'), beat(null)] }));
    expect(buildIsoWorld(resolved, timing, view).ghosts).toEqual([{ id: 'near', from: 60, to: 179 }]);
  });

  it('never crops a big focus to reach the minimum zoom', () => {
    const resolved = resolveIsoPlan(plan([object('big', { size: [14, 6, 14] }), object('tip', { x: 8.5, z: 0, size: [1, 1, 1] })], { beats: [beat('big'), beat(null), beat(null), beat(null)] }));
    const { zoom } = buildIsoWorld(resolved, timing, view).camera[0];
    expect(zoom * 14 * Math.SQRT2).toBeLessThanOrEqual(view.width * 0.93);
  });

  it('never fades what the focus rests on', () => {
    const resolved = resolveIsoPlan(plan([object('tray', { size: [8, 3, 8], wall: 0.5 }), object('small', { on: 'tray', size: [1, 1, 1] })], { beats }));
    expect(buildIsoWorld(resolved, timing, view).ghosts).toEqual([]);
  });
});

describe('blob objects', () => {
  const lobes = [{ at: [0, 0, 0] as [number, number, number], r: 0.8 }];

  it('rests a child on the curve instead of the bounding box', () => {
    const resolved = resolveIsoPlan(plan([
      object('body', { shape: 'blob', lobes, size: [8, 8, 8] }),
      object('center', { on: 'body', size: [1, 1, 1] }),
      object('side', { on: 'body', size: [1, 1, 1], x: 3.2 }),
    ]));
    expect(find(resolved, 'side').center[1]).toBeLessThan(find(resolved, 'center').center[1] - 1);
    expect(find(resolved, 'center').center[1]).toBeCloseTo(0.5 + 8 - 0.08, 0);
  });

  it('attaches a link to the curve', () => {
    const body = object('body', { shape: 'blob', lobes: [{ at: [-0.6, 0, 0], r: 0.4 }, { at: [0.6, 0, 0], r: 0.4 }], size: [8, 4, 4] });
    const resolved = resolveIsoPlan(plan([body]));
    expect(find(resolved, 'body').top).toBeLessThan(0.5 + 4);
  });

  it('rejects a blob without lobes, and repairs it into a ball', () => {
    const bare = object('body', { shape: 'blob' });
    expect(resolveIsoPlan(plan([bare])).errors.join()).toContain('needs lobes');
    const repaired = resolveIsoPlan(plan([bare]), { repair: true });
    expect(repaired.errors).toEqual([]);
    expect(find(repaired, 'body').object.lobes).toHaveLength(1);
  });

  it('passes lobes to the stage', () => {
    const world = buildIsoWorld(resolveIsoPlan(plan([object('body', { shape: 'blob', lobes })])), timing, view);
    expect(world.solids.find((solid) => solid.id === 'body')?.lobes).toEqual(lobes);
  });
});

describe('blob regions', () => {
  const body = object('body', {
    shape: 'blob', size: [10, 6, 6],
    lobes: [{ id: 'kiri', at: [-0.6, 0, 0], r: 0.4 }, { id: 'kanan', at: [0.6, 0, 0], r: 0.4 }, { at: [0, 0, 0], r: 0.3 }],
  });

  it('lets a beat focus on one part of a single body', () => {
    const resolved = resolveIsoPlan(plan([body], { beats: [beat(null), beat('kiri', 'Kiri'), beat(null), beat(null)] }));
    expect(resolved.errors).toEqual([]);
    const world = buildIsoWorld(resolved, timing, view);
    expect(world.highlights).toEqual([{ id: 'body', lobe: 0, from: 70, to: 119 }]);
    const close = world.camera.find((key) => key.frame === 86)!;
    expect(close.zoom).toBeGreaterThan(world.camera[0].zoom);
    expect(close.target[0]).toBeLessThan(0);
    expect(world.labels![0].at[0]).toBeLessThan(0);
  });

  it('lets a link attach to a part', () => {
    const resolved = resolveIsoPlan(plan([body, object('box', { x: 12 })], {
      links: [{ id: 'pipe', through: ['box', 'kanan'], color: '#FFFFFF', radius: null, activeBeats: [] }],
    }));
    expect(resolved.errors).toEqual([]);
    const end = resolved.links[0].points.at(-1)!;
    expect(end[0]).toBeGreaterThan(0);
    expect(end[1]).toBeLessThanOrEqual(0.5 + 6);
  });

  it('keeps a part in focus without fading its own body', () => {
    const resolved = resolveIsoPlan(plan([body], { beats: [beat('kiri'), beat(null), beat(null), beat(null)] }));
    expect(buildIsoWorld(resolved, timing, view).ghosts).toEqual([]);
  });

  it('rejects a lobe id that collides with an object', () => {
    const clash = object('kiri', { x: 12 });
    expect(resolveIsoPlan(plan([clash, body])).errors.join()).toContain('Lobe id "kiri"');
  });

  it('can focus on a lobe buried inside the body', () => {
    const buried = object('body', { shape: 'blob', size: [8, 8, 8], lobes: [{ at: [0, 0, 0], r: 0.9 }, { id: 'inti', at: [0.3, 0, 0], r: 0.1 }] });
    const resolved = resolveIsoPlan(plan([buried], { beats: [beat('inti'), beat(null), beat(null), beat(null)] }));
    expect(resolved.errors).toEqual([]);
    expect(resolved.focus[0]).toBe('inti');
  });

  it('never drops a blob because its bounding box touches a neighbor', () => {
    const resolved = resolveIsoPlan(plan([object('skin', { size: [10, 1, 10] }), { ...body, x: 1 }]));
    expect(resolved.errors).toEqual([]);
    expect(find(resolved, 'body')).toBeDefined();
  });

  it('accepts a world that is one body', () => {
    expect(IsoPlanSchema.safeParse(plan([body])).success).toBe(true);
  });
});

describe('screens', () => {
  const screen = {
    face: 'left' as const, background: '#FFFFFF', ink: '#111111', accent: '#117A4B',
    states: [
      { fromBeat: 0, title: 'Kasir', items: [{ kind: 'row' as const, text: 'Kopi', value: null }] },
      { fromBeat: 2, title: 'Bayar', items: [{ kind: 'button' as const, text: 'Bayar', value: null }] },
    ],
  };

  it('turns beats into frames', () => {
    const world = buildIsoWorld(resolveIsoPlan(plan([object('hp', { screen })])), timing, view);
    expect(world.solids.find((solid) => solid.id === 'hp')?.screen?.states.map((state) => state.from)).toEqual([0, 120]);
  });

  it('never shows a state whose beat does not exist', () => {
    const late = { ...screen, states: [screen.states[0], { ...screen.states[1], fromBeat: 40 }] };
    const world = buildIsoWorld(resolveIsoPlan(plan([object('hp', { screen: late })])), timing, view);
    expect(world.solids.find((solid) => solid.id === 'hp')?.screen?.states[1].from).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('frames a screen tightly and drops its label', () => {
    const scene = (hp: IsoObject, labelled: string | null) => buildIsoWorld(resolveIsoPlan(plan([hp, object('other', { x: 14, size: [8, 1, 8] })], {
      beats: [beat('hp', labelled), beat('other', 'Lain'), beat(null), beat(null)],
    })), timing, view);
    const framed = scene(object('hp', { screen, size: [2, 2, 1] }), 'Layar');
    expect(framed.labels!.map((label) => label.text)).toEqual(['Lain']);
    expect(framed.camera[0].zoom).toBeGreaterThan(scene(object('hp', { size: [2, 2, 1] }), null).camera[0].zoom);
  });

  it('fades a link that would cross the screen in its close-up', () => {
    const resolved = resolveIsoPlan(plan([object('hp', { screen, size: [4, 7, 1] }), object('box', { x: 4 })], {
      beats: [beat('hp'), beat(null), beat(null), beat(null)],
      links: [{ id: 'pipe', through: ['box', 'hp'], color: '#FFFFFF', radius: null, activeBeats: [0] }],
    }));
    const world = buildIsoWorld(resolved, timing, view);
    expect(world.ghosts!.map((ghost) => ghost.id)).toContain('link-pipe');
    expect(world.flows).toEqual([]);
  });

  it('only allows a screen on a flat face', () => {
    const round = object('hp', { shape: 'cylinder', screen });
    expect(resolveIsoPlan(plan([round])).errors.join()).toContain('can hold a screen');
    const repaired = resolveIsoPlan(plan([round]), { repair: true });
    expect(find(repaired, 'hp').object.screen).toBeNull();
  });
});

describe('IsoPlanSchema', () => {
  it('rejects a color that is not a hex value', () => {
    const invalid = plan([1, 2, 3, 4, 5, 6].map((number) => object(`o${number}`, { x: number * 3 })));
    invalid.objects[0].color = 'red';
    expect(IsoPlanSchema.safeParse(invalid).success).toBe(false);
  });
});
