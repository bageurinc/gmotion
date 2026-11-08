import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IsoCar, IsoRoad, ISO_ELECTRIC_CAR_ANCHORS, projectCarPoint } from '../src/motion-kit/isometric';

describe('electric car variant', () => {
  it('replaces the petrol system rather than adding a battery to a combustion car', () => {
    const svg = renderToStaticMarkup(<IsoCar powertrain="electric" view="chassis" />);
    for (const part of ['traction-battery', 'battery-modules', 'electric-motor', 'inverter', 'onboard-charger', 'charge-port', 'reduction-gear']) {
      expect(svg).toContain(`data-part="${part}"`);
    }
    for (const part of ['fuel-tank', 'exhaust', 'engine-block', 'transmission', 'accessory-belt', 'drivetrain']) {
      expect(svg).not.toContain(`data-part="${part}"`);
    }
    expect(svg).not.toMatch(/<(image|img|video|foreignObject)\b/);
  });

  it('keeps the existing petrol variant as default', () => {
    const svg = renderToStaticMarkup(<IsoCar />);
    expect(svg).toContain('data-part="fuel-tank"');
    expect(svg).toContain('data-part="engine-block"');
    expect(svg).not.toContain('data-part="traction-battery"');
  });

  it('animates energy deterministically, with no flow overlay unless requested', () => {
    expect(renderToStaticMarkup(<IsoCar powertrain="electric" />)).not.toContain('data-part="electric-energy-flow"');
    const frame = (phase: number) => renderToStaticMarkup(<IsoCar powertrain="electric" energyFlow energyPhase={phase} />);
    expect(frame(0)).not.toBe(frame(0.5));
    expect(frame(0.25)).toBe(frame(1.25));
    expect(frame(NaN)).not.toMatch(/NaN|Infinity/);
  });

  it('exposes charging hardware and anchor points without invalid coordinates', () => {
    const closed = renderToStaticMarkup(<IsoCar powertrain="electric" />);
    const open = renderToStaticMarkup(<IsoCar powertrain="electric" chargePortOpen motorRotation={Infinity} batteryCoverOpacity={NaN} />);
    expect(open).not.toBe(closed);
    expect(open).not.toMatch(/NaN|Infinity/);
    for (const anchor of Object.values(ISO_ELECTRIC_CAR_ANCHORS)) {
      const p = projectCarPoint(anchor);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(760);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(480);
    }
  });
});

describe('reusable isometric road', () => {
  it('loops lane markings every 120 world units and supports vehicle children', () => {
    const road = (distance: number) => renderToStaticMarkup(<IsoRoad distance={distance}><IsoCar powertrain="electric" /></IsoRoad>);
    expect(road(0)).not.toBe(road(60));
    expect(road(0)).toBe(road(120));
    expect(road(0)).toContain('data-part="traction-battery"');
    expect(road(-120)).toBe(road(0));
  });

  it('keeps repeated road clips separate and sanitizes invalid dimensions', () => {
    const svg = renderToStaticMarkup(<div><IsoRoad length={NaN} laneWidth={Infinity} distance={NaN} /><IsoRoad lanes={1} /></div>);
    expect(svg).not.toMatch(/NaN|Infinity/);
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, target] of svg.matchAll(/url\(#([^)]*)\)/g)) expect(ids).toContain(target);
  });
});
