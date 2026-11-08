import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { z } from 'zod';
import { contrastRatio, COPY_ANTI_SLOP_RULES, ensureContrast } from '../pipeline/anti-slop';
import type { Storyboard } from '../../types/studio';
import type { ImageBox, ImageShot } from '../../motion-kit/explainer/image-camera';
import type { IsoPicture, IsoPictureFlow } from '../../motion-kit/world/IsoPicture';
import { callChat, LlmUsage } from './asset-generator';
import { blankCanvas, generateImage, matchesAspect } from './image-generator';
import { keepStatedNumbers } from './iso-plan';
import { IsoBeatSchema, IsoPlan } from './iso-world';
import { locateObjects } from './scene-moments';
import { WORLD_STORY_RULES } from './world-plan';

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Id = z.string().regex(/^[a-z0-9-]{1,32}$/);

export const IsoPicturePlanSchema = z.object({
  look: z.enum(['bright', 'dark']),
  unit: z.string().max(6),
  palette: z.object({ ground: HexColor, hud: HexColor, hudText: HexColor, accent: HexColor, ink: HexColor }),
  setting: z.string().min(20).max(1200),
  parts: z.array(z.object({ id: Id, label: z.string().min(1).max(24), find: z.string().min(3).max(160) })).min(1).max(8),
  details: z.array(z.object({ id: Id, label: z.string().min(1).max(24), draw: z.string().min(20).max(800) })).max(2),
  flows: z.array(z.object({ id: Id, through: z.array(z.string()).min(2).max(5), activeBeats: z.array(z.number().int().min(0)).max(12) })).max(3),
  beats: z.array(IsoBeatSchema).min(3).max(12),
});

export type IsoPicturePlan = z.infer<typeof IsoPicturePlanSchema>;

export const ISO_PICTURE_PROMPT = `You plan a short vertical explainer drawn as ONE detailed isometric illustration, and write its timeline in casual spoken Bahasa Indonesia, as if talking to a friend.
An image model paints the picture from your "setting". Code then finds your parts in it, moves the camera between them, and draws labels and flows.

Output only JSON:
{
 "look": "bright",
 "unit": "%",
 "palette": {"ground":"#hex","hud":"#hex","hudText":"#hex","accent":"#hex","ink":"#hex"},
 "setting": "English description of the whole picture",
 "parts": [{"id":"kebab-id","label":"Nama pendek","find":"English: what it looks like and where it is in the picture"}],
 "details": [{"id":"kebab-id","label":"Nama pendek","draw":"English description of a close-up picture"}],
 "flows": [{"id":"kebab-id","through":["part-a","part-b"],"activeBeats":[1,2]}],
 "beats": [{"text":"one short spoken sentence","headline":"short heading for the top panel","accent":"word from the headline to highlight","value":null,"status":"short state word","clock":null,"focus":"part id, detail id, or null for wide","label":"short label or null","sticker":"short sound word or null"}]
}

SETTING RULES
- The subject is shown where it really exists, in its real context. An organ sits inside a human body, an engine inside its vehicle, a phone in a hand or on a real counter, a bee among flowers. Never a lone object on a tile, base, platform, plinth, or floating slab.
- To show something hidden, use a cutaway of its real context, such as a person's chest drawn with the skin and ribs cut open, or a car with its hood removed.
- Describe every part the story explains, its real shape, real proportions, real colors, and where it sits, so each one is clearly recognizable. Mention what surrounds it.
- The picture fills the whole frame from edge to edge. The subject sits in the middle and lower part. The top quarter stays calm, because a headline panel covers it.
- Write the setting in English, 60 to 160 words.

PART RULES
- parts are things visible in the main picture that the story points at. 2 to 6 parts, each big enough to see in the whole picture.
- find describes the part so a vision model can box it, such as "the red heart in the center of the chest".
- details are close-ups that need their own picture, because the part is too small or is inside something, such as tiny air sacs inside a lung or the chip inside a phone. 0 to 2 details. Draw them in the same world, cut open where needed.

STORY RULES
${WORLD_STORY_RULES}
- The camera travels: at most two beats in a row share a focus. Use wide shots (focus null) only for the opening and ending.
- A beat's focus explains its line alone, so pick the part the line is about.
- A flow is movement between parts, such as blood, air, money, or data. Use one only where something really moves, and list the beats when it moves.
- Use a sticker on at most 2 beats, written in Bahasa Indonesia.
- value and clock show a number on the top panel. Use one only when that exact number is spoken in the narration or written in the topic. Otherwise they are null. Never invent a number.

COLOR RULES
- look is "bright" or "dark", decided from where the topic really happens. Choose dark only when the place itself is dark, such as the deep sea, space, a cave, or night.
- ground matches the picture's background tone, hud is a strong panel color, hudText reads on hud, accent stands out on hud and is reserved for what is being explained, and ink is a dark color.

${COPY_ANTI_SLOP_RULES}`;

