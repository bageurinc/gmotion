import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkDurationFit,
  durationBudget,
  estimateStoryboardSeconds,
  parseTargetDurationSeconds,
} from '@/lib/pipeline/draft';

const generateText = vi.hoisted(() => vi.fn());
vi.mock('ai', () => ({ generateText }));
vi.mock('@/lib/ai/llm-client', () => ({ getDirectorModel: () => 'model', isApiKeyConfigured: () => true }));

const { generateStoryboard } = await import('@/lib/pipeline/director-agent');

const words = (count: number) => Array(count).fill('kata').join(' ');
const draftJson = (sceneWords: number[]) =>
  JSON.stringify({
    title: 'Uji',
    palette: { background: '#FFFFFF', surface: '#EEEEEE', primary: '#0055AA', secondary: '#00AA55', alert: '#CC0000', text: '#111111' },
    scenes: sceneWords.map((count, index) => ({ title: `Adegan ${index + 1}`, voiceoverText: words(count), kineticHeadline: 'X', visualPrompt: 'Y', role: 'narrative' })),
  });

describe('target duration from prompt', () => {
  it('reads lengths stated for the video', () => {
    expect(parseTargetDurationSeconds('Buat video 30 detik tentang lebah')).toBe(30);
    expect(parseTargetDurationSeconds('Proses kopi, durasi 1,5 menit')).toBe(90);
    expect(parseTargetDurationSeconds('45 detik: cara kerja lift')).toBe(45);
    expect(parseTargetDurationSeconds('reels 1 menit soal inflasi')).toBe(60);
    expect(parseTargetDurationSeconds('Bikin 20s video promo kopi')).toBe(20);
    expect(parseTargetDurationSeconds('Iklan 45 detik untuk warung kopi')).toBe(45);
  });

  it('ignores times that belong to the topic or are implausible', () => {
    expect(parseTargetDurationSeconds('Cara rebus telur setengah matang 7 menit')).toBeNull();
    expect(parseTargetDurationSeconds('Kenapa langit biru?')).toBeNull();
    expect(parseTargetDurationSeconds('video 3 detik')).toBeNull();
    expect(parseTargetDurationSeconds('video 10 menit')).toBeNull();
  });

  it('turns a target into a word and scene budget that lands near it', () => {
    for (const target of [15, 30, 60, 120]) {
      const budget = durationBudget(target);
      expect(budget.minScenes).toBeGreaterThanOrEqual(3);
      expect(budget.maxScenes).toBeLessThanOrEqual(12);
      expect(budget.minWords).toBeLessThan(budget.maxWords);
      const scenes = Math.round((budget.minScenes + budget.maxScenes) / 2);
      const perScene = Math.round((budget.minWords + budget.maxWords) / 2 / scenes);
      const estimate = estimateStoryboardSeconds(Array(scenes).fill({ voiceoverText: words(perScene) }));
      expect(Math.abs(estimate - target) / target).toBeLessThan(0.15);
    }
  });

  it('flags drafts outside the tolerance', () => {
    expect(checkDurationFit([{ voiceoverText: words(55) }], 30).onTarget).toBe(true);
    expect(checkDurationFit([{ voiceoverText: words(80) }], 30)).toMatchObject({ onTarget: false, words: 80 });
  });
});

describe('director keeps the requested length', () => {
  beforeEach(() => generateText.mockReset());

  it('asks once more when the first draft runs long and keeps the closer one', async () => {
    generateText
      .mockResolvedValueOnce({ text: draftJson([30, 30, 30]) }) // about 44 seconds
      .mockResolvedValueOnce({ text: draftJson([18, 18, 18]) }); // about 27 seconds
    const storyboard = await generateStoryboard('Buat video 30 detik tentang lebah', 'story-2d', '9:16', { strict: true });
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText.mock.calls[0][0].prompt).toContain('TARGET DURATION: 30 seconds');
    expect(generateText.mock.calls[1][0].prompt).toContain('Shorten it');
    expect(storyboard.scenes[0].voiceoverText.split(' ')).toHaveLength(18);
  });

  it('keeps the first draft when the correction is worse', async () => {
    generateText
      .mockResolvedValueOnce({ text: draftJson([25, 25, 25]) })
      .mockResolvedValueOnce({ text: draftJson([60, 60, 60]) });
    const storyboard = await generateStoryboard('video 30 detik tentang lebah', 'story-2d', '9:16', { strict: true });
    expect(storyboard.scenes[0].voiceoverText.split(' ')).toHaveLength(25);
  });

  it('makes a single call when no length is requested or the draft fits', async () => {
    generateText.mockResolvedValue({ text: draftJson([20, 20, 20]) });
    await generateStoryboard('Kenapa langit biru?', 'story-2d', '9:16', { strict: true });
    await generateStoryboard('video 30 detik tentang lebah', 'story-2d', '9:16', { strict: true });
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText.mock.calls[0][0].prompt).not.toContain('TARGET DURATION');
  });
});

describe('Story 2D drafts', () => {
  beforeEach(() => generateText.mockReset());

  it('researches a short prompt first and writes the narration from the notes', async () => {
    generateText
      .mockResolvedValueOnce({ text: '- Air merembes ke celah aspal sehingga lapisan bawah melemah.' })
      .mockResolvedValueOnce({ text: draftJson([20, 20, 20, 20, 20, 20, 20]) });
    await generateStoryboard('Evolusi jalan aspal anti-rusak', 'story-canvas', '9:16', { strict: true });
    expect(generateText).toHaveBeenCalledTimes(2);
    const draft = generateText.mock.calls[1][0].prompt as string;
    expect(draft).toContain('RESEARCH NOTES');
    expect(draft).toContain('Air merembes ke celah aspal');
    expect(draft).toContain('cause and effect');
    expect(draft).not.toContain('at most 14 words');
  });

  it('skips research for a full script and still drafts when research fails', async () => {
    generateText.mockResolvedValue({ text: draftJson([20, 20, 20]) });
    await generateStoryboard(words(200), 'story-canvas', '9:16', { strict: true });
    expect(generateText).toHaveBeenCalledTimes(1);
    generateText.mockReset();
    generateText.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ text: draftJson([20, 20, 20]) });
    const storyboard = await generateStoryboard('Kenapa langit biru?', 'story-canvas', '9:16', { strict: true });
    expect(storyboard.scenes).toHaveLength(3);
    expect(generateText.mock.calls[1][0].prompt).not.toContain('RESEARCH NOTES');
  });
});

