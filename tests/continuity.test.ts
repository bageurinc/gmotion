import { describe, expect, it } from 'vitest';
import { applySharedWorld, continuityFor, continuityPrompt, extractSharedWorld } from '@/lib/explainer/continuity';
import type { GeneratedAsset } from '@/lib/explainer/asset-generator';

const block = (body: string) => `// SHARED-WORLD:START
const WorldBase = () => <rect fill="${body}" />;
// SHARED-WORLD:END`;
const scene = (shared: string, body = '<WorldBase />') => `import React from 'react';
${shared}
export const Asset = () => <svg>${body}</svg>;
export default Asset;`;
const asset = (code: string) => ({ manifest: { choreography: [] }, code }) as unknown as GeneratedAsset;

describe('applySharedWorld', () => {
  it('replaces a drifted copy with the first scene block', () => {
    const code = applySharedWorld(scene(block('#222222')), block('#111111'));
    expect(extractSharedWorld(code)).toBe(block('#111111'));
    expect(code).not.toContain('#222222');
  });

  it('keeps dollar signs in the block literally', () => {
    const shared = block('$&');
    expect(extractSharedWorld(applySharedWorld(scene(block('#222222')), shared))).toBe(shared);
  });

  it('keeps the first scene own block', () => {
    expect(applySharedWorld(scene(block('#111111')))).toBe(scene(block('#111111')));
  });

  it('rejects a scene without the block', () => {
    expect(() => applySharedWorld(scene(''))).toThrow(/SHARED-WORLD:START/);
  });

  it('rejects a block without WorldBase', () => {
    const shared = '// SHARED-WORLD:START\nconst Ground = () => null;\n// SHARED-WORLD:END';
    expect(() => applySharedWorld(scene(shared, '<Ground />'))).toThrow(/WorldBase/);
  });

  it('requires WorldBase without props outside the block', () => {
    expect(() => applySharedWorld(scene(block('#111111'), ''))).toThrow(/WorldBase/);
    expect(() => applySharedWorld(scene(block('#111111'), '<WorldBase tint="red" />'))).toThrow(/no props/);
  });
});

describe('continuityFor', () => {
  const scenes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const first = asset(scene(block('#111111')));
  const second = asset(scene(block('#111111'), '<WorldBase /><circle />'));

  it('starts empty on the first scene', () => {
    expect(continuityFor(scenes, undefined, 0)).toEqual({ sharedWorld: undefined, previous: undefined });
  });

  it('inherits the first block and the nearest earlier scene', () => {
    expect(continuityFor(scenes, { a: first, b: second }, 2)).toEqual({ sharedWorld: block('#111111'), previous: second });
  });

  it('skips a scene that fell back to the simple version', () => {
    expect(continuityFor(scenes, { a: first }, 2).previous).toBe(first);
  });

  it('keeps the block when the first scene is redrawn', () => {
    expect(continuityFor(scenes, { a: first, b: second }, 0)).toEqual({ sharedWorld: block('#111111'), previous: undefined });
  });

  it('lets a later scene define the block when the first has none', () => {
    expect(continuityFor(scenes, { b: second }, 2).sharedWorld).toBe(block('#111111'));
  });
});

describe('continuityPrompt', () => {
  it('asks the first scene to define the world', () => {
    expect(continuityPrompt({})).toContain('defines it for the whole video');
  });

  it('gives later scenes the block and the previous code', () => {
    const previous = asset(scene(block('#111111'), '<WorldBase /><circle id="pose" />'));
    const prompt = continuityPrompt({ sharedWorld: block('#111111'), previous });
    expect(prompt).toContain('already fixed by the first scene');
    expect(prompt).toContain('id="pose"');
  });
});