const STYLE = `Detailed isometric illustration seen from above at the classic 30 degree isometric angle, like a high quality explainer infographic.
Clean shapes with crisp dark outlines, soft flat shading with two or three tones per surface, and rich true-to-life colors. Correct anatomy and real proportions.
Absolutely no text, letters, numbers, labels, arrows, logos, or watermarks. Screens, paper, and signs show only pictures, icons, colored blocks, and blank lines, never digits or writing.
No base, tile, plinth, platform, or floating slab under the subject.`;

export function worldImagePrompt(plan: IsoPicturePlan): string {
  return `Paint over this entire canvas, keeping its exact shape. Its color is only a tone reference, and no blank area may remain.

${STYLE}

Show: ${plan.setting}

The scene fills the canvas edge to edge in its real surroundings. The top quarter is a calm, light continuation of the surroundings with no important objects.`;
}

export function detailImagePrompt(detail: IsoPicturePlan['details'][number]): string {
  return `This picture is only a style reference. Draw a NEW picture: a close-up view, in exactly the same illustration style, outline weight, and colors.

${STYLE}

Show: ${detail.draw}

The close-up fills the canvas edge to edge. The top quarter is calm, because a headline panel covers it.`;
}

const BAND_COLUMNS = 32;
const BAND_ROWS = 96;
const BAND_ROW_SPREAD = 6;
const BAND_ROW_SHIFT = 8;

