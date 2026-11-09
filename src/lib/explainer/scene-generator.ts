import { buildActionCues, narrationWords, unanimatedActions } from './choreography';
import { dataVisualStart, spokenDataVisual } from './data-visual';
import { applySharedWorld, continuityPrompt, scenePath, type SceneContinuity } from './continuity';
import { isApiKeyConfigured } from '@/lib/ai/llm-client';
import { generateSceneFile } from '@/lib/pipeline/coder-agent';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { ensureContrast } from '@/lib/pipeline/anti-slop';
import type { ImageShot } from '@/motion-kit/explainer/image-camera';
import type { ColorPalette, DrawingModel, SceneSpec, Storyboard } from '@/types/studio';
import { generateAsset, GeneratedAsset, parseAssetResponse, repairAsset, sceneAssetPrompt } from './asset-generator';

export function assetModel(choice: DrawingModel = 'gemini'): string {
  if (choice === 'deepseek-flash') return process.env.DEEPSEEK_FLASH_MODEL || 'ds/deepseek-v4.1-flash';
  return process.env.ASSET_MODEL || process.env.CODER_MODEL || 'ag/gemini-3.8-flash-high';
}

/** Captions sit on a dark box, so their highlight must read on black whatever the palette is. */
function captionHighlight(palette: ColorPalette): string {
  return ensureContrast(palette.primary, '#000000', 7);
}

const stageStyle = ({ textStyle }: Storyboard) => (textStyle ? ` textStyle=${JSON.stringify(textStyle)}` : '');

/** The headline, optional data card, and captions every drawn scene shares. */
function sceneOverlays(storyboard: Storyboard, index: number): string {
  const scene = storyboard.scenes[index];
  const { palette, textStyle } = storyboard;
  const style = textStyle ? ` textStyle=${JSON.stringify(textStyle)}` : '';
  const focus = scene.headlineFocus && scene.kineticHeadline.toLowerCase().includes(scene.headlineFocus.toLowerCase())
    ? ` highlightWords={${JSON.stringify([scene.headlineFocus])}}`
    : '';
  const visual = spokenDataVisual(scene.dataVisual, scene.voiceoverText);
  const card = visual
    ? `\n    <DataCard visual={${JSON.stringify(visual)}} from={${dataVisualStart(visual, scene, storyboard.fps || 30)}} background=${JSON.stringify(palette.surface)} textColor=${JSON.stringify(ensureContrast(palette.text, palette.surface, 4.5))} accent=${JSON.stringify(ensureContrast(palette.primary, palette.surface, 3))}${style} />`
    : '';
  return `<KineticHeadline text={${JSON.stringify(scene.kineticHeadline)}}${focus} highlightColor={${JSON.stringify(palette.primary)}} textColor={${JSON.stringify(palette.text)}}${style} />${card}
    <SyncedCaptions text={${JSON.stringify(scene.voiceoverText)}} wordTimings={${JSON.stringify(scene.wordTimings)}} activeColor={${JSON.stringify(captionHighlight(palette))}}${style} />`;
}

export function composeAssetScene(
  asset: GeneratedAsset,
  storyboard: Storyboard,
  index: number,
  /** The scene before this one, whose settled camera a continuing scene starts from. */
  previous?: GeneratedAsset,
): string {
  const scene: SceneSpec = storyboard.scenes[index];
  const componentName = `Scene${index + 1}`;
  const { palette } = storyboard;
  const manifest = {
    ...asset.manifest,
    palette: {
      backgroundFrom: palette.surface,
      backgroundTo: palette.background,
      accent: palette.primary,
      accentAlt: palette.secondary,
      text: palette.text,
    },
  };
  const actionCues = manifest.choreography
    ? buildActionCues(manifest.choreography, narrationWords(scene, storyboard.fps || 30), scene.durationInFrames, storyboard.fps || 30)
    : [];
  const path = scenePath(asset, index, previous);
  const camera = path ? ` camera={${JSON.stringify(path)}}` : '';
  const assetCode = asset.code
    .replace(/export\s+default\s+Asset;?/, '')
    .replace(/export\s+const\s+Asset\b/, 'const Asset');

  return `import { AssetStage, buildAssetShots, DataCard, KineticHeadline, SyncedCaptions } from '@/motion-kit';
${assetCode}

const manifest = ${JSON.stringify(manifest, null, 2)};
const shots = buildAssetShots(manifest, ${scene.durationInFrames}, ${storyboard.fps || 30});

export const ${componentName} = () => (
  <AssetStage manifest={manifest} Asset={Asset} shots={shots} actionCues={${JSON.stringify(actionCues)}} fullBleed${camera}${stageStyle(storyboard)}>
    ${sceneOverlays(storyboard, index)}
  </AssetStage>
);

export default ${componentName};
`;
}

/** A scene drawn by an image model. The app serves the file, and export rewrites its path. */
export function composeImageScene(storyboard: Storyboard, index: number, images: string[], shots: ImageShot[]): string {
  const componentName = `Scene${index + 1}`;
  const { palette } = storyboard;
  const accent = ensureContrast(palette.primary, palette.background, 3);
  return `import { DataCard, ImageStage, KineticHeadline, SyncedCaptions } from '@/motion-kit';

export const ${componentName} = () => (
  <ImageStage images={${JSON.stringify(images)}} shots={${JSON.stringify(shots)}} backgroundColor={${JSON.stringify(palette.background)}} accent={${JSON.stringify(accent)}} labelBackground={${JSON.stringify(palette.text)}} labelText={${JSON.stringify(palette.background)}}${stageStyle(storyboard)}${storyboard.artStyle === 'pixel' ? ' pixelated' : ''}>
    ${sceneOverlays(storyboard, index)}
  </ImageStage>
);

export default ${componentName};
`;
}

