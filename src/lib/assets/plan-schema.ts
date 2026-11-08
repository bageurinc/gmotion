import { z } from 'zod';
import { ASSET_REGISTRY, getAsset } from './registry';
import type { AssetEntry, AssetPropSpec } from './types';

export const PLAN_LIMITS = { instances: 8, scenes: 12, actionsPerScene: 16, sceneSeconds: 60 } as const;

const ID = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const HEX_COLOR = /^#(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/;

export const VisualPolicySchema = z.enum(['library-first', 'library-only']);
export type VisualPolicy = z.infer<typeof VisualPolicySchema>;

export const SceneLayoutSchema = z.enum(['single', 'side-by-side', 'road', 'close-up']);

const ActionSchema = z.object({
  instanceId: ID,
  prop: z.string().max(40),
  from: z.number().finite(),
  to: z.number().finite(),
  startSec: z.number().min(0),
  endSec: z.number().min(0),
  easing: z.enum(['linear', 'ease-in-out', 'ease-out']).default('ease-in-out'),
}).strict();

const SceneSchema = z.object({
  id: ID,
  layout: SceneLayoutSchema,
  durationSec: z.number().positive().max(PLAN_LIMITS.sceneSeconds),
  instances: z.array(ID).min(1).max(PLAN_LIMITS.instances),
  /** Spoken line for this scene; also shown as the caption. */
  narration: z.string().trim().min(1).max(400),
  /** Static props applied from this scene on, for non-animatable changes such as the view. */
  set: z.array(z.object({ instanceId: ID, props: z.record(z.string(), z.unknown()) }).strict()).max(PLAN_LIMITS.instances).default([]),
  focus: z.array(z.object({ instanceId: ID, anchor: z.string().max(40), label: z.string().trim().min(1).max(40) }).strict()).max(4).default([]),
  actions: z.array(ActionSchema).max(PLAN_LIMITS.actionsPerScene).default([]),
}).strict();

