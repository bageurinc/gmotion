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
    expect(registrySnapshot()).toEqual({ 'vehicle.car': '0.1.0', 'vehicle.lmpv': '0.1.0', 'vehicle.ac': '0.1.0', 'vehicle.ac-compressor': '0.1.0', 'environment.road': '0.1.0', 'environment.waste-sorting': '0.1.0', 'environment.water-channel': '0.1.0', 'environment.water-treatment': '0.1.0', 'building.house': '0.1.0', 'building.sink': '0.1.0', 'building.home-ac': '0.1.0', 'building.home-ac-indoor': '0.1.0', 'building.home-ac-outdoor': '0.1.0', 'building.home-ac-compressor': '0.1.0', 'building.home-ac-remote': '0.1.0', 'business.shop': '0.1.0', 'business.shelf': '0.1.0', 'business.checkout': '0.1.0', 'business.product': '0.1.0', 'business.pos': '0.1.0' });
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

describe('scene motion rules', () => {
  it('requires a visible change per scene only when asked', () => {
    const plan = comparePlan();
    plan.scenes.push({
      id: 'idle', layout: 'single', durationSec: 4, narration: 'Mesinnya berputar.', instances: ['car-petrol'],
      actions: [{ instanceId: 'car-petrol', prop: 'engineRotation', from: 0, to: 720, startSec: 0, endSec: 4 }],
    });
    expect(validateAssetPlan(plan).ok).toBe(true);
    const strict = validateAssetPlan(plan, undefined, { requireVisibleChange: true });
    expect(strict.ok ? [] : strict.errors).toEqual([expect.stringContaining('scene idle: shows no visible change')]);
    plan.scenes[2].actions!.push({ instanceId: 'car-petrol', prop: 'hoodOpen', from: 0, to: 1, startSec: 1, endSec: 2 });
    expect(validateAssetPlan(plan, undefined, { requireVisibleChange: true }).ok).toBe(true);
  });

  it('tracks first appearances and the state each scene is entered with', async () => {
    const { sceneStates } = await import('../src/lib/assets/plan-state');
    const result = validateAssetPlan(comparePlan());
    if (!result.ok) throw new Error(result.errors.join());
    const [first, second] = sceneStates(result.plan);
    expect([...first.firstAppearance].sort()).toEqual(['car-ev', 'car-petrol']);
    expect(first.entry).not.toHaveProperty('car-ev');
    expect([...second.firstAppearance]).toEqual(['road']);
    expect(second.entry['car-ev'].view).toBe('chassis');
    expect(second.start['car-ev'].view).toBe('exterior');
  });

  it('fades the shell on view changes instead of cutting', async () => {
    const { viewTransition } = await import('../src/lib/assets/plan-state');
    expect(viewTransition(undefined, 'chassis', 0)).toEqual({ shellOpacity: 1 });
    expect(viewTransition('exterior', 'exterior', 0)).toEqual({ shellOpacity: 1 });
    expect(viewTransition('exterior', 'chassis', 0)).toEqual({ view: 'exterior', shellOpacity: 1 });
    expect(viewTransition('exterior', 'chassis', 0.45).shellOpacity).toBeCloseTo(0.5);
    expect(viewTransition('exterior', 'chassis', 2)).toEqual({ shellOpacity: 1 });
    expect(viewTransition('exterior', 'cutaway', 0.899).shellOpacity).toBeCloseTo(0.1, 2);
    expect(viewTransition('chassis', 'exterior', 0)).toEqual({ view: 'exterior', shellOpacity: 0 });
    expect(viewTransition('chassis', 'exterior', 5)).toEqual({ view: 'exterior', shellOpacity: 1 });
  });
});

describe('callout safe area', () => {
  it('keeps label boxes inside the given safe area', async () => {
    const { layoutCallouts } = await import('../src/motion-kit/assets/PlanVideo');
    const area = { left: 1080 * 0.08, right: 1080 * 0.83, top: 1920 * 0.12 };
    const items = layoutCallouts([
      { point: { x: 900, y: 260 }, text: 'Transmisi bensin' },
      { point: { x: 150, y: 300 }, text: 'Baterai traksi' },
    ], 1080, area);
    for (const item of items) {
      expect(item.boxX).toBeGreaterThanOrEqual(area.left);
      expect(item.boxX + item.boxWidth).toBeLessThanOrEqual(area.right + 0.001);
      expect(item.boxY).toBeGreaterThanOrEqual(area.top);
    }
  });
});

describe('renderer-driven loops', () => {
  const waterPlan = (props: Record<string, unknown>, actions: unknown[] = []) => ({
    schemaVersion: 1, visualPolicy: 'library-first',
    instances: [{ id: 'plant', assetId: 'environment.water-treatment', assetVersion: '0.1.0', variant: 'conventional', props }],
    scenes: [
      { id: 'intro', layout: 'single', durationSec: 4, narration: 'Air masuk.', instances: ['plant'] },
      { id: 'flow', layout: 'single', durationSec: 4, narration: 'Air mengalir.', instances: ['plant'], actions },
    ],
  });

  it('counts an active flow as visible motion and refuses to animate the loop phase', () => {
    expect(validateAssetPlan(waterPlan({ flowing: true }), undefined, { requireVisibleChange: true }).ok).toBe(true);
    const still = validateAssetPlan(waterPlan({ flowing: false }), undefined, { requireVisibleChange: true });
    expect(still.ok ? [] : still.errors.join()).toContain('scene flow: shows no visible change');
    const animated = validateAssetPlan(waterPlan({}, [{ instanceId: 'plant', prop: 'flowPhase', from: 0, to: 300, startSec: 0, endSec: 4 }]));
    expect(animated.ok ? [] : animated.errors.join()).toContain('not an animatable prop');
  });
});

describe('one-world layout', () => {
  it('places every instance once, cars in lanes on one road, others off the shoulder', async () => {
    const { layoutWorld } = await import('../src/motion-kit/assets/WorldPlanVideo');
    const result = validateAssetPlan(comparePlan());
    if (!result.ok) throw new Error(result.errors.join());
    const layout = layoutWorld(result.plan, ASSET_REGISTRY);
    expect([...layout.origins.keys()]).toEqual(['car-ev', 'car-petrol']);
    expect(layout.road?.id).toBe('road');
    const [ev, petrol] = [layout.origins.get('car-ev')!, layout.origins.get('car-petrol')!];
    // Later objects step further along the iso x axis: right and down on screen.
    expect(petrol.x).toBeGreaterThan(ev.x - 300);
    expect(petrol.depth).not.toBe(ev.depth);
  });
});
