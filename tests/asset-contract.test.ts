import { ASSET_SYSTEM_PROMPT, CRITIC_SYSTEM_PROMPT } from '@/lib/explainer/asset-generator';
import { describe, expect, it } from 'vitest';
import { composeAssetScene } from '@/lib/explainer/scene-generator';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { generateMainVideoCode } from '@/lib/pipeline/coder-agent';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import { compileVirtualProject } from '@/lib/runtime/browser-compiler';
import { AssetManifestSchema, canvasWidthFor, missingContractIds } from '@/lib/explainer/asset-contract';
import { canvasNote } from '@/lib/explainer/asset-generator';
import { fitToCanvas } from '@/lib/explainer/scene-generator';
import { worldViewBox } from '@/lib/explainer/story-svg-shared';
import { parseAssetResponse, parseCritique } from '@/lib/explainer/asset-generator';
import { buildAssetShots, fitArtwork, fitFocus } from '@/motion-kit/explainer/AssetStage';

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

describe('bleed and setting rules', () => {
  it('asks for a real setting that reaches the frame edges', () => {
    expect(ASSET_SYSTEM_PROMPT).toContain('x=-1000 to x=W+1000');
    expect(ASSET_SYSTEM_PROMPT).toContain('A plain empty backdrop is a failure');
    expect(CRITIC_SYSTEM_PROMPT).toContain('plain backdrop with no setting');
  });
});

describe('canvas follows the video shape', () => {
  it('keeps portrait videos square and widens landscape ones', () => {
    expect(canvasWidthFor('9:16')).toBe(1000);
    expect(canvasWidthFor('4:5')).toBe(1000);
    expect(canvasWidthFor('16:9')).toBe(1778);
    expect(canvasWidthFor(undefined)).toBe(1000);
  });

  it('tells the model the wide canvas and asks it to fill the sides', () => {
    expect(canvasNote('16:9')).toContain('viewBox is "0 0 1778 1000"');
    expect(canvasNote('16:9')).toContain('x=-1000 to x=2778');
    expect(canvasNote('9:16')).toContain('viewBox is "0 0 1000 1000"');
    expect(ASSET_SYSTEM_PROMPT).toContain('Empty or bare sides are a failure');
    expect(CRITIC_SYSTEM_PROMPT).toContain('narrow middle column');
  });

  it('records the canvas and widens a square viewBox the model kept', () => {
    const asset = fitToCanvas(parseAssetResponse(response), 1778);
    expect(asset.manifest.canvasWidth).toBe(1778);
    expect(asset.code).toContain('viewBox="0 0 1778 1000"');
    expect(fitToCanvas(parseAssetResponse(response), 1000).code).toContain('viewBox="0 0 1000 1000"');
  });

  it('accepts x coordinates on a wide canvas', () => {
    const wide = { ...manifest, canvasWidth: 1778, heroFocus: { x: 1400, y: 400, scale: 1.5 } };
    expect(AssetManifestSchema.safeParse(wide).success).toBe(true);
  });

  it('centres the setting preview on the canvas it was drawn for', () => {
    expect(worldViewBox('16:9').startsWith(`${889 - (1150 * 16) / 9 / 2} `)).toBe(true);
    expect(worldViewBox('16:9', 1000).startsWith(`${500 - (1150 * 16) / 9 / 2} `)).toBe(true);
  });

  it('frames and clamps the camera to a wide canvas', () => {
    const fit = fitArtwork({ x: 100, y: 100, width: 1578, height: 800 }, 1778);
    expect(fit.offsetX + 889 * fit.scale).toBeCloseTo(889, 0);
    expect(fitFocus({ x: 1700, y: 500, scale: 2 }, { scale: 1, offsetX: 0, offsetY: 0 }, 1778).x).toBeCloseTo(1778 - 1778 / 4);
    const shots = buildAssetShots({ ...AssetManifestSchema.parse(manifest), canvasWidth: 1778 }, 300, 30);
    expect(shots[0].focus).toEqual({ x: 889, y: 500, scale: 1 });
  });
});

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

  it('fits the shot count to the scene length', () => {
    const parsed = AssetManifestSchema.parse(manifest);
    const shots = buildAssetShots(parsed, 300, 30);
    expect(shots.map((shot) => shot.highlightPart)).toEqual([undefined, 'fan', 'compressor', 'turbine']);
    expect(shots[0].view).toBe('exterior');
    expect(shots[1].view).toBe('cutaway');
    expect(shots.at(-1)?.to).toBe(300);
    expect(buildAssetShots(parsed, 90, 30)).toHaveLength(1);
  });
});

describe('artwork fit', () => {
  it('leaves artwork alone until it is measured', () => {
    expect(fitArtwork(null)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
  });

  it('centers and enlarges small artwork', () => {
    const fit = fitArtwork({ x: 100, y: 200, width: 640, height: 320 });
    expect(fit.scale).toBe(1.5);
    expect((100 + 320) * fit.scale + fit.offsetX).toBeCloseTo(500);
    expect((200 + 160) * fit.scale + fit.offsetY).toBeCloseTo(500);
  });

  it('fits only the part on the canvas, so bleeding ground does not shrink the subject', () => {
    const fit = fitArtwork({ x: -1000, y: 40, width: 3000, height: 1960 });
    expect(fit.scale).toBeCloseTo(0.96);
    expect(fit.offsetX).toBeCloseTo(20);
    expect(fit.offsetY).toBeCloseTo(0.8);
  });

  it('keeps a zoomed view inside the artwork', () => {
    const focus = fitFocus({ x: 20, y: 980, scale: 1.6 }, { scale: 1, offsetX: 0, offsetY: 0 });
    expect(focus.x).toBeCloseTo(312.5);
    expect(focus.y).toBeCloseTo(687.5);
  });
});

describe('asset scene composition', () => {
  const storyboard = generateProceduralStoryboard('Topik uji', 'story-2d', '9:16');
  storyboard.scenes[1].kineticHeadline = 'JUDUL "UJI"';
  const composed = composeAssetScene(parseAssetResponse(response), storyboard, 1);

  it('produces a valid self-contained scene', () => {
    expect(validateSceneCode(composed, 'Scene2.tsx').valid).toBe(true);
    expect(composed).toContain('export default Scene2');
    expect(composed).not.toContain('export default Asset');
    expect(composed).toContain(storyboard.palette.primary);
  });

  it('compiles in the browser runtime', () => {
    const files = { 'Scene2.tsx': composed, 'MainVideo.tsx': generateMainVideoCode(storyboard, [1]) };
    expect(typeof compileVirtualProject(files, 'MainVideo.tsx')).toBe('function');
  });
});
