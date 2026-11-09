import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IsoAlternator } from '../src/motion-kit/isometric';

describe('IsoAlternator exploded view component', () => {
  it('renders assembled alternator when explode = 0 without callouts', () => {
    const html = renderToStaticMarkup(<IsoAlternator explode={0} showCallouts={false} />);
    expect(html).toContain('viewBox="0 0 760 480"');
    expect(html).toContain('data-part="pulley"');
    expect(html).toContain('data-part="front-housing"');
    expect(html).toContain('data-part="stator"');
    expect(html).toContain('data-part="rotor"');
    expect(html).toContain('data-part="rear-housing"');
    expect(html).toContain('data-part="rectifier"');
    expect(html).toContain('data-part="regulator"');
    expect(html).toContain('data-part="brush-holder"');
    expect(html).toContain('data-part="rear-cover"');
  });

  it('renders exploded spare parts with numbered callouts matching FIG.49', () => {
    const html = renderToStaticMarkup(<IsoAlternator explode={1} showCallouts={true} />);
    expect(html).toContain('data-part="callout-26"'); // Lock nut
    expect(html).toContain('data-part="callout-2"');  // Pulley
    expect(html).toContain('data-part="callout-1"');  // Drive end housing
    expect(html).toContain('data-part="callout-4"');  // Front bearing
    expect(html).toContain('data-part="callout-19"'); // Rotor
    expect(html).toContain('data-part="callout-20"'); // Rear bearing
    expect(html).toContain('data-part="callout-13"'); // Rear housing
    expect(html).toContain('data-part="callout-15"'); // Rectifier
    expect(html).toContain('data-part="callout-22"'); // Regulator
    expect(html).toContain('data-part="callout-17"'); // Brush holder
    expect(html).toContain('data-part="callout-14"'); // Rear cover
  });
});
