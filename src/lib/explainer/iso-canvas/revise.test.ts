import { describe, expect, it, vi } from 'vitest';
import type { StudioProject } from '@/types/studio';
import { assembleObjects, assembleScenes, buildWorldScenes, sceneTimings } from './assemble';
import { worldFile } from './build';
import { applyMotion, detailBodies, matchClose, readFunction, replaceFunction, worldBody } from './code-parts';
import { dryRunIsoCanvas } from './dry-run';
import type { IsoCanvasPlan } from './plan';

const chat = vi.hoisted(() => ({ reply: '' }));
vi.mock('../asset-generator', async (original) => ({
  ...(await original<typeof import('../asset-generator')>()),
  callChat: vi.fn(async () => ({ text: chat.reply, finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1, seconds: 0 } })),
}));

const { clearDestination, resolveTarget, reviseIsoCanvas, walkInstruction } = await import('./revise');

const KIPAS = `export function drawKipas(iso: Iso, state: Record<string, number>, t: number) {
  const label = \`spin \${'{'}\`; // a brace inside a template and a comment: {
  void label;
  iso.shadow(-1, -1, 2, 2);
  iso.cyl('z', 0, 0, 0, 1, 0.2, '#E2E8F0');
  iso.rotate('y', (state.putar ?? 0) * t * 12, [0, 0.3, 2.8], () => {
    iso.box(-0.15, 0.25, 2.8, 0.3, 0.05, 1, '#38BDF8');
  });
}`;
const MEJA = `export function drawMeja(iso: Iso, state: Record<string, number>, t: number) {
  void state;
  void t;
  iso.box(-1, -0.5, 0, 2, 1, 0.75, '#A16207');
}`;
const DETAIL = `iso.background('#F8FAFC');
iso.look(0, 0, 2.8, 260);
if (t > 1) {
  drawKipas(iso, { putar: 1 }, t);
}`;

const plan: IsoCanvasPlan = {
  look: 'bright',
  unit: '',
  palette: { ground: '#D9C3A5', hud: '#0F172A', hudText: '#FFFFFF', accent: '#38BDF8', ink: '#1F2421' },
  background: { top: '#EEF2F7', bottom: '#DCE4EE' },
  setting: 'A small home office with a desk and a desk fan.',
  objects: [
    { id: 'kipas', label: 'Kipas', look: 'A desk fan with blades and a round base.', size: [2, 2, 3.8], at: [0, 0, 0], states: [{ key: 'putar', meaning: 'blades still to spinning' }] },
    { id: 'meja', label: 'Meja', look: 'A plain wooden desk with four legs.', size: [2, 1, 0.75], at: [3, 0, 0], states: [] },
  ],
  details: [{ id: 'motor', label: 'Motor', draw: 'The motor inside the fan head turning the blades.', objects: ['kipas'] }],
  beats: [
    { text: 'Kipas angin berputar di atas meja kerja.', headline: 'Kipas', accent: 'Kipas', value: null, status: '', clock: null, focus: 'kipas', label: 'Kipas angin', sticker: null, set: [{ object: 'kipas', key: 'putar', value: 1 }] },
    { text: 'Di dalamnya ada motor yang memutar baling-baling.', headline: 'Motor', accent: 'Motor', value: null, status: '', clock: null, focus: 'motor', label: null, sticker: null, set: [] },
  ],
} as IsoCanvasPlan;

const scene = (id: string, text: string) => ({
  id, title: id, voiceoverText: text, kineticHeadline: '', visualPrompt: '', durationInFrames: 90, role: 'narrative', wordTimings: [],
});

function makeProject(): StudioProject {
  const storyboard = { aspectRatio: '9:16', fps: 30, preset: 'world', bgmTrack: null, scenes: [scene('s1', plan.beats[0].text), scene('s2', plan.beats[1].text)] };
  const frame = { width: 1080, height: 1920 };
  const timings = sceneTimings(storyboard as never);
  const files = {
    'IsoObjects.ts': assembleObjects([KIPAS, MEJA]),
    'IsoWorld.ts': worldFile(plan, `export function drawWorld(iso: Iso, t: number, states: IsoStates) {\n  iso.background('#EEF2F7', '#DCE4EE');\n  iso.ground('#D9C3A5');\n  iso.at(3, 0, 0, () => drawMeja(iso, states['meja'] ?? {}, t));\n  drawKipas(iso, states['kipas'] ?? {}, t);\n}`),
    'IsoScenes.ts': assembleScenes(buildWorldScenes(plan, timings, frame), [null, { start: timings[1].start, duration: timings[1].duration, body: DETAIL }], ['drawKipas', 'drawMeja']),
  };
  return { id: 'proj_test', userPrompt: 'Gimana kipas angin bekerja?', storyboard, files, chatHistory: [], status: 'ready', isoEngine: 'canvas', isoCanvasPlan: plan } as unknown as StudioProject;
}