const InstanceSchema = z.object({
  id: ID,
  assetId: z.string().max(60),
  assetVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  variant: z.string().max(40),
  props: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const AssetPlanSchema = z.object({
  schemaVersion: z.literal(1),
  visualPolicy: VisualPolicySchema,
  instances: z.array(InstanceSchema).min(1).max(PLAN_LIMITS.instances),
  scenes: z.array(SceneSchema).min(1).max(PLAN_LIMITS.scenes),
}).strict();

export type AssetPlan = z.infer<typeof AssetPlanSchema>;
export type AssetPlanInstance = AssetPlan['instances'][number];

export type AssetPlanResult =
  | { ok: true; plan: AssetPlan }
  | { ok: false; errors: string[] };

function propSchema(spec: AssetPropSpec) {
  switch (spec.type) {
    case 'number': {
      const base = z.number().finite().min(spec.min).max(spec.max);
      return spec.integer ? base.int() : base;
    }
    case 'boolean': return z.boolean();
    case 'enum': return z.enum(spec.values as [string, ...string[]]);
    case 'color': return z.string().regex(HEX_COLOR);
  }
}

/** Props this variant accepts, built from registry metadata. Unknown keys are rejected. */
export function variantPropsSchema(entry: AssetEntry, variant: string) {
  const shape = Object.fromEntries(
    Object.entries(entry.props)
      .filter(([, spec]) => !spec.variants || spec.variants.includes(variant))
      .map(([name, spec]) => [name, propSchema(spec).optional()]),
  );
  return z.object(shape).strict();
}

const LAYOUT_COUNTS: Record<z.infer<typeof SceneLayoutSchema>, [number, number]> = {
  single: [1, 1],
  'close-up': [1, 1],
  'side-by-side': [2, 2],
  road: [2, 5],
};

const issues = (error: z.ZodError, prefix: string) =>
  error.issues.map((issue) => `${prefix}${issue.path.length ? `${issue.path.join('.')}: ` : ''}${issue.message}`);

/**
 * Validates a model-produced plan against the pinned registry. The model may only pick
 * registered IDs, variants, props, anchors, and animatable props; nothing is passed through.
 */
export function validateAssetPlan(input: unknown, registry: readonly AssetEntry[] = ASSET_REGISTRY): AssetPlanResult {
  const parsed = AssetPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: issues(parsed.error, '') };
  const plan = parsed.data;
  const errors: string[] = [];
  const instances = new Map<string, { entry: AssetEntry; instance: AssetPlanInstance }>();

  for (const instance of plan.instances) {
    const where = `instance ${instance.id}: `;
    if (instances.has(instance.id)) { errors.push(`${where}duplicate id`); continue; }
    const entry = getAsset(instance.assetId, instance.assetVersion, registry);
    if (!entry) { errors.push(`${where}unknown asset ${instance.assetId}@${instance.assetVersion}`); continue; }
    if (entry.status === 'deprecated') errors.push(`${where}${entry.assetId}@${entry.version} is deprecated`);
    if (!entry.variants[instance.variant]) { errors.push(`${where}variant ${instance.variant} is not available for ${entry.assetId}`); continue; }
    const props = variantPropsSchema(entry, instance.variant).safeParse(instance.props);
    if (!props.success) errors.push(...issues(props.error, `${where}props.`));
    instances.set(instance.id, { entry, instance });
  }

  const sceneIds = new Set<string>();
  for (const scene of plan.scenes) {
    const where = `scene ${scene.id}: `;
    if (sceneIds.has(scene.id)) errors.push(`${where}duplicate id`);
    sceneIds.add(scene.id);
    if (new Set(scene.instances).size !== scene.instances.length) errors.push(`${where}lists an instance twice`);
    const members = scene.instances.map((id) => instances.get(id));
    scene.instances.forEach((id, index) => { if (!members[index] && !plan.instances.some((item) => item.id === id)) errors.push(`${where}unknown instance ${id}`); });

    const [min, max] = LAYOUT_COUNTS[scene.layout];
    if (scene.instances.length < min || scene.instances.length > max) {
      errors.push(`${where}layout ${scene.layout} needs ${min === max ? min : `${min}-${max}`} instances`);
    }
    const roads = members.filter((member) => member?.entry.assetId === 'environment.road').length;
    if (scene.layout === 'road' && roads !== 1) errors.push(`${where}layout road needs exactly one road instance`);
    if (scene.layout !== 'road' && roads > 0) errors.push(`${where}a road is only placed by the road layout`);

    for (const change of scene.set) {
      const member = scene.instances.includes(change.instanceId) ? instances.get(change.instanceId) : undefined;
      if (!member) { errors.push(`${where}set on ${change.instanceId}, which is not in this scene`); continue; }
      const props = variantPropsSchema(member.entry, member.instance.variant).safeParse(change.props);
      if (!props.success) errors.push(...issues(props.error, `${where}set ${change.instanceId}.`));
    }

    for (const focus of scene.focus) {
      const member = scene.instances.includes(focus.instanceId) ? instances.get(focus.instanceId) : undefined;
      if (!member) { errors.push(`${where}focus on ${focus.instanceId}, which is not in this scene`); continue; }
      if (!member.entry.variants[member.instance.variant].anchors[focus.anchor]) {
        errors.push(`${where}anchor ${focus.anchor} does not exist on ${member.entry.assetId} ${member.instance.variant}`);
      }
    }

    for (const action of scene.actions) {
      const label = `${where}action ${action.instanceId}.${action.prop}: `;
      const member = scene.instances.includes(action.instanceId) ? instances.get(action.instanceId) : undefined;
      if (!member) { errors.push(`${label}instance is not in this scene`); continue; }
      const spec = member.entry.props[action.prop];
      const allowed = spec?.type === 'number' && spec.animatable && (!spec.variants || spec.variants.includes(member.instance.variant));
      if (!allowed) { errors.push(`${label}not an animatable prop of ${member.entry.assetId} ${member.instance.variant}`); continue; }
      if (spec.type === 'number' && [action.from, action.to].some((value) => value < spec.min || value > spec.max)) {
        errors.push(`${label}values must stay within ${spec.min}..${spec.max}`);
      }
      if (action.endSec <= action.startSec) errors.push(`${label}endSec must be after startSec`);
      if (action.endSec > scene.durationSec) errors.push(`${label}runs past the scene duration`);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, plan };
}

/** Resolved props for rendering: registry defaults, then the plan's static props. */
export function resolveInstanceProps(entry: AssetEntry, instance: AssetPlanInstance): Record<string, unknown> {
  const defaults = Object.fromEntries(
    Object.entries(entry.props)
      .filter(([, spec]) => !spec.variants || spec.variants.includes(instance.variant))
      .map(([name, spec]) => [name, spec.default]),
  );
  return { ...defaults, ...instance.props };
}