/** Share of the picture height, from the top, that is one flat color. The gemini/ route often leaves one. */
export async function blankTopShare(image: Buffer): Promise<number> {
  const { data } = await sharp(image).greyscale().resize(BAND_COLUMNS, BAND_ROWS, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const row = (index: number) => Array.from(data.subarray(index * BAND_COLUMNS, (index + 1) * BAND_COLUMNS));
  const first = row(0);
  const base = first.reduce((sum, value) => sum + value, 0) / BAND_COLUMNS;
  for (let index = 0; index < BAND_ROWS; index += 1) {
    const values = row(index);
    const mean = values.reduce((sum, value) => sum + value, 0) / BAND_COLUMNS;
    if (Math.max(...values) - Math.min(...values) > BAND_ROW_SPREAD || Math.abs(mean - base) > BAND_ROW_SHIFT) {
      // Only a strip that ends in a hard edge across the frame shows; a subject rising from a plain backdrop does not.
      // The first changed row is often a soft anti-aliased line, so the edge is read a few rows lower.
      const below = row(Math.min(BAND_ROWS - 1, index + 3));
      const edge = Math.abs(below[0] - first[0]) > BAND_ROW_SHIFT && Math.abs(below[BAND_COLUMNS - 1] - first[BAND_COLUMNS - 1]) > BAND_ROW_SHIFT;
      return edge ? index / BAND_ROWS : 0;
    }
  }
  return 0;
}

function referencedIds(plan: IsoPicturePlan): string[] {
  const known = new Set([...plan.parts.map((part) => part.id), ...plan.details.map((detail) => detail.id)]);
  const problems: string[] = [];
  plan.beats.forEach((beat, index) => {
    if (beat.focus && !known.has(beat.focus)) problems.push(`Beat ${index} focuses on unknown id "${beat.focus}"`);
  });
  for (const flow of plan.flows) {
    for (const id of flow.through) if (!plan.parts.some((part) => part.id === id)) problems.push(`Flow ${flow.id} passes unknown part "${id}"`);
  }
  return problems;
}

function withReadablePalette(plan: IsoPicturePlan): IsoPicturePlan {
  const { palette } = plan;
  return {
    ...plan,
    palette: {
      ...palette,
      hudText: ensureContrast(palette.hudText, palette.hud, 4.5),
      accent: ensureContrast(palette.accent, palette.hud, 3),
      ink: contrastRatio(palette.ink, '#FFFFFF') >= 7 ? palette.ink : '#1F2421',
    },
  };
}

/** Approved narration always wins, and every line gets exactly one beat. */
function applyStory(plan: IsoPicturePlan, story: string[]): IsoPicturePlan {
  return {
    ...plan,
    beats: story.map((text, index) => ({
      ...(plan.beats[index] ?? { headline: text.slice(0, 60), accent: '', value: null, status: '', clock: null, focus: null, label: null, sticker: null }),
      text,
    })),
  };
}

/** Unknown ids are dropped instead of failing, because a wide shot is a safe fallback. */
function dropUnknown(plan: IsoPicturePlan): IsoPicturePlan {
  const parts = new Set(plan.parts.map((part) => part.id));
  const known = new Set([...parts, ...plan.details.map((detail) => detail.id)]);
  return {
    ...plan,
    flows: plan.flows.map((flow) => ({ ...flow, through: flow.through.filter((id) => parts.has(id)) })).filter((flow) => flow.through.length >= 2),
    beats: plan.beats.map((beat) => ({ ...beat, focus: beat.focus && known.has(beat.focus) ? beat.focus : null })),
  };
}

export interface IsoPicturePlanResult {
  plan: IsoPicturePlan;
  attempts: number;
  firstProblems: string[];
  usage: LlmUsage;
}

function parsePlan(text: string): IsoPicturePlan {
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) throw new Error('Answer was not JSON');
  return IsoPicturePlanSchema.parse(JSON.parse(json[0]));
}

export async function generateIsoPicturePlan(model: string, topic: string, story?: string[]): Promise<IsoPicturePlanResult> {
  const usage: LlmUsage = { promptTokens: 0, completionTokens: 0, seconds: 0 };
  const ask = async (content: string) => {
    const reply = await callChat({ model, system: ISO_PICTURE_PROMPT, content, maxTokens: 8000 });
    usage.promptTokens += reply.usage.promptTokens;
    usage.completionTokens += reply.usage.completionTokens;
    usage.seconds += reply.usage.seconds;
    return reply.text;
  };
  const finish = (raw: IsoPicturePlan) => {
    const plan = withReadablePalette(story ? applyStory(raw, story) : raw);
    // The number filter only reads beats and screens, so an empty object list is enough.
    const checked = keepStatedNumbers({ unit: plan.unit, beats: plan.beats, objects: [] } as unknown as IsoPlan, topic);
    return { ...plan, beats: checked.beats };
  };
  const fixedStory = story
    ? `\n\nThis narration is already approved. Keep it word for word. Write exactly ${story.length} beats, one for each line, in this order. This overrides the beat count rule.\n${story.map((line, index) => `${index}. ${line}`).join('\n')}`
    : '';
  const request = `Topic: "${topic}"${fixedStory}`;
  const first = await ask(request);
  let problems: string[];
  try {
    const raw = parsePlan(first);
    problems = referencedIds(raw);
    if (!problems.length) return { plan: finish(raw), attempts: 1, firstProblems: [], usage };
  } catch (error) {
    problems = [error instanceof Error ? error.message : String(error)];
  }
  const second = await ask(`${request}\n\nYour previous answer had these problems:\n- ${problems.slice(0, 20).join('\n- ')}\n\nPrevious answer:\n${first.slice(0, 30_000)}\n\nReturn the complete corrected JSON.`);
  return { plan: dropUnknown(finish(parsePlan(second))), attempts: 2, firstProblems: problems, usage };
}

