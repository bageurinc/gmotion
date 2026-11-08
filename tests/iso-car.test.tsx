import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IsoCar, ISO_CAR_ANCHORS, projectCarPoint } from '../src/motion-kit/isometric';

describe('IsoCar asset', () => {
  it('contains only vector artwork and renders without a timeline provider', () => {
    const svg = renderToStaticMarkup(<IsoCar />);
    expect(svg).toContain('viewBox="0 0 760 480"');
    expect(svg).toContain('data-part="body"');
    expect(svg).not.toMatch(/<(image|img|video|foreignObject)\b|https?:\/\/(?!www\.w3\.org)/);
  });

  it('uses equal-scale ground axes at 30 degrees and keeps attachment points in bounds', () => {
    const origin = projectCarPoint([0, 0, 0]);
    const x = projectCarPoint([100, 0, 0]);
    const y = projectCarPoint([0, 100, 0]);
    expect(Math.atan2(x.y - origin.y, x.x - origin.x)).toBeCloseTo(Math.PI / 6);
    expect(Math.hypot(x.x - origin.x, x.y - origin.y)).toBeCloseTo(Math.hypot(y.x - origin.x, y.y - origin.y));
    for (const anchor of Object.values(ISO_CAR_ANCHORS)) {
      const p = projectCarPoint(anchor);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(760);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(480);
    }
  });

  it('moves the clipped glass while preserving the window frame', () => {
    const closed = renderToStaticMarkup(<IsoCar windowOpen={0} />);
    const open = renderToStaticMarkup(<IsoCar windowOpen={1} />);
    expect(closed).toContain('translate(0 0)');
    expect(open).toContain('translate(0 -62)');
    expect(open).toContain('<clipPath');
    expect(open.match(/stroke="#1C3037"/g)).toHaveLength(1);
  });

  it('isolates clips and accessible titles when multiple cars share a document', () => {
    const svg = renderToStaticMarkup(<div><IsoCar /><IsoCar color="#349" /></div>);
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, target] of svg.matchAll(/url\(#([^)]*)\)/g)) expect(ids).toContain(target);
  });

  it('is repeatable at a supplied wheel angle and clamps invalid state', () => {
    expect(renderToStaticMarkup(<IsoCar wheelRotation={123} />)).toBe(renderToStaticMarkup(<IsoCar wheelRotation={483} />));
    const invalid = renderToStaticMarkup(<IsoCar color="invalid" windowOpen={Infinity} bodyOpacity={-4} wheelRotation={NaN} />);
    expect(invalid).not.toMatch(/NaN|Infinity/);
    expect(invalid).toContain('fill="#CF5A3C"');
    expect(invalid).toContain('data-part="body" opacity="0"');
  });

  it('reveals mechanics without a floor or cabin obscuring the chassis view', () => {
    const svg = renderToStaticMarkup(<IsoCar view="chassis" />);
    expect(svg).toContain('data-part="body" opacity="0"');
    expect(svg).toContain('data-part="floor" opacity="0"');
    expect(svg).toContain('data-part="cabin" opacity="0"');
    for (const part of ['engine-bay', 'transmission', 'chassis-rails', 'exhaust', 'fuel-tank', 'suspension', 'brake', 'accessory-belt']) {
      expect(svg).toContain(`data-part="${part}"`);
    }
    expect(svg).not.toMatch(/<(image|img|video|foreignObject)\b/);
  });

  it('raises the hood independently of the shell and safely handles invalid animation values', () => {
    const hood = (svg: string) => svg.match(/data-part="hood"[^>]*><polygon points="([^"]+)"/)?.[1];
    const closed = renderToStaticMarkup(<IsoCar />);
    const open = renderToStaticMarkup(<IsoCar hoodOpen={1} engineRotation={90} />);
    expect(hood(closed)).toBeTruthy();
    expect(hood(open)).not.toBe(hood(closed));
    expect(open).toContain('rotate(90)');
    const invalid = renderToStaticMarkup(<IsoCar hoodOpen={NaN} engineRotation={Infinity} wheelOpacity={NaN} />);
    expect(invalid).not.toMatch(/NaN|Infinity/);
    expect(hood(invalid)).toBe(hood(closed));
  });
});
