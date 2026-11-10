import { describe, expect, it } from 'vitest';
import type { GeneratedAsset } from '@/lib/explainer/asset-generator';
import { AssetManifestSchema } from '@/lib/explainer/asset-contract';
import { continuedScenes, continuityFor, continuityPrompt, scenePath } from '@/lib/explainer/continuity';
import { composeAssetScene, sceneCanvasWidth, sceneTopicPrompt } from '@/lib/explainer/scene-generator';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { generateMainVideoCode } from '@/lib/pipeline/coder-agent';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import { compileVirtualProject } from '@/lib/runtime/browser-compiler';
import { scenePathCamera } from '@/motion-kit/explainer/AssetStage';

const manifest = (camera?: unknown) => ({
  topic: 'Gedung tahan gempa',
  title: 'GEDUNG',
  subtitle: 'Berayun saat gempa',
  palette: { backgroundFrom: '#f1f5f9', backgroundTo: '#e2e8f0', accent: '#1e293b', accentAlt: '#64748b', text: '#0f172a' },
  heroFocus: { x: 500, y: 500, scale: 1 },
  ...(camera ? { camera } : {}),
  choreography: [{ id: 'sway', description: 'Gedung berayun', startWord: 0, endWord: 2 }],
  views: [{ id: 'main', label: 'Gedung', description: 'Gedung utuh' }],
  parts: ['tower', 'frame', 'base'].map((id) => ({
    id, label: id, views: ['main'], anchor: { x: 500, y: 500 }, focus: { x: 500, y: 500, scale: 2 },
  })),
  flows: [{ id: 'wave', view: 'main', d: 'M 0 900 L 1000 900', color: '#ef4444' }],
});

const asset = (camera?: unknown): GeneratedAsset => ({
  manifest: AssetManifestSchema.parse(manifest(camera)),
  code: `import React from 'react';
export const Asset = ({ highlight, actionProgress }) => (
  <svg viewBox="0 0 1000 1000">
    <g opacity={1}><rect id="main" x={(actionProgress.sway ?? 0) * 10} fill={highlight.tower ? 'red' : 'blue'} /><g id="frame" /><g id="base" /></g>
  </svg>
);
export default Asset;`,
}) as GeneratedAsset;

const wide = asset({ link: 'cut', focus: { x: 500, y: 500, scale: 1 } });
const frame = asset({ link: 'continue', focus: { x: 620, y: 420, scale: 3 } });
const footing = asset({ link: 'continue', focus: { x: 500, y: 880, scale: 2.5 } });
const document = asset({ link: 'cut', focus: { x: 500, y: 450, scale: 1.2 } });

describe('scene camera path', () => {
  it('starts a continuing scene at the previous camera and a cut scene at its own', () => {
    expect(scenePath(frame, 1, wide)).toEqual({ from: wide.manifest.camera!.focus, to: frame.manifest.camera!.focus });
    expect(scenePath(document, 3, footing)).toEqual({ to: document.manifest.camera!.focus });
    expect(scenePath(asset(), 1, wide)).toBeUndefined();
  });

  it('treats a first scene, or one after a simple fallback scene, as a cut', () => {
    expect(scenePath(frame, 0)).toEqual({ to: frame.manifest.camera!.focus });
    expect(scenePath(frame, 1)).toEqual({ to: frame.manifest.camera!.focus });
  });

  it('flies to the target in the first seconds, then holds still', () => {
    const path = scenePath(frame, 1, wide)!;
    expect(scenePathCamera(0, 30, path)).toEqual(path.from);
    const middle = scenePathCamera(20, 30, path);
    expect(middle.scale).toBeGreaterThan(1);
    expect(middle.scale).toBeLessThan(3);
    expect(scenePathCamera(39, 30, path)).toEqual(path.to);
    expect(scenePathCamera(300, 30, path)).toEqual(path.to);
  });

  it('stays wide without a path, as older scenes did', () => {
    expect(scenePathCamera(100, 30)).toEqual({ x: 500, y: 500, scale: 1 });
  });
});

