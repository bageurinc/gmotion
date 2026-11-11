import { describe, expect, it, vi } from 'vitest';
import type { IsoObject, IsoPlan } from '@/lib/explainer/iso-world';
import { resolveIsoPlan } from '@/lib/explainer/iso-world';
import { applyStory, clampLobes, keepStatedNumbers } from '@/lib/explainer/iso-plan';
import { StoredPresetSchema, StylePresetSchema, usesWorldEngine } from '@/types/studio';
import type { Storyboard } from '@/types/studio';
import { validateSceneCode } from './code-validator';
import { worldMainVideoCode, worldPictureVideoCode } from './world-video';

vi.mock('@/lib/explainer/asset-generator', () => ({ callChat: vi.fn() }));

const object = (id: string, x: number): IsoObject => ({
  id, label: id, shape: 'box', size: [4, 2, 4], color: '#88AA66', on: null, x, z: 0,
});

const beat = (text: string, value: number | null = null) => ({
  text, headline: 'Judul', accent: '', value, status: 'jalan', clock: null, focus: null, label: null, sticker: null,
});

const plan: IsoPlan = {
  look: 'bright',
  unit: '%',
  palette: { ground: '#F4EEE2', surface: '#E4C49B', hud: '#1F4D3A', hudText: '#FFFFFF', accent: '#F2542D', ink: '#1F2A37' },
  objects: [object('a', -3), object('b', 3)],
  links: [],
  beats: [beat('Satu'), beat('Dua'), beat('Tiga')],
};

const storyboard = {
  title: 'Uji',
  preset: 'world',
  aspectRatio: '9:16',
  fps: 30,
  bgmTrack: 'warm-acoustic',
  palette: { background: '#FFFFFF', surface: '#FFFFFF', primary: '#000000', secondary: '#000000', alert: '#000000', text: '#000000' },
  scenes: ['Satu', 'Dua', 'Tiga'].map((text, index) => ({
    id: `scene-${index + 1}-narrative`,
    order: index + 1,
    role: 'narrative',
    title: text,
    voiceoverText: text,
    kineticHeadline: text,
    visualPrompt: '',
    cameraAction: 'slow-push',
    sfxCue: 'none',
    audioUrl: `/api/projects/p/assets/scene-${index + 1}.wav`,
    durationInFrames: 90,
    wordTimings: [],
  })),
} as Storyboard;

describe('worldMainVideoCode', () => {
  const code = worldMainVideoCode(storyboard, resolveIsoPlan(plan));

  it('passes the scene code validator', () => {
    expect(validateSceneCode(code, 'MainVideo.tsx')).toMatchObject({ valid: true });
  });

  it('puts beats on the scene timeline with the scene audio', () => {
    const data = JSON.parse(code.match(/const data = (.*);\n/)![1]);
    expect(data.script.beats.map((item: { from: number }) => item.from)).toEqual([0, 90, 180]);
    expect(data.script.beats[1].audio).toBe('/api/projects/p/assets/scene-2.wav');
    expect(data.script.music).toBe('warm-acoustic');
  });
});

describe('call to action', () => {
  const withCta = {
    ...storyboard,
    scenes: storyboard.scenes.map((scene, index) => (index === 2 ? { ...scene, role: 'cta' as const, kineticHeadline: 'Coba sekarang' } : scene)),
  };

  it('puts the button only on the CTA scene', () => {
    const data = JSON.parse(worldMainVideoCode(withCta, resolveIsoPlan(plan)).match(/const data = (.*);\n/)![1]);
    expect(data.script.beats[1].cta).toBeUndefined();
    expect(data.script.beats[2].cta.text).toBe('Coba sekarang');
  });
});

describe('applyStory', () => {
  it('keeps approved narration word for word', () => {
    expect(applyStory(plan, ['Baru', 'Dua', 'Tiga']).beats[0].text).toBe('Baru');
  });

  it('gives extra lines a wide beat and drops extra beats', () => {
    expect(applyStory(plan, ['A', 'B', 'C', 'D']).beats[3]).toMatchObject({ text: 'D', focus: null, value: null });
    expect(applyStory(plan, ['A']).beats).toHaveLength(1);
  });
});

describe('clampLobes', () => {
  it('pulls a stray lobe back into the unit box', () => {
    const raw = { objects: [{ lobes: [{ at: [0, 1.2, 0], to: [-1.1, 0, 0.5], r: 0.2 }] }] };
    expect(clampLobes(raw)).toEqual({ objects: [{ lobes: [{ at: [0, 1, 0], to: [-1, 0, 0.5], r: 0.2 }] }] });
  });

  it('leaves unusable input for the schema to reject', () => {
    expect(clampLobes(null)).toBeNull();
    expect(clampLobes({ objects: [{ lobes: [{ at: 'x' }] }] })).toEqual({ objects: [{ lobes: [{ at: 'x' }] }] });
  });
});

