import type { StylePreset } from '@/types/studio';

/** Local [x, y, z] point in the asset's own world coordinates. */
export type AssetPoint = readonly [number, number, number];

export type AssetStatus = 'experimental' | 'ready' | 'deprecated';
export type AssetProjection = 'isometric-30';
/** Renderer keys map to local components; the model never names a component directly. */
export type AssetRendererKey = 'IsoCar' | 'IsoLmpv' | 'IsoRoad' | 'IsoWasteSorting' | 'IsoWaterChannel' | 'IsoWaterTreatment' | 'IsoShop' | 'IsoShelf' | 'IsoCheckout' | 'IsoProduct' | 'IsoPosTerminal' | 'IsoHouse' | 'IsoSink';

interface PropBase {
  /** Limits the prop to these variants. Absent means every variant accepts it. */
  variants?: readonly string[];
  /** Numeric props that a plan action may interpolate over time. */
  animatable?: boolean;
  /**
   * A looping phase the renderer advances from the frame at a readable speed (units per second),
   * while the boolean prop named in activeWhen is true. Plans cannot animate it: models picked
   * speeds so high that the motion aliased into stillness.
   */
  driven?: { speed: number; activeWhen?: string };
  /** Motion too small to read on a wide shot, so it does not count as a scene's visible change. */
  subtle?: boolean;
  description: string;
}

export type AssetPropSpec =
  | (PropBase & { type: 'number'; min: number; max: number; default: number; integer?: boolean })
  | (PropBase & { type: 'boolean'; default: boolean })
  | (PropBase & { type: 'enum'; values: readonly string[]; default: string })
  | (PropBase & { type: 'color'; default: string; material: string });

export interface AssetVariant {
  label: string;
  /** What this variant can show. Mechanisms not listed here are unsupported. */
  capabilities: readonly string[];
  anchors: Readonly<Record<string, AssetPoint>>;
  limitations: readonly string[];
}

/** Renderer of assets published from the admin draft flow; their component code lives in the database. */
export const PUBLISHED_RENDERER = 'Published' as const;

export interface AssetEntry {
  assetId: string;
  version: string;
  status: AssetStatus;
  label: string;
  renderer: AssetRendererKey | typeof PUBLISHED_RENDERER;
  /** Set for assets published from /admin/assets: where the component code and previews came from. */
  published?: { id: string; draftId: string; draftVersion: number; publishedAt: number; publishedBy: string | null };
  projection: AssetProjection;
  styles: readonly StylePreset[];
  /** Lowercase words or phrases that point at this asset in an Indonesian or English prompt. */
  aliases: readonly string[];
  variants: Readonly<Record<string, AssetVariant & { aliases: readonly string[] }>>;
  defaultVariant: string;
  props: Readonly<Record<string, AssetPropSpec>>;
  bounds: { viewBox: readonly [number, number]; groundOrigin: readonly [number, number] };
  /** Color tokens that stay fixed whatever the theme, because they carry meaning. */
  protectedMaterials: readonly string[];
  limitations: readonly string[];
  provenance: { author: string; license: string; commercialUse: boolean };
}
