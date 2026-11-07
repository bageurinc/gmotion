import { contrastRatio, COPY_ANTI_SLOP_RULES, ensureContrast, VISUAL_ANTI_SLOP_RULES } from '../pipeline/anti-slop';
import { callChat, LlmUsage } from './asset-generator';
import { IsoPlan, IsoPlanSchema, resolveIsoPlan, ResolvedIso } from './iso-world';
import { WORLD_STORY_RULES } from './world-plan';

const MAX_TOKENS = 16000;

export const ISO_PLAN_PROMPT = `You design one isometric world for a short vertical explainer, and write its timeline in casual spoken Bahasa Indonesia, as if talking to a friend.
You describe objects as data. Code draws them, computes all heights, routes pipes and cables, and moves the camera. Never compute 3D coordinates.

Output only JSON:
{
 "look": "bright",
 "unit": "%",
 "palette": {"ground":"#hex","surface":"#hex","hud":"#hex","hudText":"#hex","accent":"#hex","ink":"#hex"},
 "objects": [{"id":"kebab-id","label":"Nama pendek","shape":"box","size":[4,1,3],"color":"#hex","on":null,"x":0,"z":0}],
 "links": [{"id":"kebab-id","through":["object-a","object-b"],"color":"#hex","radius":0.14,"activeBeats":[1,2]}],
 "beats": [{"text":"one short spoken sentence","headline":"short heading for the top panel","accent":"word from the headline to highlight","value":null,"status":"short state word","clock":null,"focus":"object id or null for wide","label":"short label or null","sticker":"short sound word or null"}]
}

OBJECT RULES
- Build the subject from 14 to 34 simple solids. Enough detail to recognize the real thing, with its real proportions. The whole subject must be recognizable from its silhouette in the wide shot.
- The subject is the world. It is big and fills most of the 24 by 24 area. Add a side object only when the story talks about it. Scene decoration such as lamps, cups, and clocks is a failure.
- The outer shape must match the real thing. Use real outlines: a long rounded hull is a plate with "radius" close to half its depth, and a cutaway keeps that same outline. A plain rectangular box standing in for a curved subject is a failure.
- Code already adds the ground base under everything. Never add a table, floor, or platform object. Its material is the "surface" color.
- shape is one of: box (sharp corners), plate (rounded corners, set "radius"), cylinder, cone, wedge (a triangular roof prism).
- An abstract topic becomes a concrete place: pick real objects that show the idea working, such as shop shelves for prices.
- A story that moves between places lays them out as neighboring areas of one world.
- size is [width along x, height, depth along z] in world units. The whole world fits within about 24 by 24 units. Small details are at least 0.3 wide.
- "on" is the id of the object this one rests on, or null if it stands on the ground. A parent must come before its children in the list.
- x and z are offsets from the parent's center, or from the world center when "on" is null.
- Objects on the same surface must not overlap. Add up their sizes before you pick x and z.
- A child must fit on its parent. The child's size must be smaller than the parent's.
- Optional "axis": "x", "y", or "z" lays a cylinder or cone along that axis, with size as its bounding box. A cone points toward the positive axis.
- Optional "wall": a thickness that turns a box or plate into an open tray. Children sit on the tray floor between the walls.
- Optional "lid": true on an object resting on a tray makes it a cover with the tray's footprint. Code opens it on the first beat that focuses on something inside.
- Optional "liftAtBeat": a beat index where this object and its children rise away to reveal what is underneath.
- The camera looks from the +x +z corner. Tall objects near +x +z hide what stands behind them, so put tall objects toward -x -z and keep what the story needs visible.

LINK RULES
- A link is a pipe, cable, belt, or road between objects. "through" lists the ids it connects, in flow order.
- activeBeats lists the beat indexes when movement flows along it. Use links only where something really flows.

STORY RULES
${WORLD_STORY_RULES}
- The camera travels: at most two beats in a row share a focus. Use wide shots (focus null) only for the opening and ending.
- focus names an object big enough to see, not a tiny detail.
- Use a sticker on at most 2 beats, written in Bahasa Indonesia.
- value and clock show a number on the top panel. Use one only when that exact number is spoken in the narration or written in the topic. Otherwise they are null. Never invent a number.

COLOR RULES
- look is "bright" or "dark". Decide it from where the topic really happens. Everyday scenes, homes, daylight, food, nature, cities, and offices are bright. Choose dark only when the place itself is dark, such as the deep sea, space, a cave, or night.
- With look "bright", ground and surface are light colors. With look "dark", ground and surface are dark colors.
- Tailwind slate, zinc, and navy tones such as #0f172a, #1e293b, #334155, and #475569 are a habit, not a material. Name the real material first, then pick its color.
- ground is behind the world, surface is the base the objects stand on, hud is a strong panel color, hudText reads on hud, accent stands out on hud and is reserved for what is being explained, and ink is a dark color.
- Object colors come from real materials. Neighboring objects need visibly different colors, or the subject turns into one flat mass.

${VISUAL_ANTI_SLOP_RULES}
${COPY_ANTI_SLOP_RULES}`;

