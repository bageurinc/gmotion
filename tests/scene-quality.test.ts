import { describe, expect, it, vi } from 'vitest';
import { critiqueRequest, type AssetCritique, type GeneratedAsset } from '@/lib/explainer/asset-generator';
import { improveWeakScenes, qualityTools } from '@/lib/explainer/scene-quality';
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
    expect(quality.saveScene).toHaveBeenCalledWith(0, null, critique(7));
  });

  it('keeps a redraw that scores higher', async () => {
    const quality = tools([4, 6]);
    await improveWeakScenes(project, quality);
    expect(quality.saveScene).toHaveBeenLastCalledWith(0, draft, critique(6));
  });

  it('keeps the original when the redraw is not better', async () => {
    const quality = tools([4, 4]);
    await improveWeakScenes(project, quality);
    expect(quality.saveScene).toHaveBeenCalledTimes(1);
    expect(quality.saveScene).toHaveBeenCalledWith(0, null, critique(4));
  });

  it('holds Full SVG to its higher threshold', async () => {
    const fullSvg = { ...project, storyboard: { ...storyboard, preset: 'story-svg' } } as unknown as StudioProject;
    const weak = tools([6.2, 7]);
    await improveWeakScenes(fullSvg, weak);
    expect(weak.redraw).toHaveBeenCalledOnce();

    const strong = tools([6.6]);
    await improveWeakScenes(fullSvg, strong);
    expect(strong.redraw).not.toHaveBeenCalled();
  });

  it('keeps the 5.5 threshold for other styles', async () => {
    const quality = tools([6.2]);
    await improveWeakScenes(project, quality);
    expect(quality.redraw).not.toHaveBeenCalled();
  });

  it('keeps the critic issues with the scene score', () => {
    let saved: Partial<StudioProject> = {};
    const { saveScene } = qualityTools(() => project, (changes) => {
      saved = changes(project);
    });
    saveScene(0, null, critique(5));
    expect(saved.sceneProgress?.[storyboard.scenes[0].id]).toEqual({ stage: 'ready', score: 5, issues: ['kosong'] });
  });

  it('skips a scene when the redraw request fails', async () => {
    const quality = tools([4]);
    quality.redraw.mockRejectedValue(new Error('router down'));
    await expect(improveWeakScenes(project, quality)).resolves.toBeUndefined();
    expect(quality.saveScene).toHaveBeenCalledTimes(1);
  });
});

describe('critiqueRequest', () => {
  const parts = [{ label: 'Inti' }];

  it('lists the labels a scene really shows', () => {
    const labelled = { code: '', manifest: { parts } } as unknown as GeneratedAsset;
    expect(critiqueRequest('Topik', labelled)).toBe('Topic request: "Topik"\nVisible labels: Inti');
  });

  it('tells the critic a choreography scene has no labels', () => {
    const unlabelled = { code: '', manifest: { parts, choreography: [] } } as unknown as GeneratedAsset;
    const text = critiqueRequest('Topik', unlabelled, 'Catatan');
    expect(text).toContain('no part labels');
    expect(text).not.toContain('Inti');
    expect(text.endsWith('Catatan')).toBe(true);
  });
});
