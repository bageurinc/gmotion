import { describe, expect, it, vi } from 'vitest';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import { describeStillStretches, frameChanges } from '@/lib/render/motion-check';
import { guardRevisedScene, opensWithPreviousScene, repairCrashedScenes, sampleSceneFrames, sheetFrames, type SceneCrash } from '@/lib/render/scene-check';
import type { StudioProject } from '@/types/studio';

const project = {
  id: 'scene-check',
  storyboard: generateProceduralStoryboard('Topik', 'story-2d', '9:16'),
  files: { 'Scene1.tsx': 'crashing', 'Scene2.tsx': 'fine' },
} as unknown as StudioProject;

const crash: SceneCrash = { index: 0, message: 'inputRange must be strictly monotonically increasing' };

function tools(results: SceneCrash[][]) {
  const findCrashes = vi.fn();
  results.forEach((result) => findCrashes.mockResolvedValueOnce(result));
  return {
    current: () => project,
    findCrashes,
    reviseScene: vi.fn().mockResolvedValue('revised'),
    replaceWithSimpleScene: vi.fn().mockReturnValue('simple'),
    saveScene: vi.fn(),
  };
}

describe('sampleSceneFrames', () => {
  it('samples each scene on the shared timeline', () => {
    expect(sampleSceneFrames([100, 50])).toEqual([
      { index: 0, frame: 2 },
      { index: 0, frame: 50 },
      { index: 0, frame: 97 },
      { index: 1, frame: 102 },
      { index: 1, frame: 125 },
      { index: 1, frame: 147 },
    ]);
  });

  it('stays inside very short scenes', () => {
    const frames = sampleSceneFrames([3]).map((sample) => sample.frame);
    expect(Math.max(...frames)).toBeLessThanOrEqual(2);
    expect(Math.min(...frames)).toBeGreaterThanOrEqual(0);
  });
});

describe('sheetFrames', () => {
  const sceneA = { id: 'a', durationInFrames: 100, wordTimings: [], voiceoverText: 'satu dua tiga empat' };
  const sceneB = {
    id: 'b',
    durationInFrames: 200,
    voiceoverText: '',
    wordTimings: [
      { word: 'satu', startMs: 0, endMs: 1000 },
      { word: 'dua', startMs: 1000, endMs: 2000 },
    ],
  };
  const withScenes = (preset: string, choreography?: unknown) =>
    ({
      storyboard: { preset, fps: 30, scenes: [sceneA, sceneB] },
      sceneAssets: choreography ? { b: { manifest: { choreography } } } : undefined,
    }) as unknown as StudioProject;

  it('stays clear of the fades at a cut', () => {
    expect(sheetFrames(withScenes('story-2d'), 0)).toEqual([2, 50, 90]);
    expect(sheetFrames(withScenes('story-2d'), 1)).toEqual([109, 200, 290]);
  });

  it('adds the finished pose of each narrated action', () => {
    const actions = [{ id: 'turun', startWord: 0, endWord: 1 }];
    expect(sheetFrames(withScenes('story-2d', actions), 1)).toEqual([109, 160, 200, 290]);
  });

  it('drops frames nearly on top of each other', () => {
    const actions = [{ id: 'turun', startWord: 0, endWord: 0 }];
    const project = withScenes('story-2d', actions);
    project.storyboard.scenes[1] = { ...sceneB, wordTimings: [{ word: 'satu', startMs: 0, endMs: 3400 }] } as never;
    expect(sheetFrames(project, 1)).toEqual([109, 200, 290]);
  });

  it('leads a full SVG scene with the end of the previous scene', () => {
    const project = withScenes('story-svg');
    expect(opensWithPreviousScene(project, 0)).toBe(false);
    expect(opensWithPreviousScene(project, 1)).toBe(true);
    expect(sheetFrames(project, 0)).toEqual([2, 50, 90]);
    expect(sheetFrames(project, 1)).toEqual([90, 109, 200, 290]);
  });
});

describe('stillness helpers', () => {
  it('measures the mean difference between neighbors', () => {
    expect(frameChanges([Uint8Array.of(10, 10), Uint8Array.of(14, 10), Uint8Array.of(14, 10)])).toEqual([2, 0]);
  });

  it('writes an Indonesian note only when something stayed still', () => {
    expect(describeStillStretches([])).toBe('');
    expect(describeStillStretches([{ from: 12, to: 18.5, seconds: 6.5 }])).toBe(
      'Ada 1 bagian yang hampir diam lebih dari 4 detik, yaitu detik 12,0–18,5. Cek bagian ini saat menonton.'
    );
  });
});

describe('repairCrashedScenes', () => {
  it('does nothing when every scene runs', async () => {
    const repair = tools([[]]);
    await repairCrashedScenes(project, repair);
    expect(repair.reviseScene).not.toHaveBeenCalled();
    expect(repair.findCrashes).toHaveBeenCalledTimes(1);
  });

  it('keeps an AI repair that fixes the crash', async () => {
    const repair = tools([[crash], []]);
    await repairCrashedScenes(project, repair);
    expect(repair.saveScene).toHaveBeenCalledTimes(1);
    expect(repair.saveScene).toHaveBeenCalledWith(0, 'revised', false);
  });

  it('falls back to the simple scene when the repair still crashes', async () => {
    const repair = tools([[crash], [crash]]);
    await repairCrashedScenes(project, repair);
    expect(repair.saveScene).toHaveBeenLastCalledWith(0, 'simple', true);
  });
});

describe('guardRevisedScene', () => {
  const guard = (results: Array<SceneCrash[] | Error>, repaired = 'repaired') => {
    const findCrashes = vi.fn();
    results.forEach((result) => (result instanceof Error ? findCrashes.mockRejectedValueOnce(result) : findCrashes.mockResolvedValueOnce(result)));
    const repair = vi.fn().mockResolvedValue(repaired);
    return { findCrashes, repair };
  };

  it('keeps a revision that renders, checking only that scene', async () => {
    const t = guard([[]]);
    expect(await guardRevisedScene(project, 0, 'before', t)).toEqual({ code: 'crashing', outcome: 'ok' });
    expect(t.findCrashes).toHaveBeenCalledWith(project, [0]);
    expect(t.repair).not.toHaveBeenCalled();
  });

  it('keeps an AI repair that renders', async () => {
    const t = guard([[crash], []]);
    const result = await guardRevisedScene(project, 0, 'before', t);
    expect(result).toEqual({ code: 'repaired', outcome: 'repaired', crash: crash.message });
    expect(t.findCrashes.mock.calls[1][0].files['Scene1.tsx']).toBe('repaired');
  });

  it('goes back to the previous code when the repair still crashes', async () => {
    const t = guard([[crash], [crash]]);
    expect(await guardRevisedScene(project, 0, 'before', t)).toMatchObject({ code: 'before', outcome: 'reverted' });
  });

  it('goes back without a second check when the repair changes nothing', async () => {
    const t = guard([[crash]], 'crashing');
    expect(await guardRevisedScene(project, 0, 'before', t)).toMatchObject({ code: 'before', outcome: 'reverted' });
    expect(t.findCrashes).toHaveBeenCalledTimes(1);
  });

  it('keeps the revision but says so when the checker itself fails', async () => {
    const t = guard([new Error('no chrome')]);
    expect(await guardRevisedScene(project, 0, 'before', t)).toEqual({ code: 'crashing', outcome: 'unchecked' });
  });
});
