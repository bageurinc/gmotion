import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  IsoLmpv,
  ISO_LMPV_ANCHORS,
  projectCarPoint,
} from '../src/motion-kit/isometric';
import { findAssets, getAsset, validateAssetPlan } from '../src/lib/assets';

describe('IsoLmpv component', () => {
  it('renders default exterior view with 7-seater body and wheels', () => {
    const html = renderToStaticMarkup(<IsoLmpv color="#4A5560" />);
    expect(html).toContain('viewBox="0 0 760 480"');
    expect(html).toContain('data-part="front-wheel"');
    expect(html).toContain('data-part="rear-wheel"');
    expect(html).toContain('data-part="body"');
    expect(html).toContain('data-part="front-fascia"');
    expect(html).toContain('data-part="side-windows"');
    expect(html).toContain('data-part="side-mirror"');
    expect(html).toContain('data-part="shark-fin-antenna"');
    expect(html).toContain('data-part="shadow"');
  });

  it('renders cutaway view exposing 3-row interior and transverse engine bay', () => {
    const html = renderToStaticMarkup(<IsoLmpv view="cutaway" />);
    expect(html).toContain('data-part="cabin"');
    expect(html).toContain('data-part="dashboard"');
    expect(html).toContain('data-part="steering-wheel"');
    expect(html).toContain('data-part="row-1-seats"');
    expect(html).toContain('data-part="row-2-seats"');
    expect(html).toContain('data-part="row-3-seats"');
    expect(html).toContain('data-part="double-blower"');
    expect(html).toContain('data-part="cargo-luggage"');
    expect(html).toContain('data-part="engine-bay"');
    expect(html).toContain('data-part="radiator"');
    expect(html).toContain('data-part="engine-block"');
    expect(html).toContain('data-part="intake"');
    expect(html).toContain('data-part="battery"');
  });

  it('renders chassis view exposing FWD transaxle, front suspension, fuel tank, and torsion beam', () => {
    const html = renderToStaticMarkup(<IsoLmpv view="chassis" />);
    expect(html).toContain('data-part="underbody"');
    expect(html).toContain('data-part="chassis-platform"');
    expect(html).toContain('data-part="fwd-drivetrain"');
    expect(html).toContain('data-part="fuel-tank"');
    expect(html).toContain('data-part="exhaust"');
    expect(html).toContain('data-part="rear-torsion-beam"');
  });

  it('handles interactive opening props: hoodOpen, tailgateOpen, doorOpen, windowOpen', () => {
    const htmlOpen = renderToStaticMarkup(
      <IsoLmpv
        hoodOpen={1}
        tailgateOpen={1}
        doorOpen={1}
        windowOpen={0.8}
        headlights={true}
      />
    );
    expect(htmlOpen).toContain('data-part="hood"');
    expect(htmlOpen).toContain('data-part="tailgate-open"');
    expect(htmlOpen).toContain('data-part="driver-door-open"');
    expect(htmlOpen).toContain('data-part="side-windows"');
    // Headlights lit color
    expect(htmlOpen).toContain('#FFF8C4');
  });

  it('lifts the tailgate out of the cargo opening while keeping its roof hinge fixed', () => {
    for (const open of [0.01, 0.25, 0.5, 0.75, 1]) {
      const html = renderToStaticMarkup(<IsoLmpv tailgateOpen={open} />);
      const hatch = html.match(/data-part="tailgate-open"[^>]*><polygon points="([^"]+)"/);
      expect(hatch).not.toBeNull();
      const vertices = hatch![1].split(' ').map((point) => point.split(',').map(Number));
      const hinge = projectCarPoint([-188, -78, 178]);
      expect(vertices[0][0]).toBeCloseTo(hinge.x);
      expect(vertices[0][1]).toBeCloseTo(hinge.y);
      // Recover world coordinates from the projected lower corner at y=-78.
      const [screenX, screenY] = vertices[1];
      const x = (screenX - 380) / (Math.sqrt(3) / 2) - 78;
      const z = 300 + (x - 78) / 2 - screenY;
      expect(x).toBeLessThan(-225);
      expect(z).toBeGreaterThan(112);
      expect(Math.hypot(x + 188, z - 178)).toBeCloseTo(Math.hypot(-37, -66));
    }
  });

  it('has valid anchors that project inside the 760x480 viewport', () => {
    for (const [key, point] of Object.entries(ISO_LMPV_ANCHORS)) {
      const p = projectCarPoint(point);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(100);
      expect(p.x).toBeLessThanOrEqual(680);
      expect(p.y).toBeGreaterThanOrEqual(50);
      expect(p.y).toBeLessThanOrEqual(440);
    }
  });
});

