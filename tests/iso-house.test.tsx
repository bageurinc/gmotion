import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IsoHouse, IsoSink, ISO_HOUSE_ANCHORS, ISO_SINK_ANCHORS, projectCarPoint } from '../src/motion-kit/isometric';
import { getAsset, validateAssetPlan } from '../src/lib/assets';

describe('IsoHouse component', () => {
  it('renders exterior view with pitched roof, chimney, front door, and front window', () => {
    const svg = renderToStaticMarkup(<IsoHouse view="exterior" />);
    expect(svg).toContain('viewBox="0 0 760 480"');
    expect(svg).toContain('aria-label="Rumah tinggal keluarga tampak luar');

    // Roof, chimney, and facade parts
    expect(svg).toContain('data-part="roof"');
    expect(svg).toContain('data-part="front-door"');
    expect(svg).toContain('data-part="window-front"');
    // Cutaway interior is hidden in exterior view
    expect(svg).not.toContain('data-part="interior"');
    expect(svg).not.toMatch(/<(image|img|video|foreignObject)\b/);
  });

  it('renders cutaway view exposing kitchen, bathroom, sinks, faucets, and living room', () => {
    const svg = renderToStaticMarkup(<IsoHouse view="cutaway" />);
    expect(svg).toContain('aria-label="Potongan interior rumah tinggal keluarga lengkap dengan dapur');

    // Dapur (Kitchen), Wastafel & Keran Dapur
    expect(svg).toContain('data-part="kitchen"');
    expect(svg).toContain('data-part="kitchen-sink"');
    expect(svg).toContain('data-part="kitchen-faucet"');

    // Kamar Mandi (Bathroom), Wastafel, Keran & Shower
    expect(svg).toContain('data-part="bathroom"');
    expect(svg).toContain('data-part="bathroom-sink"');
    expect(svg).toContain('data-part="bathroom-faucet"');
    expect(svg).toContain('data-part="shower-area"');

    // Ruang Tamu (Living room)
    expect(svg).toContain('data-part="living-room"');
    expect(svg).toContain('data-part="sofa"');
    expect(svg).toContain('data-part="table"');
    expect(svg).toContain('data-part="lamp"');
    expect(svg).toContain('data-part="plant"');

    // Exterior roof and front facade hidden
    expect(svg).not.toContain('data-part="exterior"');
    expect(svg).not.toContain('data-part="roof"');
  });

  it('flows water from faucets into sinks when waterRunning is true', () => {
    const drySvg = renderToStaticMarkup(<IsoHouse view="cutaway" waterRunning={false} />);
    const waterSvg = renderToStaticMarkup(<IsoHouse view="cutaway" waterRunning={true} />);

    expect(drySvg).not.toContain('data-part="kitchen-water-stream"');
    expect(drySvg).not.toContain('data-part="bathroom-water-stream"');

    expect(waterSvg).toContain('data-part="kitchen-water-stream"');
    expect(waterSvg).toContain('data-part="bathroom-water-stream"');
  });

  it('swings front door when doorOpen changes', () => {
    const closed = renderToStaticMarkup(<IsoHouse view="exterior" doorOpen={0} />);
    const open = renderToStaticMarkup(<IsoHouse view="exterior" doorOpen={1} />);

    expect(closed).toContain('data-part="door-leaf"');
    expect(open).toContain('data-part="door-leaf"');
    expect(closed).not.toEqual(open);
  });

  it('illuminates windows and interior lamp when windowLit is true', () => {
    const dark = renderToStaticMarkup(<IsoHouse view="cutaway" windowLit={false} />);
    const lit = renderToStaticMarkup(<IsoHouse view="cutaway" windowLit={true} />);

    // In lit mode, warm gold lamp and window fill appears
    expect(lit).toContain('#FFEAA3');
    expect(dark).not.toContain('#FFEAA3');
  });

  it('exports stable anchors within the canvas bounds', () => {
    expect(ISO_HOUSE_ANCHORS.entrance).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.door).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.window).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.roof).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.kitchen).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.kitchenSink).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.kitchenFaucet).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.bathroom).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.bathroomSink).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.bathroomFaucet).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.shower).toBeDefined();

    for (const anchor of Object.values(ISO_HOUSE_ANCHORS)) {
      const p = projectCarPoint(anchor);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(760);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(480);
    }
  });
});

describe('IsoSink companion component', () => {
  it('renders kitchen sink with gooseneck faucet', () => {
    const svg = renderToStaticMarkup(<IsoSink variant="kitchen" />);
    expect(svg).toContain('data-part="sink-basin"');
    expect(svg).toContain('data-part="faucet"');
    expect(svg).toContain('Wastafel cuci piring dapur');
  });

  it('renders bathroom sink vanity', () => {
    const svg = renderToStaticMarkup(<IsoSink variant="bathroom" />);
    expect(svg).toContain('Wastafel kamar mandi');
    expect(svg).toContain('data-part="sink-basin"');
  });

  it('animates water stream when waterRunning is active', () => {
    const dry = renderToStaticMarkup(<IsoSink waterRunning={false} />);
    const wet = renderToStaticMarkup(<IsoSink waterRunning={true} />);

    expect(dry).not.toContain('data-part="water-stream"');
    expect(wet).toContain('data-part="water-stream"');
  });

  it('exports valid ISO_SINK_ANCHORS within canvas bounds', () => {
    for (const anchor of Object.values(ISO_SINK_ANCHORS)) {
      const p = projectCarPoint(anchor);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(760);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(480);
    }
  });
});

