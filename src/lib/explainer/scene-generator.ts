import { isApiKeyConfigured } from '@/lib/ai/llm-client';
import { generateSceneFile } from '@/lib/pipeline/coder-agent';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import type { SceneSpec, Storyboard } from '@/types/studio';
import { generateAsset, GeneratedAsset, parseAssetResponse, repairAsset, sceneAssetPrompt } from './asset-generator';

function assetModel(): string {
  return process.env.ASSET_MODEL || process.env.CODER_MODEL || 'ag/gemini-3.8-flash-high';
}

export function composeAssetScene(asset: GeneratedAsset, storyboard: Storyboard, index: number): string {
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
  const assetCode = asset.code
    .replace(/export\s+default\s+Asset;?/, '')
    .replace(/export\s+const\s+Asset\b/, 'const Asset');

  return `import { AssetStage, buildAssetShots, KineticHeadline, SyncedCaptions } from '@/motion-kit';
${assetCode}

const manifest = ${JSON.stringify(manifest, null, 2)};
const shots = buildAssetShots(manifest, ${scene.durationInFrames}, ${storyboard.fps || 30});

export const ${componentName} = () => (
  <AssetStage manifest={manifest} Asset={Asset} shots={shots}>
    <KineticHeadline text={${JSON.stringify(scene.kineticHeadline)}} highlightColor={${JSON.stringify(palette.primary)}} textColor={${JSON.stringify(palette.text)}} />
    <SyncedCaptions text={${JSON.stringify(scene.voiceoverText)}} wordTimings={${JSON.stringify(scene.wordTimings)}} activeColor={${JSON.stringify(palette.primary)}} />
  </AssetStage>
);

export default ${componentName};
`;
}

async function generateAssetScene(storyboard: Storyboard, index: number): Promise<string> {
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

  const compose = (text: string) => {
    const code = composeAssetScene(parseAssetResponse(text), storyboard, index);
    const validation = validateSceneCode(code, `Scene${index + 1}.tsx`);
    if (!validation.valid) throw new Error(validation.errors.join('\n'));
    return code;
  };

  const first = await generateAsset(assetModel(), prompt);
  try {
    return compose(first.text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const repaired = await repairAsset(assetModel(), prompt, first.text, message);
    return compose(repaired.text);
  }
}

export async function generateVideoSceneFile(
  storyboard: Storyboard,
  index: number
): Promise<{ code: string; simplified: boolean }> {
  // CTA scenes need the real button component, which the illustration stage does not draw.
  if (storyboard.scenes[index].role === 'cta' || !isApiKeyConfigured()) {
    return { code: await generateSceneFile(storyboard, index), simplified: false };
  }

  try {
    return { code: await generateAssetScene(storyboard, index), simplified: false };
  } catch (error) {
    console.warn(`[SceneGenerator] Asset for scene ${index + 1} failed, using the simple scene:`, error);
    return { code: await generateSceneFile(storyboard, index), simplified: true };
  }
}
