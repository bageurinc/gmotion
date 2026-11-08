import { describe, expect, it } from 'vitest';
import {
  ASSET_REGISTRY, describeForPrompt, findAssets, getAsset, registrySnapshot, resolveInstanceProps,
  validateAssetPlan, variantPropsSchema,
} from '../src/lib/assets';
import { ISO_CAR_ANCHORS, ISO_ELECTRIC_CAR_ANCHORS } from '../src/motion-kit/isometric';

type LoosePlan = {
  schemaVersion: number;
  visualPolicy: string;
  instances: { id: string; assetId: string; assetVersion: string; variant: string; props: Record<string, unknown> }[];
  scenes: {
    id: string; layout: string; durationSec: number; instances: string[];
    narration: string;
    set?: { instanceId: string; props: Record<string, unknown> }[];
    focus?: { instanceId: string; anchor: string; label: string }[];
    actions?: { instanceId: string; prop: string; from: number; to: number; startSec: number; endSec: number; easing?: string }[];
  }[];
};

const comparePlan = (): LoosePlan => ({
  schemaVersion: 1,
  visualPolicy: 'library-first',
  instances: [
    { id: 'car-ev', assetId: 'vehicle.car', assetVersion: '0.1.0', variant: 'electric', props: { color: '#367E83', view: 'chassis' } },
    { id: 'car-petrol', assetId: 'vehicle.car', assetVersion: '0.1.0', variant: 'petrol', props: { color: '#CF5A3C', view: 'chassis' } },
    { id: 'road', assetId: 'environment.road', assetVersion: '0.1.0', variant: 'straight', props: { lanes: 2 } },
  ],
  scenes: [
    {
      id: 'compare-source',
      layout: 'side-by-side',
      durationSec: 6,
      narration: 'Mobil listrik menyimpan energi di baterai, mobil bensin di tangki.',
      instances: ['car-ev', 'car-petrol'],
      focus: [{ instanceId: 'car-ev', anchor: 'tractionBattery', label: 'Baterai' }, { instanceId: 'car-petrol', anchor: 'fuelTank', label: 'Tangki' }],
      actions: [{ instanceId: 'car-ev', prop: 'batteryCoverOpacity', from: 0.15, to: 0, startSec: 1, endSec: 3 }],
    },
    {
      id: 'driving',
      layout: 'road',
      durationSec: 5,
      narration: 'Di jalan, keduanya melaju berdampingan.',
      instances: ['road', 'car-petrol', 'car-ev'],
      set: [{ instanceId: 'car-ev', props: { view: 'exterior' } }],
      actions: [{ instanceId: 'road', prop: 'distance', from: 0, to: 600, startSec: 0, endSec: 5, easing: 'linear' }],
    },
  ],
});

const errorsOf = (plan: unknown) => {
  const result = validateAssetPlan(plan);
  return result.ok ? [] : result.errors;
};

describe('asset registry', () => {
  it('keeps every entry self-consistent', () => {
    for (const entry of ASSET_REGISTRY) {
      expect(entry.variants[entry.defaultVariant]).toBeDefined();
      for (const variant of Object.keys(entry.variants)) {
        const defaults = resolveInstanceProps(entry, { id: 'x', assetId: entry.assetId, assetVersion: entry.version, variant, props: {} });
        expect(variantPropsSchema(entry, variant).safeParse(defaults).success).toBe(true);
      }
      for (const spec of Object.values(entry.props)) {
        for (const variant of spec.variants ?? []) expect(entry.variants[variant]).toBeDefined();
      }
    }
  });

  it('takes anchors from the motion kit rather than copying numbers', () => {
    const car = getAsset('vehicle.car', '0.1.0')!;
    expect(car.variants.petrol.anchors.fuelTank).toBe(ISO_CAR_ANCHORS.fuelTank);
    expect(car.variants.electric.anchors.tractionBattery).toBe(ISO_ELECTRIC_CAR_ANCHORS.tractionBattery);
    expect(car.variants.electric.anchors.fuelTank).toBeUndefined();
    expect(car.variants.petrol.anchors.tractionBattery).toBeUndefined();
  });

  it('pins versions in a snapshot', () => {
    expect(registrySnapshot()).toEqual({ 'vehicle.car': '0.1.0', 'environment.road': '0.1.0' });
  });
});

