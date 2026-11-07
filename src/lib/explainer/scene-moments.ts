import { z } from 'zod';
import type { ImageBox, ImageShot } from '../../motion-kit/explainer/image-camera';
import type { Storyboard, WordTiming } from '../../types/studio';
import { COPY_ANTI_SLOP_RULES, VISUAL_ANTI_SLOP_RULES } from '../pipeline/anti-slop';
import { callChat } from './asset-generator';

const MIN_MOMENT_GAP_SECONDS = 1.6;
const MAX_SHOT_SECONDS = 4;
/** Each state is one paid picture, so this bounds the image cost of a scene. */
export const MAX_SCENE_STATES = 2;
/** Gemini answers boxes on a 0 to 1000 scale, even when asked for fractions. */
const GEMINI_BOX_SCALE = 1000;
const MIN_BOX_SIZE = 0.03;
const FALLBACK_SECONDS_PER_MOMENT = 3;

const MomentSchema = z.object({
  phrase: z.string().min(1).max(80),
  pose: z.number().int().min(0).max(2),
  focus: z.string().max(60).nullable(),
  label: z.string().max(24).nullable(),
});

const ScenePlanSchema = z.object({
  kind: z.enum(['image', 'svg']),
  reason: z.string().max(160),
  poses: z.array(z.string().min(1).max(400)).max(3),
  moments: z.array(MomentSchema).max(8),
});

const MomentPlanSchema = z.object({ scenes: z.array(ScenePlanSchema) });

export type ScenePlan = z.infer<typeof ScenePlanSchema>;
export type Moment = z.infer<typeof MomentSchema>;

export const MOMENT_SYSTEM_PROMPT = `You plan how each scene of a short explainer video changes on screen, so the viewer is never left with a still picture and always understands what is being said.

Output only JSON:
{"scenes":[{"kind":"image","reason":"why","poses":["what picture 1 shows","what picture 2 shows"],"moments":[{"phrase":"exact words from the narration","pose":0,"focus":"object to point at, or null","label":"short label or null"}]}]}

CHOOSING kind
- "image" draws a finished illustration. Use it when the subject is hard to draw from shapes: hands, faces, bodies, animals, plants, food, or places.
- "svg" builds the drawing from parts that can move on their own. Use it for diagrams, molecules, mechanisms, flows, and invisible processes that must be seen moving.
- Choose per scene from what that scene must show. Do not default to one kind.

MOMENTS for "image" scenes
- A moment is a change that happens exactly when the narration says something. Give one moment for about every 3 seconds of narration.
- phrase is copied word for word from that scene's narration, and it is the words at which the change happens.
- poses lists exactly 2 states of ONE picture, the second one step further along what the narration says. The viewer watches the same picture change.
- poses[0] describes the whole picture. poses[1] describes ONLY what changes from poses[0], in one short sentence, such as "the germs on the surface are gone". It never describes a new scene, a new angle, or a new subject.
- Choose changes that can be seen in the same framing: something appears, disappears, moves, fills, or changes color.
- pose is the index of the picture shown from that moment on. Poses advance in order.
- focus names one clearly visible object in that picture, so the camera moves to it and marks it. Use null to show the whole picture.
- label is 1 to 3 Indonesian words naming what is marked, or null.
- Consecutive moments must change something different. Never repeat the same move.

MOMENTS for "svg" scenes
- poses and moments stay empty, because that scene is animated separately.

${VISUAL_ANTI_SLOP_RULES}
${COPY_ANTI_SLOP_RULES}`;

export async function planSceneMoments(model: string, storyboard: Storyboard): Promise<ScenePlan[]> {
  const scenes = storyboard.scenes
    .map((scene, index) => `Scene ${index + 1} (${(scene.durationInFrames / storyboard.fps).toFixed(1)} seconds)\nNarration: ${scene.voiceoverText}\nVisual direction: ${scene.visualPrompt}`)
    .join('\n\n');
  const { text } = await callChat({
    model,
    system: MOMENT_SYSTEM_PROMPT,
    content: `Video: "${storyboard.title}"\n\n${scenes}\n\nReturn exactly ${storyboard.scenes.length} scenes in this order.`,
    maxTokens: 12000,
  });
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) throw new Error('Moment plan was not JSON');
  const { scenes: plans } = MomentPlanSchema.parse(JSON.parse(json[0]));
  if (plans.length !== storyboard.scenes.length) throw new Error(`Moment plan has ${plans.length} scenes`);
  return plans;
}

