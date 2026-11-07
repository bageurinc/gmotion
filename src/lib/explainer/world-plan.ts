import { z } from 'zod';
import type { AssetManifest } from './asset-contract';
import { contrastRatio, COPY_ANTI_SLOP_RULES, ensureContrast, VISUAL_ANTI_SLOP_RULES } from '../pipeline/anti-slop';
import { callChat, parseAssetResponse, requestAsset } from './asset-generator';

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const WorldBeatSchema = z.object({
  text: z.string().min(1).max(160),
  headline: z.string().min(1).max(60),
  accent: z.string().max(40),
  value: z.number(),
  status: z.string().max(24),
  clock: z.string().max(16),
  view: z.string(),
  focus: z.string().nullable(),
  zoom: z.number().min(1).max(3.2),
  label: z.string().max(24).nullable(),
  sticker: z.string().max(24).nullable(),
});

export const WorldScriptSchema = z.object({
  unit: z.string().max(6),
  palette: z.object({ ground: HexColor, hud: HexColor, hudText: HexColor, accent: HexColor, ink: HexColor }),
  beats: z.array(WorldBeatSchema).min(4).max(10),
});

export type WorldScript = z.infer<typeof WorldScriptSchema>;

export function worldAssetPrompt(topic: string): string {
  return `Create ONE large isometric world for this explainer: "${topic}".

WORLD RULES
- The whole video happens inside this single world, and a camera travels across it. Everything the story needs is in the same drawing.
- Use a strict isometric projection at 30 degrees. All objects share one light direction.
- Style: clean technical cutaway. Each solid has three flat tones: top lightest, left middle, right darkest, with a thin darker outline. Avoid soft gradients and glow.
- The main subject is big. It must cover at least half of the canvas, with secondary objects close beside it. A small object on a large empty surface is a failure.
- Draw only a modest surface under the objects, in a believable real-world material and color. Internal components must be visible where the story needs them.
- Components are bold, recognizable, and large enough to read at 3x zoom.
- Pick colors the viewer would expect from the real scene. An everyday home scene is bright and warm, with light wood or fabric and clear daylight. Use a dark world only when the topic itself is dark.
- Define 6 to 9 parts. Each part's anchor sits on it, and its focus uses scale 2 to 3 and is centered on it.
- Define 2 views: "normal" for the everyday state, and "state" for the changed or warning state.
- Provide 2 flows for current, fluid, or movement along real paths.

${VISUAL_ANTI_SLOP_RULES}`;
}

export async function generateWorldAsset(model: string, topic: string) {
  const first = await requestAsset(model, worldAssetPrompt(topic));
  try {
    return parseAssetResponse(first.text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fixed = await requestAsset(model, `${worldAssetPrompt(topic)}\n\nThe previous answer failed with: ${message}\nPrevious answer:\n${first.text.slice(0, 60_000)}\nReturn the complete json and tsx blocks.`);
    return parseAssetResponse(fixed.text);
  }
}

export const WORLD_STORY_RULES = `- 6 to 7 beats, 18 to 22 seconds total. Each text is at most 11 words.
- Open with a question that makes people stop scrolling. End with a clear answer.`;

const SCRIPT_PROMPT = `You write the timeline for a short vertical explainer in casual spoken Bahasa Indonesia, as if talking to a friend.
Output only JSON:
{
 "unit": "%",
 "palette": {"ground":"#hex","hud":"#hex","hudText":"#hex","accent":"#hex","ink":"#hex"},
 "beats": [{"text":"one short spoken sentence","headline":"short heading for the top panel","accent":"word from the headline to highlight","value":21,"status":"mengisi","clock":"+0:00 jam","view":"view id","focus":"part id or null for wide","zoom":2.2,"label":"short label or null","sticker":"short sound word or null"}]
}
Rules:
${WORLD_STORY_RULES}
- value is the number that changes through the story, such as a percentage or temperature. Keep it realistic for the topic.
- The camera must travel: at most two beats in a row share a focus. Use wide shots only for the opening and ending. Zoom 2 to 3 on parts.
- Use a sticker on at most 2 beats.
- Build the palette from the world's colors given below. ground continues the world's background, hud is a strong dark or saturated panel color, accent stands out on hud, and hudText reads on hud. ink is a dark color.
`;

export async function generateWorldScript(model: string, topic: string, manifest: AssetManifest): Promise<WorldScript> {
  const parts = manifest.parts.map((part) => `${part.id} (${part.label})`).join(', ');
  const views = manifest.views.map((view) => view.id).join(', ');
  const { text } = await callChat({
    model,
    system: `${SCRIPT_PROMPT}\n${COPY_ANTI_SLOP_RULES}`,
    content: `Topic: "${topic}"\nWorld colors: ${JSON.stringify(manifest.palette)}\nAvailable parts: ${parts}\nAvailable views: ${views}`,
    maxTokens: 6000,
  });
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) throw new Error('World script was not JSON');
  const script = WorldScriptSchema.parse(JSON.parse(json[0]));
  const partIds = new Set(manifest.parts.map((part) => part.id));
  const viewIds = new Set(manifest.views.map((view) => view.id));
  const { palette } = script;
  return {
    ...script,
    palette: {
      ...palette,
      hudText: ensureContrast(palette.hudText, palette.hud, 4.5),
      accent: ensureContrast(palette.accent, palette.hud, 3),
      ink: contrastRatio(palette.ink, '#FFFFFF') >= 7 ? palette.ink : '#1F2421',
    },
    beats: script.beats.map((beat) => ({
      ...beat,
      focus: beat.focus && partIds.has(beat.focus) ? beat.focus : null,
      view: viewIds.has(beat.view) ? beat.view : manifest.views[0].id,
    })),
  };
}
