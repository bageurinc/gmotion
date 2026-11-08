import { describe, expect, it, vi } from 'vitest';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import { parseRevisionPlan, retimeSceneCode, reviseScene, reviseScenes, type SceneRevisionDeps } from '@/lib/pipeline/scene-revision';
import { composeImageScene } from '@/lib/explainer/scene-generator';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import type { SceneSpec, Storyboard, StudioProject } from '@/types/studio';

const base = generateProceduralStoryboard('Perjalanan kopi', 'story-2d', '9:16');
const timings = (text: string, step = 400) =>
  text.split(' ').map((word, i) => ({ word, startMs: i * step, endMs: (i + 1) * step }));

const before: SceneSpec = {
  ...base.scenes[0],
  voiceoverText: 'Petani memetik 20 kilogram ceri merah setiap pagi.',
  kineticHeadline: 'PETIK CERI MERAH',
  headlineFocus: 'CERI',
  dataVisual: { kind: 'stat', value: '20', unit: 'kilogram', label: 'ceri per pagi' },
  durationInFrames: 120,
  audioUrl: '/api/projects/p/assets/scene-1-hook.wav?v=old',
};
before.wordTimings = timings(before.voiceoverText);
const storyboard: Storyboard = { ...base, scenes: [before, ...base.scenes.slice(1)] };
const shots = [{ from: 0, pose: 0, box: { x: 0.1, y: 0.2, w: 0.3, h: 0.2 }, label: 'Ceri' }, { from: 60, pose: 0, box: { x: 0.4, y: 0.2, w: 0.3, h: 0.2 }, label: 'Keranjang' }];
const imageCode = composeImageScene(storyboard, 0, ['/a.png'], shots);

describe('retimeSceneCode', () => {
  it('updates captions, headline, data card, and scales camera timings', () => {
    const text = 'Petani memetik ceri merah satu per satu dengan tangan, lalu mengumpulkannya di keranjang bambu.';
    const after: SceneSpec = { ...before, voiceoverText: text, wordTimings: timings(text), kineticHeadline: 'PANEN DENGAN TANGAN', durationInFrames: 240 };
    const code = retimeSceneCode(imageCode, before, after, storyboard)!;
    expect(code).toContain(JSON.stringify(text));
    expect(code).toContain(JSON.stringify(after.wordTimings));
    expect(code).not.toContain('Petani memetik 20 kilogram');
    expect(code).toContain('"PANEN DENGAN TANGAN"');
    // The old focus word is gone from the new headline, so no highlight is kept.
    expect(code).not.toContain('highlightWords');
    // The new narration no longer says the number, so its card is removed.
    expect(code).not.toContain('<DataCard');
    expect(code).toContain('"from":120');
    expect(validateSceneCode(code, 'Scene1.tsx').errors).toEqual([]);
  });

  it('keeps a spoken data card and moves it with the new timing', () => {
    const text = 'Setiap pagi petani memetik 20 kilogram ceri merah.';
    const after: SceneSpec = { ...before, voiceoverText: text, wordTimings: timings(text, 600), durationInFrames: 200 };
    const code = retimeSceneCode(imageCode, before, after, storyboard)!;
    expect(code).toContain('<DataCard');
    expect(code).toContain('highlightWords={["CERI"]}');
  });

  it('scales asset shots and action cues', () => {
    const assetCode = `import { AssetStage, buildAssetShots, KineticHeadline, SyncedCaptions } from '@/motion-kit';
const shots = buildAssetShots(manifest, 120, 30);
export const Scene1 = () => (
  <AssetStage manifest={manifest} Asset={Asset} shots={shots} actionCues={[{"id":"petik","from":10,"to":100}]} fullBleed>
    <KineticHeadline text={"PETIK CERI MERAH"} highlightColor={"#000"} textColor={"#111"} />
    <SyncedCaptions text={"lama"} wordTimings={[{"word":"lama","startMs":0,"endMs":400}]} activeColor={"#fff"} />
  </AssetStage>
);`;
    const code = retimeSceneCode(assetCode, before, { ...before, durationInFrames: 60 }, storyboard)!;
    expect(code).toContain('buildAssetShots(manifest, 60, 30)');
    expect(code).toContain('actionCues={[{"id":"petik","from":5,"to":50}]}');
  });

  it('still works after a model reformatted the scene', () => {
    const reformatted = `import { ImageStage, KineticHeadline, SyncedCaptions } from '@/motion-kit';

export const Scene2 = () => (
  <ImageStage
    images={["/a.png"]}
    shots={[
      { from: 0, pose: 0, box: { x: 0.1, y: 0.3, w: 0.3, h: 0.1 }, label: "Ceri {merah}" },
      { from: 60, pose: 1, box: { x: 0.4, y: 0.3, w: 0.4, h: 0.1 }, label: "Keranjang" },
    ]}
    backgroundColor="#E5DAC8"
  >
    <KineticHeadline
      text="Petik Buah Merah"
      highlightWords={["PETIK"]}
      textStyle="editorial"
    />
    <SyncedCaptions
      text="Petani memetik buah, lalu {menyortir}."
      wordTimings={[{ word: "Petani", startMs: 0, endMs: 400 }]}
      activeColor="#96a69d"
    />
  </ImageStage>
);
`;
    const after: SceneSpec = { ...before, voiceoverText: 'Kalimat baru.', wordTimings: timings('Kalimat baru.'), kineticHeadline: 'JUDUL BARU', headlineFocus: undefined, durationInFrames: 60 };
    const code = retimeSceneCode(reformatted, { ...before, kineticHeadline: 'Petik Buah Merah' }, after, storyboard)!;
    expect(code).toContain('text={"Kalimat baru."}');
    expect(code).toContain(`wordTimings={${JSON.stringify(after.wordTimings)}}`);
    expect(code).toContain('text={"JUDUL BARU"}');
    expect(code).not.toContain('highlightWords');
    expect(code).toContain('{ from: 30, pose: 1');
    expect(code).toContain('label: "Ceri {merah}"');
    expect(code).toContain('backgroundColor="#E5DAC8"');
    expect(validateSceneCode(code, 'Scene2.tsx').errors).toEqual([]);
  });

  it('leaves scenes without composed captions to the model', () => {
    expect(retimeSceneCode('export default () => null;', before, before, storyboard)).toBeNull();
  });
});