describe('iso canvas code parts', () => {
  it('reads and replaces one object function, skipping braces in strings and comments', () => {
    const file = assembleObjects([KIPAS, MEJA]);
    expect(readFunction(file, 'drawKipas')).toBe(KIPAS);
    expect(readFunction(file, 'drawMeja')).toBe(MEJA);
    const replaced = replaceFunction(file, 'drawKipas', KIPAS.replace('#38BDF8', '#F97316'))!;
    expect(replaced).toContain('#F97316');
    expect(readFunction(replaced, 'drawMeja')).toBe(MEJA);
  });

  it('reads close-up bodies back from IsoScenes.ts', () => {
    const files = makeProject().files;
    expect(detailBodies(files['IsoScenes.ts'])).toEqual([DETAIL]);
    expect(worldBody(files['IsoWorld.ts'])).toMatch(/^export function drawWorld/);
  });

  it('returns -1 for unbalanced code', () => {
    expect(matchClose('{ a(', 0)).toBe(-1);
  });

  it('starts from a valid fixture', () => {
    const files = makeProject().files;
    expect(dryRunIsoCanvas({ 'IsoObjects.ts': files['IsoObjects.ts'], 'IsoWorld.ts': files['IsoWorld.ts'], 'IsoScenes.ts': files['IsoScenes.ts'] }).problems).toEqual([]);
  });
});

describe('iso canvas revision target', () => {
  const worldScenes = [{} as never, null];

  it('keeps only targets that exist', () => {
    expect(resolveTarget({ target: 'object', object: 'kipas', instruction: 'Add a wire guard.' }, plan, worldScenes, null)).toEqual({ target: 'object', object: 'kipas', instruction: 'Add a wire guard.' });
    expect(resolveTarget({ target: 'object', object: 'kulkas', instruction: 'x' }, plan, worldScenes, null).target).toBe('none');
    expect(resolveTarget({ target: 'detail', scene: 1, instruction: 'x' }, plan, worldScenes, null).target).toBe('none');
    expect(resolveTarget({ target: 'detail', scene: 2, instruction: 'Show copper coils.' }, plan, worldScenes, null)).toMatchObject({ target: 'detail', scene: 1 });
  });

  it('uses the picked scene for camera changes and asks for one when missing', () => {
    expect(resolveTarget({ target: 'shot', scene: null, zoomScale: 1.4 }, plan, worldScenes, 0)).toMatchObject({ target: 'shot', scene: 0, zoomScale: 1.4 });
    const missing = resolveTarget({ target: 'shot', scene: null, zoomScale: 1.4 }, plan, worldScenes, null);
    expect(missing).toMatchObject({ target: 'none' });
  });
});

describe('reviseIsoCanvas', () => {
  it('moves the camera closer without new drawing code and keeps the close-up', async () => {
    chat.reply = JSON.stringify({ target: 'shot', scene: 1, zoomScale: 1.5, focus: null, label: null });
    const project = makeProject();
    const result = await reviseIsoCanvas('test-model', project, 'Adegan 1 kameranya lebih dekat', null);
    expect(result.changed).toBe(true);
    expect(result.reply).toMatch(/Adegan 1: kamera lebih dekat/);
    expect(result.project.isoCanvasPlan!.beats[0].zoomScale).toBe(1.5);
    expect(result.project.files['IsoObjects.ts']).toBe(project.files['IsoObjects.ts']);
    expect(detailBodies(result.project.files['IsoScenes.ts'])).toEqual([DETAIL]);
    expect(result.project.files['IsoScenes.ts']).not.toBe(project.files['IsoScenes.ts']);
  });

  it('drops a label whose words are not in the narration', async () => {
    chat.reply = JSON.stringify({ target: 'shot', scene: 1, label: 'Hemat 90 persen' });
    const result = await reviseIsoCanvas('test-model', makeProject(), 'Ganti label adegan 1', null);
    expect(result.reply).toMatch(/tidak dipakai/);
    expect(result.project.isoCanvasPlan!.beats[0].label).toBeNull();
  });

  it('leaves the video alone when the request cannot be acted on', async () => {
    chat.reply = JSON.stringify({ target: 'none', reason: 'Narasi tidak bisa diubah di sini.' });
    const project = makeProject();
    const result = await reviseIsoCanvas('test-model', project, 'Ganti suaranya', null);
    expect(result).toEqual({ project, changed: false, reply: 'Narasi tidak bisa diubah di sini.' });
  });
});