export function sceneTopicPrompt(storyboard: Storyboard, index: number, continuity?: SceneContinuity): string {
  const scene = storyboard.scenes[index];
  const prompt = sceneAssetPrompt({
    videoTitle: storyboard.title,
    outline: storyboard.scenes.map((item, position) => `${position + 1}. ${item.title}`).join('\n'),
    sceneNumber: index + 1,
    sceneCount: storyboard.scenes.length,
    sceneTitle: scene.title,
    narration: scene.voiceoverText,
    visualPrompt: scene.visualPrompt,
    palette: storyboard.palette,
  });
  const cardNote = spokenDataVisual(scene.dataVisual, scene.voiceoverText)
    ? '\nA data card covers the frame below y=800 in this scene, so keep the main subject and its full motion above y=800. The ground may continue behind the card.'
    : '';
  if (storyboard.preset !== 'story-svg') return `${prompt}${cardNote}`;
  const fps = storyboard.fps || 30;
  const words = narrationWords(scene, fps);
  return `${prompt}
FULL SVG CHOREOGRAPHY MODE (use the choreography contract from the system prompt):
- One persistent world view. Move the actual objects through causal actions, never dissolve between duplicate drawings or stages.
- Add 1 to 4 choreography actions {id, description, startWord, endWord}. Word indexes below are zero-based, inclusive, ordered, non-overlapping. Cover the narrated process; prefer 1 or 2 strong actions for short sentences.
- Destructure actionProgress in Asset. For EVERY action, use actionProgress.actionId ?? 0 to change object position, rotation, shape, or a meaningful physical state. Progress stays at 1 after completion. Do not reset or loop the main action using time or sin.
- Use the same SVG nodes for an object's before/after state. One action leads into the next. Keep the final result visible. No crossfaded duplicate objects, generic particles, bouncing, or idle-only motion.
- Keep the dominant subject and its full motion envelope inside the camera's window from the CAMERA rules, where it fills most of the window. The camera settles in the first second and then stays still so the action reads clearly.
- Keep a consistent subject silhouette, material, scale, light direction, ground height, and screen direction throughout this video. Begin from the previous scene's final state; finish in the next scene's starting state. Use the complete directions below as the shared design specification.
- No raster images, no ImageStage, no video.
Narration words with timing: ${JSON.stringify(words.map((w, i) => ({ index: i, ...w })))}
Shared sequence directions: ${JSON.stringify(storyboard.scenes.map((item, i) => ({ scene: i + 1, title: item.title, narration: item.voiceoverText, visual: item.visualPrompt })))}
This scene lasts ${scene.durationInFrames / fps} seconds.${cardNote}${continuity ? `\n\n${continuityPrompt(continuity)}` : ''}`;
}

export function buildAssetScene(
  text: string,
  storyboard: Storyboard,
  index: number,
  continuity?: SceneContinuity,
): { asset: GeneratedAsset; code: string } {
  let asset = parseAssetResponse(text);
  if (storyboard.preset === 'story-svg') {
    if (!asset.manifest.choreography?.length || asset.manifest.views.length !== 1) {
      throw new Error('Full SVG requires choreography actions and one persistent view.');
    }
    const idle = unanimatedActions(asset.manifest.choreography, asset.code);
    if (idle.length) throw new Error(`Drive these actions from actionProgress instead of idle-only motion: ${idle.join(', ')}`);
    asset = { ...asset, code: applySharedWorld(asset.code, continuity?.sharedWorld) };
  }
  const code = composeAssetScene(asset, storyboard, index, continuity?.previous);
  const validation = validateSceneCode(code, `Scene${index + 1}.tsx`, { svgOnly: storyboard.preset === 'story-svg' });
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  return { asset, code };
}

export interface SceneOptions {
  drawingModel?: DrawingModel;
  continuity?: SceneContinuity;
}

async function generateAssetScene(storyboard: Storyboard, index: number, { drawingModel, continuity }: SceneOptions) {
  const prompt = sceneTopicPrompt(storyboard, index, continuity);
  const model = assetModel(drawingModel);
  const first = await generateAsset(model, prompt);
  try {
    return buildAssetScene(first.text, storyboard, index, continuity);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const repaired = await repairAsset(model, prompt, first.text, message);
    return buildAssetScene(repaired.text, storyboard, index, continuity);
  }
}

export async function generateVideoSceneFile(
  storyboard: Storyboard,
  index: number,
  options: SceneOptions = {},
): Promise<{ code: string; simplified: boolean; asset?: GeneratedAsset }> {
  if (storyboard.scenes[index].role === 'cta' || !isApiKeyConfigured()) {
    return { code: await generateSceneFile(storyboard, index), simplified: false };
  }

  // A simple scene has another look, which breaks a Full SVG video, so it gets one more full attempt.
  const attempts = storyboard.preset === 'story-svg' ? 2 : 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return { ...(await generateAssetScene(storyboard, index, options)), simplified: false };
    } catch (error) {
      console.warn(`[SceneGenerator] Asset for scene ${index + 1} failed on attempt ${attempt}:`, error);
    }
  }
  return { code: await generateSceneFile(storyboard, index), simplified: true };
}
