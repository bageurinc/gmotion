import { z } from 'zod';
import { COPY_ANTI_SLOP_RULES, contrastRatio, ensureContrast } from '@/lib/pipeline/anti-slop';
import { callChat, type LlmUsage } from '../asset-generator';
import { keepStatedNumbers } from '../iso-plan';
import { IsoBeatSchema, type IsoPlan } from '../iso-world';
import { WORLD_STORY_RULES } from '../world-plan';
import { writeUntilValid } from './writer';

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Id = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
const StateKey = z.string().regex(/^[a-z][a-zA-Z0-9]{0,23}$/);
const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const IsoCanvasPlanSchema = z.object({
  look: z.enum(['bright', 'dark']),
  unit: z.string().max(6),
  palette: z.object({ ground: HexColor, hud: HexColor, hudText: HexColor, accent: HexColor, ink: HexColor }),
  background: z.object({ top: HexColor, bottom: HexColor }),
  setting: z.string().min(20).max(1500),
  objects: z.array(z.object({
    id: Id,
    label: z.string().min(1).max(24),
    look: z.string().min(20).max(900),
    size: Vec3,
    at: Vec3,
    states: z.array(z.object({ key: StateKey, meaning: z.string().min(3).max(160) })).max(3),
    /**
     * Set only by chat revisions: the object travels from `at` (state 0) to `to` (state 1) as
     * state `key` changes. The engine moves it, so the object's own code never has to.
     */
    path: z.object({ key: StateKey, to: Vec3 }).optional(),
  })).min(1).max(5),
  details: z.array(z.object({ id: Id, label: z.string().min(1).max(24), draw: z.string().min(20).max(900), objects: z.array(Id).max(3) })).max(2),
  beats: z.array(IsoBeatSchema.extend({
    set: z.array(z.object({
      object: Id,
      key: StateKey,
      value: z.number().min(0).max(1),
      /** Set only by chat revisions: scene seconds the change starts and how long it eases. */
      at: z.number().min(0).max(60).optional(),
      over: z.number().min(0.1).max(60).optional(),
    })).max(4),
    /** Set only by chat revisions ("closer", "wider"): multiplies the fitted zoom of the shot. */
    zoomScale: z.number().min(0.4).max(2.5).optional(),
  })).min(1).max(14),
});

export type IsoCanvasPlan = z.infer<typeof IsoCanvasPlanSchema>;
export type IsoCanvasObject = IsoCanvasPlan['objects'][number];
export type IsoCanvasDetail = IsoCanvasPlan['details'][number];

