import { describe, expect, it } from 'vitest';
import { checkPiece, joinPieces, type DraftPlan, type StorySvgDraft } from '@/lib/explainer/story-svg-draft';
import { draftApi, draftLabel, worldViewBox } from '@/lib/explainer/story-svg-shared';
import { continuityFor, continuityPrompt } from '@/lib/explainer/continuity';

const plan: DraftPlan = {
  world: { label: 'Dapur', description: 'A warm kitchen', groundY: 700 },
  objects: [{ name: 'Kettle', kind: 'object', label: 'Ketel', description: 'A steel kettle', width: 300, height: 260, props: [], closeups: [] }],
  sceneObjects: [['Kettle']],
};
const fullWorld = 'function WorldBase() { return <g><rect x={-1000} y={-1000} width={3000} height={3000} fill="#ddeeff" /></g>; }';
const kettle = `/** Kettle 300x260, origin base centre. Parts: spout (120,-150) */
function Kettle({ steam = 0 }: { steam?: number }) {
  const rings = [0, 1, 2].map((i) => <path key={i} d={\`M -100 \${-40 - i * 20} Q 0 \${-50 - i * 20} 100 \${-40 - i * 20}\`} stroke="#555555" />);
  return <g><defs><linearGradient id="asset-world-kettle-body" /></defs><ellipse cy={-130} rx={150} ry={130} fill="url(#asset-world-kettle-body)" opacity={1 - steam} />{rings}</g>;
}`;