describe('building.house & building.sink registry and plan integration', () => {
  it('retrieves registered building.house and building.sink assets with variants and capabilities', () => {
    const house = getAsset('building.house', '0.1.0');
    expect(house).toBeDefined();
    expect(house?.variants.residential.capabilities).toContain('kitchen');
    expect(house?.variants.residential.capabilities).toContain('kitchen-sink');
    expect(house?.variants.residential.capabilities).toContain('bathroom');
    expect(house?.variants.residential.capabilities).toContain('bathroom-sink');
    expect(house?.props.waterRunning).toBeDefined();

    const sink = getAsset('building.sink', '0.1.0');
    expect(sink).toBeDefined();
    expect(sink?.variants.kitchen).toBeDefined();
    expect(sink?.variants.bathroom).toBeDefined();
  });

  it('validates an asset plan with house, kitchen, bathroom, and running water', () => {
    const plan = {
      schemaVersion: 1,
      visualPolicy: 'library-first',
      instances: [
        {
          id: 'home',
          assetId: 'building.house',
          assetVersion: '0.1.0',
          variant: 'residential',
          props: { view: 'cutaway', waterRunning: true, windowLit: true },
        },
        {
          id: 'sink-closeup',
          assetId: 'building.sink',
          assetVersion: '0.1.0',
          variant: 'kitchen',
          props: { waterRunning: true },
        },
      ],
      scenes: [
        {
          id: 'house-cutaway',
          layout: 'single',
          durationSec: 4,
          narration: 'Dapur dan kamar mandi terhubung dengan instalasi air bersih rumah tangga.',
          instances: ['home'],
          focus: [
            { instanceId: 'home', anchor: 'kitchenSink', label: 'Wastafel Dapur' },
            { instanceId: 'home', anchor: 'bathroomSink', label: 'Wastafel Kamar Mandi' },
          ],
        },
        {
          id: 'sink-detail',
          layout: 'single',
          durationSec: 3,
          narration: 'Air bersih mengalir dari keran wastafel.',
          instances: ['sink-closeup'],
          focus: [{ instanceId: 'sink-closeup', anchor: 'faucet', label: 'Keran Air' }],
        },
      ],
    };

    const result = validateAssetPlan(plan);
    expect(result.ok).toBe(true);
  });

  it('renders and validates luxury variant with swimming pool, garage with car, and garden', () => {
    // Exterior luxury
    const extSvg = renderToStaticMarkup(<IsoHouse variant="luxury" view="exterior" carInGarage={true} garden={true} />);
    expect(extSvg).toContain('data-part="swimming-pool"');
    expect(extSvg).toContain('data-part="balcony"');
    expect(extSvg).toContain('data-part="garage"');
    expect(extSvg).toContain('data-part="carport-car"');
    expect(extSvg).toContain('data-part="garden"');
    expect(extSvg).toContain('Rumah mewah modern 2 lantai');

    // Cutaway luxury
    const cutSvg = renderToStaticMarkup(<IsoHouse variant="luxury" view="cutaway" waterRunning={true} carInGarage={true} garden={true} />);
    expect(cutSvg).toContain('data-part="swimming-pool"');
    expect(cutSvg).toContain('data-part="kitchen"');
    expect(cutSvg).toContain('data-part="kitchen-sink"');
    expect(cutSvg).toContain('data-part="kitchen-water-stream"');
    expect(cutSvg).toContain('data-part="bathroom"');
    expect(cutSvg).toContain('data-part="shower-area"');
    expect(cutSvg).toContain('data-part="upper-floor"');
    expect(cutSvg).toContain('data-part="garage"');
    expect(cutSvg).toContain('data-part="carport-car"');
    expect(cutSvg).toContain('data-part="garden"');

    // Toggle garage car and garden off
    const withoutCarOrGarden = renderToStaticMarkup(<IsoHouse variant="luxury" carInGarage={false} garden={false} />);
    expect(withoutCarOrGarden).not.toContain('data-part="carport-car"');
    expect(withoutCarOrGarden).not.toContain('data-part="garden"');

    // Anchors for luxury, garage, car, garden
    expect(ISO_HOUSE_ANCHORS.pool).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.balcony).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.upperFloor).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.garage).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.car).toBeDefined();
    expect(ISO_HOUSE_ANCHORS.garden).toBeDefined();

    // Plan validation with luxury variant
    const luxuryPlan = {
      schemaVersion: 1,
      visualPolicy: 'library-first',
      instances: [
        {
          id: 'villa',
          assetId: 'building.house',
          assetVersion: '0.1.0',
          variant: 'luxury',
          props: { view: 'cutaway', waterRunning: true, carInGarage: true, garden: true, poolColor: '#2EB5C8' },
        },
      ],
      scenes: [
        {
          id: 'villa-overview',
          layout: 'single',
          durationSec: 4,
          narration: 'Villa modern 2 lantai dengan garasi mobil, taman asri, dan kolam renang.',
          instances: ['villa'],
          focus: [
            { instanceId: 'villa', anchor: 'car', label: 'Mobil Garasi' },
            { instanceId: 'villa', anchor: 'garden', label: 'Taman Asri' },
            { instanceId: 'villa', anchor: 'pool', label: 'Kolam Renang' },
          ],
        },
      ],
    };

    const res = validateAssetPlan(luxuryPlan);
    expect(res.ok).toBe(true);
  });
});
