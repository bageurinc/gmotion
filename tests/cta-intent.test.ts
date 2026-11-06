import { describe, expect, it } from 'vitest';
import { generateProceduralStoryboard, wantsCallToAction, parseStoryboardFromLLMResponse } from '../src/lib/pipeline/director-agent';

describe('CTA intent', () => {
  it.each([
    ['Ceritakan perjuangan Rama mencari cinta sejati dan pesan moral', false],
    ['Buat konten edukasi sejarah kopi', false],
    ['Iklan kopi untuk promosi produk', true],
    ['Cerita kopi dengan CTA pesan sekarang', true],
    ['Buat iklan tanpa CTA', false],
    ['Video konten, jangan tambahkan CTA', false],
  ])('respects the intent of %s', (prompt, expected) => {
    expect(wantsCallToAction(prompt)).toBe(expected);
    const storyboard = generateProceduralStoryboard(prompt, 'story-2d', '9:16');
    expect(storyboard.scenes.some(scene => scene.role === 'cta')).toBe(expected);
    if (!expected) expect(storyboard.scenes.at(-1)?.visualPrompt).not.toContain('PulseCTAButton');
  });

  it('removes a model-invented CTA from an ordinary story', () => {
    const result = parseStoryboardFromLLMResponse(JSON.stringify({ scenes: [
      { role: 'hook', kineticHeadline: 'Awal cerita' },
      { role: 'cta', kineticHeadline: 'Klik link sekarang', voiceoverText: 'Beli sekarang di bio' },
    ] }), 'Ceritakan perjalanan Rama', 'story-2d', '9:16');
    expect(result?.scenes.at(-1)?.role).toBe('narrative');
    expect(result?.scenes.at(-1)?.voiceoverText).not.toMatch(/beli|klik|bio/i);
  });
});
