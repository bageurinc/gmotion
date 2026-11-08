import { describe, expect, it } from 'vitest';
import { dataVisualStart, spokenDataVisual } from '@/lib/explainer/data-visual';
import { composeAssetScene, composeImageScene } from '@/lib/explainer/scene-generator';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import { toSentenceCase, wordMotion } from '@/motion-kit/core/text-style';
import type { DataVisual } from '@/types/studio';

describe('spokenDataVisual', () => {
  it('is optional', () => {
    expect(spokenDataVisual(undefined, 'Tanpa data')).toBeUndefined();
  });

  it('keeps a number spoken with the same unit', () => {
    const visual = { kind: 'stat', value: '28', unit: 'persen', label: 'lebih hemat' } as const;
    expect(spokenDataVisual(visual, 'Hemat 28% setiap bulan.')).toEqual(visual);
    expect(spokenDataVisual(visual, 'Hemat 28 persen setiap bulan.')).toEqual(visual);
  });

  it('drops an invented number, a partial number, or a wrong unit', () => {
    const stat = { kind: 'stat', value: '28', unit: 'persen', label: 'hemat' } as const;
    expect(spokenDataVisual(stat, 'Jauh lebih hemat.')).toBeUndefined();
    expect(spokenDataVisual(stat, 'Hemat 128 persen.')).toBeUndefined();
    expect(spokenDataVisual(stat, 'Selama 28 hari.')).toBeUndefined();
  });

  it('drops a comparison when one value was not spoken', () => {
    const visual: DataVisual = { kind: 'compare', unit: 'meter', items: [{ label: 'A', value: '12' }, { label: 'B', value: '40' }] };
    expect(spokenDataVisual(visual, 'Dari 12 meter menjadi 40 meter.')).toEqual(visual);
    expect(spokenDataVisual(visual, 'Dari 12 meter menjadi jauh lebih dalam.')).toBeUndefined();
  });

  it('allows steps without numbers but not with invented ones', () => {
    expect(spokenDataVisual({ kind: 'steps', items: ['Bor', 'Cor'] }, 'Dibor lalu dicor.')).toBeDefined();
    expect(spokenDataVisual({ kind: 'steps', items: ['Bor 30 meter', 'Cor'] }, 'Dibor lalu dicor.')).toBeUndefined();
  });

  it('rejects a stat without any number', () => {
    expect(spokenDataVisual({ kind: 'stat', value: 'banyak', label: 'x' }, 'banyak sekali')).toBeUndefined();
  });
});

describe('dataVisualStart', () => {
  const scene = { voiceoverText: 'Bor sedalam 40 meter', durationInFrames: 120, wordTimings: [
    { word: 'Bor', startMs: 0, endMs: 300 }, { word: 'sedalam', startMs: 300, endMs: 900 }, { word: '40', startMs: 1000, endMs: 1200 }, { word: 'meter', startMs: 1200, endMs: 1500 },
  ] };

  it('arrives as the number is spoken', () => {
    expect(dataVisualStart({ kind: 'stat', value: '40', unit: 'meter', label: 'kedalaman' }, scene, 30)).toBe(27);
  });

  it('shows steps early', () => {
    expect(dataVisualStart({ kind: 'steps', items: ['A', 'B'] }, scene, 30)).toBe(15);
  });
});

describe('text style', () => {
  it('softens capital headlines', () => {
    expect(toSentenceCase('ANALISIS BATUAN DASAR')).toBe('Analisis batuan dasar');
  });

  it('ends every entrance at rest', () => {
    expect(wordMotion('slam', 1).transform).toBe('scale(1)');
    expect(wordMotion('rise', 1).transform).toBe('translate3d(0, 0px, 0)');
  });
});

describe('composeAssetScene overlays', () => {
  const base = generateProceduralStoryboard('Cara kerja bor tanah', 'story-2d', '9:16');
  const asset = { code: 'const Asset = () => null;', manifest: { views: [{ id: 'a' }], parts: [], flows: [] } } as never;
  const withVisual = (voiceoverText: string, dataVisual: DataVisual) => ({
    ...base,
    textStyle: 'teknis' as const,
    scenes: [{ ...base.scenes[0], voiceoverText, dataVisual }, ...base.scenes.slice(1)],
  });
  const visual: DataVisual = { kind: 'stat', value: '40', unit: 'meter', label: 'kedalaman' };

  it('shows a card only for a spoken number', () => {
    expect(composeAssetScene(asset, withVisual('Bor sedalam 40 meter.', visual), 0)).toContain('<DataCard');
    expect(composeAssetScene(asset, withVisual('Bor sangat dalam.', visual), 0)).not.toContain('<DataCard');
  });

  it('passes the text style and palette to image scene labels', () => {
    const code = composeImageScene(withVisual('Tanpa angka.', { kind: 'steps', items: ['A', 'B'] }), 0, ['/a.png'], [{ from: 0, pose: 0, box: null, label: null }]);
    expect(code).toContain('textStyle="teknis"');
    expect(code).toContain('labelBackground=');
  });

  it('adds no card or text style to scenes without them', () => {
    const code = composeAssetScene(asset, base, 0);
    expect(code).not.toContain('<DataCard');
    expect(code).not.toContain('textStyle=');
  });
});