describe('vehicle.lmpv asset registry entry', () => {
  it('is registered in catalog with proper aliases and capabilities', () => {
    const entry = getAsset('vehicle.lmpv', '0.1.0');
    expect(entry).toBeDefined();
    expect(entry?.renderer).toBe('IsoLmpv');
    expect(entry?.defaultVariant).toBe('family-7seater');

    const variant = entry?.variants['family-7seater'];
    expect(variant?.capabilities).toContain('7-seater');
    expect(variant?.capabilities).toContain('3-row-seats');
    expect(variant?.capabilities).toContain('double-blower-ac');
    expect(variant?.capabilities).toContain('transverse-fwd-engine');
    expect(variant?.capabilities).toContain('torsion-beam');
    expect(variant?.capabilities).toContain('tailgate-open');
  });

  it('matches prompt queries for ertiga, lmpv, and mobil keluarga', () => {
    const matchesErtiga = findAssets('video review mobil ertiga terbaru', 'world');
    expect(matchesErtiga.some((m) => m.entry.assetId === 'vehicle.lmpv')).toBe(true);

    const matchesLmpv = findAssets('perbandingan mobil lmpv 7 seater untuk keluarga', 'world');
    expect(matchesLmpv.some((m) => m.entry.assetId === 'vehicle.lmpv')).toBe(true);
  });

  it('validates a structured plan using vehicle.lmpv', () => {
    const plan = {
      schemaVersion: 1,
      visualPolicy: 'library-first',
      instances: [
        {
          id: 'ertiga',
          assetId: 'vehicle.lmpv',
          assetVersion: '0.1.0',
          variant: 'family-7seater',
          props: {
            color: '#4A5560',
            view: 'cutaway',
            hoodOpen: 0,
            tailgateOpen: 0,
          },
        },
      ],
      scenes: [
        {
          id: 'interior-3row',
          layout: 'single',
          durationSec: 5,
          narration: 'Kabin lega 3 baris kursi dengan AC double blower untuk 7 penumpang.',
          instances: ['ertiga'],
          focus: [
            { instanceId: 'ertiga', anchor: 'doubleBlower', label: 'AC Double Blower' },
            { instanceId: 'ertiga', anchor: 'row2Seat', label: 'Baris 2 Split 60:40' },
          ],
        },
        {
          id: 'engine-hood',
          layout: 'single',
          durationSec: 5,
          narration: 'Mesin 1.5L melintang FWD bertenaga dan irit bahan bakar.',
          instances: ['ertiga'],
          set: [{ instanceId: 'ertiga', props: { view: 'exterior', hoodOpen: 1 } }],
          focus: [
            { instanceId: 'ertiga', anchor: 'engine', label: 'Mesin 1.5L DOHC FWD' },
            { instanceId: 'ertiga', anchor: 'radiator', label: 'Radiator' },
          ],
          actions: [
            {
              instanceId: 'ertiga',
              prop: 'hoodOpen',
              from: 0,
              to: 1,
              startSec: 0,
              endSec: 2,
            },
          ],
        },
      ],
    };

    const result = validateAssetPlan(plan);
    expect(result.ok).toBe(true);
  });
});
