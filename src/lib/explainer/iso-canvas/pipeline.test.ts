import { describe, expect, it } from 'vitest';
import { assembleObjects, assembleScenes, buildWorldScenes, fitZoom, isoCanvasMainVideo, sceneTimings } from './assemble';
import { dryRunIsoCanvas } from './dry-run';
import { finishPlan, planProblems, type IsoCanvasPlan } from './plan';
import { canvasFinishedMessage } from './report';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import type { Storyboard } from '@/types/studio';

const beat = (text: string, focus: string | null, extra: Partial<IsoCanvasPlan['beats'][number]> = {}) => ({
  text, headline: 'Judul', accent: '', value: null, status: '', clock: null, focus, label: null, sticker: null, set: [], ...extra,
});

const plan: IsoCanvasPlan = {
  look: 'bright',
  unit: '%',
  palette: { ground: '#D9C3A5', hud: '#1E3A8A', hudText: '#FFFFFF', accent: '#FACC15', ink: '#111827' },
  background: { top: '#EEF2F7', bottom: '#DCE4EE' },
  setting: 'A small bedroom with a wooden desk and a desk fan on it.',
  objects: [
    { id: 'kipas', label: 'Kipas', look: 'A white desk fan with three blue blades behind a wire guard.', size: [0.4, 0.3, 0.5], at: [0, 0, 0.75], states: [{ key: 'putar', meaning: '0 still, 1 spinning fast' }] },
    { id: 'meja', label: 'Meja', look: 'A light wooden desk with four legs and a flat top.', size: [1.2, 0.6, 0.75], at: [0, 0, 0], states: [] },
  ],
  details: [{ id: 'motor', label: 'Motor', draw: 'Cutaway of the fan motor with copper coils.', objects: ['kipas'] }],
  beats: [
    beat('Ini kipas di meja kamar.', null),
    beat('Begitu dinyalakan, baling-baling kipas berputar.', 'kipas', { set: [{ object: 'kipas', key: 'putar', value: 1 }], label: 'Baling-baling kipas' }),
    beat('Di dalamnya ada motor kecil.', 'motor'),
  ],
};

const storyboard = {
  fps: 30,
  aspectRatio: '9:16',
  bgmTrack: 'calm',
  scenes: [
    { voiceoverText: 'Ini kipas di meja kamar.', durationInFrames: 90, audioUrl: '/a1.mp3', wordTimings: [], sfxCue: 'none', role: 'hook', kineticHeadline: '' },
    { voiceoverText: 'Begitu dinyalakan, baling-baling kipas berputar.', durationInFrames: 120, audioUrl: '/a2.mp3', wordTimings: [], sfxCue: 'none', role: 'body', kineticHeadline: '' },
    { voiceoverText: 'Di dalamnya ada motor kecil.', durationInFrames: 75, audioUrl: '/a3.mp3', wordTimings: [], sfxCue: 'none', role: 'cta', kineticHeadline: 'Coba sekarang' },
  ],
} as unknown as Storyboard;

const frame = { width: 1080, height: 1920 };

describe('canvas plan', () => {
  it('flags references to things the plan never defines', () => {
    const broken = { ...plan, beats: [...plan.beats.slice(0, 2), beat('x', 'pompa', { set: [{ object: 'kipas', key: 'nyala', value: 1 }] })] };
    const problems = planProblems(broken, 3);
    expect(problems.join(' ')).toMatch(/"pompa" is not an object or detail id/);
    expect(problems.join(' ')).toMatch(/state "nyala"/);
    expect(planProblems(plan, 4).join(' ')).toMatch(/exactly 4 beats/);
  });

  it('keeps narration word for word, drops invented numbers and ungrounded labels', () => {
    const raw = {
      ...plan,
      beats: [
        beat('ditulis ulang', null, { value: 90, headline: 'Kecepatan 90 km/jam' }),
        beat('ditulis ulang', 'kipas', { label: 'Motor 2000 rpm', set: [{ object: 'kipas', key: 'putar', value: 1 }] }),
        beat('ditulis ulang', 'tidak-ada'),
      ],
    };
    const story = plan.beats.map((item) => item.text);
    const finished = finishPlan(raw, story, 'Cara kerja kipas angin');
    expect(finished.beats.map((item) => item.text)).toEqual(story);
    expect(finished.beats[0].value).toBeNull();
    expect(finished.beats[0].headline).not.toMatch(/90/);
    expect(finished.beats[1].label).toBeNull();
    expect(finished.beats[2].focus).toBeNull();
    expect(finished.beats[1].set).toHaveLength(1);
  });

  it('keeps a label made of words from the line', () => {
    const finished = finishPlan(plan, plan.beats.map((item) => item.text), 'Cara kerja kipas angin');
    expect(finished.beats[1].label).toBe('Baling-baling kipas');
  });
});

