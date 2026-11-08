import { describe, expect, it } from 'vitest';
import { AssetManifestSchema } from '@/lib/explainer/asset-contract';
import { actionProgressAt, buildActionCues, narrationWords, unanimatedActions } from '@/lib/explainer/choreography';
import { buildAssetShots } from '@/motion-kit/explainer/AssetStage';

const part = (id: string) => ({ id, label: id, views: ['world'], anchor: { x: 500, y: 500 }, focus: { x: 500, y: 500, scale: 2 } });
const base = {
  topic: 'sabun',
  title: 'Sabun',
  subtitle: 'Cara kerja sabun',
  palette: { backgroundFrom: '#102030', backgroundTo: '#203040', accent: '#ff8800', accentAlt: '#00aaff', text: '#ffffff' },
  heroFocus: { x: 500, y: 500, scale: 2 },
  views: [{ id: 'world', label: 'Dunia', description: 'Satu dunia' }],
  parts: [part('soap'), part('oil'), part('water')],
  flows: [{ id: 'rinse', view: 'world', d: 'M 0 0 L 100 100', color: '#00aaff' }],
};
const action = (id: string, startWord: number, endWord: number) => ({ id, description: id, startWord, endWord });
const words = [
  { word: 'sabun', startMs: 0, endMs: 500 },
  { word: 'menempel', startMs: 500, endMs: 1000 },
  { word: 'lalu', startMs: 1000, endMs: 1500 },
  { word: 'terbilas', startMs: 1500, endMs: 2000 },
];

describe('choreography manifest', () => {
  it('accepts one persistent view with ordered actions', () => {
    const parsed = AssetManifestSchema.parse({ ...base, choreography: [action('attach', 0, 1), action('rinse', 2, 3)] });
    expect(buildAssetShots(parsed, 300, 30)).toEqual([expect.objectContaining({ from: 0, to: 300, view: 'world' })]);
  });

  it('still requires two views without choreography', () => {
    expect(AssetManifestSchema.safeParse(base).success).toBe(false);
  });

  it('rejects overlapping actions and extra views', () => {
    expect(AssetManifestSchema.safeParse({ ...base, choreography: [action('attach', 0, 2), action('rinse', 2, 3)] }).success).toBe(false);
    expect(AssetManifestSchema.safeParse({
      ...base,
      views: [...base.views, { id: 'after', label: 'Akhir', description: 'Gambar kedua' }],
      choreography: [action('attach', 0, 1)],
    }).success).toBe(false);
  });
});

describe('action timing', () => {
  it('maps spoken words to frames', () => {
    expect(buildActionCues([action('attach', 0, 1), action('rinse', 2, 3)], words, 90, 30)).toEqual([
      { id: 'attach', from: 0, to: 30 },
      { id: 'rinse', from: 30, to: 60 },
    ]);
  });

  it('rejects word indexes outside the narration', () => {
    expect(() => buildActionCues([action('attach', 0, 9)], words, 90, 30)).toThrow(/attach/);
  });

  it('keeps the final pose after an action ends', () => {
    const cues = [{ id: 'attach', from: 10, to: 20 }];
    expect(actionProgressAt(cues, 0).attach).toBe(0);
    expect(actionProgressAt(cues, 15).attach).toBe(0.5);
    expect(actionProgressAt(cues, 80).attach).toBe(1);
  });

  it('prefers recorded timings and splits the narration evenly without them', () => {
    expect(narrationWords({ wordTimings: words, voiceoverText: 'abaikan', durationInFrames: 60 }, 30)).toBe(words);
    expect(narrationWords({ wordTimings: [], voiceoverText: 'satu  dua', durationInFrames: 60 }, 30)).toEqual([
      { word: 'satu', startMs: 0, endMs: 1000 },
      { word: 'dua', startMs: 1000, endMs: 2000 },
    ]);
  });
});

describe('unanimatedActions', () => {
  const actions = [action('wash', 0, 1)];

  it('accepts dot, optional, and bracket access', () => {
    expect(unanimatedActions(actions, 'const p = actionProgress.wash ?? 0;')).toEqual([]);
    expect(unanimatedActions(actions, 'const p = actionProgress?.wash ?? 0;')).toEqual([]);
    expect(unanimatedActions(actions, `const p = actionProgress['wash'] ?? 0;`)).toEqual([]);
  });

  it('does not count a longer id or an unused action', () => {
    expect(unanimatedActions(actions, 'const p = actionProgress.washOut;')).toEqual(['wash']);
    expect(unanimatedActions(actions, 'const wash = Math.sin(time);')).toEqual(['wash']);
  });
});
