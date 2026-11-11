import { describe, expect, it } from 'vitest';
import { assembleStoryPlaces, assembleStoryProps, assembleStoryScenes, buildStoryScenes, mapsByProp, storyCanvasMainVideo } from './assemble';
import { detailProblems, fallbackDetail, fallbackPlace, fallbackProp, mapProblems, missingPropCalls, placeProblems, placeSamples, propProblems } from './build';
import { validateStoryCanvasFile } from './contract';
import { dryRunStoryCanvas, readPropMaps } from './dry-run';
import { EXAMPLE_CHEST, EXAMPLE_HEART, EXAMPLE_PLACE, EXAMPLE_PROP } from './examples';
import { finishStoryPlan, storyPlanProblems, type StoryCanvasPlan } from './plan';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import type { Storyboard } from '@/types/studio';

const FRAME = { width: 1080, height: 1920 };

const beat = (overrides: Partial<StoryCanvasPlan['beats'][number]>): StoryCanvasPlan['beats'][number] => ({
  text: 'Kalimat', headline: 'Judul', accent: 'Judul', value: null, status: 'mulai', clock: null, sticker: null, place: 'dapur', focus: null, label: null, actors: [], set: [], ...overrides,
});

const PLAN: StoryCanvasPlan = {
  look: 'bright',
  unit: '%',
  palette: { ground: '#D9B48A', hud: '#1F4E79', hudText: '#FFFFFF', accent: '#F4A261', ink: '#1F2421' },
  cast: [{ id: 'ibu', label: 'Ibu', height: 1.62, skin: '#E0AC85', hair: '#C2556B', hairStyle: 'hijab', top: '#F4F1EA', bottom: '#4A5568', shoes: '#2F3540', sleeves: 'long', apron: '#E76F51', coat: null, glasses: null }],
  places: [{ id: 'dapur', label: 'Dapur', look: 'A warm home kitchen with a window and a counter from x=2.5 to x=4.2.', width: 5 }],
  props: [
    { id: 'adonan', label: 'Adonan', look: 'A blue bowl of bread dough that rises.', size: [0.64, 0.3], place: 'dapur', at: [3.3, 0.92], surface: null, states: [{ key: 'naik', meaning: '0 flat dough, 1 risen dome' }] },
    { id: 'kursi', label: 'Kursi', look: 'A simple wooden chair with a back.', size: [0.5, 0.9], place: 'dapur', at: [1.0, 0], surface: 0.46, states: [] },
  ],
  details: [{ id: 'gelembung', label: 'Gelembung gas', draw: 'A magnified circle showing gas bubbles growing inside the dough.', props: ['adonan'] }],
  beats: [
    beat({ text: 'Kenapa adonan bisa mengembang?', focus: 'adonan', actors: [{ cast: 'ibu', x: 2.5, facing: 1, pose: 'explain', poseTo: 'point', walkTo: null, on: null, hold: null, face: 'smile' }] }),
    beat({ text: 'Ragi makan gula di adonan.', focus: 'gelembung', set: [{ prop: 'adonan', key: 'naik', value: 0.5 }] }),
    beat({ text: 'Ibu duduk menunggu adonan naik.', focus: 'ibu', label: 'adonan naik', actors: [{ cast: 'ibu', x: 1.0, facing: 1, pose: 'sit', on: 'kursi', face: 'smile' }], set: [{ prop: 'adonan', key: 'naik', value: 1 }] }),
  ],
};

const TIMINGS = [{ start: 0, duration: 3 }, { start: 3, duration: 2.5 }, { start: 5.5, duration: 3 }];

describe('story canvas plan', () => {
  it('accepts a consistent plan and reports broken references', () => {
    expect(storyPlanProblems(PLAN, 3)).toEqual([]);
    const broken: StoryCanvasPlan = {
      ...PLAN,
      beats: [beat({ focus: 'oven', actors: [{ cast: 'ayah', x: 9, facing: 1, pose: 'lie' }] }), ...PLAN.beats.slice(1)],
    };
    const problems = storyPlanProblems(broken, 3).join('\n');
    expect(problems).toContain('focus "oven"');
    expect(problems).toContain('unknown cast "ayah"');
    expect(problems).toContain('pose lie');
  });

  it('keeps the narration, drops ungrounded labels, and stands up a sitter without a seat', () => {
    const raw: StoryCanvasPlan = {
      ...PLAN,
      beats: [
        beat({ label: 'Rongga udara khusus', focus: 'adonan' }),
        beat({ actors: [{ cast: 'ibu', x: 1, facing: 1, pose: 'sit', on: 'tidak-ada' }] }),
        beat({ value: 90 }),
      ],
    };
    const plan = finishStoryPlan(raw, ['Satu.', 'Dua.', 'Tiga.'], 'Roti');
    expect(plan.beats.map((item) => item.text)).toEqual(['Satu.', 'Dua.', 'Tiga.']);
    expect(plan.beats[0].label).toBeNull();
    expect(plan.beats[1].actors[0].pose).toBe('stand');
    expect(plan.beats[2].value).toBeNull();
  });
});

