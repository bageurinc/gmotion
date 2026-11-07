import { describe, expect, it, vi } from 'vitest';
import type { IsoObject, IsoPlan } from '@/lib/explainer/iso-world';
import { resolveIsoPlan } from '@/lib/explainer/iso-world';
import { applyStory, keepStatedNumbers } from '@/lib/explainer/iso-plan';
import { StoredPresetSchema, StylePresetSchema, usesWorldEngine } from '@/types/studio';
import type { Storyboard } from '@/types/studio';
import { validateSceneCode } from './code-validator';
import { worldMainVideoCode } from './world-video';

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

describe('keepStatedNumbers', () => {
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
    expect(usesWorldEngine('ads-ui')).toBe(false);
  });

  it('refuses the old names for new projects but still reads them from saved ones', () => {
    expect(StylePresetSchema.options).toEqual(['story-2d', 'ads-ui', 'world']);
    expect(StylePresetSchema.safeParse('story').success).toBe(false);
    expect(StoredPresetSchema.safeParse('story').success).toBe(true);
  });
});
