import type { StylePreset } from '@/types/studio';

/** Local [x, y, z] point in the asset's own world coordinates. */
export type AssetPoint = readonly [number, number, number];

export type AssetStatus = 'experimental' | 'ready' | 'deprecated';
export type AssetProjection = 'isometric-30';
/** Renderer keys map to local components; the model never names a component directly. */
export type AssetRendererKey = 'IsoCar' | 'IsoRoad';

interface PropBase {
  /** Limits the prop to these variants. Absent means every variant accepts it. */
  variants?: readonly string[];
  /** Numeric props that a plan action may interpolate over time. */
  animatable?: boolean;
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

export interface AssetEntry {
  assetId: string;
  version: string;
  status: AssetStatus;
  label: string;
  renderer: AssetRendererKey;
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
