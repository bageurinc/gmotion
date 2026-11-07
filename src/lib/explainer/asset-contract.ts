import { z } from 'zod';

/**
 * Topic-neutral contract for every generated explainer asset.
 * The stage, camera, labels, and flows depend only on this shape,
 * so no downstream code needs to know whether the subject is a heart or inflation.
 */

const IdSchema = z.string().regex(/^[a-z][a-zA-Z0-9]*$/);
const Coordinate = z.number().min(0).max(1000);
const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const FocusSchema = z.object({
  x: Coordinate,
  y: Coordinate,
  scale: z.number().min(1).max(4),
});

export const AssetManifestSchema = z
  .object({
    topic: z.string().min(1),
    title: z.string().min(1).max(32),
    subtitle: z.string().min(1).max(64),
    palette: z.object({
      backgroundFrom: HexColor,
      backgroundTo: HexColor,
      accent: HexColor,
      accentAlt: HexColor,
      text: HexColor,
    }),
    heroFocus: FocusSchema,
    views: z
      .array(
        z.object({
          id: IdSchema,
          label: z.string().min(1).max(40),
          description: z.string().min(1),
        })
      )
      .min(2)
      .max(4),
    parts: z
      .array(
        z.object({
          id: IdSchema,
          label: z.string().min(1).max(28),
          views: z.array(IdSchema).min(1),
          anchor: z.object({ x: Coordinate, y: Coordinate }),
          focus: FocusSchema,
        })
      )
      .min(3)
      .max(10),
    flows: z
      .array(
        z.object({
          id: IdSchema,
          view: IdSchema,
          d: z.string().min(5),
          color: HexColor,
        })
      )
      .min(1)
      .max(6),
  })
  .superRefine((manifest, ctx) => {
    const viewIds = new Set(manifest.views.map((view) => view.id));
    for (const part of manifest.parts) {
      for (const view of part.views) {
        if (!viewIds.has(view)) {
          ctx.addIssue({ code: 'custom', message: `Part ${part.id} references unknown view ${view}` });
        }
      }
    }
    for (const flow of manifest.flows) {
      if (!viewIds.has(flow.view)) {
        ctx.addIssue({ code: 'custom', message: `Flow ${flow.id} references unknown view ${flow.view}` });
      }
    }
    const secondView = manifest.views[1]?.id;
    if (manifest.parts.filter((part) => part.views.includes(secondView)).length < 2) {
      ctx.addIssue({ code: 'custom', message: 'The second view needs at least two parts' });
    }
    if (!manifest.flows.some((flow) => flow.view === secondView)) {
      ctx.addIssue({ code: 'custom', message: 'The second view needs at least one flow' });
    }
  });

export type AssetManifest = z.infer<typeof AssetManifestSchema>;
export type AssetFocus = z.infer<typeof FocusSchema>;

export interface GeneratedAssetProps {
  /** Opacity from 0 to 1 for every manifest view. */
  viewOpacity: Record<string, number>;
  /** Highlight strength from 0 to 1 for every manifest part. */
  highlight: Record<string, number>;
  /** Scene time in seconds, for deterministic idle motion. */
  time: number;
}

export function missingContractIds(manifest: AssetManifest, code: string): string[] {
  const ids = [...manifest.views.map((view) => view.id), ...manifest.parts.map((part) => part.id)];
  return ids.filter((id) => !code.includes(id));
}