describe('keepStatedNumbers', () => {
  it('drops screen lines with an unstated number, and keeps the ones the narration said', () => {
    const screen = {
      face: 'left' as const, background: '#FFFFFF', ink: '#111111', accent: '#117A4B',
      states: [{
        fromBeat: 0,
        title: 'Promo 50%',
        items: [
          { kind: 'stat' as const, text: 'Total', value: 'Rp 99.000' },
          { kind: 'stat' as const, text: 'Terisi', value: '80%' },
          { kind: 'row' as const, text: 'Kopi', value: 'Rp 5.000' },
          { kind: 'row' as const, text: '3 item terjual', value: null },
          { kind: 'button' as const, text: 'Bayar', value: null },
        ],
      }],
    };
    const objects = [{ id: 'hp', label: 'HP', shape: 'box' as const, size: [2, 4, 1] as [number, number, number], color: '#222222', on: null, x: 0, z: 0, screen }];
    const [state] = keepStatedNumbers({ ...plan, objects, beats: [beat('Terisi 80 persen')] }, 'Topik').objects[0].screen!.states;
    expect(state.title).toBe('Layar');
    expect(state.items).toEqual([
      { kind: 'stat', text: 'Terisi', value: '80%' },
      { kind: 'row', text: 'Kopi', value: null },
      { kind: 'button', text: 'Bayar', value: null },
    ]);
  });

  it('removes a whole unstated token and keeps stated numbers', () => {
    const headline = (text: string, topic: string) =>
      keepStatedNumbers({ ...plan, beats: [{ ...beat('Terisi'), headline: text }] }, topic).beats[0].headline;
    expect(headline('Pengisian Cepat 0-80%', 'Isi 80 persen')).toBe('Pengisian Cepat');
    expect(headline('Batas 80% dan 90%', 'Isi 80 persen')).toBe('Batas 80% dan');
  });

  it('removes a value nobody stated', () => {
    expect(keepStatedNumbers({ ...plan, beats: [beat('Baterai terisi', 72)] }, 'Topik').beats[0].value).toBeNull();
  });

  it('removes a stated number shown with the wrong unit', () => {
    expect(keepStatedNumbers({ ...plan, beats: [beat('Terisi', 14)] }, 'Coba gratis 14 hari').beats[0].value).toBeNull();
    expect(keepStatedNumbers({ ...plan, unit: 'hari', beats: [beat('Terisi', 14)] }, 'Coba gratis 14 hari').beats[0].value).toBe(14);
  });

  it('keeps a value spoken in the narration or written in the topic', () => {
    expect(keepStatedNumbers({ ...plan, beats: [beat('Terisi 80 persen', 80)] }, 'Topik').beats[0].value).toBe(80);
    expect(keepStatedNumbers({ ...plan, beats: [beat('Terisi', 320)] }, 'Naik 320%').beats[0].value).toBe(320);
  });

  it('strips unstated numbers from text on the panel', () => {
    const [result] = keepStatedNumbers({ ...plan, beats: [{ ...beat('Terisi'), headline: 'Naik 90 persen', label: 'Suhu 40', status: '12 jam', clock: '23:00' }] }, 'Topik').beats;
    expect(result.headline).toBe('Naik persen');
    expect(result.label).toBeNull();
    expect(result.status).toBe('');
    expect(result.clock).toBeNull();
  });
});

describe('presets', () => {
  it('sends every new preset to the 3D engine and keeps old projects on theirs', () => {
    expect(usesWorldEngine('story')).toBe(true);
    expect(usesWorldEngine('ads')).toBe(true);
    expect(usesWorldEngine('world')).toBe(true);
    expect(usesWorldEngine('story-2d')).toBe(false);
    expect(usesWorldEngine('story-svg')).toBe(false);
    expect(usesWorldEngine('ads-ui')).toBe(false);
  });

  it('refuses the old names for new projects but still reads them from saved ones', () => {
    expect(StylePresetSchema.options).toEqual(['story-2d', 'story-svg', 'ads-ui', 'world', 'story-canvas']);
    expect(StylePresetSchema.safeParse('story').success).toBe(false);
    expect(StoredPresetSchema.safeParse('story').success).toBe(true);
  });
});

describe('painted world composition', () => {
  it('writes code the validator accepts, with the pictures as plain data', () => {
    const picturePlan = {
      look: 'bright' as const,
      unit: '%',
      palette: { ground: '#F4EEE2', hud: '#1F4D3A', hudText: '#FFFFFF', accent: '#F2542D', ink: '#1F2A37' },
      setting: 'A small shop counter seen in isometric view, with a phone on a stand.',
      parts: [{ id: 'hp', label: 'HP', find: 'the phone on the counter' }],
      details: [],
      flows: [],
      beats: [beat('Satu'), beat('Dua'), beat('Tiga')],
    };
    const picture = {
      images: ['/api/projects/proj_1/assets/iso-world.png'],
      tops: [0.28],
      shots: [{ from: 0, pose: 0, box: null, label: null }],
      flows: [],
      background: '#F4EEE2',
      accent: '#F2542D',
      ink: '#1F2A37',
    };
    const code = worldPictureVideoCode(storyboard, picturePlan, picture);
    expect(validateSceneCode(code, 'MainVideo.tsx').valid).toBe(true);
    expect(code).toContain('IsoPictureVideo');
    expect(code).toContain('iso-world.png');
  });
});
