import { ASSET_REGISTRY, getAsset } from './registry';
import { resolveInstanceProps, type AssetPlan } from './plan-schema';
import type { AssetEntry } from './types';

export type InstanceProps = Record<string, unknown>;
type Action = AssetPlan['scenes'][number]['actions'][number];

const EASINGS: Record<Action['easing'], (t: number) => number> = {
  linear: (t) => t,
  'ease-in-out': (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  'ease-out': (t) => 1 - (1 - t) ** 3,
};

export interface SceneState {
  /** Props as the previous scene left them, before this scene's `set`. Absent on first appearance. */
  entry: Record<string, InstanceProps>;
  /** Props after this scene's `set`, before its actions run. */
  start: Record<string, InstanceProps>;
  /** Instances shown for the first time in this scene. */
  firstAppearance: ReadonlySet<string>;
}

/**
 * Per-scene state. A scene's `set` and the end values of its actions carry into later
 * scenes, so an opened hood stays open until a plan closes it.
 */
export function sceneStates(plan: AssetPlan, registry: readonly AssetEntry[] = ASSET_REGISTRY): SceneState[] {
  const current: Record<string, InstanceProps> = {};
  for (const instance of plan.instances) {
    const entry = getAsset(instance.assetId, instance.assetVersion, registry);
    if (entry) current[instance.id] = resolveInstanceProps(entry, instance);
  }
  const shown = new Set<string>();
  return plan.scenes.map((scene) => {
    const firstAppearance = new Set(scene.instances.filter((id) => !shown.has(id)));
    scene.instances.forEach((id) => shown.add(id));
    const entry = structuredClone(Object.fromEntries(Object.entries(current).filter(([id]) => !firstAppearance.has(id))));
    for (const change of scene.set) current[change.instanceId] = { ...current[change.instanceId], ...change.props };
    const start = structuredClone(current);
    for (const action of [...scene.actions].sort((a, b) => a.endSec - b.endSec)) {
      current[action.instanceId] = { ...current[action.instanceId], [action.prop]: action.to };
    }
    return { entry, start, firstAppearance };
  });
}

export const sceneStartStates = (plan: AssetPlan, registry: readonly AssetEntry[] = ASSET_REGISTRY) =>
  sceneStates(plan, registry).map((state) => state.start);

export const VIEW_TRANSITION_SEC = 0.9;

/**
 * Opening or closing the shell plays as a fade instead of a cut: the shell fades out in the
 * old view before switching, or fades in on the exterior view.
 */
export function viewTransition(entryView: unknown, startView: unknown, seconds: number): { view?: string; shellOpacity: number } {
  if (entryView === undefined || entryView === startView) return { shellOpacity: 1 };
  const progress = Math.min(1, Math.max(0, seconds / VIEW_TRANSITION_SEC));
  const eased = EASINGS['ease-in-out'](progress);
  // Cutaway keeps a 10% ghost shell, so fading to that level makes the switch seamless.
  const ghost = (view: unknown) => (view === 'cutaway' ? 0.1 : 0);
  if (entryView === 'exterior') return progress < 1 ? { view: 'exterior', shellOpacity: 1 - eased * (1 - ghost(startView)) } : { shellOpacity: 1 };
  if (startView === 'exterior') return { view: 'exterior', shellOpacity: ghost(entryView) + eased * (1 - ghost(entryView)) };
  return { shellOpacity: 1 };
}

/** Props at `seconds` into a scene. Before an action starts, its `from` value already applies. */
export function propsAtTime(start: InstanceProps, actions: readonly Action[], seconds: number): InstanceProps {
  const props = { ...start };
  const ordered = [...actions].sort((a, b) => a.startSec - b.startSec);
  const seen = new Set<string>();
  for (const action of ordered) {
    if (seconds < action.startSec) {
      if (!seen.has(action.prop)) props[action.prop] = action.from;
      seen.add(action.prop);
      continue;
    }
    seen.add(action.prop);
    const progress = Math.min(1, (seconds - action.startSec) / (action.endSec - action.startSec));
    props[action.prop] = action.from + (action.to - action.from) * EASINGS[action.easing](progress);
  }
  return props;
}

/** Stretches each scene and its action times to the real narration length. */
export function retimePlan(plan: AssetPlan, durationsSec: readonly number[]): AssetPlan {
  return {
    ...plan,
    scenes: plan.scenes.map((scene, index) => {
      const duration = durationsSec[index] ?? scene.durationSec;
      const factor = duration / scene.durationSec;
      return {
        ...scene,
        durationSec: duration,
        actions: scene.actions.map((action) => ({ ...action, startSec: action.startSec * factor, endSec: Math.min(duration, action.endSec * factor) })),
      };
    }),
  };
}
