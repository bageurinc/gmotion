import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { validateAssetPlan } from '../src/lib/assets';
import { retimePlan } from '../src/lib/assets/plan-state';
import type { AssetPresentation } from '../src/lib/assets';

vi.mock('remotion', async (original) => ({
  ...await original<typeof import('remotion')>(),
  useCurrentFrame: () => 40,
  useVideoConfig: () => ({ fps: 24, width: 540, height: 960 }),
  Sequence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AbsoluteFill: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Audio: () => <audio data-testid="narration-audio" />,
  staticFile: (src: string) => src,
}));
import { PlanVideo } from '../src/motion-kit/assets/PlanVideo';

function makePlan(presentation?: AssetPresentation, scenePresentation?: AssetPresentation, paired = false) {
  const result = validateAssetPlan({
    schemaVersion: 1, visualPolicy: 'library-only', presentation,
    instances: ['a', ...(paired ? ['b'] : [])].map((id) => ({ id, assetId: 'environment.water-treatment', assetVersion: '0.1.0', variant: 'conventional', props: {} })),
    scenes: [{
      id: 'flow', durationSec: 3, layout: paired ? 'side-by-side' : 'single',
      instances: ['a', ...(paired ? ['b'] : [])], narration: 'Narasi suara tetap tersimpan.',
      presentation: scenePresentation,
      focus: [{ instanceId: 'a', anchor: 'filtration', label: 'Media penyaring' }],
      actions: [{ instanceId: 'a', prop: 'settling', from: 0, to: 1, startSec: 0, endSec: 3 }],
    }],
  });
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.plan;
}
const render = (presentation?: AssetPresentation, scene?: AssetPresentation, paired = false) =>
  renderToStaticMarkup(<PlanVideo plan={makePlan(presentation, scene, paired)} audio={['voice.mp3']} />);

describe('optional asset presentation', () => {
  it('keeps existing plans annotated when settings are absent', () => {
    const html = render();
    expect(html).toContain('Narasi suara tetap tersimpan.');
    expect(html).toContain('Media penyaring');
  });
  it('renders the same asset without visible text while retaining narration audio and actions', () => {
    const plan = makePlan({ captions: false, labels: false, names: false }, undefined, true);
    const html = renderToStaticMarkup(<PlanVideo plan={plan} audio={['voice.mp3']} />);
    expect(html).not.toContain('<text');
    expect(html).not.toContain('Narasi suara tetap tersimpan.');
    expect(html).toContain('narration-audio');
    expect(html).toContain('data-part="filtration"');
    expect(plan.scenes[0].actions[0].to).toBe(1);
    expect(plan.scenes[0].narration).toBe('Narasi suara tetap tersimpan.');
  });
  it('controls captions and callouts independently and permits scene overrides', () => {
    expect(render({ captions: false, labels: true })).toContain('Media penyaring');
    expect(render({ captions: true, labels: false })).not.toContain('Media penyaring');
    const html = render({ captions: false, labels: false }, { captions: true });
    expect(html).toContain('Narasi suara tetap tersimpan.');
    expect(html).not.toContain('Media penyaring');
    expect(render({ names: false }, undefined, true)).not.toContain('Pengolahan air permukaan konvensional</text>');
  });
  it('preserves presentation after JSON reload and narration retiming', () => {
    const original = makePlan({ captions: false }, { labels: false });
    const parsed = validateAssetPlan(JSON.parse(JSON.stringify(original)));
    expect(parsed.ok).toBe(true);
    const retimed = retimePlan(original, [6]);
    expect(retimed.presentation).toEqual({ captions: false });
    expect(retimed.scenes[0].presentation).toEqual({ labels: false });
    expect(retimed.scenes[0].actions[0].endSec).toBe(6);
  });
  it('rejects unknown presentation keys and non-boolean settings', () => {
    expect(validateAssetPlan({ ...makePlan(), presentation: { captions: 'false' } }).ok).toBe(false);
    expect(validateAssetPlan({ ...makePlan(), presentation: { css: 'display:none' } }).ok).toBe(false);
  });
});
