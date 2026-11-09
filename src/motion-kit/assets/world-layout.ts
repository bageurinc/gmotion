import { getAsset } from '@/lib/assets/registry';
import type { AssetPlan, AssetPlanInstance } from '@/lib/assets/plan-schema';
import type { AssetEntry } from '@/lib/assets/types';
import { roadGeometry } from '@/motion-kit/isometric';

export const COS_30 = Math.sqrt(3) / 2;
/** World units between neighbouring objects along the iso x axis (the car is 440 long). */
export const SLOT_STEP = 720;

export type Point = { x: number; y: number };

/** Screen offset of a world point on the shared projection, relative to its own canvas origin. */
export const worldOffset = (x: number, y: number): Point => ({ x: (x - y) * COS_30, y: (x + y) / 2 });

export interface WorldLayout {
  /** Canvas origin of each instance, in world-canvas pixels. */
  origins: Map<string, Point & { depth: number }>;
  road?: { id: string; origin: Point; geometry: ReturnType<typeof roadGeometry> };
}

/**
 * Places every instance once in one isometric world, in the order the story first shows
 * them, stepping along the iso x axis. Cars share a road when the plan has one.
 */
export function layoutWorld(plan: AssetPlan, registry: readonly AssetEntry[]): WorldLayout {
  const entryOf = (instance: AssetPlanInstance) => getAsset(instance.assetId, instance.assetVersion, registry);
  const order: AssetPlanInstance[] = [];
  for (const scene of plan.scenes) {
    for (const id of scene.instances) {
      const instance = plan.instances.find((item) => item.id === id);
      if (instance && !order.includes(instance)) order.push(instance);
    }
  }
  const roadInstance = order.find((instance) => entryOf(instance)?.renderer === 'IsoRoad');
  const things = order.filter((instance) => instance !== roadInstance);
  const origins = new Map<string, Point & { depth: number }>();
  let carIndex = 0;
  const geometry = roadInstance ? roadGeometry({ lanes: (roadInstance.props.lanes as 1) ?? 2, length: 2400 }) : undefined;
  things.forEach((instance, index) => {
    const x = index * SLOT_STEP;
    const isCar = entryOf(instance)?.renderer === 'IsoCar';
    // Cars drive in the lanes; anything else stands just off the near shoulder.
    const y = geometry
      ? isCar ? geometry.laneCenters[carIndex++ % geometry.count] : geometry.width / 2 + 160
      : 0;
    origins.set(instance.id, { ...worldOffset(x, y), depth: x + y });
  });
  if (!roadInstance || !geometry) return { origins };
  const carXs = things.filter((instance) => entryOf(instance)?.renderer === 'IsoCar').map((instance) => things.indexOf(instance) * SLOT_STEP);
  const centerX = carXs.length ? (Math.min(...carXs) + Math.max(...carXs)) / 2 : 0;
  return { origins, road: { id: roadInstance.id, origin: worldOffset(centerX, 0), geometry } };
}
