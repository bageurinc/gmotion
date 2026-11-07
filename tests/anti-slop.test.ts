import { describe, expect, it } from 'vitest';
import { contrastRatio, normalizePalette } from '@/lib/pipeline/anti-slop';
import { parseStoryboardFromLLMResponse } from '@/lib/pipeline/director-agent';

const palette = {
  background: '#FFF4E0',
  surface: '#FFFFFF',
  primary: '#FFD166',
  secondary: '#2A9D8F',
  alert: '#E76F51',
  text: '#FFFFFF',
};

describe('normalizePalette', () => {
  it('replaces the generic dark background', () => {
    const result = normalizePalette({ ...palette, background: '#0F172A', surface: '#1E293B', text: '#F8FAFC' });
    expect(result.background).toBe('#F2F5F1');
    expect(contrastRatio(result.text, result.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps a dark background chosen for the subject', () => {
    const space = normalizePalette({ ...palette, background: '#1A1033', text: '#F4EFFF', primary: '#FFB703' });
    expect(space.background).toBe('#1A1033');
    expect(space.text.toLowerCase()).toBe('#f4efff');
  });

  it('makes unreadable text and accents legible', () => {
    const result = normalizePalette(palette);
    expect(contrastRatio(result.text, result.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(result.primary, result.background)).toBeGreaterThanOrEqual(3);
  });

  it('survives missing colors', () => {
    const result = normalizePalette({ background: '', surface: '', primary: '', secondary: '', alert: '', text: '' });
    expect(Object.values(result).every((color) => /^#[0-9a-f]{6}$/i.test(color))).toBe(true);
  });
});

it('applies the palette filter to director output', () => {
  const text = JSON.stringify({
    palette: { background: '#0F172A', surface: '#1E293B', primary: '#38BDF8', secondary: '#F59E0B', alert: '#EF4444', text: '#F8FAFC' },
    scenes: [{ title: 'Satu' }, { title: 'Dua' }],
  });
  const storyboard = parseStoryboardFromLLMResponse(text, 'Topik', 'story-2d', '9:16');
  expect(storyboard?.palette.background).toBe('#F2F5F1');
});