export interface IsoPlanResult {
  plan: IsoPlan;
  resolved: ResolvedIso;
  attempts: number;
  /** Why the first answer was rejected, for reports. */
  firstProblems: string[];
  usage: LlmUsage;
}

function parsePlan(text: string): IsoPlan {
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) throw new Error('Answer was not JSON');
  return IsoPlanSchema.parse(JSON.parse(json[0]));
}

/** Approved narration always wins, and every line gets exactly one beat. */
export function applyStory(plan: IsoPlan, story: string[]): IsoPlan {
  return {
    ...plan,
    beats: story.map((text, index) => ({
      ...(plan.beats[index] ?? { headline: text.slice(0, 60), accent: '', value: null, status: '', clock: null, focus: null, label: null, sticker: null }),
      text,
    })),
  };
}

const NUMBERS = /\d+(?:[.,]\d+)?/g;
/** A whole token that holds a digit, so "0-80%" leaves no stray symbols behind. */
const NUMBER_TOKENS = /[^\s]*\d[^\s]*/g;

/** The panel pairs a value with one unit, so "14 hari" must not become "14 %". */
function isStatedWithUnit(value: number, unit: string, source: string): boolean {
  const units = unit === '%' ? '(?:%|persen)' : unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\d.,])${value}\\s*${units}`, 'i').test(source);
}

/** The panel may only repeat numbers the user or the narration actually stated. */
export function keepStatedNumbers(plan: IsoPlan, topic: string): IsoPlan {
  const source = `${topic} ${plan.beats.map((beat) => beat.text).join(' ')}`;
  const stated = new Set(source.match(NUMBERS) ?? []);
  const isStated = (text: string) => (text.match(NUMBERS) ?? []).every((number) => stated.has(number));
  return {
    ...plan,
    beats: plan.beats.map((beat) => ({
      ...beat,
      value: beat.value !== null && isStatedWithUnit(beat.value, plan.unit, source) ? beat.value : null,
      clock: beat.clock && isStated(beat.clock) ? beat.clock : null,
      headline: isStated(beat.headline)
        ? beat.headline
        : beat.headline.replace(NUMBER_TOKENS, (token) => (isStated(token) ? token : '')).replace(/\s+/g, ' ').trim() || beat.status || 'Lihat bagian ini',
      label: beat.label && !isStated(beat.label) ? null : beat.label,
      status: isStated(beat.status) ? beat.status : '',
    })),
  };
}

function withReadablePalette(plan: IsoPlan): IsoPlan {
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

/**
 * Asks for a world, gives the model one chance to fix its own mistakes, and then repairs
 * what is left. Repairs are listed in `resolved.warnings`, so a caller can report them.
 */
export async function generateIsoPlan(model: string, topic: string, story?: string[]): Promise<IsoPlanResult> {
  const usage: LlmUsage = { promptTokens: 0, completionTokens: 0, seconds: 0 };
  const ask = async (content: string) => {
    const reply = await callChat({ model, system: ISO_PLAN_PROMPT, content, maxTokens: MAX_TOKENS });
    usage.promptTokens += reply.usage.promptTokens;
    usage.completionTokens += reply.usage.completionTokens;
    usage.seconds += reply.usage.seconds;
    return reply.text;
  };

  const finish = (raw: IsoPlan) => keepStatedNumbers(withReadablePalette(story ? applyStory(raw, story) : raw), topic);
  const fixedStory = story
    ? `\n\nThis narration is already approved. Keep it word for word. Write exactly ${story.length} beats, one for each line, in this order. This overrides the beat count rule.\n${story.map((line, index) => `${index}. ${line}`).join('\n')}`
    : '';
  const request = `Topic: "${topic}"${fixedStory}`;
  const first = await ask(request);
  let problems: string[];
  try {
    const raw = parsePlan(first);
    const plan = finish(raw);
    const resolved = resolveIsoPlan(plan);
    const countProblem = story && raw.beats.length !== story.length ? [`Write exactly ${story.length} beats, not ${raw.beats.length}`] : [];
    problems = [...countProblem, ...resolved.errors];
    if (!problems.length) return { plan, resolved, attempts: 1, firstProblems: [], usage };
  } catch (error) {
    problems = [error instanceof Error ? error.message : String(error)];
  }

  const second = await ask(`${request}\n\nYour previous answer had these problems:\n- ${problems.slice(0, 30).join('\n- ').slice(0, 6000)}\n\nPrevious answer:\n${first.slice(0, 60_000)}\n\nReturn the complete corrected JSON.`);
  const plan = finish(parsePlan(second));
  return { plan, resolved: resolveIsoPlan(plan, { repair: true }), attempts: 2, firstProblems: problems, usage };
}
