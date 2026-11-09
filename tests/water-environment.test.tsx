import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { findAssets, getAsset, validateAssetPlan } from '../src/lib/assets';
import { IsoWaterChannel, WATER_CHANNEL_ROUTE } from '../src/motion-kit/isometric/IsoWaterChannel';
import { IsoWaterTreatment, ISO_WATER_TREATMENT_ANCHORS } from '../src/motion-kit/isometric/IsoWaterTreatment';
import { waterFlowPoint } from '../src/motion-kit/isometric/water-svg';

const plan = (assetId = 'environment.water-treatment', variant = 'conventional', props: Record<string, unknown> = {}) => ({
  schemaVersion: 1, visualPolicy: 'library-only',
  instances: [{ id: 'water', assetId, assetVersion: '0.1.0', variant, props }],
  scenes: [{ id: 'flow', layout: 'single', durationSec: 4, instances: ['water'], narration: 'Aliran air ilustratif.', focus: [], actions: [] }],
});

describe('water environment assets', () => {
  it('selects real channel variants and keeps treatment separate from wastewater', () => {
    expect(findAssets('sungai', 'world')[0].variants).toEqual(['river']);
    expect(findAssets('saluran air', 'world')[0].variants).toEqual(['canal']);
    expect(findAssets('pengolahan air', 'world')[0].entry.assetId).toBe('environment.water-treatment');
    expect(findAssets('pengolahan air', 'story-2d')).toEqual([]);
    expect(validateAssetPlan(plan()).ok).toBe(true);
    expect(validateAssetPlan(plan('environment.water-channel', 'canal')).ok).toBe(true);
    expect(validateAssetPlan(plan('environment.water-treatment', 'wastewater')).ok).toBe(false);
    expect(getAsset('environment.water-treatment')!.variants.conventional.anchors).toBe(ISO_WATER_TREATMENT_ANCHORS);
  });
  it('rejects invalid material colors, process values, anchors, and road placement', () => {
    expect(validateAssetPlan(plan(undefined, undefined, { waterColor: 'url(x)' })).ok).toBe(false);
    expect(validateAssetPlan(plan(undefined, undefined, { settling: 2 })).ok).toBe(false);
    expect(validateAssetPlan(plan('environment.water-channel', 'river', { settling: 1 })).ok).toBe(false);
    const input = plan();
    input.scenes[0].layout = 'road';
    expect(validateAssetPlan(input).ok).toBe(false);
  });
  it('follows the channel in forward order with clamped finite positions', () => {
    expect(waterFlowPoint(WATER_CHANNEL_ROUTE, 0)).toEqual(WATER_CHANNEL_ROUTE[0]);
    expect(waterFlowPoint(WATER_CHANNEL_ROUTE, 1)).toEqual(WATER_CHANNEL_ROUTE.at(-1));
    let previous = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const [x, y, z] = waterFlowPoint(WATER_CHANNEL_ROUTE, i / 100);
      expect(x).toBeGreaterThanOrEqual(previous);
      expect([x, y, z].every(Number.isFinite)).toBe(true);
      previous = x;
    }
    expect(waterFlowPoint(WATER_CHANNEL_ROUTE, NaN)).toEqual(WATER_CHANNEL_ROUTE[0]);
  });
  it('renders distinct channel geometry and deterministic settling without shared SVG IDs', () => {
    expect(renderToStaticMarkup(<IsoWaterChannel variant="river" />)).not.toBe(renderToStaticMarkup(<IsoWaterChannel variant="canal" />));
    const initial = renderToStaticMarkup(<IsoWaterTreatment settling={0.25} flowPhase={0.2} />);
    expect(renderToStaticMarkup(<IsoWaterTreatment settling={1} flowPhase={0.7} />)).not.toBe(initial);
    expect(renderToStaticMarkup(<IsoWaterTreatment settling={0.25} flowPhase={0.2} />)).toBe(initial);
    expect(initial).not.toContain('id=');
  });
  it('animates water inside connecting pipes and tanks, and freezes it when stopped', () => {
    const active = renderToStaticMarkup(<IsoWaterTreatment flowPhase={0.1} />);
    const later = renderToStaticMarkup(<IsoWaterTreatment flowPhase={0.6} />);
    expect(active).toContain('data-part="pipe-water"');
    expect(active).toContain('data-part="surface-ripples"');
    expect(later).not.toBe(active);
    const stopped = renderToStaticMarkup(<IsoWaterTreatment flowing={false} flowPhase={0.1} />);
    expect(stopped).not.toContain('data-part="surface-ripples"');
    expect(renderToStaticMarkup(<IsoWaterTreatment flowing={false} flowPhase={0.6} />)).toBe(stopped);
    expect(active + later + stopped).not.toMatch(/NaN|Infinity/);
  });

  it('keeps river currents visible on long world routes and stops them with flowing=false', () => {
    const initial = renderToStaticMarkup(<IsoWaterChannel continuous flowPhase={0.1} />);
    const later = renderToStaticMarkup(<IsoWaterChannel continuous flowPhase={0.6} />);
    expect(initial).toContain('data-part="river-currents"');
    expect(initial.match(/data-part="current-lane"/g)).toHaveLength(5);
    expect(initial).not.toContain('data-part="flow-route"');
    expect(later).not.toBe(initial);
    const stopped = renderToStaticMarkup(<IsoWaterChannel continuous flowing={false} flowPhase={0.1} />);
    expect(renderToStaticMarkup(<IsoWaterChannel continuous flowing={false} flowPhase={0.6} />)).toBe(stopped);
    expect(renderToStaticMarkup(<IsoWaterChannel flowPhase={NaN} />)).not.toMatch(/NaN|Infinity/);
  });

  it('renders each modular process as one basin with only its own equipment', () => {
    for (const variant of ['coagulation', 'sedimentation', 'filtration', 'disinfection'] as const) {
      const html = renderToStaticMarkup(<IsoWaterTreatment variant={variant} />);
      expect(html.match(/data-part="cutaway-wall"/g)).toHaveLength(1);
      expect(html).toContain('data-part="treatment-unit"');
      expect(html).toContain('data-part="pipe-wall-sockets"');
      expect(html).not.toContain('data-part="flow-route"');
      expect(html).not.toContain('data-part="legacy-treatment-line"');
      expect(validateAssetPlan(plan('environment.water-treatment', variant)).ok).toBe(true);
      expect(validateAssetPlan(plan('environment.water-treatment', variant, { settling: 0.5 })).ok).toBe(variant === 'sedimentation');
    }
    const legacy = renderToStaticMarkup(<IsoWaterTreatment variant="conventional" />);
    expect(legacy.match(/data-part="cutaway-wall"/g)).toHaveLength(4);
    expect(getAsset('environment.water-treatment')!.defaultVariant).toBe('coagulation');
    expect(renderToStaticMarkup(<IsoWaterTreatment variant="sedimentation" settling={0} />))
      .not.toBe(renderToStaticMarkup(<IsoWaterTreatment variant="sedimentation" settling={1} />));
  });

});
