import { describe, expect, it, vi } from 'vitest';
import type { AssetCritique, GeneratedAsset } from '@/lib/explainer/asset-generator';
import { improveWeakScenes } from '@/lib/explainer/scene-quality';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import type { StudioProject } from '@/types/studio';

vi.mock('@/lib/render/scene-check', () => ({ captureSceneSheets: vi.fn() }));

const storyboard = generateProceduralStoryboard('Topik', 'story-2d', '9:16');
const asset = { code: 'asset', manifest: {} } as unknown as GeneratedAsset;
const project = {
  id: 'quality',
  storyboard,
  files: { 'Scene1.tsx': 'old' },
  sceneAssets: { [storyboard.scenes[0].id]: asset },
} as unknown as StudioProject;
const critique = (average: number) => ({ average, issues: ['kosong'], scores: {} }) as AssetCritique;
const draft = { asset, code: 'redrawn' };

function tools(scores: number[]) {
  const critiqueTool = vi.fn();
  scores.forEach((score) => critiqueTool.mockResolvedValueOnce(critique(score)));
  return {
    current: () => project,
    capture: vi.fn().mockResolvedValue(new Map([[0, Buffer.from('sheet')]])),
    critique: critiqueTool,
    redraw: vi.fn().mockResolvedValue(draft),
    saveScene: vi.fn(),
  };
}

describe('improveWeakScenes', () => {
  it('leaves strong scenes alone', async () => {
    const quality = tools([7]);
    await improveWeakScenes(project, quality);
    expect(quality.redraw).not.toHaveBeenCalled();
    expect(quality.saveScene).toHaveBeenCalledWith(0, null, 7);
  });

  it('keeps a redraw that scores higher', async () => {
    const quality = tools([4, 6]);
    await improveWeakScenes(project, quality);
    expect(quality.saveScene).toHaveBeenLastCalledWith(0, draft, 6);
  });

  it('keeps the original when the redraw is not better', async () => {
    const quality = tools([4, 4]);
    await improveWeakScenes(project, quality);
    expect(quality.saveScene).toHaveBeenCalledTimes(1);
    expect(quality.saveScene).toHaveBeenCalledWith(0, null, 4);
  });

  it('skips a scene when the redraw request fails', async () => {
    const quality = tools([4]);
    quality.redraw.mockRejectedValue(new Error('router down'));
    await expect(improveWeakScenes(project, quality)).resolves.toBeUndefined();
    expect(quality.saveScene).toHaveBeenCalledTimes(1);
  });
});
