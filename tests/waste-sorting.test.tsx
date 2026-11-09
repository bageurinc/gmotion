import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { findAssets, validateAssetPlan } from '../src/lib/assets';
import { IsoWasteSorting, wasteItemPosition } from '../src/motion-kit/isometric/IsoWasteSorting';

const plan = (props: Record<string, unknown> = {}) => ({
  schemaVersion: 1, visualPolicy: 'library-only',
  instances: [{ id: 'bins', assetId: 'environment.waste-sorting', assetVersion: '0.1.0', variant: 'three-stream', props }],
  scenes: [{ id: 'sort', layout: 'single', durationSec: 3, instances: ['bins'], narration: 'Pisahkan kertas ke wadah bertanda kertas.', actions: [{ instanceId: 'bins', prop: 'progress', from: 0, to: 1, startSec: 0, endSec: 3 }] }],
});

describe('waste sorting asset', () => {
  it('is discovered for isometric scenes only and validates transfer actions', () => {
    expect(findAssets('Pemilahan sampah', 'world')[0].entry.assetId).toBe('environment.waste-sorting');
    expect(findAssets('Pemilahan sampah', 'story-2d')).toEqual([]);
    expect(validateAssetPlan(plan({ item: 'paper' })).ok).toBe(true);
    expect(validateAssetPlan(plan({ item: 'hazardous' })).ok).toBe(false);
    expect(validateAssetPlan(plan({ progress: 2 })).ok).toBe(false);
    expect(validateAssetPlan(plan({ paperColor: 'url(x)' })).ok).toBe(false);
  });
  it('routes objects to distinct destinations before depositing and is seek-independent', () => {
    for (const [item, x] of [['leaf', -240], ['paper', 0], ['bottle', 240]] as const) {
      expect(wasteItemPosition(item, 0.7)).toEqual({ point: [x, 0, 250], opacity: 1 });
      expect(wasteItemPosition(item, 1).opacity).toBe(0);
      const before = renderToStaticMarkup(<IsoWasteSorting item={item} progress={0.5} />);
      renderToStaticMarkup(<IsoWasteSorting item={item} progress={1} />);
      expect(renderToStaticMarkup(<IsoWasteSorting item={item} progress={0.5} />)).toBe(before);
    }
  });
  it('rejects placing collection bins on the car road layout', () => {
    const input = plan();
    input.scenes[0].layout = 'road';
    expect(validateAssetPlan(input).ok).toBe(false);
  });
});
