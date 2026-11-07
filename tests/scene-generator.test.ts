import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateVideoSceneFile } from '@/lib/explainer/scene-generator';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';

const mocks = vi.hoisted(() => ({
  generateAsset: vi.fn(),
  repairAsset: vi.fn(),
  parseAssetResponse: vi.fn(),
  generateSceneFile: vi.fn(),
}));

vi.mock('@/lib/explainer/asset-generator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/explainer/asset-generator')>()),
  generateAsset: mocks.generateAsset,
  repairAsset: mocks.repairAsset,
  parseAssetResponse: mocks.parseAssetResponse,
}));

vi.mock('@/lib/pipeline/coder-agent', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/pipeline/coder-agent')>()),
  generateSceneFile: mocks.generateSceneFile,
}));

const manifest = { title: 'Uji', palette: {}, parts: [], views: [], flows: [] };
const assetCode = `import React from 'react';
export const Asset = () => <svg />;
export default Asset;`;

describe('generateVideoSceneFile', () => {
  const adsStoryboard = generateProceduralStoryboard('Iklan aplikasi kasir', 'ads-ui', '9:16');
  const ctaIndex = adsStoryboard.scenes.findIndex((scene) => scene.role === 'cta');

  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    mocks.generateAsset.mockResolvedValue({ text: 'asset' });
    mocks.parseAssetResponse.mockReturnValue({ manifest, code: assetCode });
    mocks.generateSceneFile.mockResolvedValue('simple scene');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('illustrates ads scenes by default', async () => {
    const result = await generateVideoSceneFile(adsStoryboard, 0);
    expect(result.simplified).toBe(false);
    expect(result.code).toContain('AssetStage');
    expect(mocks.generateSceneFile).not.toHaveBeenCalled();
  });

  it('keeps the CTA scene on the button-capable generator', async () => {
    const result = await generateVideoSceneFile(adsStoryboard, ctaIndex);
    expect(result).toEqual({ code: 'simple scene', simplified: false });
    expect(mocks.generateAsset).not.toHaveBeenCalled();
  });

  it('marks a scene as simplified when illustration fails', async () => {
    mocks.generateAsset.mockRejectedValue(new Error('router down'));
    const result = await generateVideoSceneFile(adsStoryboard, 0);
    expect(result).toEqual({ code: 'simple scene', simplified: true });
  });
});