describe('fades between scenes', () => {
  const storyboard = generateProceduralStoryboard('Gedung tahan gempa', 'story-svg', '9:16');
  const scenes = storyboard.scenes.slice(0, 4);
  const assets = [wide, frame, footing, document];
  const sceneAssets = Object.fromEntries(scenes.map((scene, index) => [scene.id, assets[index]]));

  it('lists scenes whose camera continues', () => {
    expect([...continuedScenes(scenes, sceneAssets)]).toEqual([1, 2]);
  });

  it('drops the fade only where the camera continues', () => {
    const board = { ...storyboard, scenes };
    const code = generateMainVideoCode(board, [0, 1, 2, 3], continuedScenes(scenes, sceneAssets));
    const transitions = code.match(/<SceneTransition[^>]*>/g)!;
    expect(transitions[0]).toContain('fadeOut={false}');
    expect(transitions[1]).toContain('fadeIn={false}');
    expect(transitions[1]).toContain('fadeOut={false}');
    expect(transitions[2]).toContain('fadeIn={false}');
    expect(transitions[2]).not.toContain('fadeOut');
    expect(transitions[3]).not.toContain('fadeIn');
  });

  it('keeps the fade after a scene that fell back to the simple version', () => {
    const withoutFirst = Object.fromEntries(Object.entries(sceneAssets).filter(([id]) => id !== scenes[0].id));
    expect([...continuedScenes(scenes, withoutFirst)]).toEqual([2]);
  });

  it('keeps the fade when the scene in between is missing', () => {
    const code = generateMainVideoCode({ ...storyboard, scenes }, [0, 2], continuedScenes(scenes, sceneAssets));
    expect(code).not.toContain('fadeIn={false}');
    expect(code).not.toContain('fadeOut={false}');
  });

  it('composes a continuing scene that validates and compiles', () => {
    const board = { ...storyboard, scenes };
    const composed = composeAssetScene(frame, board, 1, wide);
    expect(composed).toContain('camera={{"from":{"x":500,"y":500,"scale":1},"to":{"x":620,"y":420,"scale":3}}}');
    expect(validateSceneCode(composed, 'Scene2.tsx', { svgOnly: true }).valid).toBe(true);
    const files = { 'Scene2.tsx': composed, 'MainVideo.tsx': generateMainVideoCode(board, [1]) };
    expect(typeof compileVirtualProject(files, 'MainVideo.tsx')).toBe('function');
  });
});

describe('camera prompt', () => {
  it('asks every Full SVG scene for a camera and hands over the previous one', () => {
    expect(continuityPrompt({})).toContain('"camera"');
    const prompt = continuityPrompt({ sharedWorld: '// SHARED-WORLD:START\n// SHARED-WORLD:END', previous: frame });
    expect(prompt).toContain('Previous camera: {"link":"continue","focus":{"x":620,"y":420,"scale":3}}');
    expect(prompt).toContain('Never cover the world with a panel');
  });

  it('states the wide canvas window for landscape videos', () => {
    expect(continuityPrompt({})).toContain("shared world's 1000 by 1000 coordinates");
    const wide = continuityPrompt({}, 1778);
    expect(wide).toContain("shared world's 1778 by 1000 coordinates");
    expect(wide).toContain('centred at x=889');
    expect(wide).toContain('1778/S units wide and 1000/S tall');
  });
});

describe('canvas of an existing shared world', () => {
  const scenes = [{ id: 'a' }, { id: 'b' }];
  const world = (canvasWidth?: number): GeneratedAsset => ({
    manifest: { ...frame.manifest, ...(canvasWidth ? { canvasWidth } : {}) },
    code: '// SHARED-WORLD:START\nconst WorldBase = () => null;\n// SHARED-WORLD:END',
  });

  it('keeps an older square world square, even in a landscape video', () => {
    expect(continuityFor(scenes, { a: world() }, 1).canvasWidth).toBe(1000);
    expect(continuityFor(scenes, { a: world(1778) }, 1).canvasWidth).toBe(1778);
    expect(continuityFor(scenes, {}, 0).canvasWidth).toBeUndefined();
  });

  it('lets the video shape decide only when no world exists yet', () => {
    const storyboard = { ...generateProceduralStoryboard('Air sungai jadi air bersih', 'story-svg', '16:9'), preset: 'story-svg' as const };
    expect(sceneCanvasWidth(storyboard)).toBe(1778);
    expect(sceneCanvasWidth(storyboard, { canvasWidth: 1000 })).toBe(1000);
    expect(sceneTopicPrompt(storyboard, 0)).toContain('viewBox is "0 0 1778 1000"');
  });
});
