import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssetExplorer } from '@/components/admin/AssetExplorer';
import { ASSET_REGISTRY } from '@/lib/assets/registry';
import { homeAcAsset, homeCompressorAsset, homeIndoorAsset, homeOutdoorAsset } from '@/lib/assets/home-ac';
import { houseAsset } from '@/lib/assets/house';
import { assetComponent, variantRendererProps } from '@/motion-kit/assets/asset-renderers';
import { PUBLISHED_RENDERER } from '@/lib/assets/types';

const normalize = (markup: string) => markup.replace(/id="[^"]*"|url\(#[^)]*\)|aria-labelledby="[^"]*"/g, '');

describe('asset part explorer', () => {
  it('offers the car exterior, interior, chassis and mechanical controls', () => {
    const car = ASSET_REGISTRY.find((entry) => entry.assetId === 'vehicle.car')!;
    const html = renderToStaticMarkup(<AssetExplorer entry={car} />);
    for (const text of ['Bagian luar', 'Interior / potongan dalam', 'Rangka dan mesin', 'Buka kap mesin', 'Ketebalan bodi']) expect(html).toContain(text);
    expect(html).not.toContain('Penutup baterai');
  });
  it('offers house interior and plumbing without claiming a chassis exists', () => {
    const html = renderToStaticMarkup(<AssetExplorer entry={houseAsset} />);
    expect(html).toContain('Interior / potongan dalam');
    expect(html).toContain('Tampilkan pipa');
    expect(html).not.toContain('Rangka dan mesin');
  });
  it('renders different real geometry for each supported view', () => {
    for (const entry of [ASSET_REGISTRY.find((entry) => entry.assetId === 'vehicle.car')!, houseAsset]) {
      const spec = entry.props.view;
      if (spec.type !== 'enum') throw new Error('Missing view enum');
      const Component = assetComponent(entry)!;
      const props = Object.fromEntries(Object.entries(entry.props).map(([name, item]) => [name, item.default]));
      const results = spec.values.map((view) => normalize(renderToStaticMarkup(<Component {...props} {...variantRendererProps(entry.renderer, entry.defaultVariant)} view={view} />)));
      expect(new Set(results).size).toBe(spec.values.length);
    }
  });
  it('offers playback on home AC units and only on the compressor cutaway', () => {
    for (const entry of [homeIndoorAsset, homeOutdoorAsset]) {
      expect(renderToStaticMarkup(<AssetExplorer entry={entry} />)).toContain('Putar animasi');
    }
    expect(renderToStaticMarkup(<AssetExplorer entry={homeCompressorAsset} />)).not.toContain('Putar animasi');
    const cutaway = { ...homeCompressorAsset, defaultVariant: 'cutaway' };
    const html = renderToStaticMarkup(<AssetExplorer entry={cutaway} />);
    expect(html).toContain('Putar animasi');
    expect(html).toContain('Putaran poros');
  });
  it('reveals AC internals by fading the casing in the same variant', () => {
    const examples = [
      [homeAcAsset, 'outdoor-casing', 'outdoor-internals'],
      [homeIndoorAsset, 'indoor-casing', 'indoor-internals'],
      [homeOutdoorAsset, 'outdoor-casing', 'outdoor-internals'],
      [homeCompressorAsset, 'sealed-shell', 'rotary-chamber'],
    ] as const;
    for (const [entry, casing, internals] of examples) {
      const Component = assetComponent(entry)!;
      const variant = variantRendererProps(entry.renderer, entry.defaultVariant);
      const draw = (opacity: number) => renderToStaticMarkup(<Component {...variant} casingOpacity={opacity} />);
      expect(renderToStaticMarkup(<AssetExplorer entry={entry} />)).toContain('Transparansi casing');
      expect(draw(1)).not.toContain(`data-part="${internals}"`);
      expect(draw(0.5)).toContain(`data-part="${casing}" opacity="0.5"`);
      expect(draw(0.5)).toContain(`data-part="${internals}"`);
      expect(draw(0)).not.toContain(`data-part="${casing}"`);
    }
  });
  it('uses only stored images for published assets', () => {
    const entry = { ...houseAsset, renderer: PUBLISHED_RENDERER };
    const html = renderToStaticMarkup(<AssetExplorer entry={entry} previews={[{ key: 'residential', variant: 'residential', label: 'Bagian luar', source: 'data:image/svg+xml;base64,PHN2Zy8+' }]} />);
    expect(html).toContain('Keadaan tersimpan');
    expect(html).toContain('data:image/svg+xml;base64,PHN2Zy8+');
    expect(html).not.toContain('type="range"');
  });
});