describe('canvas scenes', () => {
  it('times scenes from the storyboard and carries camera and states between world scenes', () => {
    const timings = sceneTimings(storyboard);
    expect(timings).toEqual([{ start: 0, duration: 3 }, { start: 3, duration: 4 }, { start: 7, duration: 2.5 }]);
    const scenes = buildWorldScenes(plan, timings, frame);
    expect(scenes[2]).toBeNull();
    const [first, second] = scenes as NonNullable<(typeof scenes)[number]>[];
    expect(second.camera[0].look).toEqual(first.camera[2].look);
    expect(second.camera[0].zoom).toBeCloseTo(first.camera[2].zoom);
    expect(second.states.kipas.putar).toBe(0);
    expect(second.changes?.[0]).toMatchObject({ object: 'kipas', key: 'putar', to: 1 });
    expect(second.labels?.[0]?.text).toBe('Baling-baling kipas');
  });

  it('zooms in closer on small objects than on the whole world', () => {
    expect(fitZoom([0.4, 0.3, 0.5], frame)).toBeGreaterThan(fitZoom([1.2, 0.6, 1.25], frame));
  });

  it('assembles files that pass the dry run and a MainVideo that passes the validator', () => {
    const objects = assembleObjects([
      `export function drawKipas(iso: Iso, state: Record<string, number>, t: number) {\n  iso.cyl('z', 0, 0, 0, 0.12, 0.4, '#E2E8F0');\n  iso.rotate('y', (state.putar ?? 0) * t * 10, [0, 0.1, 0.4], () => iso.box(-0.03, 0.1, 0.3, 0.06, 0.02, 0.2, '#38BDF8'));\n}`,
      `export function drawMeja(iso: Iso, state: Record<string, number>, t: number) {\n  void state; void t;\n  iso.box(-0.6, -0.3, 0.7, 1.2, 0.6, 0.05, '#C8A27A');\n}`,
    ]);
    const world = `import type { Iso, IsoStates } from '@/motion-kit';\nimport { drawKipas, drawMeja } from './IsoObjects';\n\nexport function drawWorld(iso: Iso, t: number, states: IsoStates) {\n  iso.background('#EEF2F7', '#DCE4EE');\n  iso.ground('#D9C3A5');\n  drawMeja(iso, {}, t);\n  iso.at(0, 0, 0.75, () => drawKipas(iso, states.kipas ?? {}, t));\n}\n`;
    const timings = sceneTimings(storyboard);
    const scenes = assembleScenes(buildWorldScenes(plan, timings, frame), [null, null, { start: 7, duration: 2.5, body: "iso.background('#F8FAFC');\niso.look(0, 0, 0.3, 900);\ndrawKipas(iso, { putar: 1 }, t);" }], ['drawKipas', 'drawMeja']);
    const report = dryRunIsoCanvas({ 'IsoObjects.ts': objects, 'IsoWorld.ts': world, 'IsoScenes.ts': scenes });
    expect(report.problems).toEqual([]);
    const main = isoCanvasMainVideo(storyboard, plan);
    expect(validateSceneCode(main, 'MainVideo.tsx').errors).toEqual([]);
    expect(main).toContain('"cta":{"text":"Coba sekarang"');
    expect(main).not.toContain('"set"');
  });
});

describe('canvas editor message', () => {
  it('names stand-ins and weak drawings with their score', () => {
    const message = canvasFinishedMessage({
      threshold: 6,
      items: [
        { kind: 'object', id: 'kipas', label: 'Kipas', score: 6.4, rounds: 1, passed: true, fallback: false, issues: [], history: [6.4] },
        { kind: 'world', id: 'world', label: 'Dunia', score: 5.2, rounds: 3, passed: false, fallback: false, issues: ['Tanah berhenti di tengah frame.'], history: [4.8, 5.2, 5] },
        { kind: 'detail', id: 'motor-3', label: 'Motor', score: null, rounds: 0, passed: false, fallback: true, issues: [], history: [] },
      ],
    });
    expect(message).toMatch(/close-up "Motor" gagal dibuat AI/);
    expect(message).toMatch(/di bawah 6 untuk dunia "Dunia" \(skor 5,2\)/);
    expect(message).not.toMatch(/Tanah berhenti/);
    expect(message).not.toMatch(/\.\./);
  });

  it('says so when everything passed', () => {
    expect(canvasFinishedMessage({ threshold: 5.5, items: [] })).toMatch(/mencapai skor penilai 5,5 atau lebih/);
  });
});

describe('canvas framing per aspect ratio', () => {
  it('keeps landscape subjects above the caption and portrait subjects below the panel', async () => {
    const { viewBand } = await import('./assemble');
    expect(viewBand({ width: 1920, height: 1080 })).toEqual({ center: 0.5, height: 0.5 });
    expect(viewBand({ width: 1080, height: 1920 }).center).toBeGreaterThan(0.55);
    const timings = sceneTimings(storyboard);
    const landscape = buildWorldScenes(plan, timings, { width: 1920, height: 1080 });
    expect(landscape[0]?.anchorY).toBe(0.5);
  });

  it('drops the extra line from close-up labels', async () => {
    const { createIso } = await import('@/motion-kit/iso-canvas/engine');
    const { paintIsoScene } = await import('@/motion-kit/iso-canvas/scenes');
    const texts: string[] = [];
    const ctx = new Proxy({ measureText: (text: string) => ({ width: text.length * 10 }) } as Record<string, unknown>, {
      get: (object, key) => (typeof key === 'string' && key in object ? object[key] : key === 'fillText' ? (text: string) => texts.push(text) : () => undefined),
      set: (object, key, value) => { object[key as string] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    const iso = createIso(ctx, 1080, 1920);
    paintIsoScene(iso, { kind: 'detail', start: 0, duration: 2, draw: (target) => target.label(0, 0, 0, 'Motor', { sub: 'Kawat tembaga berarus' }) }, 1, () => undefined);
    iso.finish();
    expect(texts).toEqual(['Motor']);
  });
});
