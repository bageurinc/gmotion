import { describe, expect, it } from 'vitest';
import { checkPiece, joinPieces, type DraftPlan, type StorySvgDraft } from '@/lib/explainer/story-svg-draft';
import { draftApi, draftLabel, worldViewBox } from '@/lib/explainer/story-svg-shared';
import { continuityFor, continuityPrompt } from '@/lib/explainer/continuity';

const plan: DraftPlan = {
  world: { label: 'Dapur', description: 'A warm kitchen', groundY: 700 },
  objects: [{ name: 'Kettle', label: 'Ketel', description: 'A steel kettle', width: 300, height: 260, props: [], closeups: [] }],
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
  });

  it('reports a component that crashes with its default props', async () => {
    const code = 'function Kettle({ parts }: { parts?: number[] }) { return <g>{parts!.map((p) => <circle key={p} r={p} />)}</g>; }';
    expect((await checkPiece('Kettle', code)).errors.join(' ')).toMatch(/Rendering Kettle/);
  });

  it('finds gaps when the setting stops at the canvas edge', async () => {
    const boxed = 'function WorldBase() { return <g><rect x={0} y={0} width={1000} height={1000} fill="#ddeeff" /></g>; }';
    expect((await checkPiece('WorldBase', boxed)).errors.join(' ')).toMatch(/gaps at/);
    expect((await checkPiece('WorldBase', fullWorld)).errors).toEqual([]);
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