describe('story canvas scenes', () => {
  it('frames the people with the focused prop, carries states, and seats the sitter on the chair', () => {
    const scenes = buildStoryScenes(PLAN, TIMINGS, FRAME);
    expect(scenes[1]).toBeNull();
    const first = scenes[0]!;
    const look = first.camera[1].look;
    expect(look[0]).toBeGreaterThan(2.3);
    expect(look[0]).toBeLessThan(3.6);
    const third = scenes[2]!;
    expect(third.states.adonan.naik).toBe(0.5);
    expect(third.changes?.[0]).toMatchObject({ prop: 'adonan', key: 'naik', to: 1 });
    const sitter = third.actors[0];
    expect(sitter.x).toBeLessThan(1.0);
    expect(Math.abs(sitter.y)).toBeLessThan(0.1);
    expect(third.labels?.[0].text).toBe('adonan naik');
  });

  it('assembles files that pass the validator and the dry run with people in frame', () => {
    const scenes = buildStoryScenes(PLAN, TIMINGS, FRAME);
    const files = {
      'StoryProps.ts': assembleStoryProps(PLAN.props.map(fallbackProp)),
      'StoryPlaces.ts': assembleStoryPlaces(PLAN.places.map((place) => fallbackPlace(PLAN, place))),
      'StoryScenes.ts': assembleStoryScenes(PLAN, scenes, [null, { start: 3, duration: 2.5, body: fallbackDetail(PLAN, PLAN.details[0]) }, null]),
    };
    for (const [name, code] of Object.entries(files)) expect(validateStoryCanvasFile(name as keyof typeof files, code).errors).toEqual([]);
    const report = dryRunStoryCanvas(files, { framing: true });
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('writes a MainVideo that passes the validator', () => {
    const storyboard = {
      fps: 30, title: 'Roti', bgmTrack: undefined,
      scenes: PLAN.beats.map((item, index) => ({ voiceoverText: item.text, durationInFrames: Math.round(TIMINGS[index].duration * 30), audioUrl: '', wordTimings: [], sfxCue: undefined, role: 'narrative', kineticHeadline: '' })),
    } as unknown as Storyboard;
    const main = storyCanvasMainVideo(storyboard, PLAN, 90, { title: true, caption: false, panel: true });
    expect(validateSceneCode(main, 'MainVideo.tsx').errors).toEqual([]);
    expect(main).toContain("import { TitleCard } from './StoryTitle'");
    expect(main).toContain('titleFrames={90}');
  });
});

describe('story canvas writers', () => {
  it('accepts the worked examples as real props and places', () => {
    const prop = { ...PLAN.props[0] };
    expect(propProblems(PLAN, prop, EXAMPLE_PROP, FRAME)).toEqual([]);
    const scenes = buildStoryScenes(PLAN, TIMINGS, FRAME);
    const sampled = placeSamples(PLAN, PLAN.places[0], scenes, FRAME);
    const propsFile = assembleStoryProps([EXAMPLE_PROP, fallbackProp(PLAN.props[1])]);
    expect(placeProblems(PLAN, PLAN.places[0], propsFile, sampled, EXAMPLE_PLACE)).toEqual([]);
  });

  it('rejects labels in props and redrawn props in close-ups', () => {
    const labelled = EXAMPLE_PROP.replace("s.rect(-0.12, 0, 0.24, 0.04", "s.label(0, 0.3, 'Adonan'); s.rect(-0.12, 0, 0.24, 0.04");
    expect(propProblems(PLAN, PLAN.props[0], labelled, FRAME)[0]).toContain('s.label');
    expect(missingPropCalls(PLAN.details[0], 's.background("#fff"); // drawAdonan(s, {}, t)')).toHaveLength(1);
    expect(missingPropCalls(PLAN.details[0], 'drawAdonan(s, {}, t);')).toEqual([]);
  });
});

describe('story canvas close-up checks', () => {
  it('rejects a close-up whose zoom is a scale factor instead of pixels per meter', () => {
    const tiny = 's.background("#0B1526", "#111827");\ns.look(0, 0, 1.05);\ndrawAdonan(s, {}, t);';
    const problems = detailProblems(PLAN, assembleStoryProps([EXAMPLE_PROP, fallbackProp(PLAN.props[1])]), PLAN.details[0], 2.5, tiny);
    expect(problems.join(' ')).toContain('pixels per meter');
    const good = tiny.replace('1.05', '1600');
    expect(detailProblems(PLAN, assembleStoryProps([EXAMPLE_PROP, fallbackProp(PLAN.props[1])]), PLAN.details[0], 2.5, good)).toEqual([]);
  });
});

describe('story canvas without people, at any scale', () => {
  const HEART: StoryCanvasPlan = {
    ...PLAN,
    cast: [],
    places: [{ id: 'dada', label: 'Rongga dada', look: 'A cutaway of the chest with ribs, lungs, and the diaphragm.', width: 0.4, states: [{ key: 'gelap', meaning: '0 normal, 1 dim red glow' }] }],
    props: [{ id: 'jantung', label: 'Jantung', look: 'A human heart with four chambers and the aorta.', size: [0.12, 0.13], place: 'dada', at: [0.2, 0.05], surface: null, states: [{ key: 'detak', meaning: '0 relaxed, 1 squeezed' }] }],
    details: [],
    beats: [
      beat({ place: 'dada', focus: 'jantung', set: [{ prop: 'jantung', key: 'detak', value: 1 }] }),
      beat({ place: 'dada', focus: null, set: [{ prop: 'dada', key: 'gelap', value: 1 }] }),
    ],
  };

  it('accepts place state changes and frames a 12 cm heart up close', () => {
    expect(storyPlanProblems(HEART, 2)).toEqual([]);
    const scenes = buildStoryScenes(HEART, [{ start: 0, duration: 3 }, { start: 3, duration: 3 }], FRAME);
    expect(scenes[0]!.actors).toEqual([]);
    expect(scenes[0]!.camera[1].zoom).toBeGreaterThan(2000);
    expect(scenes[1]!.changes?.[0]).toMatchObject({ prop: 'dada', key: 'gelap', to: 1 });
    expect(scenes[1]!.states.jantung.detak).toBe(1);
  });

  it('frames a 2 km volcano from far away', () => {
    const volcano: StoryCanvasPlan = {
      ...HEART,
      places: [{ id: 'selat', label: 'Selat Sunda', look: 'The sea strait with far islands and a wide sky above the water.', width: 6000 }],
      props: [{ id: 'gunung', label: 'Krakatau', look: 'A steep volcanic cone rising from the sea.', size: [2500, 800], place: 'selat', at: [3000, 0], surface: null, states: [] }],
      beats: [beat({ place: 'selat', focus: 'gunung' })],
    };
    const [scene] = buildStoryScenes(volcano, [{ start: 0, duration: 3 }], FRAME);
    expect(scene!.camera[1].zoom).toBeLessThan(1);
    expect(scene!.camera[1].look[0]).toBeCloseTo(3000, 0);
  });
});

describe('story canvas plan schema', () => {
  it('trims overlong lists and texts instead of rejecting a rich plan', async () => {
    const { StoryCanvasPlanSchema } = await import('./plan');
    const states = ['detak', 'katup', 'paru', 'tubuh', 'listrik', 'oksigen', 'ekstra'].map((key) => ({ key, meaning: `state ${key}` }));
    const raw = { ...PLAN, props: [{ ...PLAN.props[0], states }, PLAN.props[1]], beats: PLAN.beats.map((item) => ({ ...item, headline: 'x'.repeat(120) })) };
    const parsed = StoryCanvasPlanSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.props[0].states).toHaveLength(6);
    expect(parsed.data?.beats[0].headline).toHaveLength(80);
  });
});

describe('story canvas parts, flows, and camera moves', () => {
  const HEART_PROP: StoryCanvasPlan['props'][number] = {
    id: 'jantung', label: 'Jantung', look: 'A human heart cutaway with four chambers and vessels.', size: [0.12, 0.13], place: 'dada', at: [0.15, 0.03], surface: null, states: [{ key: 'cepat', meaning: '0 resting, 1 racing' }],
    parts: [{ id: 'serambi-kanan', label: 'Serambi kanan' }, { id: 'bilik-kanan', label: 'Bilik kanan' }, { id: 'serambi-kiri', label: 'Serambi kiri' }, { id: 'bilik-kiri', label: 'Bilik kiri' }],
    flows: [{ id: 'darah-kotor', label: 'Darah kotor', meaning: 'From the body into the right side and out to the lungs.' }, { id: 'darah-bersih', label: 'Darah bersih', meaning: 'From the lungs into the left side and out to the body.' }],
  };
  const PLAN2: StoryCanvasPlan = {
    ...PLAN,
    cast: [],
    places: [{ id: 'dada', label: 'Rongga dada', look: 'A chest cutaway with ribs, lungs, and the diaphragm around the heart.', width: 0.3 }],
    props: [HEART_PROP],
    details: [{ id: 'sel', label: 'Sel darah', draw: 'Blood cells carrying oxygen, magnified.', props: [] }],
    beats: [
      beat({ place: 'dada', focus: 'jantung', shot: 'wide', move: 'push' }),
      beat({ place: 'dada', focus: 'jantung', part: 'serambi-kanan', shot: 'close', move: 'push', label: 'Serambi kanan' }),
      beat({ place: 'dada', focus: 'jantung', flow: 'darah-kotor', move: 'follow' }),
      beat({ place: 'dada', focus: 'sel' }),
      beat({ place: 'dada', focus: 'jantung', part: 'bilik-kiri', shot: 'medium', move: 'pull' }),
    ],
  };
  const TIMES = [0, 4, 8, 12, 15].map((start) => ({ start, duration: start === 12 ? 3 : 4 }));
  const maps = () => mapsByProp(PLAN2, readPropMaps(assembleStoryProps([EXAMPLE_HEART])));

  it('accepts the heart example and its exported map', () => {
    expect(propProblems(PLAN2, HEART_PROP, EXAMPLE_HEART, FRAME)).toEqual([]);
    expect(Object.keys(maps().jantung.parts ?? {})).toHaveLength(4);
    const scenes = buildStoryScenes(PLAN2, TIMES, FRAME, maps());
    expect(placeProblems(PLAN2, PLAN2.places[0], assembleStoryProps([EXAMPLE_HEART]), placeSamples(PLAN2, PLAN2.places[0], scenes, FRAME), EXAMPLE_CHEST)).toEqual([]);
  });

  it('reports a missing map and a part drawn outside the prop', () => {
    const withoutMap = EXAMPLE_HEART.replace(/export const drawJantungMap = \{[\s\S]*?\n\};\n/, 'const drawJantungMap = { parts: {}, flows: {} };\n');
    expect(mapProblems(HEART_PROP, withoutMap)[0]).toContain('Export the map');
    const outside = EXAMPLE_HEART.replace("'serambi-kanan': { at: [-0.026, 0.086]", "'serambi-kanan': { at: [-0.4, 0.086]");
    expect(mapProblems(HEART_PROP, outside).join(' ')).toContain("parts['serambi-kanan']");
  });

  it('frames a part close, rides a flow, pushes in before a close-up, and pulls back', () => {
    const scenes = buildStoryScenes(PLAN2, TIMES, FRAME, maps());
    const wide = scenes[0]!.camera.at(-1)!;
    const close = scenes[1]!.camera[1];
    expect(close.zoom).toBeGreaterThan(wide.zoom * 1.8);
    expect(close.look[0]).toBeCloseTo(0.15 - 0.026, 3);
    expect(scenes[1]!.labels?.[0].at[1]).toBeCloseTo(0.03 + 0.086 + 0.015, 4);
    const follow = scenes[2]!.camera;
    expect(follow.filter((key) => key.glide).length).toBe(8);
    // The ride ends near the end of the flow; the last key pushes into the next close-up.
    expect(scenes[3]).toBeNull();
    expect(follow.at(-1)!.zoom).toBeGreaterThan(follow.at(-3)!.zoom * 1.5);
    const pull = scenes[4]!.camera;
    expect(pull[0].zoom).toBeGreaterThan(pull.at(-1)!.zoom * 1.5);
  });

  it('rejects two beats in a row with the same shot', () => {
    const repeated: StoryCanvasPlan = { ...PLAN2, beats: [PLAN2.beats[1], { ...PLAN2.beats[1], text: 'Lagi.' }, ...PLAN2.beats.slice(2)] };
    expect(storyPlanProblems(repeated, 5).join(' ')).toContain('repeats the shot');
  });
});

describe('story canvas shot sizes', () => {
  it('keeps medium between close and wide', async () => {
    const { buildStoryScenes: build, mapsByProp: byProp, assembleStoryProps: props } = await import('./assemble');
    const prop: StoryCanvasPlan['props'][number] = {
      id: 'jantung', label: 'Jantung', look: 'A human heart cutaway with four chambers and vessels.', size: [0.12, 0.13], place: 'dada', at: [0.15, 0.03], surface: null, states: [],
      parts: [{ id: 'bilik-kiri', label: 'Bilik kiri' }],
    };
    const plan: StoryCanvasPlan = { ...PLAN, cast: [], details: [], places: [{ id: 'dada', label: 'Dada', look: 'A chest cutaway with ribs and lungs around the heart.', width: 0.3 }], props: [prop],
      beats: ['wide', 'medium', 'close'].map((shot) => beat({ place: 'dada', focus: 'jantung', part: shot === 'wide' ? null : 'bilik-kiri', shot: shot as 'wide', move: 'cut' })) };
    const maps = byProp(plan, readPropMaps(props([EXAMPLE_HEART])));
    const [wide, medium, close] = build(plan, [0, 3, 6].map((start) => ({ start, duration: 3 })), FRAME, maps).map((scene) => scene!.camera[1].zoom);
    expect(medium).toBeGreaterThan(wide);
    expect(close).toBeGreaterThan(medium);
  });
});

describe('story canvas timing to spoken words', () => {
  const words = ['Bilik', 'kanan', 'lalu', 'memompa', 'darah', 'ke', 'paru-paru.'].map((word, index) => ({ word, startMs: 300 + index * 400, endMs: 650 + index * 400 }));

  it('finds a cue word with affixes and punctuation', async () => {
    const { wordTime } = await import('./assemble');
    expect(wordTime('memompa', words)).toBeCloseTo(1.5, 6);
    expect(wordTime('pompa', words)).toBeCloseTo(1.5, 6);
    expect(wordTime('paru-paru', words)).toBeCloseTo(2.7, 6);
    expect(wordTime('jantung', words)).toBeNull();
    expect(wordTime(null, words)).toBeNull();
  });

  it('starts a change on its word and lands the camera on the cue', () => {
    const plan: StoryCanvasPlan = {
      ...PLAN,
      beats: [
        beat({ focus: 'adonan' }),
        beat({ focus: 'kursi', cue: 'darah', label: 'kursi', set: [{ prop: 'adonan', key: 'naik', value: 1, word: 'memompa' }] }),
      ],
    };
    const scenes = buildStoryScenes(plan, [{ start: 0, duration: 3 }, { start: 3, duration: 4 }], FRAME, {}, [[], words]);
    const second = scenes[1]!;
    expect(second.changes?.[0].from).toBeCloseTo(1.45, 6);
    const landing = second.camera.find((key) => key.look[0] === second.camera.at(-1)!.look[0]);
    expect(landing?.at).toBeCloseTo(1.9, 6);
    expect(second.labels?.[0].from).toBeCloseTo(1.9, 6);
  });
});

describe('story canvas motion checks', () => {
  it('accepts a beating heart and rejects a frozen one', async () => {
    const { motionProblems } = await import('./build');
    const heart: StoryCanvasPlan['props'][number] = { id: 'jantung', label: 'Jantung', look: 'A human heart cutaway with four chambers and vessels.', size: [0.12, 0.13], place: 'dada', at: [0.15, 0.03], surface: null, moves: true, states: [{ key: 'cepat', meaning: '0 resting, 1 racing' }] };
    expect(motionProblems(heart, EXAMPLE_HEART)).toEqual([]);
    const frozen = EXAMPLE_HEART.replace('const beat = s.beat(t, 68 + 40 * fast);', 'const beat = s.beat(0, 68 + 40 * fast);').replace(/s\.flow\(/g, 'void (');
    expect(motionProblems(heart, frozen)[0]).toContain('must keep moving');
    expect(motionProblems({ ...heart, moves: false }, frozen)).toEqual([]);
  });
});

describe('story canvas reference examples', () => {
  it('passes the water system through the prop checks, map, and motion', async () => {
    const { EXAMPLE_WATER } = await import('./examples');
    const pump: StoryCanvasPlan['props'][number] = {
      id: 'pompa-air', label: 'Pompa air', look: 'A water tank on a stand, a pump, a pipe, and a tap.', size: [1.4, 1.2], place: 'dapur', at: [2.5, 0], surface: null, moves: true,
      states: [{ key: 'nyala', meaning: '0 pump off, 1 pump running' }],
      parts: [{ id: 'tandon', label: 'Tandon' }, { id: 'pompa', label: 'Pompa' }, { id: 'keran', label: 'Keran' }],
      flows: [{ id: 'air', label: 'Air', meaning: 'From the tank through the pump to the tap.' }],
    };
    const plan: StoryCanvasPlan = { ...PLAN, props: [pump, PLAN.props[1]] };
    expect(propProblems(plan, pump, EXAMPLE_WATER, FRAME)).toEqual([]);
  });
});
