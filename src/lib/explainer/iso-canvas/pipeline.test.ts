import { describe, expect, it } from 'vitest';
import { assembleObjects, assembleScenes, buildWorldScenes, fitZoom, isoCanvasMainVideo, isoTitleFrames, sceneTimings } from './assemble';
import { dryRunIsoCanvas } from './dry-run';
import { finishPlan, planProblems, type IsoCanvasPlan } from './plan';
import { canvasFinishedMessage } from './report';
import { captionMoments, captionProblems, captionTask, panelMoments, panelProblems, panelTask, missingObjectCalls, titleProblems, titleTask, titleText, type IsoTaskContext } from './build';
import { captionAt } from '@/motion-kit/world/caption-track';
import { panelAt, PANEL_MAX_BOTTOM } from '@/motion-kit/world/panel-track';
import { DETAIL_SYSTEM, detailRequest } from './prompts';
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

describe('canvas close-up objects', () => {
  const detail = plan.details[0];

  it('rejects a close-up that redraws a listed object instead of calling its function', () => {
    const redrawn = `iso.background('#fff', '#eee');\n// drawKipas(iso, {}, t) is not used here\niso.box(0, 0, 0, 0.4, 0.3, 0.5, '#ffffff');`;
    expect(missingObjectCalls(detail, redrawn)).toEqual([expect.stringContaining('drawKipas')]);
  });

  it('accepts a close-up that calls every listed object function', () => {
    const reused = `iso.background('#fff', '#eee');\niso.at(0, 0, 0.75, () => drawKipas(iso, { putar: 1 }, t));\niso.pipe([[0, 0, 1], [0.1, 0, 1]], 0.02, '#c87533');`;
    expect(missingObjectCalls(detail, reused)).toEqual([]);
  });

  it('tells the close-up writer how listed objects look and where they stand', () => {
    const request = detailRequest(plan, detail, 'Di dalamnya ada motor kecil.', 2.5);
    expect(request).toContain('A white desk fan with three blue blades');
    expect(request).toContain('World position [0, 0, 0.75]');
    expect(request).toContain('must call');
    expect(DETAIL_SYSTEM).toContain('Never redraw a listed object');
  });
});

const TITLE = `import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTitleFont } from '@/motion-kit';

export const TITLE_TEXT = ['Kipas di meja', 'MOTOR KECIL', 'di dalamnya'];

export const TitleCard: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const display = useTitleFont('Bebas Neue', 400);
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const exit = interpolate(frame, [duration - 12, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ top: height * 0.08, height: height * 0.45, alignItems: 'center', opacity: exit }}>
      <div style={{ fontFamily: display, fontSize: width * 0.04 }}>{TITLE_TEXT[0]}</div>
      <div style={{ fontFamily: display, fontSize: width * 0.14, transform: \`scale(\${enter})\` }}>{TITLE_TEXT[1]}</div>
      <div style={{ fontFamily: display, fontSize: width * 0.035 }}>{TITLE_TEXT[2]}</div>
    </AbsoluteFill>
  );
};
`;

describe('canvas title card', () => {
  const source = 'Kipas angin\nIni kipas di meja kamar.\nDi dalamnya ada motor kecil.';

  it('accepts a title that follows the contract', () => {
    expect(titleText(TITLE)).toEqual(['Kipas di meja', 'MOTOR KECIL', 'di dalamnya']);
    expect(titleProblems(TITLE, source)).toEqual([]);
  });

  it('rejects numbers the narration never states', () => {
    const code = TITLE.replace("'MOTOR KECIL'", "'3000 RPM'");
    expect(titleProblems(code, source)).toEqual([expect.stringContaining('3000')]);
    expect(titleProblems(code, `${source}\nMotor berputar 3.000 kali.`)).toEqual([]);
  });

  it('rejects unknown fonts, a missing text list, and forbidden code', () => {
    expect(titleProblems(TITLE.replace("'Bebas Neue'", "'Comic Sans'"), source)).toEqual([expect.stringContaining('Comic Sans')]);
    expect(titleProblems(TITLE.replace(/export const TITLE_TEXT[^\n]*\n/, ''), source)[0]).toMatch(/TITLE_TEXT/);
    expect(titleProblems(TITLE.replace('const frame = useCurrentFrame();', 'const frame = useCurrentFrame() + Math.random();'), source).length).toBeGreaterThan(0);
  });

  it('keeps the card shorter than the first scene so its panel still shows', () => {
    expect(isoTitleFrames(storyboard)).toBe(66);
    expect(isoTitleFrames({ ...storyboard, scenes: [{ ...storyboard.scenes[0], durationInFrames: 150 }] } as Storyboard)).toBe(96);
  });

  it('adds the title to MainVideo only when asked, and the result still validates', () => {
    const plain = isoCanvasMainVideo(storyboard, plan);
    const titled = isoCanvasMainVideo(storyboard, plan, { title: true });
    expect(plain).not.toContain('IsoTitle');
    expect(titled).toContain("import { TitleCard } from './IsoTitle';");
    expect(titled).toContain('title={TitleCard} titleFrames={66}');
    expect(validateSceneCode(titled, 'MainVideo.tsx').valid).toBe(true);
  });

  it('sets up the title task for a plan with several beats', () => {
    const ctx = { model: 'test', plan, frame, topic: 'Kipas', browser: null } as unknown as IsoTaskContext;
    const task = titleTask(ctx, { topic: 'Kipas', title: 'Kipas angin', narration: storyboard.scenes.map((scene) => scene.voiceoverText), frames: 66, fps: 30 });
    expect(task.kind).toBe('title');
    expect(task.check(TITLE)).toEqual([]);
  });

  it('tells the editor plainly when the title was left out', () => {
    const item = { kind: 'title' as const, id: 'title', label: 'Judul pembuka', score: null, rounds: 1, passed: false, fallback: true, issues: [], history: [] };
    expect(canvasFinishedMessage({ threshold: 6, items: [item] })).toContain('dibuka dengan panel judul biasa');
  });
});