describe('checkPiece', () => {
  it('accepts a single prefixed component that renders shapes', async () => {
    expect((await checkPiece('Kettle', kettle)).errors).toEqual([]);
  });

  it('rejects helpers outside the component and unprefixed ids', async () => {
    const code = `const ring = 3;\nfunction Kettle() { return <g><linearGradient id="body" /><circle r={ring} /></g>; }`;
    const { errors } = await checkPiece('Kettle', code);
    expect(errors.join(' ')).toMatch(/inside Kettle: ring/);
    expect(errors.join(' ')).toMatch(/asset-world-kettle-/);
    const rootId = kettle.replace('return <g>', 'return <g id="asset-world-kettle">');
    expect((await checkPiece('Kettle', rootId)).errors).toEqual([]);
  });

  it('checks ids built from a template on the rendered SVG', async () => {
    const built = (head: string) => `function Kettle() { const p = '${head}'; return <g><linearGradient id={\`\${p}body\`} /><rect width={10} height={10} fill={\`url(#\${p}body)\`} /></g>; }`;
    expect((await checkPiece('Kettle', built('asset-world-kettle-'))).errors).toEqual([]);
    expect((await checkPiece('Kettle', built('k-'))).errors.join(' ')).toMatch(/asset-world-kettle-": "k-body"\./);
  });

  it('ignores ids that render empty', async () => {
    const empty = `function Kettle({ glow = false }: { glow?: boolean }) { return <g><rect id="" width={10} height={10} /><circle id={glow ? 'asset-world-kettle-glow' : ''} r={5} /></g>; }`;
    expect((await checkPiece('Kettle', empty)).errors).toEqual([]);
  });

  it('reports a component that crashes with its default props', async () => {
    const code = 'function Kettle({ parts }: { parts?: number[] }) { return <g>{parts!.map((p) => <circle key={p} r={p} />)}</g>; }';
    expect((await checkPiece('Kettle', code)).errors.join(' ')).toMatch(/Rendering Kettle/);
  });

  it('finds gaps when the setting stops at the canvas edge', async () => {
    const boxed = 'function WorldBase() { return <g><rect x={0} y={0} width={1000} height={1000} fill="#ddeeff" /></g>; }';
    expect((await checkPiece('WorldBase', boxed)).errors.join(' ')).toMatch(/gaps at/);
    expect((await checkPiece('WorldBase', fullWorld)).errors).toEqual([]);
    // A setting that fills -1000..2000 leaves the right side of a 16:9 canvas bare.
    expect((await checkPiece('WorldBase', fullWorld, { canvasWidth: 1778 })).errors.join(' ')).toMatch(/x=-1000\.\.2778/);
    const wideWorld = 'function WorldBase() { return <g><rect x={-1000} y={-1000} width={3778} height={3000} fill="#ddeeff" /></g>; }';
    expect((await checkPiece('WorldBase', wideWorld, { canvasWidth: 1778 })).errors).toEqual([]);
  });
});

describe('draft helpers', () => {
  const draft: StorySvgDraft = {
    sharedWorld: joinPieces(plan, { WorldBase: fullWorld, Kettle: kettle }),
    sceneObjects: plan.sceneObjects,
    plan,
    pieces: { WorldBase: fullWorld, Kettle: kettle },
  };

  it('joins the pieces into one shared block', () => {
    expect(draft.sharedWorld.startsWith('// SHARED-WORLD:START\nfunction WorldBase')).toBe(true);
    expect(draft.sharedWorld.trimEnd().endsWith('// SHARED-WORLD:END')).toBe(true);
  });

  it('sends scenes the component headers instead of every path', () => {
    const prompt = continuityPrompt(continuityFor([{ id: 'a' }], {}, 0, draft));
    expect(prompt).toContain('Parts: spout (120,-150)');
    expect(prompt).toContain('function Kettle({ steam = 0 }: { steam?: number })');
    expect(prompt).not.toContain('linearGradient');
  });

  it('labels in Bahasa Indonesia and frames the setting like the video', () => {
    expect(draftLabel(draft, 'Kettle')).toBe('Ketel');
    expect(draftLabel(draft, 'WorldBase')).toBe('Dapur');
    expect(worldViewBox('9:16').split(' ').map(Number)[3]).toBeCloseTo(1150 * 16 / 9);
    expect(draftApi({ sharedWorld: draft.sharedWorld, sceneObjects: [['Kettle']] })).toBeUndefined();
  });
});

const H = 780;
const rect = (x: number, y: number, w: number, h: number, fill = '#445566') => `<rect x={${x}} y={${y}} width={${w}} height={${h}} rx={8} fill="${fill}" />`;
const walker = `/** Walker: character on HumanRig, height ${H}. Parts: head, torso, pelvis, limbs */
function Walker({ pose = 'stand', poseTo, poseMix = 0, walkPhase, walkMix = 1, facing = 1, carry = 0 }: Record<string, any>) {
  const parts = {
    head: <ellipse cy={-50} rx={44} ry={54} fill="#b9825c" />,
    neck: ${rect(-13, -36, 26, 44, '#b9825c')},
    torso: <g><defs><linearGradient id="asset-world-walker-shirt" /></defs>${rect(-40, -236, 84, 246, 'url(#asset-world-walker-shirt)')}</g>,
    pelvis: ${rect(-42, -46, 86, 86)},
    upperArm: ${rect(-18, -14, 36, 168)},
    foreArm: ${rect(-14, -10, 28, 136)},
    hand: ${rect(-11, -6, 22, 80, '#b9825c')},
    thigh: ${rect(-32, -14, 64, 214)},
    shin: ${rect(-24, -12, 48, 204)},
    foot: <path d="M -27 4 L -26 35 L 91 35 L 80 12 Z" fill="#221111" />,
  };
  return <HumanRig height={${H}} pose={pose} poseTo={poseTo} poseMix={poseMix} walkPhase={walkPhase} walkMix={walkMix} facing={facing} parts={parts}
    holding={carry ? { item: <rect x={-4} y={0} width={8} height={200} fill="#777777" />, hand: 'near', angle: 0 } : null} />;
}`;

describe('characters on HumanRig', () => {
  const character = { height: H };

  it('accepts a character drawn as rig parts and reviews it in three poses', async () => {
    const { errors, svg } = await checkPiece('Walker', walker, { character });
    expect(errors).toEqual([]);
    expect(svg).toContain(`<g transform="translate(${-0.85 * H} 0)">`);
    expect(svg).toContain(`<g transform="translate(${0.85 * H} 0)">`);
  });

  it('rejects a character that does not use the rig or skips parts', async () => {
    const plain = 'function Walker() { return <g><rect width={10} height={10} /></g>; }';
    expect((await checkPiece('Walker', plain, { character })).errors.join(' ')).toMatch(/must return <HumanRig/);
    const noFeet = walker.replace(/\s+foot: <path[^\n]*\n/, '\n');
    expect((await checkPiece('Walker', noFeet, { character })).errors.join(' ')).toMatch(/parts object: foot/);
  });

  it('rejects a character that ignores the walk and pose props', async () => {
    const frozen = walker.replace('walkPhase={walkPhase} walkMix={walkMix}', '').replace('pose={pose} poseTo', 'pose="stand" poseTo');
    expect((await checkPiece('Walker', frozen, { character })).errors.join(' ')).toMatch(/looks the same standing and in pose walk, point/);
  });

  it('rejects path data built from props and parts drawn away from their joints', async () => {
    const morph = walker.replace('d="M -27 4 L -26 35 L 91 35 L 80 12 Z"', 'd={`M -27 ${4 + carry} L -26 35 L 91 35 L 80 12 Z`}');
    expect((await checkPiece('Walker', morph, { character })).errors.join(' ')).toMatch(/must not depend on props \(carry\)/);
    const folds = walker.replace('torso: <g>', 'torso: <g>{[0, 1, 2].map((i) => <path key={i} d={`M -30 ${-60 - i * 40} L 30 ${-60 - i * 40}`} stroke="#223344" />)}');
    expect((await checkPiece('Walker', folds, { character })).errors).toEqual([]);
    const worldScale = walker.replace('<ellipse cy={-50} rx={44} ry={54}', '<ellipse cy={-700} rx={44} ry={54}');
    expect((await checkPiece('Walker', worldScale, { character })).errors.join(' ')).toMatch(/tall but the rig is 780/);
  });

  it('puts the rig in the shared block and tells scenes how to animate characters', () => {
    const castPlan: DraftPlan = {
      ...plan,
      objects: [...plan.objects, { name: 'Walker', kind: 'character', label: 'Pejalan', description: 'A man in a blue shirt', width: 320, height: H, props: [], closeups: [] }],
      sceneObjects: [['Kettle', 'Walker']],
    };
    const pieces = { WorldBase: fullWorld, Kettle: kettle, Walker: walker };
    const sharedWorld = joinPieces(castPlan, pieces);
    expect(sharedWorld).toMatch(/^\/\/ SHARED-WORLD:START\nconst HUMAN_RIG = /);
    expect(joinPieces(plan, { WorldBase: fullWorld, Kettle: kettle })).not.toContain('HUMAN_RIG');
    const prompt = continuityPrompt(continuityFor([{ id: 'a' }], {}, 0, { sharedWorld, sceneObjects: castPlan.sceneObjects, plan: castPlan, pieces }));
    expect(prompt).toContain('Character on HumanRig, height 780');
    expect(prompt).toContain('HUMAN_RIG.walk({ progress');
    expect(prompt).toContain('People are drafted characters on HumanRig');
    expect(prompt).not.toContain('function Rig(props)');
  });
});