const normalizeWord = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Index of the word where a phrase starts, or -1 when the narration does not hold it. */
export function findPhraseStart(words: WordTiming[], phrase: string): number {
  const wanted = phrase.split(/\s+/).map(normalizeWord).filter(Boolean);
  if (!wanted.length) return -1;
  const spoken = words.map((word) => normalizeWord(word.word));
  return spoken.findIndex((_, start) => wanted.every((word, offset) => spoken[start + offset] === word));
}

/** Places each moment on the frame where its words are spoken. Unmatched moments are spread evenly. */
export function momentFrames(moments: Moment[], words: WordTiming[], durationInFrames: number, fps: number): number[] {
  const minGap = Math.round(MIN_MOMENT_GAP_SECONDS * fps);
  const lastStart = Math.max(0, durationInFrames - minGap);
  let previous = -minGap;
  return moments.map((moment, index) => {
    const start = findPhraseStart(words, moment.phrase);
    const wanted = start >= 0
      ? Math.round((words[start].startMs / 1000) * fps)
      : Math.round((index * durationInFrames) / moments.length);
    const frame = index === 0 ? 0 : Math.min(lastStart, Math.max(wanted, previous + minGap));
    previous = frame;
    return frame;
  });
}

/** Number of moments a scene needs so it never sits still. */
export const expectedMoments = (durationInFrames: number, fps: number) =>
  Math.max(1, Math.round(durationInFrames / fps / FALLBACK_SECONDS_PER_MOMENT));

export function normalizeBox(raw: { x: number; y: number; w: number; h: number }): ImageBox | null {
  const scale = Math.max(raw.x, raw.y, raw.w, raw.h) > 1.5 ? GEMINI_BOX_SCALE : 1;
  const x = Math.min(1, Math.max(0, raw.x / scale));
  const y = Math.min(1, Math.max(0, raw.y / scale));
  const w = Math.min(1 - x, raw.w / scale);
  const h = Math.min(1 - y, raw.h / scale);
  return w >= MIN_BOX_SIZE && h >= MIN_BOX_SIZE ? { x, y, w, h } : null;
}

const LocateSchema = z.object({
  imageVisible: z.boolean(),
  boxes: z.record(z.string(), z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).nullable()),
});

/** Finds objects in a picture. Anything it cannot place stays null, and that moment shows the whole picture. */
export async function locateObjects(model: string, image: Buffer, names: string[]): Promise<Record<string, ImageBox | null>> {
  if (!names.length) return {};
  const { text } = await callChat({
    model,
    system: 'You locate objects in an image. Output only JSON.',
    maxTokens: 3000,
    content: [
      { type: 'text', text: `Give a tight bounding box from the top-left corner for each object. Use null for an object that is not visible.\nObjects: ${JSON.stringify(names)}\nOutput {"imageVisible":true,"boxes":{"object name":{"x":0,"y":0,"w":0,"h":0}}}` },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${image.toString('base64')}` } },
    ],
  });
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) return {};
  const located = LocateSchema.safeParse(JSON.parse(json[0]));
  if (!located.success || !located.data.imageVisible) return {};
  return Object.fromEntries(Object.entries(located.data.boxes).map(([name, box]) => [name, box ? normalizeBox(box) : null]));
}

/** Breaks up long holds with a camera move, so no shot outlasts the viewer's attention. */
export function fillLongShots(shots: ImageShot[], durationInFrames: number, fps: number): ImageShot[] {
  const longest = MAX_SHOT_SECONDS * fps;
  return shots.flatMap((shot, index) => {
    const end = shots[index + 1]?.from ?? durationInFrames;
    const pieces = Math.ceil((end - shot.from) / longest);
    return Array.from({ length: pieces }, (_, piece) => (piece === 0
      ? shot
      : { from: shot.from + Math.round(((end - shot.from) * piece) / pieces), pose: shot.pose, box: piece % 2 === 0 ? shot.box : null, label: null }));
  });
}

export function buildImageShots(
  moments: Moment[],
  frames: number[],
  boxes: Array<Record<string, ImageBox | null>>,
  poseCount: number
): ImageShot[] {
  return moments.map((moment, index) => {
    const pose = Math.min(moment.pose, poseCount - 1);
    const box = moment.focus ? boxes[pose]?.[moment.focus] ?? null : null;
    return { from: frames[index], pose, box, label: box ? moment.label : null };
  });
}