export const ISO_CANVAS_PLAN_PROMPT = `You plan a short vertical explainer video set in ONE isometric world drawn with simple 3D shapes in code, and write its timeline in casual spoken Bahasa Indonesia.
Programmers then write one drawing function per object, one for the world around them, and one per close-up. A camera moves between your objects; a headline panel covers the top of the frame.

Output only JSON:
{
 "look": "bright",
 "unit": "%",
 "palette": {"ground":"#hex","hud":"#hex","hudText":"#hex","accent":"#hex","ink":"#hex"},
 "background": {"top":"#hex","bottom":"#hex"},
 "setting": "English: the place, the ground, what surrounds the objects, and how they are arranged",
 "objects": [{"id":"kebab-id","label":"Nama pendek","look":"English: real shape, proportions, characteristic parts, colors, materials","size":[w,d,h],"at":[x,y,z],"states":[{"key":"camelCase","meaning":"English: what 0 and 1 look like"}]}],
 "details": [{"id":"kebab-id","label":"Nama pendek","draw":"English: what this close-up or cutaway shows","objects":["object-id"]}],
 "beats": [{"text":"one short spoken sentence","headline":"short heading for the top panel","accent":"word from the headline to highlight","value":null,"status":"short state word","clock":null,"focus":"object id, detail id, or null for wide","label":"short label or null","sticker":"short sound word or null","set":[{"object":"object-id","key":"stateKey","value":1}]}]
}

WORLD RULES
- The world shows the subject where it really exists, in its real context: a phone on a real desk or in a hand, an engine inside its car, a heart inside a chest seen as a cutaway, a bee among flowers.
- Units are meters. size is [width along x, depth along y, height] of the object's bounding box. at is where the centre of its footprint stands. Objects that touch in real life touch here; keep the whole world within about 12 meters so the camera can show it.
- Objects are the things the story points at: 1 to 5. Each look describes the real thing so a programmer can model it from boxes, cylinders, cones, extruded profiles, spheres, and tubes, with the parts that make it recognizable.
- states are numbers from 0 to 1 that change what the object shows, such as a fan spinning, a lid open, a light on, a battery level, or blood flowing. Use them only where the story changes something.
- details are close-ups for things too small or hidden to read in the world, such as the chip inside a phone. 0 to 2.
- Never describe sky, a horizon, or distant scenery; the ground or floor fills the view.
- Vehicles, devices, and products are generic and unbranded.

STORY RULES
${WORLD_STORY_RULES}
- The camera travels: at most two beats in a row share a focus. Use wide shots (focus null) only for the opening and ending.
- A beat's focus explains its line alone, so pick the object or detail the line is about.
- set lists state changes that happen during that beat and stay afterwards. Show what the line says.
- label names the focused thing in at most 3 words taken from the line itself, or null.
- Use a sticker on at most 2 beats, written in Bahasa Indonesia.
- value and clock show a number on the top panel. Use one only when that exact number is spoken in the narration or written in the topic. Otherwise they are null. Never invent a number.

COLOR RULES
- look is "bright" or "dark", decided from where the topic really happens. Choose dark only when the place itself is dark, such as the deep sea, space, a cave, or night.
- background is the canvas behind the ground, usually a soft tone near the ground color. hud is a strong panel color, hudText reads on hud, accent stands out on hud, and ink is a dark color.

${COPY_ANTI_SLOP_RULES}`;

/** Ids a plan refers to that it never defines. */
export function planProblems(plan: IsoCanvasPlan, sceneCount: number): string[] {
  const problems: string[] = [];
  const objects = new Map(plan.objects.map((object) => [object.id, object]));
  const details = new Set(plan.details.map((detail) => detail.id));
  if (new Set([...objects.keys(), ...details]).size !== objects.size + details.size) problems.push('Object and detail ids must all be different.');
  if (plan.beats.length !== sceneCount) problems.push(`Write exactly ${sceneCount} beats, one for each narration line.`);
  plan.beats.forEach((beat, index) => {
    if (beat.focus && !objects.has(beat.focus) && !details.has(beat.focus)) problems.push(`beats[${index}].focus "${beat.focus}" is not an object or detail id.`);
    for (const change of beat.set) {
      const object = objects.get(change.object);
      if (!object) problems.push(`beats[${index}].set uses unknown object "${change.object}".`);
      else if (!object.states.some((state) => state.key === change.key)) problems.push(`beats[${index}].set uses state "${change.key}" that object "${change.object}" does not define.`);
    }
  });
  plan.details.forEach((detail) => detail.objects.forEach((id) => {
    if (!objects.has(id)) problems.push(`details "${detail.id}" uses unknown object "${id}".`);
  }));
  plan.objects.forEach((object) => {
    if (object.size.some((value) => value <= 0 || value > 40)) problems.push(`objects "${object.id}" size must be between 0 and 40 meters.`);
    if (object.at.some((value) => Math.abs(value) > 30)) problems.push(`objects "${object.id}" at must stay within 30 meters of the origin.`);
  });
  return problems;
}

const words = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean);

/**
 * Keeps a label only when its words come from the line, the topic, or the focused thing's
 * own name, so labels never add facts the narration does not say.
 */