/** Each beat becomes one shot: a part box on the main picture, a detail picture, or the whole picture. */
export function pictureShots(plan: IsoPicturePlan, boxes: Record<string, ImageBox | null>, starts: number[]): ImageShot[] {
  return plan.beats.map((beat, index) => {
    const detail = plan.details.findIndex((item) => item.id === beat.focus);
    if (detail >= 0) return { from: starts[index], pose: detail + 1, box: null, label: beat.label ?? plan.details[detail].label };
    const box = beat.focus ? boxes[beat.focus] ?? null : null;
    const part = plan.parts.find((item) => item.id === beat.focus);
    return { from: starts[index], pose: 0, box, label: box ? beat.label ?? part?.label ?? null : null };
  });
}

/** Flows run through the centers of their located parts, and only during their beats. */
export function pictureFlows(plan: IsoPicturePlan, boxes: Record<string, ImageBox | null>, beats: Array<{ from: number; duration: number }>): IsoPictureFlow[] {
  return plan.flows.flatMap((flow) => {
    const points = flow.through.map((id) => boxes[id]).filter((box): box is ImageBox => Boolean(box)).map((box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 }));
    if (points.length < 2) return [];
    return flow.activeBeats.filter((beat) => beats[beat]).map((beat) => ({ points, from: beats[beat].from, to: beats[beat].from + beats[beat].duration }));
  });
}

export interface IsoPictureBuild {
  picture: IsoPicture;
  images: number;
  missing: string[];
  seconds: number;
}

/** Paints the world and its close-ups, finds the parts, and returns the data the stage plays. */
export async function buildIsoPicture(
  projectId: string,
  storyboard: Storyboard,
  plan: IsoPicturePlan,
  beats: Array<{ from: number; duration: number }>,
  locateModel: string,
): Promise<IsoPictureBuild> {
  const startedAt = Date.now();
  const canvas = await blankCanvas(storyboard.aspectRatio, plan.palette.ground);
  const world = await generateImage(worldImagePrompt(plan), storyboard.aspectRatio, canvas);
  if (!(await matchesAspect(world, storyboard.aspectRatio))) throw new Error('World picture came back in the wrong shape');
  const details = await Promise.all(plan.details.map(async (detail) => {
    const image = await generateImage(detailImagePrompt(detail), storyboard.aspectRatio, world);
    return (await matchesAspect(image, storyboard.aspectRatio)) ? image : world;
  }));

  const assetsDir = path.join(process.cwd(), 'storage', 'projects', projectId, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  const pictures = [world, ...details];
  // Repainting the strip only adds a wall corner above the same hard edge, so the camera hides it instead.
  const tops = await Promise.all(pictures.map(blankTopShare));
  const images = pictures.map((image, index) => {
    const name = index === 0 ? 'iso-world.png' : `iso-detail-${index}.png`;
    fs.writeFileSync(path.join(assetsDir, name), image);
    return `/api/projects/${projectId}/assets/${name}`;
  });

  const located = await locateObjects(locateModel, world, plan.parts.map((part) => part.find));
  const boxes = Object.fromEntries(plan.parts.map((part) => [part.id, located[part.find] ?? null]));
  const missing = plan.parts.filter((part) => !boxes[part.id]).map((part) => part.id);

  return {
    picture: {
      images,
      tops,
      shots: pictureShots(plan, boxes, beats.map((beat) => beat.from)),
      flows: pictureFlows(plan, boxes, beats),
      background: plan.palette.ground,
      accent: plan.palette.accent,
      ink: plan.palette.ink,
    },
    images: images.length,
    missing,
    seconds: (Date.now() - startedAt) / 1000,
  };
}
