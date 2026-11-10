import type { StudioProject } from '@/types/studio';
import type { GeneratedAsset } from './asset-generator';
import { CANVAS_HEIGHT, manifestCanvasWidth, type AssetFocus } from './asset-contract';
import type { StorySvgDraft } from './story-svg-draft';
import { draftApi } from './story-svg-shared';

const START = '// SHARED-WORLD:START';
const END = '// SHARED-WORLD:END';
const BLOCK = /\/\/ SHARED-WORLD:START[\s\S]*?\/\/ SHARED-WORLD:END/;

export interface SceneContinuity {
  /** The draft's shared block, or the first drawn scene's block on older projects. */
  sharedWorld?: string;
  /** Component headers of a per-object draft, sent to the model instead of the full block. */
  sharedWorldApi?: string;
  requiredObjects?: string[];
  /** The nearest earlier scene, whose final pose this scene continues from. */
  previous?: GeneratedAsset;
  /** True when previous is the scene right before this one, so the camera may carry on from it. */
  adjacent?: boolean;
  /**
   * Canvas width the shared world was drawn for. Scenes keep it, so an older square world is never mixed with wide scenes.
   * Undefined when no world exists yet, and the video shape decides.
   */
  canvasWidth?: number;
}

export const extractSharedWorld = (code: string): string | undefined => code.match(BLOCK)?.[0];

/** Finds what a scene inherits. The first drawn scene owns the shared block, also when it is redrawn. */
export function continuityFor(
  scenes: Array<{ id: string }>,
  sceneAssets: Record<string, GeneratedAsset> | undefined,
  index: number,
  draft?: StorySvgDraft,
): SceneContinuity {
  const assets = scenes.map((scene) => sceneAssets?.[scene.id]);
  const owner = assets.find((asset) => asset && extractSharedWorld(asset.code));
  const previous = assets.slice(0, index).reverse().find(Boolean);
  const canvasWidth = draft ? draft.canvasWidth ?? CANVAS_HEIGHT : owner && manifestCanvasWidth(owner.manifest);
  return {
    sharedWorld: draft?.sharedWorld ?? (owner && extractSharedWorld(owner.code)),
    ...(canvasWidth ? { canvasWidth } : {}),
    ...(draft ? { requiredObjects: draft.sceneObjects[index] } : {}),
    ...(draft && draftApi(draft) ? { sharedWorldApi: draftApi(draft) } : {}),
    previous,
    adjacent: Boolean(previous) && previous === assets[index - 1],
  };
}

/** Marker lines written as block comments or with stray spaces, as some models do, become the exact lines. */
const MARKER = /\/[/*][ \t]*SHARED-WORLD[ \t]*:[ \t]*(START|END)[ \t]*(?:\*\/)?/g;
const normalizeMarkers = (code: string) => code.replace(MARKER, (_, edge: string) => (edge === 'START' ? START : END));

const topLevelNames = (code: string) =>
  [...code.matchAll(/^(?:export\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map((match) => match[1]);

/**
 * Puts a fixed shared block after the imports when the model left out the marker lines.
 * The renderer owns that block anyway, so only a scene that redefines its components is refused.
 */
function insertSharedWorld(code: string, sharedWorld: string): string {
  const shared = new Set(topLevelNames(sharedWorld));
  const redefined = topLevelNames(code).filter((name) => shared.has(name));
  if (redefined.length) {
    throw new Error(`Do not define ${redefined.join(', ')}: the shared block between ${START} and ${END} defines them. Put the two marker lines after the imports instead.`);
  }
  const imports = [...code.matchAll(/^import[^;]*;[^\n]*\n/gm)].pop();
  const at = imports ? (imports.index ?? 0) + imports[0].length : 0;
  return `${code.slice(0, at)}\n${sharedWorld}\n${code.slice(at)}`;
}

/** Makes the shared block identical across scenes, so drift in the model's copy never reaches the video. */
export function applySharedWorld(rawCode: string, sharedWorld?: string, requiredObjects: string[] = []): string {
  let code = normalizeMarkers(rawCode);
  if (!extractSharedWorld(code) && sharedWorld) code = insertSharedWorld(code, sharedWorld);
  const own = extractSharedWorld(code);
  if (!own) throw new Error(`Put the persistent world between ${START} and ${END}.`);
  const block = sharedWorld ?? own;
  if (!/\b(?:const|function)\s+WorldBase\b/.test(block)) throw new Error('The shared block must define a WorldBase component.');
  const applied = code.replace(BLOCK, () => block);
  const sceneCode = applied.replace(BLOCK, '');
  if (!/<WorldBase\s*\/>/.test(sceneCode)) {
    throw new Error('Asset must render <WorldBase /> with no props so the world stays identical across scenes.');
  }
  const missing = requiredObjects.filter((object) => !new RegExp(`<${object}(?=[\\s/>])`).test(sceneCode));
  if (missing.length) throw new Error(`Render these drafted SVG components directly: ${missing.join(', ')}.`);
  return applied;
}

const wideOf = (asset?: GeneratedAsset): AssetFocus => ({ x: (asset ? manifestCanvasWidth(asset.manifest) : CANVAS_HEIGHT) / 2, y: CANVAS_HEIGHT / 2, scale: 1 });

/** True when this scene's camera flies on from the previous scene instead of cutting to a new place. */
export const continuesCamera = (asset: GeneratedAsset | undefined, index: number) =>
  index > 0 && asset?.manifest.camera?.link === 'continue';

export function hasContinuousCut(project: StudioProject, index: number): boolean {
  if (project.storyboard.preset !== 'story-svg' || index < 1) return false;
  const { scenes } = project.storyboard;
  return Boolean(project.sceneAssets?.[scenes[index - 1].id])
    && continuesCamera(project.sceneAssets?.[scenes[index].id], index);
}

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
  return { from: previous.manifest.camera?.focus ?? wideOf(previous), to: camera.focus };
}

