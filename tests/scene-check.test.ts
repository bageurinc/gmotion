import { describe, expect, it, vi } from 'vitest';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import { repairCrashedScenes, sampleSceneFrames, type SceneCrash } from '@/lib/render/scene-check';
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