describe('motion', () => {
  it('wraps objects so the engine moves them and restores names when motion is gone', () => {
    const file = assembleObjects([KIPAS, MEJA]);
    const moved = applyMotion(file, [{ name: 'drawKipas', at: [0, 0, 0], path: { key: 'jalan', to: [0, 3, 0] } }, { name: 'drawMeja', at: [3, 0, 0] }]);
    expect(moved).toContain('function drawKipasShape(');
    expect(moved).toContain("const k = state['jalan'] ?? 0;");
    expect(moved).toContain('iso.defer(() => iso.at(0 * k, 3 * k, 0 * k, () => drawKipasShape(iso, state, t)), 3 * k);');
    expect(moved).toContain('iso.defer(() => drawMejaShape(iso, state, t));');
    // Rebuilding is idempotent, and no path gives the original file back.
    expect(applyMotion(moved, [{ name: 'drawKipas', at: [0, 0, 0], path: { key: 'jalan', to: [0, 3, 0] } }, { name: 'drawMeja', at: [3, 0, 0] }])).toBe(moved);
    expect(applyMotion(moved, [{ name: 'drawKipas', at: [0, 0, 0] }, { name: 'drawMeja', at: [3, 0, 0] }]).trim()).toBe(file.trim());
  });

  it('makes an object walk and times another state to its arrival', async () => {
    chat.reply = JSON.stringify({ target: 'motion', scene: 1, object: 'kipas', moveTo: [0, 3, 0], moveAt: 0.2, moveOver: 2, events: [{ object: 'kipas', key: 'putar', value: 1, at: 1.5 }, { object: 'meja', key: 'tidakAda', value: 1, at: 1 }] });
    const project = makeProject();
    const result = await reviseIsoCanvas('test-model', project, 'Kipasnya jalan ke depan lalu berputar', null);
    expect(result.changed).toBe(true);
    const plan = result.project.isoCanvasPlan!;
    expect(plan.objects[0].path).toEqual({ key: 'jalan', to: [0, 3, 0] });
    expect(plan.objects[0].states.map((state) => state.key)).toEqual(['putar', 'jalan']);
    // The unknown state on meja is dropped; the walk and the timed spin are kept.
    expect(plan.beats[0].set).toEqual([{ object: 'kipas', key: 'jalan', value: 1, at: 0.2, over: 2 }, { object: 'kipas', key: 'putar', value: 1, at: 1.5, over: 0.4 }]);
    expect(result.project.files['IsoObjects.ts']).toContain('function drawKipasShape(');
    expect(result.project.files['IsoScenes.ts']).toMatch(/"key": "jalan"[\s\S]*"from": 0.2/);
    expect(detailBodies(result.project.files['IsoScenes.ts'])).toEqual([DETAIL]);
    expect(result.reply).toMatch(/Adegan 1: "Kipas" kini berpindah dari detik 0,2 sampai 2,2/);
  });

  it('refuses motion in a close-up scene', async () => {
    chat.reply = JSON.stringify({ target: 'motion', scene: 2, object: 'kipas', moveTo: [0, 3, 0] });
    const result = await reviseIsoCanvas('test-model', makeProject(), 'Kipas berjalan di adegan 2', null);
    expect(result.changed).toBe(false);
    expect(result.reply).toMatch(/close-up/);
  });
});

describe('clearDestination', () => {
  it('moves a destination that lands on another object further along the trip', () => {
    const walkers = {
      ...plan,
      objects: [
        { ...plan.objects[0], id: 'a', at: [0, -1.8, 0], size: [0.55, 0.45, 1.75] },
        { ...plan.objects[0], id: 'b', at: [0, 1.8, 0], size: [0.55, 0.45, 1.75] },
      ],
    } as IsoCanvasPlan;
    const to = clearDestination(walkers, 'a', [0, 1.8, 0]);
    expect(to[0]).toBe(0);
    expect(to[1]).toBeGreaterThanOrEqual(1.8 + 0.45 + 0.35);
    expect(clearDestination(walkers, 'a', [0, 0.5, 0])).toEqual([0, 0.5, 0]);
  });
});

describe('walking', () => {
  it('asks for steps only while travelling, facing the way it walks', () => {
    const text = walkInstruction('jalan', '+y');
    expect(text).toMatch(/strictly between 0 and 1/);
    expect(text).toMatch(/state\["jalan"\]/);
    expect(text).toMatch(/face \+y/);
    expect(text).toMatch(/Do not move the object yourself/);
  });

  it('only walks when there is a mover', () => {
    const worldScenes = [{} as never, null];
    expect(resolveTarget({ target: 'motion', scene: 1, object: 'kipas', moveTo: [0, 3, 0], walks: true }, plan, worldScenes, null)).toMatchObject({ walks: true });
    expect(resolveTarget({ target: 'motion', scene: 1, walks: true, events: [{ object: 'kipas', key: 'putar', value: 1, at: 1 }] }, plan, worldScenes, null)).toMatchObject({ walks: false, object: null });
  });
});
