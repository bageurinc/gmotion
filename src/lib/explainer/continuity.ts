import type { GeneratedAsset } from './asset-generator';

const START = '// SHARED-WORLD:START';
const END = '// SHARED-WORLD:END';
const BLOCK = /\/\/ SHARED-WORLD:START[\s\S]*?\/\/ SHARED-WORLD:END/;

export interface SceneContinuity {
  /** The first scene's shared block, copied unchanged into every later scene. */
  sharedWorld?: string;
  /** The nearest earlier scene, whose final pose this scene continues from. */
  previous?: GeneratedAsset;
}

export const extractSharedWorld = (code: string): string | undefined => code.match(BLOCK)?.[0];

/** Finds what a scene inherits. The first drawn scene owns the shared block, also when it is redrawn. */
export function continuityFor(
  scenes: Array<{ id: string }>,
  sceneAssets: Record<string, GeneratedAsset> | undefined,
  index: number,
): SceneContinuity {
  const assets = scenes.map((scene) => sceneAssets?.[scene.id]);
  const owner = assets.find((asset) => asset && extractSharedWorld(asset.code));
  const previous = assets.slice(0, index).reverse().find(Boolean);
  return { sharedWorld: owner && extractSharedWorld(owner.code), previous };
}

/** Makes the shared block identical across scenes, so drift in the model's copy never reaches the video. */
export function applySharedWorld(code: string, sharedWorld?: string): string {
  const own = extractSharedWorld(code);
  if (!own) throw new Error(`Put the persistent world between ${START} and ${END}.`);
  const block = sharedWorld ?? own;
  if (!/\b(?:const|function)\s+WorldBase\b/.test(block)) throw new Error('The shared block must define a WorldBase component.');
  const applied = code.replace(BLOCK, () => block);
  if (!/<WorldBase\s*\/>/.test(applied.replace(BLOCK, ''))) {
    throw new Error('Asset must render <WorldBase /> with no props so the world stays identical across scenes.');
  }
  return applied;
}

/** Prompt section that makes one scene continue the sequence instead of starting a new drawing. */
export function continuityPrompt({ sharedWorld, previous }: SceneContinuity): string {
  const rules = sharedWorld
    ? `SHARED WORLD (already fixed by the first scene):
- Copy this block unchanged directly after the imports. Any change you make to it is discarded.
- Render <WorldBase /> with no props in every frame, and draw recurring objects only through the components in this block.
- Do not draw a second ground, surface, panel, or background. Keep the same scale, so objects stay the same size as in the block.
\`\`\`tsx
${sharedWorld}
\`\`\``
    : `SHARED WORLD (this scene defines it for the whole video):
- Directly after the imports, write a block starting with the line "${START}" and ending with the line "${END}".
- The block defines WorldBase, a component with no props that draws the fixed setting, ground, and surface at the same position for every scene in the shared sequence directions. Its ground and surfaces follow the system prompt's rule and run past the canvas to the frame edges.
- The block also defines every recurring object as a component driven only by props, such as position, scale, and state, so later scenes can place it in any pose.
- Code in the block reads only its own props. It must not use actionProgress, time, or anything declared outside the block. Prefix its gradient and filter ids with "asset-world-".
- Asset renders <WorldBase /> with no props, then places the recurring objects. Design WorldBase for all scenes, not only this one, and leave room for every object in the sequence.`;
  if (!previous) return rules;
  return `${rules}

PREVIOUS SCENE (continue from it):
- The first frame of this scene matches its final state, the moment every actionProgress value is 1. Keep each object's position, scale, and shape from there.
- Previous actions: ${JSON.stringify(previous.manifest.choreography ?? [])}
\`\`\`tsx
${previous.code}
\`\`\``;
}