const CAMERA_RULES = (width: number) => `CAMERA (the stage moves it, your code never does):
- Add "camera": {"link": "continue" or "cut", "focus": {"x": ..., "y": ..., "scale": ...}} to the manifest, in the shared world's ${width} by 1000 coordinates. focus is the centre of what this scene explains. scale 1 shows the whole canvas, centred at x=${width / 2}, y=500. At scale S the window is ${width}/S units wide and 1000/S tall: scale 2 shows ${width / 2} by 500. Use 1 to 4.${width > CANVAS_HEIGHT ? ' The frame is wide, so prefer scale 1 to 2 and fill the window\'s width with the subject and its related objects.' : ''}
- "continue" when this scene stays in the same place as the previous scene, including when it explains one part of the same object, such as a floor, a joint, or the foundation of the same building. The camera flies from the previous scene's focus to yours with no fade, so the viewer sees where the part sits in the whole.
- "continue" also needs the previous scene's final frame to already show what you point at, drawn the same way. Your first frame is that final frame, so every object it shows stays in place, and you only add detail as the camera gets close.
- "cut" when the scene moves to a different place or a different kind of picture, such as a document, a chart, another location, or from a geological cross-section to a building. Also "cut" when you cannot start from the previous scene's final frame. The video fades there. The first scene is always "cut".
- When the scene explains a part, draw that part where it really is in the shared world, at its real size, through the shared components, and point the camera at it. Never cover the world with a panel, card, blueprint mat, or magnified inset to show a close-up. Zoom is how the viewer gets close.
- At scale S everything looks S times larger, so draw the explained part with detail fine enough for that zoom: thin strokes around 2/S, small bolts, seams, and layers. Detail outside the camera's window can stay simple.
- The camera's window is ${width}/S units wide and 1000/S tall around focus. The explained part and its full motion fill most of that window and stay inside it. The headline covers the top tenth of the window.`;

/** Prompt section that makes one scene continue the sequence instead of starting a new drawing. */
export function continuityPrompt({ sharedWorld, sharedWorldApi, requiredObjects, previous, adjacent }: SceneContinuity, canvasWidth = CANVAS_HEIGHT): string {
  const camera = CAMERA_RULES(canvasWidth);
  const rules = sharedWorld
    ? `SHARED WORLD (${requiredObjects ? 'fixed by the object draft' : 'already fixed by the first scene'}):
- Put the two SHARED-WORLD marker lines directly after the imports, with nothing between them. The renderer inserts the exact block ${sharedWorldApi ? 'whose components are listed below (headers and signatures only; their art is finished)' : 'below'}.
- Render <WorldBase /> with no props in every frame, and draw recurring objects only through the components in this block.
- Do not draw a second ground, surface, panel, or background. Keep the same scale, so objects stay the same size as in the block.
${requiredObjects?.length ? `- Render each of these drafted objects directly in JSX: ${requiredObjects.join(', ')}. Place and animate instances with SVG group transforms or their documented props. ${sharedWorldApi ? 'Each object\'s origin is the centre of its base, so translate it to where it stands; WorldBase\'s ground line is given below. ' : ''}Preserve object proportions and use the previous placement and pose for a continuous cut.` : ''}
${sharedWorldApi?.includes('Character on HumanRig') ? '- People are drafted characters on HumanRig. Move and pose them only through their props and HUMAN_RIG.walk, exactly as the block below explains. A character that starts this scene keeps the pose and facing it ended the previous scene with.' : ''}
\`\`\`tsx
${sharedWorldApi ?? sharedWorld}
\`\`\``
    : `SHARED WORLD (this scene defines it for the whole video):
- Directly after the imports, write a block starting with the line "${START}" and ending with the line "${END}".
- The block defines WorldBase, a component with no props that draws the fixed setting, ground, and surface at the same position for every scene in the shared sequence directions. Its ground and surfaces follow the system prompt's rule and run past the canvas to the frame edges.
- The block also defines every recurring object as a component driven only by props, such as position, scale, and state, so later scenes can place it in any pose.
- Code in the block reads only its own props. It must not use actionProgress, time, or anything declared outside the block. Prefix its gradient and filter ids with "asset-world-".
- Asset renders <WorldBase /> with no props, then places the recurring objects. Design WorldBase for all scenes, not only this one, and leave room for every object in the sequence.`;
  if (!previous || adjacent === false) return `${rules}

${camera}`;
  return `${rules}

${camera}

PREVIOUS SCENE (continue from it):
- The first frame of this scene matches its final state, the moment every actionProgress value is 1. Keep each object's position, scale, and shape from there.
- Previous camera: ${JSON.stringify(previous.manifest.camera ?? { link: 'cut', focus: wideOf(previous) })}. With "continue", your camera starts there.
- Previous actions: ${JSON.stringify(previous.manifest.choreography ?? [])}
\`\`\`tsx
${previous.code.replace(BLOCK, '')}
\`\`\``;
}