const CAPTION = `import React from 'react';
import { interpolate, useVideoConfig } from 'remotion';
import { useTitleFont, type CaptionProps } from '@/motion-kit';

export const CaptionCard: React.FC<CaptionProps> = ({ words }) => {
  const { width } = useVideoConfig();
  const font = useTitleFont('Oswald', 600);
  return (
    <div style={{ fontFamily: font, fontSize: width * 0.055, textAlign: 'center', color: '#fff', textShadow: '0 4px 12px #000' }}>
      {words.map((word, index) => (
        <span key={index} style={{ color: word.state === 'active' ? '#FFD34E' : '#fff', opacity: interpolate(word.since, [-1, 0, 4], [0.6, 0.6, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{word.text} </span>
      ))}
    </div>
  );
};
`;

const timings = ['Di', 'dalamnya', 'ada', 'motor', 'kecil', 'yang', 'berputar', 'cepat'].map((word, index) => ({ word, startMs: index * 400, endMs: index * 400 + 300 }));

describe('canvas caption design', () => {
  it('accepts a caption design that follows the contract and rejects broken ones', () => {
    expect(captionProblems(CAPTION)).toEqual([]);
    expect(captionProblems(CAPTION.replace("'Oswald'", "'Papyrus'"))[0]).toContain('Papyrus');
    expect(captionProblems(CAPTION.replace('export const CaptionCard', 'export const Captions'))[0]).toContain('CaptionCard');
    expect(captionProblems(CAPTION.replace('{word.text} ', 'kata ')).length).toBe(1);
  });

  it('groups words by five and marks the spoken one, as the plain caption did', () => {
    const early = captionAt(timings, 30 * 0.9, 30)!;
    expect(early.group).toBe(0);
    expect(early.words.map((word) => word.state)).toEqual(['past', 'past', 'active', 'future', 'future']);
    const late = captionAt(timings, 30 * 2.5, 30)!;
    expect(late.group).toBe(1);
    expect(late.words.map((word) => word.text)).toEqual(['yang', 'berputar', 'cepat']);
    expect(late.words[1].since).toBeGreaterThan(0);
    expect(captionAt([], 10, 30)).toBeNull();
  });

  it('samples moments in both caption groups', () => {
    const moments = captionMoments(timings);
    expect(moments.length).toBe(5);
    expect(captionAt(timings, moments[0] * 30, 30)!.group).toBe(0);
    expect(captionAt(timings, moments[4] * 30, 30)!.group).toBe(1);
  });

  it('sets up the caption task and wires the design into MainVideo', () => {
    const ctx = { model: 'test', plan, frame, topic: 'Kipas', browser: null } as unknown as IsoTaskContext;
    const task = captionTask(ctx, { topic: 'Kipas', title: 'Kipas angin', wordTimings: timings, sample: 'Di dalamnya ada motor kecil.', titleCode: TITLE });
    expect(task.kind).toBe('caption');
    expect(task.request).toContain("useTitleFont('Bebas Neue', 400)");
    const main = isoCanvasMainVideo(storyboard, plan, { caption: true });
    expect(main).toContain("import { CaptionCard } from './IsoCaption';");
    expect(main).toContain('caption={CaptionCard}');
    expect(main).not.toContain('IsoTitle');
    expect(validateSceneCode(main, 'MainVideo.tsx').valid).toBe(true);
  });

  it('tells the editor when captions fell back to the plain look', () => {
    const item = { kind: 'caption' as const, id: 'caption', label: 'Subtitle', score: null, rounds: 1, passed: false, fallback: true, issues: [], history: [] };
    expect(canvasFinishedMessage({ threshold: 6, items: [item] })).toContain('subtitle memakai tampilan biasa');
  });
});