describe('parseRevisionPlan', () => {
  it('reads changed parts and drops empty ones', () => {
    expect(parseRevisionPlan('```json\n{"voiceoverText":"Baru.","kineticHeadline":null,"visualInstruction":" "}\n```'))
      .toEqual({ voiceoverText: 'Baru.', kineticHeadline: undefined, visualInstruction: undefined });
    expect(parseRevisionPlan('bukan json')).toBeNull();
  });
});

describe('reviseScene', () => {
  const project = { id: 'p', storyboard, files: { 'Scene1.tsx': imageCode, 'MainVideo.tsx': '' }, chatHistory: [] } as unknown as StudioProject;
  const deps = (plan: object, crashes: Array<Array<{ index: number; message: string }>> = [[]]): SceneRevisionDeps => {
    const findCrashes = vi.fn();
    crashes.forEach((result) => findCrashes.mockResolvedValueOnce(result));
    return {
      plan: vi.fn().mockResolvedValue(plan),
      speak: vi.fn().mockImplementation(async (scene: SceneSpec) => ({
        audioUrl: '/api/projects/p/assets/scene-1-hook.wav?v=new', durationInFrames: 180, wordTimings: timings(scene.voiceoverText),
      })),
      reviseCode: vi.fn().mockImplementation(async (code: string) => `${code}\n// visual`),
      check: { findCrashes, repair: vi.fn().mockResolvedValue('still broken') },
    };
  };

  it('speaks new narration and updates the scene, captions, and video timeline', async () => {
    const d = deps({ voiceoverText: 'Ceri dipetik pagi hari.' });
    const result = await reviseScene(project, 0, 'ganti narasinya', d);
    const scene = result.project.storyboard.scenes[0];
    expect(result).toMatchObject({ outcome: 'ok', narrationChanged: true, headlineChanged: false });
    expect(d.speak).toHaveBeenCalledWith(expect.objectContaining({ voiceoverText: 'Ceri dipetik pagi hari.' }), expect.objectContaining({ projectId: 'p' }));
    expect(scene).toMatchObject({ voiceoverText: 'Ceri dipetik pagi hari.', durationInFrames: 180, audioUrl: expect.stringContaining('v=new') });
    expect(result.project.files['Scene1.tsx']).toContain('"Ceri dipetik pagi hari."');
    expect(result.project.files['MainVideo.tsx']).toContain('durationInFrames={180}');
    expect(result.project.files['MainVideo.tsx']).toContain('v=new');
    expect(d.reviseCode).not.toHaveBeenCalled();
  });

  it('applies narration and a visual change in one request', async () => {
    const d = deps({ voiceoverText: 'Ceri dipetik pagi hari.', visualInstruction: 'Make the basket larger' });
    const result = await reviseScene(project, 0, 'ganti narasi dan besarkan keranjang', d);
    expect(d.reviseCode).toHaveBeenCalledWith(expect.stringContaining('"Ceri dipetik pagi hari."'), expect.anything(), 'Make the basket larger');
    expect(result.project.files['Scene1.tsx']).toContain('// visual');
  });

  it('falls back to the retimed scene when the visual change crashes', async () => {
    const d = deps({ voiceoverText: 'Ceri dipetik pagi hari.', visualInstruction: 'Break it' }, [[{ index: 0, message: 'boom' }], [{ index: 0, message: 'boom' }]]);
    const result = await reviseScene(project, 0, 'x', d);
    expect(result.outcome).toBe('reverted');
    expect(result.narrationChanged).toBe(true);
    expect(result.project.files['Scene1.tsx']).toContain('"Ceri dipetik pagi hari."');
    expect(result.project.files['Scene1.tsx']).not.toContain('// visual');
  });

  it('restores the old narration when a model-written scene cannot take the new words', async () => {
    const custom = { ...project, files: { ...project.files, 'Scene1.tsx': 'export default () => null;' } };
    const d = deps({ voiceoverText: 'Ceri dipetik pagi hari.' }, [[{ index: 0, message: 'boom' }], [{ index: 0, message: 'boom' }]]);
    const result = await reviseScene(custom, 0, 'x', d);
    expect(result).toMatchObject({ outcome: 'reverted', narrationChanged: false });
    expect(result.project.storyboard.scenes[0].voiceoverText).toBe(before.voiceoverText);
    expect(result.project.files['Scene1.tsx']).toBe('export default () => null;');
  });

  it('reports no change when the plan and code stay the same', async () => {
    const d = deps({ voiceoverText: before.voiceoverText });
    d.reviseCode = vi.fn();
    const result = await reviseScene(project, 0, 'x', d);
    expect(result.outcome).toBe('unchanged');
    expect(d.speak).not.toHaveBeenCalled();
  });

  it('revises several scenes with one render check, leaving unrelated ones alone', async () => {
    const multi = { ...project, files: { ...project.files, 'Scene2.tsx': imageCode.replace(/Scene1/g, 'Scene2'), 'Scene3.tsx': 'export default () => null;' } };
    const d = deps({});
    d.plan = vi.fn().mockImplementation(async (_scene: SceneSpec, _ins: string, position: { sceneNumber: number }) =>
      position.sceneNumber === 3 ? {} : { visualInstruction: 'Warmer background' });
    const result = await reviseScenes(multi, [0, 1, 2], 'latar lebih hangat', d);
    expect(result.scenes.map((scene) => scene.outcome)).toEqual(['ok', 'ok', 'unchanged']);
    expect(d.check.findCrashes).toHaveBeenCalledTimes(1);
    expect(d.check.findCrashes).toHaveBeenCalledWith(expect.anything(), [0, 1]);
    expect(result.project.files['Scene2.tsx']).toContain('// visual');
    expect(result.project.files['Scene3.tsx']).toBe('export default () => null;');
  });

  it('keeps the other scenes when one scene fails to prepare, and throws when all fail', async () => {
    const d = deps({ visualInstruction: 'x' });
    d.reviseCode = vi.fn().mockRejectedValueOnce(new Error('model down')).mockImplementation(async (code: string) => `${code}\n// visual`);
    const multi = { ...project, files: { ...project.files, 'Scene2.tsx': imageCode } };
    const result = await reviseScenes(multi, [0, 1], 'x', d);
    expect(result.scenes.map((scene) => scene.outcome).sort()).toEqual(['ok', 'unchanged']);

    const broken = deps({ visualInstruction: 'x' });
    broken.reviseCode = vi.fn().mockRejectedValue(new Error('model down'));
    await expect(reviseScene(project, 0, 'x', broken)).rejects.toThrow('model down');
  });
});
