import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { findAssets, getAsset, validateAssetPlan } from '../src/lib/assets';
import { IsoShop, IsoShelf, IsoCheckout, ISO_SHOP_ANCHORS, checkoutProductPoint } from '../src/motion-kit/isometric/IsoShop';
import { ASSET_RENDERERS, variantRendererProps } from '../src/motion-kit/assets/asset-renderers';

const plan = (assetId: string, variant: string, props: Record<string, unknown> = {}) => ({
  schemaVersion: 1, visualPolicy: 'library-only', presentation: { captions: false, labels: false, names: false },
  instances: [{ id: 'item', assetId, assetVersion: '0.1.0', variant, props }],
  scenes: [{ id: 'one', layout: 'single', durationSec: 3, narration: 'Aset usaha generik.', instances: ['item'] }],
});

describe('business assets', () => {
  it('discovers independent assets only in the supported style', () => {
    for (const [text, id] of [['toko', 'business.shop'], ['rak', 'business.shelf'], ['meja kasir', 'business.checkout'], ['produk', 'business.product'], ['POS', 'business.pos']]) {
      expect(findAssets(text, 'world').some((match) => match.entry.assetId === id)).toBe(true);
      expect(findAssets(text, 'story-2d')).toEqual([]);
    }
    expect(findAssets('Can you show a river?', 'world').some((match) => match.entry.assetId === 'business.product')).toBe(false);
    expect(getAsset('business.shop')!.variants.generic.anchors).toBe(ISO_SHOP_ANCHORS);
  });
  it('uses different product geometry per variant without visible brand or price text', () => {
    const Component = ASSET_RENDERERS.IsoProduct;
    const variants = ['box', 'bottle', 'can'];
    const markup = variants.map((variant) => renderToStaticMarkup(<Component {...variantRendererProps('IsoProduct', variant)} />));
    expect(new Set(markup).size).toBe(3);
    for (const html of markup) expect(html).not.toMatch(/<text|<image|id=/);
  });
  it('gates props, bounds, versions, and variants through the registry', () => {
    expect(validateAssetPlan(plan('business.shop', 'generic', { view: 'cutaway', posActive: true })).ok).toBe(true);
    expect(validateAssetPlan(plan('business.shelf', 'three-tier', { stockCount: 7 })).ok).toBe(false);
    expect(validateAssetPlan(plan('business.shelf', 'three-tier', { stockCount: 2.5 })).ok).toBe(false);
    expect(validateAssetPlan(plan('business.product', 'bottle', { color: 'url(x)' })).ok).toBe(false);
    expect(validateAssetPlan(plan('business.pos', 'desktop', { price: 10000 })).ok).toBe(false);
    expect(validateAssetPlan(plan('business.product', 'branded')).ok).toBe(false);
  });
  it('supports registered checkout actions without pretending to process a payment', () => {
    const input = { ...plan('business.checkout', 'counter'), scenes: [{ ...plan('business.checkout', 'counter').scenes[0], actions: [{ instanceId: 'item', prop: 'drawerOpen', from: 0, to: 1, startSec: 0, endSec: 3 }] }] };
    expect(validateAssetPlan(input).ok).toBe(true);
    expect(checkoutProductPoint(0)).toEqual([-85, 0, 108]);
    expect(checkoutProductPoint(0.5)).toEqual([0, 0, 108]);
    expect(checkoutProductPoint(1)).toEqual([85, 0, 108]);
    input.scenes[0].actions[0].to = 2;
    expect(validateAssetPlan(input).ok).toBe(false);
  });
  it('shows distinct door, cutaway, stock and drawer states deterministically', () => {
    expect(renderToStaticMarkup(<IsoShop doorOpen={0} />)).not.toBe(renderToStaticMarkup(<IsoShop doorOpen={1} />));
    expect(renderToStaticMarkup(<IsoShop view="cutaway" />)).not.toContain('data-part="storefront"');
    const empty = renderToStaticMarkup(<IsoShelf stockCount={0} />);
    expect(empty).not.toContain('data-part="product-');
    expect(renderToStaticMarkup(<IsoShelf stockCount={3} />).match(/data-part="product-/g)).toHaveLength(3);
    const frame = renderToStaticMarkup(<IsoCheckout drawerOpen={0.5} scanProgress={0.5} />);
    renderToStaticMarkup(<IsoCheckout drawerOpen={1} scanProgress={1} />);
    expect(renderToStaticMarkup(<IsoCheckout drawerOpen={0.5} scanProgress={0.5} />)).toBe(frame);
    expect(frame).not.toBe(renderToStaticMarkup(<IsoCheckout drawerOpen={0} scanProgress={0} />));
  });
});
