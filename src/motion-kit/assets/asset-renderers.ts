import React from 'react';
import { PUBLISHED_RENDERER, type AssetEntry, type AssetRendererKey } from '@/lib/assets/types';
import { IsoCar, IsoLmpv, IsoVehicleAC, IsoACCompressor, IsoRoad, IsoWasteSorting, IsoWaterChannel, IsoWaterTreatment, IsoShop, IsoShelf, IsoCheckout, IsoProduct, IsoPosTerminal, IsoHouse, IsoSink, IsoHomeAC, IsoHomeACIndoor, IsoHomeACOutdoor, IsoHomeCompressor, IsoHomeACRemote } from '@/motion-kit/isometric';

/**
 * Registry renderer key → local component. Typed as a full Record, so registering an
 * asset with a new renderer fails the type check until it has a component here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ASSET_RENDERERS: Record<AssetRendererKey, React.FC<any>> = {
  IsoCar,
  IsoLmpv,
  IsoVehicleAC,
  IsoACCompressor,
  IsoRoad,
  IsoWasteSorting,
  IsoWaterChannel,
  IsoWaterTreatment,
  IsoShop, IsoShelf, IsoCheckout, IsoProduct, IsoPosTerminal,
  IsoHouse, IsoSink,
  IsoHomeAC, IsoHomeACIndoor, IsoHomeACOutdoor, IsoHomeCompressor, IsoHomeACRemote,
};

/** Props a renderer needs to show one variant, beyond the registry's own props. */
export function variantRendererProps(renderer: AssetEntry['renderer'], variant: string): Record<string, unknown> {
  if (renderer === PUBLISHED_RENDERER) return { variant };
  if (renderer === 'IsoCar') return { powertrain: variant };
  if (renderer === 'IsoACCompressor' || renderer === 'IsoHomeCompressor' || renderer === 'IsoHomeAC' || renderer === 'IsoHomeACIndoor' || renderer === 'IsoHomeACOutdoor' || renderer === 'IsoWaterTreatment' || renderer === 'IsoWaterChannel' || renderer === 'IsoProduct' || renderer === 'IsoHouse' || renderer === 'IsoSink') return { variant };
  return {};
}

/** Components of database-published assets, keyed by "assetId@version", supplied by the render entry point. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PublishedComponents = Readonly<Record<string, React.FC<any>>>;
export const publishedKey = (entry: Pick<AssetEntry, 'assetId' | 'version'>) => `${entry.assetId}@${entry.version}`;

/** The component that draws an entry, from code or from the published set. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assetComponent(entry: AssetEntry, published?: PublishedComponents): React.FC<any> | undefined {
  return entry.renderer === PUBLISHED_RENDERER ? published?.[publishedKey(entry)] : ASSET_RENDERERS[entry.renderer];
}

/**
 * Draws an asset at a position on a parent SVG. Code assets take x/y/width/height on their
 * own root <svg>. Published assets are model-written and may ignore those props, so they
 * are wrapped in a positioned <svg> with the shared 760x480 viewBox and drawn inside it.
 */
export function placeAsset(entry: AssetEntry, published: PublishedComponents | undefined, props: Record<string, unknown>, box: { key: string; x: number; y: number; width: number; height: number; overflow?: boolean }): React.ReactElement {
  const Component = assetComponent(entry, published);
  // A missing published component is a broken render setup, not something to hide.
  if (!Component) throw new Error(`No component for ${entry.assetId}@${entry.version}`);
  const style = { width: box.width, height: box.height, ...(box.overflow ? { overflow: 'visible' as const } : {}) };
  if (entry.renderer !== PUBLISHED_RENDERER) {
    return React.createElement(Component, { key: box.key, ...props, x: box.x, y: box.y, width: box.width, height: box.height, style });
  }
  return React.createElement('svg', { key: box.key, x: box.x, y: box.y, width: box.width, height: box.height, viewBox: '0 0 760 480', style },
    React.createElement(Component, props));
}