describe('asset plan validation', () => {
  it('accepts the electric versus petrol comparison', () => {
    expect(errorsOf(comparePlan())).toEqual([]);
  });

  it('rejects unknown assets, versions, and variants', () => {
    const plan = comparePlan();
    plan.instances[0].assetId = 'organ.heart';
    plan.instances[1].assetVersion = '9.9.9';
    plan.instances[2].variant = 'curved';
    const errors = errorsOf(plan).join('\n');
    expect(errors).toContain('unknown asset organ.heart');
    expect(errors).toContain('unknown asset vehicle.car@9.9.9');
    expect(errors).toContain('variant curved is not available');
  });

  it('gates props and actions by variant', () => {
    const plan = comparePlan();
    plan.instances[1].props = { ...plan.instances[1].props, energyFlow: true };
    plan.scenes[0].actions = [{ instanceId: 'car-ev', prop: 'engineRotation', from: 0, to: 360, startSec: 0, endSec: 2 }];
    const errors = errorsOf(plan).join('\n');
    expect(errors).toMatch(/car-petrol: props\..*energyFlow/);
    expect(errors).toContain('engineRotation: not an animatable prop of vehicle.car electric');
  });

  it('rejects unknown props, invalid colors, and out-of-range values', () => {
    const plan = comparePlan();
    plan.instances[0].props = { color: 'url(#x)', onClick: 'alert(1)' };
    plan.instances[2].props = { lanes: 7 };
    const errors = errorsOf(plan).join('\n');
    expect(errors).toContain('props.color');
    expect(errors).toContain('onClick');
    expect(errors).toContain('props.lanes');
  });

  it('rejects anchors from the other variant', () => {
    const plan = comparePlan();
    plan.scenes[0].focus = [{ instanceId: 'car-ev', anchor: 'fuelTank', label: 'Tangki' }];
    expect(errorsOf(plan).join('\n')).toContain('anchor fuelTank does not exist on vehicle.car electric');
  });

  it('checks layout membership, duplicates, and timing', () => {
    const plan = comparePlan();
    plan.instances.push({ ...plan.instances[0] });
    plan.scenes[0].instances = ['car-ev'];
    plan.scenes[1].actions![0].endSec = 9;
    const errors = errorsOf(plan).join('\n');
    expect(errors).toContain('instance car-ev: duplicate id');
    expect(errors).toContain('layout side-by-side needs 2 instances');
    expect(errors).toContain('runs past the scene duration');
  });

  it('keeps roads in the road layout only', () => {
    const plan = comparePlan();
    plan.scenes[0].instances = ['car-ev', 'road'];
    plan.scenes[0].focus = [];
    plan.scenes[0].actions = [];
    expect(errorsOf(plan).join('\n')).toContain('a road is only placed by the road layout');
  });

  it('rejects unknown top-level keys such as code from the model', () => {
    expect(errorsOf({ ...comparePlan(), code: 'export default () => null' }).length).toBeGreaterThan(0);
  });
});

describe('asset catalog search', () => {
  it('matches assets and variants by whole words', () => {
    const [car] = findAssets('Bandingkan mobil listrik dan mobil bensin', 'world');
    expect(car.entry.assetId).toBe('vehicle.car');
    expect(car.variants.sort()).toEqual(['electric', 'petrol']);
    expect(findAssets('Kenapa EV lebih senyap?', 'world')[0]?.variants).toEqual(['electric']);
  });

  it('does not match inside other words or outside the asset styles', () => {
    expect(findAssets('Bagaimana jantung memompa darah', 'world')).toEqual([]);
    expect(findAssets('Seven tips', 'world')).toEqual([]);
    expect(findAssets('Mobil listrik', 'story-2d')).toEqual([]);
  });

  it('sends only matched variants and keeps limitations in the prompt subset', () => {
    const [summary] = describeForPrompt(findAssets('mobil listrik', 'world'));
    expect(Object.keys(summary.variants)).toEqual(['electric']);
    expect(summary.props).not.toHaveProperty('engineRotation');
    expect(summary.props).toHaveProperty('energyFlow');
    expect(summary.variants.electric.limitations.length).toBeGreaterThan(0);
  });
});

describe('asset plan state', () => {
  it('carries set props and action end values into later scenes', async () => {
    const { sceneStartStates } = await import('../src/lib/assets/plan-state');
    const result = validateAssetPlan(comparePlan());
    if (!result.ok) throw new Error(result.errors.join());
    const starts = sceneStartStates(result.plan);
    expect(starts[0]['car-ev'].view).toBe('chassis');
    expect(starts[0]['car-ev'].batteryCoverOpacity).toBe(0.15);
    expect(starts[1]['car-ev'].view).toBe('exterior');
    expect(starts[1]['car-ev'].batteryCoverOpacity).toBe(0);
    expect(starts[0]['car-petrol']).not.toHaveProperty('energyFlow');
  });

  it('interpolates actions deterministically and holds from before they start', async () => {
    const { propsAtTime } = await import('../src/lib/assets/plan-state');
    const action = { instanceId: 'a', prop: 'hoodOpen', from: 0, to: 1, startSec: 1, endSec: 3, easing: 'linear' as const };
    expect(propsAtTime({ hoodOpen: 0.5 }, [action], 0).hoodOpen).toBe(0);
    expect(propsAtTime({}, [action], 2).hoodOpen).toBe(0.5);
    expect(propsAtTime({}, [action], 9).hoodOpen).toBe(1);
  });

  it('stretches action timing to the narration length', async () => {
    const { retimePlan } = await import('../src/lib/assets/plan-state');
    const result = validateAssetPlan(comparePlan());
    if (!result.ok) throw new Error(result.errors.join());
    const retimed = retimePlan(result.plan, [12, 5]);
    expect(retimed.scenes[0].actions[0]).toMatchObject({ startSec: 2, endSec: 6 });
    expect(validateAssetPlan(retimed).ok).toBe(true);
  });
});
