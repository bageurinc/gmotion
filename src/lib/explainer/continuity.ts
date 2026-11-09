import type { GeneratedAsset } from './asset-generator';
import type { AssetFocus } from './asset-contract';

const START = '// SHARED-WORLD:START';
const END = '// SHARED-WORLD:END';
const BLOCK = /\/\/ SHARED-WORLD:START[\s\S]*?\/\/ SHARED-WORLD:END/;

export interface SceneContinuity {
  /** The first scene's shared block, copied unchanged into every later scene. */
  sharedWorld?: string;
  /** The nearest earlier scene, whose final pose this scene continues from. */
  previous?: GeneratedAsset;
  /** True when previous is the scene right before this one, so the camera may carry on from it. */
  adjacent?: boolean;
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
  return { sharedWorld: owner && extractSharedWorld(owner.code), previous, adjacent: Boolean(previous) && previous === assets[index - 1] };
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

const WIDE: AssetFocus = { x: 500, y: 500, scale: 1 };

/** True when this scene's camera flies on from the previous scene instead of cutting to a new place. */
export const continuesCamera = (asset: GeneratedAsset | undefined, index: number) =>
  index > 0 && asset?.manifest.camera?.link === 'continue';

/**
 * Scene indexes whose camera carries on from the scene before them, for the fade-free cuts in MainVideo.
 * A scene before it that fell back to the simple version has no drawn asset and another look, so that cut keeps its fade.
 */
export function continuedScenes(
  scenes: Array<{ id: string }>,
  sceneAssets: Record<string, GeneratedAsset> | undefined,
): Set<number> {
  return new Set(scenes.flatMap((scene, index) =>
    continuesCamera(sceneAssets?.[scene.id], index) && sceneAssets?.[scenes[index - 1].id] ? [index] : []));
}

/**
 * The stage camera for one scene: from the previous scene's settled camera when it continues, else straight in.
 * previous must be the drawn scene right before this one; without it the scene opens on its own camera.
 */
export function scenePath(
  asset: GeneratedAsset,
  index: number,
  previous?: GeneratedAsset,
): { from?: AssetFocus; to: AssetFocus } | undefined {
  const camera = asset.manifest.camera;
  if (!camera) return undefined;
  if (!continuesCamera(asset, index) || !previous) return { to: camera.focus };
  return { from: previous.manifest.camera?.focus ?? WIDE, to: camera.focus };
}

const CAMERA_RULES = `CAMERA (the stage moves it, your code never does):
- Add "camera": {"link": "continue" or "cut", "focus": {"x": ..., "y": ..., "scale": ...}} to the manifest, in the shared world's 1000 by 1000 coordinates. focus is the centre of what this scene explains. scale 1 shows the whole canvas, 2 shows a 500-unit-wide window, 4 shows 250 units. Use 1 to 4.
- "continue" when this scene stays in the same place as the previous scene, including when it explains one part of the same object, such as a floor, a joint, or the foundation of the same building. The camera flies from the previous scene's focus to yours with no fade, so the viewer sees where the part sits in the whole.
- "continue" also needs the previous scene's final frame to already show what you point at, drawn the same way. Your first frame is that final frame, so every object it shows stays in place, and you only add detail as the camera gets close.
- "cut" when the scene moves to a different place or a different kind of picture, such as a document, a chart, another location, or from a geological cross-section to a building. Also "cut" when you cannot start from the previous scene's final frame. The video fades there. The first scene is always "cut".
- When the scene explains a part, draw that part where it really is in the shared world, at its real size, through the shared components, and point the camera at it. Never cover the world with a panel, card, blueprint mat, or magnified inset to show a close-up. Zoom is how the viewer gets close.
- At scale S everything looks S times larger, so draw the explained part with detail fine enough for that zoom: thin strokes around 2/S, small bolts, seams, and layers. Detail outside the camera's window can stay simple.
- The camera's window is 1000/S units wide around focus. The explained part and its full motion fill most of that window and stay inside it. The headline covers the top tenth of the window.`;

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
  if (!previous) return `${rules}

${CAMERA_RULES}`;
  return `${rules}

${CAMERA_RULES}

PREVIOUS SCENE (continue from it):
- The first frame of this scene matches its final state, the moment every actionProgress value is 1. Keep each object's position, scale, and shape from there.
- Previous camera: ${JSON.stringify(previous.manifest.camera ?? { link: 'cut', focus: WIDE })}. With "continue", your camera starts there.
- Previous actions: ${JSON.stringify(previous.manifest.choreography ?? [])}
\`\`\`tsx
${previous.code}
\`\`\``;
}
