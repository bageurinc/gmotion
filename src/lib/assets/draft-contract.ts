import { z } from 'zod';
import { validateSceneCode } from '@/lib/pipeline/code-validator';

/** A draft may import only these. The kit shares the library's isometric projection. */
export const DRAFT_IMPORTS = ['react', '@/motion-kit/isometric/draft-kit'] as const;
export const DRAFT_CODE_LIMIT = 40_000;
export const DRAFT_CANVAS = { width: 760, height: 480 } as const;

const NAME = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/);
const ID = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/);
const POINT = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const TEXT = z.string().trim().min(1).max(200);

const PropBase = { description: TEXT, variants: z.array(ID).max(8).optional() };
export const DraftPropSchema = z.discriminatedUnion('type', [
  z.object({ ...PropBase, type: z.literal('number'), min: z.number().finite(), max: z.number().finite(), default: z.number().finite(), animatable: z.boolean().optional(), integer: z.boolean().optional() }).strict()
    .refine((spec) => spec.min < spec.max && spec.default >= spec.min && spec.default <= spec.max, 'min < max and default within range'),
  z.object({ ...PropBase, type: z.literal('boolean'), default: z.boolean() }).strict(),
  z.object({ ...PropBase, type: z.literal('enum'), values: z.array(ID).min(2).max(8), default: ID }).strict()
    .refine((spec) => spec.values.includes(spec.default), 'default must be one of values'),
  z.object({ ...PropBase, type: z.literal('color'), default: z.string().regex(/^#[\da-fA-F]{6}$/), material: z.string().regex(/^[a-z]+(?:\.[a-z-]+)+$/) }).strict(),
]);

export const DraftMetaSchema = z.object({
  label: TEXT,
  aliases: z.array(z.string().trim().toLowerCase().min(2).max(40)).min(1).max(12),
  defaultVariant: ID,
  variants: z.record(ID, z.object({
    label: TEXT,
    capabilities: z.array(ID).min(1).max(20),
    anchors: z.record(NAME, POINT).refine((anchors) => Object.keys(anchors).length >= 1 && Object.keys(anchors).length <= 16, '1–16 anchors'),
    limitations: z.array(TEXT).max(8),
  }).strict()).refine((variants) => Object.keys(variants).length >= 1 && Object.keys(variants).length <= 4, '1–4 variants'),
  props: z.record(NAME, DraftPropSchema).refine((props) => Object.keys(props).length <= 12, 'at most 12 props').refine((props) => !('variant' in props), "'variant' is passed by the renderer, not declared as a prop"),
  limitations: z.array(TEXT).min(1).max(8),
}).strict().superRefine((meta, context) => {
  if (!meta.variants[meta.defaultVariant]) context.addIssue({ code: 'custom', message: `defaultVariant ${meta.defaultVariant} is not a variant`, path: ['defaultVariant'] });
  for (const [name, spec] of Object.entries(meta.props)) {
    for (const variant of spec.variants ?? []) {
      if (!meta.variants[variant]) context.addIssue({ code: 'custom', message: `prop ${name} names unknown variant ${variant}`, path: ['props', name] });
    }
  }
});
export type DraftMeta = z.infer<typeof DraftMetaSchema>;

export interface PreviewCase {
  key: string;
  label: string;
  variant: string;
  props: Record<string, unknown>;
}

function defaults(meta: DraftMeta, variant: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(meta.props)
    .filter(([, spec]) => !spec.variants || spec.variants.includes(variant))
    .map(([name, spec]) => [name, spec.default]));
}

/**
 * The states an admin reviews: each variant at its defaults, every value of every state
 * prop, and every animatable number at its end value. Capped so a draft cannot flood the page.
 */
export function previewCases(meta: DraftMeta, limit = 16): PreviewCase[] {
  const cases: PreviewCase[] = [];
  for (const [variant, info] of Object.entries(meta.variants)) {
    const base = defaults(meta, variant);
    cases.push({ key: `${variant}`, label: info.label, variant, props: { ...base, variant } });
    for (const [name, spec] of Object.entries(meta.props)) {
      if (spec.variants && !spec.variants.includes(variant)) continue;
      if (spec.type === 'enum') {
        for (const value of spec.values.filter((item) => item !== spec.default)) {
          cases.push({ key: `${variant}:${name}=${value}`, label: `${info.label} · ${name}: ${value}`, variant, props: { ...base, variant, [name]: value } });
        }
      }
      if (spec.type === 'number' && spec.animatable) {
        const end = spec.default === spec.max ? spec.min : spec.max;
        cases.push({ key: `${variant}:${name}=${end}`, label: `${info.label} · ${name}: ${end}`, variant, props: { ...base, variant, [name]: end } });
      }
      if (spec.type === 'boolean') {
        cases.push({ key: `${variant}:${name}=${!spec.default}`, label: `${info.label} · ${name}: ${spec.default ? 'mati' : 'nyala'}`, variant, props: { ...base, variant, [name]: !spec.default } });
      }
    }
  }
  return cases.slice(0, limit);
}

/** Same rules as AI scene code, with a narrower import list and no raster images. */
export function validateDraftCode(code: string): string[] {
  if (code.length > DRAFT_CODE_LIMIT) return [`Code is longer than ${DRAFT_CODE_LIMIT} characters.`];
  const result = validateSceneCode(code, 'DraftAsset.tsx', { svgOnly: true, allowedImports: DRAFT_IMPORTS });
  const errors = [...result.errors];
  if (!/export\s+default\s+/.test(code)) errors.push('DraftAsset.tsx must have a default export: the asset component.');
  return errors;
}

/** Projects an anchor the same way the kit does, to check it lands on the canvas. */
export function projectAnchor([x, y, z]: readonly [number, number, number]) {
  const cos30 = Math.sqrt(3) / 2;
  return { x: 380 + (x - y) * cos30, y: 300 + (x + y) / 2 - z };
}
