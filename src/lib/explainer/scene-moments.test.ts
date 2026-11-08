import { describe, expect, it, vi } from 'vitest';
import { activeShot, cameraForShot, imageCameraAt, imageOffset } from '@/motion-kit/explainer/image-camera';
import { stillStretches } from '@/lib/render/motion-check';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import { callChat } from './asset-generator';
import { buildImageShots, expectedMoments, fillLongShots, findPhraseStart, MAX_SCENE_STATES, momentFrames, normalizeBox, planSceneMoments } from './scene-moments';

vi.mock('./asset-generator', () => ({ callChat: vi.fn() }));

const words = 'Sabun menempel pada lemak lalu air membilas kuman'.split(' ').map((word, index) => ({
  word: index === 3 ? `${word},` : word,
  startMs: index * 1000,
  endMs: index * 1000 + 900,
}));
const moment = (phrase: string, pose = 0, focus: string | null = null) => ({ phrase, pose, focus, label: 'Busa' });

describe('findPhraseStart', () => {
  it('matches spoken words regardless of case and punctuation', () => {
    expect(findPhraseStart(words, 'LEMAK lalu')).toBe(3);
  });

  it('reports a phrase the narration does not hold', () => {
    expect(findPhraseStart(words, 'tidak ada')).toBe(-1);
  });
});

describe('momentFrames', () => {
  it('puts each change on the frame its words are spoken', () => {
    expect(momentFrames([moment('Sabun'), moment('lemak'), moment('kuman')], words, 300, 30)).toEqual([0, 90, 210]);
  });

  it('keeps changes readable when phrases sit too close', () => {
    expect(momentFrames([moment('Sabun'), moment('menempel')], words, 300, 30)).toEqual([0, 48]);
  });

  it('spreads moments evenly when a phrase is not found', () => {
    expect(momentFrames([moment('a'), moment('b')], words, 300, 30)).toEqual([0, 150]);
  });
});

describe('expectedMoments', () => {
  it('asks for one change about every three seconds', () => {
    expect(expectedMoments(330, 30)).toBe(4);
    expect(expectedMoments(30, 30)).toBe(1);
  });
});

describe('normalizeBox', () => {
  it('converts the 0 to 1000 scale the model really answers with', () => {
    expect(normalizeBox({ x: 500, y: 250, w: 100, h: 200 })).toEqual({ x: 0.5, y: 0.25, w: 0.1, h: 0.2 });
  });

  it('keeps fractions as they are', () => {
    expect(normalizeBox({ x: 0.5, y: 0.25, w: 0.1, h: 0.2 })).toEqual({ x: 0.5, y: 0.25, w: 0.1, h: 0.2 });
  });

  it('keeps boxes inside the picture and rejects tiny ones', () => {
    expect(normalizeBox({ x: 0.9, y: 0, w: 0.5, h: 0.5 })?.w).toBeCloseTo(0.1);
    expect(normalizeBox({ x: 0.5, y: 0.5, w: 0.001, h: 0.001 })).toBeNull();
  });
});

describe('buildImageShots', () => {
  it('uses the box found in that moment\'s pose and drops the label without one', () => {
    const box = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
    const shots = buildImageShots([moment('a', 0), moment('b', 1, 'busa'), moment('c', 5, 'hilang')], [0, 90, 180], [{}, { busa: box }], 2);
    expect(shots[1]).toEqual({ from: 90, pose: 1, box, label: 'Busa' });
    expect(shots[2]).toMatchObject({ pose: 1, box: null, label: null });
  });
});

describe('fillLongShots', () => {
  const box = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };

  it('leaves short shots alone', () => {
    const shots = [{ from: 0, pose: 0, box: null, label: null }];
    expect(fillLongShots(shots, 90, 30)).toEqual(shots);
  });

  it('adds a camera move inside a long hold without changing the picture', () => {
    const filled = fillLongShots([{ from: 0, pose: 1, box, label: 'Busa' }], 300, 30);
    expect(filled.map((shot) => shot.from)).toEqual([0, 100, 200]);
    expect(filled.every((shot) => shot.pose === 1)).toBe(true);
    expect(filled[1].box).toBeNull();
    expect(filled[2].box).toEqual(box);
  });

  it('caps a scene at two paid pictures', () => {
    expect(MAX_SCENE_STATES).toBe(2);
  });
});

describe('image camera', () => {
  const shots = [
    { from: 0, pose: 0, box: null, label: null },
    { from: 60, pose: 0, box: { x: 0.4, y: 0.4, w: 0.2, h: 0.1 }, label: null },
  ];

  it('zooms into a marked object within limits', () => {
    expect(cameraForShot(shots[1])).toMatchObject({ x: 0.5, y: 0.45 });
    expect(cameraForShot(shots[1]).scale).toBeLessThanOrEqual(2.2);
  });

  it('keeps moving during a held shot', () => {
    expect(imageCameraAt(30, shots, 30).scale).toBeGreaterThan(imageCameraAt(10, shots, 30).scale);
  });

  it('never shows an image edge', () => {
    const offset = imageOffset({ x: 0.95, y: 0.95, scale: 2 }, 1080, 1920, 0.48);
    expect(offset.x).toBe(-1080);
    expect(offset.y).toBe(-1920);
  });

  it('finds the shot on screen', () => {
    expect(activeShot(59, shots).from).toBe(0);
    expect(activeShot(60, shots).from).toBe(60);
  });
});

describe('stillStretches', () => {
  it('reports long quiet parts only', () => {
    const changes = [9, 1, 1, 1, 1, 9, 1, 9];
    expect(stillStretches(changes, 0.5, 2, 1.5)).toEqual([{ from: 0.5, to: 2.5, seconds: 2 }]);
  });

  it('counts a quiet ending', () => {
    expect(stillStretches([9, 1, 1, 1], 1, 2, 3)).toEqual([{ from: 1, to: 4, seconds: 3 }]);
  });
});

describe('planSceneMoments with pixel art', () => {
  const storyboard = generateProceduralStoryboard('Topik uji', 'story-2d', '9:16');
  const reply = (count: number) => ({
    text: JSON.stringify({ scenes: Array.from({ length: count }, () => ({ kind: 'svg', reason: 'diagram', poses: [], moments: [] })) }),
  });

  it('draws every scene as a picture so no flat vector scene breaks the style', async () => {
    vi.mocked(callChat).mockResolvedValueOnce(reply(storyboard.scenes.length) as Awaited<ReturnType<typeof callChat>>);
    const plans = await planSceneMoments('model', { ...storyboard, artStyle: 'pixel' });
    expect(plans.every((plan) => plan.kind === 'image')).toBe(true);
    expect(vi.mocked(callChat).mock.calls.at(-1)?.[0].content).toContain('pixel art');
  });

  it('keeps the planner choice for flat videos', async () => {
    vi.mocked(callChat).mockResolvedValueOnce(reply(storyboard.scenes.length) as Awaited<ReturnType<typeof callChat>>);
    const plans = await planSceneMoments('model', storyboard);
    expect(plans.every((plan) => plan.kind === 'svg')).toBe(true);
  });
});
