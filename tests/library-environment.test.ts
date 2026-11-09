import { describe, expect, it, vi } from 'vitest';
import { buildLibraryEnvironment } from '@/lib/pipeline/library-environment';
import { ASSET_REGISTRY } from '@/lib/assets/registry';
import type { AssetPlan } from '@/lib/assets/plan-schema';

const draw = vi.hoisted(() => vi.fn());
vi.mock('@/lib/assets/draft-ai', () => ({ generateDraft: draw, renderable: (report: { ready: boolean }) => report.ready }));
const plan = {
  instances: [{ id: 'river', assetId: 'environment.water-channel', assetVersion: '0.1.0', variant: 'river', props: {} }],
  scenes: [{ instances: ['river'], narration: 'Air sungai menuju rumah.' }],
} as unknown as AssetPlan;

describe('continuous library environment', () => {
  it('provides story, asset placement and overscan to the drawing model', async () => {
    draw.mockResolvedValue({ code: 'validated SVG', report: { ready: true } });
    const result = await buildLibraryEnvironment('Dari sungai ke keran', plan, ASSET_REGISTRY);
    const notes = draw.mock.calls.at(-1)![0].notes;
    expect(notes).toContain('environment.water-channel');
    expect(notes).toContain('Air sungai menuju rumah.');
    expect(notes).toContain('NEVER draw a second river');
    expect(notes).toContain('Draw extra supporting objects');
    const { x, y, scale } = result.placement;
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
    expect(x + 760 * scale).toBeGreaterThan(760);
    expect(y + 480 * scale).toBeGreaterThan(480);
  });

  it('rejects a failed drawing instead of shipping an empty background', async () => {
    draw.mockResolvedValue({ code: 'broken', report: { ready: false } });
    await expect(buildLibraryEnvironment('Air', plan, ASSET_REGISTRY)).rejects.toThrow('tidak lolos');
  });
});
