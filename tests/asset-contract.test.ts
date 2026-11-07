import { describe, expect, it } from 'vitest';
import { AssetManifestSchema, missingContractIds } from '@/lib/explainer/asset-contract';
import { parseAssetResponse, parseCritique } from '@/lib/explainer/asset-generator';
import { buildAssetShots } from '@/motion-kit/explainer/AssetStage';

const manifest = {
  topic: 'Mesin jet',
  title: 'MESIN JET',
  subtitle: 'Mendorong pesawat',
  palette: { backgroundFrom: '#102030', backgroundTo: '#050810', accent: '#44AAFF', accentAlt: '#FF7744', text: '#FFFFFF' },
  heroFocus: { x: 500, y: 400, scale: 2.2 },
  views: [
    { id: 'exterior', label: 'Tampak luar', description: 'Mesin tertutup' },
    { id: 'cutaway', label: 'Bagian dalam', description: 'Mesin terbuka' },
  ],
  parts: [
    { id: 'fan', label: 'Kipas', views: ['exterior', 'cutaway'], anchor: { x: 200, y: 500 }, focus: { x: 200, y: 500, scale: 2 } },
    { id: 'compressor', label: 'Kompresor', views: ['cutaway'], anchor: { x: 400, y: 500 }, focus: { x: 400, y: 500, scale: 2 } },
    { id: 'turbine', label: 'Turbin', views: ['cutaway'], anchor: { x: 700, y: 500 }, focus: { x: 700, y: 500, scale: 2 } },
  ],
  flows: [{ id: 'air', view: 'cutaway', d: 'M 100 500 L 900 500', color: '#88DDFF' }],
};

const code = `import React from 'react';
export const Asset = ({ viewOpacity, highlight }) => (
  <svg viewBox="0 0 1000 1000">
    <g opacity={viewOpacity.exterior ?? 0} />
    <g opacity={viewOpacity.cutaway ?? 0}>
      <path fill={highlight.fan ? 'red' : 'blue'} />
      <path fill={highlight.compressor ? 'red' : 'blue'} />
      <path fill={highlight.turbine ? 'red' : 'blue'} />
    </g>
  </svg>
);
export default Asset;`;

const response = `\`\`\`json\n${JSON.stringify(manifest)}\n\`\`\`\n\`\`\`tsx\n${code}\n\`\`\``;

describe('explainer asset contract', () => {
  it('accepts a topic-neutral manifest', () => {
    expect(AssetManifestSchema.parse(manifest).views).toHaveLength(2);
  });

  it('rejects references to unknown views', () => {
    const invalid = { ...manifest, flows: [{ ...manifest.flows[0], view: 'missing' }] };
    expect(AssetManifestSchema.safeParse(invalid).success).toBe(false);
  });

  it('reports manifest ids the component never uses', () => {
    const parsed = AssetManifestSchema.parse(manifest);
    expect(missingContractIds(parsed, 'exterior cutaway fan')).toEqual(['compressor', 'turbine']);
  });

  it('parses a complete generator response', () => {
    expect(parseAssetResponse(response).manifest.title).toBe('MESIN JET');
  });

  it('rejects code that imports a forbidden module', () => {
    expect(() => parseAssetResponse(response.replace("from 'react'", "from 'fs'"))).toThrow(/Forbidden import/);
  });

  it('rejects a critique made without seeing the frames', () => {
    const critique = { imageVisible: false, scores: { composition: 0 }, issues: [] };
    expect(() => parseCritique(JSON.stringify(critique))).toThrow(/could not see/);
  });

  it('averages critique scores', () => {
    const critique = { imageVisible: true, scores: { composition: 7, recognizability: 8 }, issues: [] };
    expect(parseCritique(JSON.stringify(critique)).average).toBe(7.5);
  });

  it('builds the same shot structure for any manifest', () => {
    const shots = buildAssetShots(AssetManifestSchema.parse(manifest));
    expect(shots.map((shot) => shot.view)).toEqual(['exterior', 'exterior', 'cutaway', 'cutaway']);
    expect(shots[2].highlightPart).toBe('fan');
    expect(shots[3].highlightPart).toBe('compressor');
    expect(shots.at(-1)?.to).toBe(300);
  });
});
