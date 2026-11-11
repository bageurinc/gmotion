import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assetModel, generateVideoSceneFile } from '@/lib/explainer/scene-generator';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import { drawingModelAllowed } from '@/types/studio';

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

  describe('Full SVG', () => {
    const storyboard = generateProceduralStoryboard('Topik uji', 'story-svg', '9:16');
    const choreographed = {
      ...manifest,
      views: [{ id: 'world', label: 'Dunia', description: 'Satu dunia' }],
      choreography: [{ id: 'pour', description: 'Air mengalir', startWord: 0, endWord: 0 }],
    };
    const world = (fill: string) => `// SHARED-WORLD:START
const WorldBase = () => <rect fill="${fill}" />;
// SHARED-WORLD:END`;
    const animated = `import React from 'react';
${world('#111111')}
export const Asset = ({ actionProgress }) => <svg><WorldBase /><rect x={(actionProgress.pour ?? 0) * 100} /></svg>;
export default Asset;`;

    it('passes spoken action timing to the stage', async () => {
      mocks.parseAssetResponse.mockReturnValue({ manifest: choreographed, code: animated });
      const result = await generateVideoSceneFile(storyboard, 0);
      expect(result.simplified).toBe(false);
      expect(result.code).toContain('actionCues={[{"id":"pour"');
      expect(mocks.repairAsset).not.toHaveBeenCalled();
    });

    it('sends the chosen model and forces the shared world', async () => {
      mocks.parseAssetResponse.mockReturnValue({ manifest: choreographed, code: animated });
      const result = await generateVideoSceneFile(storyboard, 1, {
        drawingModel: 'deepseek-flash',
        continuity: { sharedWorld: world('#222222') },
      });
      expect(mocks.generateAsset.mock.calls[0][0]).toBe('ds/deepseek-v4.1-flash');
      expect(mocks.generateAsset.mock.calls[0][1]).toContain(world('#222222'));
      expect(result.asset?.code).toContain('#222222');
      expect(result.asset?.code).not.toContain('#111111');
    });

    it('asks for a repair when the shared world is missing', async () => {
      mocks.repairAsset.mockResolvedValue({ text: 'asset' });
      mocks.parseAssetResponse
        .mockReturnValueOnce({ manifest: choreographed, code: animated.replace(world('#111111'), '') })
        .mockReturnValue({ manifest: choreographed, code: animated });
      const result = await generateVideoSceneFile(storyboard, 0);
      expect(result.simplified).toBe(false);
      expect(mocks.repairAsset.mock.calls[0][3]).toContain('SHARED-WORLD');
    });

    it('falls back when an asset still uses a raster image', async () => {
      mocks.repairAsset.mockResolvedValue({ text: 'asset' });
      mocks.parseAssetResponse.mockReturnValue({
        manifest: choreographed,
        code: animated.replace('<rect', "<image href='/picture.png' /><rect"),
      });
      const result = await generateVideoSceneFile(storyboard, 0);
      expect(result.simplified).toBe(true);
      expect(mocks.generateAsset).toHaveBeenCalledTimes(2);
      expect(mocks.generateSceneFile).toHaveBeenCalledWith(storyboard, 0);
    });

    it('recovers on the second full attempt', async () => {
      mocks.repairAsset.mockResolvedValue({ text: 'asset' });
      mocks.parseAssetResponse
        .mockReturnValueOnce({ manifest: choreographed, code: assetCode })
        .mockReturnValueOnce({ manifest: choreographed, code: assetCode })
        .mockReturnValue({ manifest: choreographed, code: animated });
      const result = await generateVideoSceneFile(storyboard, 0);
      expect(result.simplified).toBe(false);
      expect(mocks.generateSceneFile).not.toHaveBeenCalled();
    });

    it('asks for a repair when an action never moves anything', async () => {
      mocks.repairAsset.mockResolvedValue({ text: 'asset' });
      mocks.parseAssetResponse
        .mockReturnValueOnce({ manifest: choreographed, code: assetCode })
        .mockReturnValue({ manifest: choreographed, code: animated });
      const result = await generateVideoSceneFile(storyboard, 0);
      expect(result.simplified).toBe(false);
      expect(mocks.repairAsset.mock.calls[0][3]).toContain('pour');
    });
  });

  it('uses Gemini unless DeepSeek Flash is chosen', () => {
    vi.stubEnv('ASSET_MODEL', '');
    vi.stubEnv('CODER_MODEL', 'gemini-uji');
    expect(assetModel()).toBe('gemini-uji');
    expect(assetModel('gemini')).toBe('gemini-uji');
    expect(assetModel('deepseek-flash')).toBe('ds/deepseek-v4.1-flash');
  });

  it('maps the admin-only models to their gateway ids', () => {
    expect(assetModel('claude-sonnet')).toBe('cc/claude-sonnet-5-5');
    expect(assetModel('claude-opus')).toBe('cc/claude-opus-5-5');
    expect(assetModel('gpt-sol')).toBe('cx/gpt-6.1-sol');
    expect(assetModel('gpt-terra')).toBe('cx/gpt-6.1-terra');
  });

  it('lets only admins draw with the admin-only models', () => {
    for (const model of ['claude-sonnet', 'claude-opus', 'gpt-sol', 'gpt-terra'] as const) {
      expect(drawingModelAllowed(model, false)).toBe(false);
      expect(drawingModelAllowed(model, true)).toBe(true);
    }
    expect(drawingModelAllowed('gemini', false)).toBe(true);
    expect(drawingModelAllowed('deepseek-flash', false)).toBe(true);
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