export function keepGroundedLabels(plan: IsoCanvasPlan, topic: string): IsoCanvasPlan {
  const names = new Map([...plan.objects, ...plan.details].map((item) => [item.id, item.label]));
  return {
    ...plan,
    beats: plan.beats.map((beat) => {
      if (!beat.label) return beat;
      const source = new Set(words(`${beat.text} ${topic} ${beat.focus ? names.get(beat.focus) ?? '' : ''}`));
      const grounded = words(beat.label).every((word) => source.has(word) || word.length <= 2);
      return grounded ? beat : { ...beat, label: null };
    }),
  };
}

function readable(plan: IsoCanvasPlan): IsoCanvasPlan {
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

/** Approved narration wins word for word; unknown focus ids fall back to a wide shot. */
export function finishPlan(raw: IsoCanvasPlan, story: string[], topic: string): IsoCanvasPlan {
  const known = new Set([...raw.objects.map((object) => object.id), ...raw.details.map((detail) => detail.id)]);
  const objects = new Map(raw.objects.map((object) => [object.id, object]));
  const withStory: IsoCanvasPlan = {
    ...raw,
    beats: story.map((text, index) => {
      const beat = raw.beats[index] ?? { headline: text.slice(0, 60), accent: '', value: null, status: '', clock: null, focus: null, label: null, sticker: null, set: [] };
      return {
        ...beat,
        text,
        focus: beat.focus && known.has(beat.focus) ? beat.focus : null,
        set: beat.set.filter((change) => objects.get(change.object)?.states.some((state) => state.key === change.key)),
      };
    }),
  };
  const numbers = keepStatedNumbers({ unit: withStory.unit, beats: withStory.beats, objects: [] } as unknown as IsoPlan, topic);
  const beats = withStory.beats.map((beat, index) => ({ ...beat, ...numbers.beats[index], set: beat.set }));
  return keepGroundedLabels(readable({ ...withStory, beats }), topic);
}

export function parseCanvasPlan(text: string): IsoCanvasPlan | null {
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) return null;
  try {
    const parsed = IsoCanvasPlanSchema.safeParse(JSON.parse(json[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface IsoCanvasPlanResult {
  plan: IsoCanvasPlan;
  attempts: number;
  notes: string[];
  usage: LlmUsage;
}

export async function generateIsoCanvasPlan(model: string, topic: string, story: string[]): Promise<IsoCanvasPlanResult> {
  const usage: LlmUsage = { promptTokens: 0, completionTokens: 0, seconds: 0 };
  const request = `Topic: "${topic}"\n\nThis narration is already approved. Keep it word for word. Write exactly ${story.length} beats, one for each line, in this order.\n${story.map((line, index) => `${index}. ${line}`).join('\n')}`;
  let schemaError = '';
  const result = await writeUntilValid({
    ask: async (feedback) => {
      const reply = await callChat({ model, system: ISO_CANVAS_PLAN_PROMPT, content: request + (schemaError ? `\n\nThe previous JSON did not match the format: ${schemaError}` : '') + feedback, maxTokens: 10_000 });
      usage.promptTokens += reply.usage.promptTokens;
      usage.completionTokens += reply.usage.completionTokens;
      usage.seconds += reply.usage.seconds;
      return reply.text;
    },
    parse: (text) => {
      const json = text.match(/\{[\s\S]*\}/);
      if (!json) return null;
      try {
        const parsed = IsoCanvasPlanSchema.safeParse(JSON.parse(json[0]));
        if (parsed.success) return parsed.data;
        schemaError = parsed.error.issues.slice(0, 12).map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
        return null;
      } catch (error) {
        schemaError = String(error instanceof Error ? error.message : error).slice(0, 300);
        return null;
      }
    },
    check: (plan) => planProblems(plan, story.length),
    show: (plan) => JSON.stringify(plan),
    attempts: 3,
  });
  if (!result.value) throw new Error(`Rencana dunia gagal dibuat: ${result.problems.join('; ')}`);
  // Leftover reference problems are repaired by finishPlan (wide shots, dropped state changes).
  return { plan: finishPlan(result.value, story, topic), attempts: result.attempts, notes: result.notes, usage };
}
