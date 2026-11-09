import { describe, expect, it } from 'vitest';
import { validateAssetPlan } from '@/lib/assets/plan-schema';

const example = () => ({
  schemaVersion: 1, visualPolicy: 'library-first',
  instances: [
    { id: 'plant', assetId: 'environment.water-treatment', assetVersion: '0.1.0', variant: 'conventional', props: {} },
    { id: 'home', assetId: 'building.house', assetVersion: '0.1.0', variant: 'residential', props: {} },
  ],
  connections: [{ from: { instanceId: 'plant', anchor: 'outlet' }, to: { instanceId: 'home', anchor: 'waterInlet' } }],
  scenes: [{ id: 'home', layout: 'close-up', camera: { zoom: 12 }, durationSec: 5, instances: ['home'], narration: 'Air sampai di keran dapur.',
    set: [{ instanceId: 'home', props: { view: 'cutaway', waterRunning: true, plumbingVisible: true } }],
    focus: [{ instanceId: 'home', anchor: 'kitchenFaucet', label: 'Keran dapur' }], actions: [],
  }],
});

describe('water supply into a house', () => {
  it('preserves the pipe endpoints and faucet camera through saving and reloading', () => {
    const input = example();
    const parsed = validateAssetPlan(JSON.parse(JSON.stringify(input)));
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
    expect(parsed.plan.connections).toEqual(input.connections);
    expect(parsed.plan.scenes[0].camera).toEqual({ zoom: 12 });
  });
  it('rejects missing connection anchors and unsafe camera values', () => {
    const input = example();
    input.connections[0].to.anchor = 'missing';
    expect(validateAssetPlan(input).ok).toBe(false);
    for (const zoom of [0, Infinity, 100]) {
      const invalid = example();
      invalid.scenes[0].camera.zoom = zoom;
      expect(validateAssetPlan(invalid).ok).toBe(false);
    }
  });
});