const PANEL = `import React from 'react';
import { interpolate, useVideoConfig } from 'remotion';
import { useTitleFont, type PanelProps } from '@/motion-kit';

export const PanelCard: React.FC<PanelProps> = ({ headline, accent, status, since, safeTop, maxBottom }) => {
  const { width } = useVideoConfig();
  const font = useTitleFont('Space Grotesk', 700);
  const enter = interpolate(since, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const [before, after] = accent ? headline.split(accent) : [headline, ''];
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: maxBottom, background: 'linear-gradient(#0b1d33ee, #0b1d3300)' }}>
      <div style={{ position: 'absolute', top: safeTop, left: width * 0.07, right: width * 0.07, fontFamily: font, fontSize: width * 0.058, color: '#fff', opacity: enter }}>
        {before}{accent ? <span style={{ color: '#7dd3fc' }}>{accent}</span> : null}{after}
        {status ? <div style={{ fontSize: width * 0.026 }}>{status}</div> : null}
      </div>
    </div>
  );
};
`;

describe('canvas panel design', () => {
  it('accepts a panel that follows the contract and rejects broken ones', () => {
    expect(panelProblems(PANEL)).toEqual([]);
    expect(panelProblems(PANEL.replace("'Space Grotesk'", "'Arial'"))[0]).toContain('Arial');
    expect(panelProblems(PANEL.replace('export const PanelCard', 'export const Panel'))[0]).toContain('PanelCard');
    expect(panelProblems(PANEL.replaceAll('maxBottom', 'limit'))[0]).toContain('maxBottom');
  });

  it('gives the panel only stated numbers, counting up within a scene', () => {
    const beats = [
      { headline: 'Awal', accent: '', status: '', clock: null, value: null, from: 0, duration: 60 },
      { headline: 'Naik ke 40', accent: '40', status: 'Naik', clock: null, value: 40, from: 60, duration: 60 },
    ];
    const first = panelAt(beats, '%', 0, 10, 30, 1920, 0);
    expect(first.number).toEqual({ reached: false, value: 0, unit: '%', history: [], all: [40] });
    expect(first.accent).toBeNull();
    const second = panelAt(beats, '%', 1, 60 + 42, 30, 1920, 0);
    expect(second.number?.value).toBe(40);
    expect(second.accent).toBe('40');
    expect(second.since).toBe(42);
    expect(second.maxBottom).toBeCloseTo(1920 * PANEL_MAX_BOTTOM);
    expect(panelAt([beats[0]], '%', 0, 0, 30, 1920, 0).number).toBeNull();
  });

  it('samples arrival and hold moments across three scenes', () => {
    expect(panelMoments(6)).toEqual([0.2, 1.3, 2.4000000000000004, 3.5, 5.7]);
    expect(panelMoments(1)).toEqual([0.2, 1.3]);
  });

  it('sets up the panel task and wires the design into MainVideo', () => {
    const ctx = { model: 'test', plan, frame, topic: 'Kipas', browser: null } as unknown as IsoTaskContext;
    const task = panelTask(ctx, { topic: 'Kipas', title: 'Kipas angin', titleCode: TITLE, fps: 30 });
    expect(task.kind).toBe('panel');
    expect(task.request).toContain('Scene headlines in this video: "Judul"');
    expect(task.request).toContain('states no numbers');
    const main = isoCanvasMainVideo(storyboard, plan, { title: true, caption: true, panel: true });
    expect(main).toContain("import { PanelCard } from './IsoPanel';");
    expect(main).toContain('caption={CaptionCard} panel={PanelCard}');
    expect(validateSceneCode(main, 'MainVideo.tsx').valid).toBe(true);
  });

  it('tells the editor when the panel fell back to the plain look', () => {
    const item = { kind: 'panel' as const, id: 'panel', label: 'Panel judul adegan', score: null, rounds: 1, passed: false, fallback: true, issues: [], history: [] };
    expect(canvasFinishedMessage({ threshold: 6, items: [item] })).toContain('panel memakai tampilan biasa');
  });
});
