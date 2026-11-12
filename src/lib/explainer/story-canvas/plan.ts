import { z } from 'zod';
import { COPY_ANTI_SLOP_RULES, contrastRatio, ensureContrast } from '@/lib/pipeline/anti-slop';
import { callChat, type LlmUsage } from '../asset-generator';
import { keepStatedNumbers } from '../iso-plan';
import type { IsoPlan } from '../iso-world';
import { writeUntilValid } from '../iso-canvas/writer';

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Id = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
const StateKey = z.string().regex(/^[a-z][a-zA-Z0-9]{0,23}$/);
const Pose = z.enum(['stand', 'point', 'explain', 'hold', 'aim', 'raiseHand', 'crossArms', 'sit', 'lookUp', 'bend', 'crouch', 'kneel', 'phone', 'wash', 'wave', 'lie']);
const Face = z.enum(['smile', 'neutral', 'open', 'worried', 'surprised']);
const HairStyle = z.enum(['short', 'long', 'bun', 'curly', 'bald', 'hijab', 'cap', 'caping']);

/**
 * A list the plan may overfill: extra items are dropped instead of failing the whole plan,
 * because a long list (a heart with five states) is a richer plan, not a broken one. The first
 * job on the heart topic failed three times over a fourth state.
 */
const capped = <T extends z.ZodTypeAny>(item: T, max: number) => z.preprocess((value) => (Array.isArray(value) ? value.slice(0, max) : value), z.array(item));
/** A short text the plan may overrun; it is cut instead of failing the plan. */
const clipped = (max: number) => z.preprocess((value) => (typeof value === 'string' ? value.slice(0, max) : value), z.string());
const States = capped(z.object({ key: StateKey, meaning: z.string().min(3).max(160) }), 6);

export const StoryCanvasPlanSchema = z.object({
  look: z.enum(['bright', 'dark']),
  unit: z.string().max(6),
  palette: z.object({ ground: HexColor, hud: HexColor, hudText: HexColor, accent: HexColor, ink: HexColor }),
  cast: capped(z.object({
    id: Id,
    label: z.string().min(1).max(24),
    height: z.number().min(0.8).max(2),
    skin: HexColor,
    hair: HexColor,
    hairStyle: HairStyle,
    top: HexColor,
    bottom: HexColor,
    shoes: HexColor,
    sleeves: z.enum(['short', 'long']).nullable().optional(),
    outfit: z.enum(['pants', 'skirt']).nullable().optional(),
    apron: HexColor.nullable().optional(),
    coat: HexColor.nullable().optional(),
    glasses: z.boolean().nullable().optional(),
  }), 3),
  places: z.array(z.object({
    id: Id,
    label: z.string().min(1).max(24),
    look: z.string().min(20).max(1200),
    /** Width of the place in meters at its real scale; props and people stand between 0 and width. */
    width: z.number().min(0.01).max(20_000),
    /** Numbers 0..1 that change the whole setting per beat (the sky darkens, a far volcano erupts). */
    states: States.optional(),
  })).min(1).max(3),
  props: z.array(z.object({
    id: Id,
    label: z.string().min(1).max(24),
    look: z.string().min(20).max(900),
    /** [width, height] in meters. */
    size: z.tuple([z.number(), z.number()]),
    place: Id,
    /** Where the base centre stands: [x, y] in the place, y = 0 on the floor, higher on a counter. */
    at: z.tuple([z.number(), z.number()]),
    /** Height of the top a person sits or lies on (a chair seat, a bed), or null. */
    surface: z.number().min(0.1).max(1.5).nullable().optional(),
    front: z.boolean().nullable().optional(),
    /** True for things that move on their own (a beating heart, a fan, water, fire, a leaf): they must never freeze. */
    moves: z.boolean().nullable().optional(),
    states: States,
    /** Named regions the narration points at (a chamber, a valve, a root); the writer exports where they are. */
    parts: capped(z.object({ id: Id, label: z.string().min(1).max(24) }), 8).optional(),
    /** Named flows inside the prop (blood to the lungs, water to the tap); the writer exports their paths. */
    flows: capped(z.object({ id: Id, label: z.string().min(1).max(32), meaning: z.string().min(3).max(200) }), 6).optional(),
    /** Components a correct drawing of the real thing must show (English); the writer draws and the critic checks each. */
    must: capped(clipped(80), 12).optional(),
  })).min(1).max(8),
  details: capped(z.object({ id: Id, label: z.string().min(1).max(24), draw: z.string().min(20).max(900), props: capped(Id, 3) }), 4),
  beats: z.array(z.object({
    text: z.string(),
    headline: clipped(80),
    accent: clipped(40),
    value: z.number().nullable(),
    status: clipped(40),
    clock: clipped(12).nullable(),
    sticker: clipped(24).nullable(),
    place: Id,
    /** Prop, cast, or detail id the line is about, or null for the whole place. */
    focus: Id.nullable(),
    /** A part of the focused prop to frame. */
    part: Id.nullable().optional(),
    /** A flow of the focused prop for the camera to follow (with move 'follow'). */
    flow: Id.nullable().optional(),
    /** How tight the shot is: the whole group, the part with some context, or the part alone. */
    shot: z.enum(['wide', 'medium', 'close']).nullable().optional(),
    /** How the camera moves: travel from the last shot and push in, ride along a flow, pull back to reveal, or cut. */
    move: z.enum(['push', 'follow', 'pull', 'cut']).nullable().optional(),
    label: clipped(40).nullable(),
    actors: capped(z.object({
      cast: Id,
      x: z.number(),
      facing: z.union([z.literal(1), z.literal(-1)]),
      pose: Pose,
      poseTo: Pose.nullable().optional(),
      walkTo: z.number().nullable().optional(),
      /** Prop id the person sits or lies on; the engine places the person on it. */
      on: Id.nullable().optional(),
      hold: Id.nullable().optional(),
      face: Face.nullable().optional(),
    }), 3),
    /** State changes of a prop or of a place (the field is named prop for both). */
    set: capped(z.object({ prop: Id, key: StateKey, value: z.number().min(0).max(1), word: clipped(40).nullable().optional() }), 8),
    /** The spoken word the camera arrives on and the label appears with. */
    cue: clipped(40).nullable().optional(),
  })).min(1).max(14),
});

export type StoryCanvasPlan = z.infer<typeof StoryCanvasPlanSchema>;
export type StoryCanvasProp = StoryCanvasPlan['props'][number];
export type StoryCanvasPlace = StoryCanvasPlan['places'][number];
export type StoryCanvasDetail = StoryCanvasPlan['details'][number];
export type StoryCanvasBeat = StoryCanvasPlan['beats'][number];

export const STORY_CANVAS_PLAN_PROMPT = `You plan a short vertical explainer video drawn as flat 2D illustrations in code, and write its timeline in casual spoken Bahasa Indonesia.
Programmers then write one drawing function per place and per prop; the engine moves the camera and, only when your plan has people, draws them on a fixed skeleton. A headline panel covers the top of the frame.

Show what the topic is really about, as creatively as a top explainer channel would: a heart topic shows the heart and its chambers, a volcano topic shows the volcano erupting at its real size, a phone battery topic shows the battery cells. People appear only when the topic asks for them or a human action is the point of the story (cooking, farming, a habit like using a phone in bed). Many videos have no people at all.

Output only JSON:
{
 "look": "bright",
 "unit": "%",
 "palette": {"ground":"#hex","hud":"#hex","hudText":"#hex","accent":"#hex","ink":"#hex"},
 "cast": [],
 "places": [{"id":"kebab-id","label":"Nama tempat","look":"English: the setting, its background, far scenery, the ground or base line, and fixed parts with x positions","width":5,"states":[{"key":"camelCase","meaning":"English: what 0 and 1 look like"}]}],
 "props": [{"id":"kebab-id","label":"Nama pendek","look":"English: real shape, proportions, characteristic parts, colors","size":[w,h],"place":"place-id","at":[x,y],"surface":null,"front":false,"moves":true,"states":[{"key":"camelCase","meaning":"English: what 0 and 1 look like"}],"parts":[{"id":"kebab-id","label":"Nama bagian"}],"flows":[{"id":"kebab-id","label":"Nama aliran","meaning":"English: what flows, from where to where, and how it changes on the way"}],"must":["English: a component the real thing has"]}],
 "details": [{"id":"kebab-id","label":"Nama pendek","draw":"English: what this close-up or cutaway shows","props":["prop-id"]}],
 "beats": [{"text":"one short spoken sentence","headline":"short heading for the top panel","accent":"word from the headline to highlight","value":null,"status":"short state word","clock":null,"sticker":null,"place":"place-id","focus":"prop, cast, or detail id, or null","part":"part id of the focused prop or null","flow":"flow id or null","shot":"wide","move":"push","label":"short label or null","actors":[],"set":[{"prop":"prop-or-place-id","key":"stateKey","value":1,"word":"word from the line"}],"cue":"word from the line or null"}]
}
A cast member, only when people are needed: {"id":"kebab-id","label":"Nama peran","height":1.65,"skin":"#hex","hair":"#hex","hairStyle":"short","top":"#hex","bottom":"#hex","shoes":"#hex","sleeves":"long","outfit":"pants","apron":null,"coat":null,"glasses":false}
An actor in a beat: {"cast":"cast-id","x":1.2,"facing":1,"pose":"stand","poseTo":"point","walkTo":null,"on":null,"hold":null,"face":"smile"}

SCENE RULES
- Seen from the side or as a flat cutaway. Units are meters at the REAL scale of the subject: a heart is about 0.12 m, a phone 0.15 m, a room 5 m, a volcano 2000 m. In each place x runs from 0 to width and y = 0 is the ground, floor, or base line. The camera zooms to whatever size you choose, so never shrink a big thing or enlarge a small one to fit next to something else.
- When a process spans a landscape or more (the water cycle, weather, a river to the sea, electricity from a plant to a home), make the place a compact cross-section diagram: the stages sit next to each other within about 1.5 frame widths and stacked in height (sky and clouds above, land and sea below), not a real-scale map where everything becomes a thin strip.
- 1 to 3 places. A place is the setting at its own scale: a kitchen, a rice field, the inside of a chest, the sea floor, a coastline with a volcano, outer space. Each look describes it so a programmer can draw it: background, far scenery, the base line, and fixed parts with where they stand.
- Place states (0 to 1) change the whole setting per beat: the sky turns dark with ash, night falls, the water rises, the background glows red. Use them for anything too big to be a prop.
- props are the things the story points at: 1 to 8, each at its real size. size is [width, height] in meters; at is where its base centre stands, [x, y]. surface is the height of a seat or bed top a person sits or lies on, otherwise null. front: true only for a prop drawn in front of people.
- parts name the regions of a prop the narration talks about (the right atrium, a valve, the compressor, a root tip), and flows name what moves through it (blood from the body to the right atrium, refrigerant through the coils, water up the stem). The programmer draws them and exports where they are, so the camera can visit them. A prop the story explains in steps needs parts for each step.
- must lists 6 to 12 components a correct, expert drawing of the real thing shows, in English, as a textbook illustration would: a heart has the four chambers, the septum, the tricuspid and mitral valves, the aortic and pulmonary valves, the aorta arch with its branches, the pulmonary trunk, the venae cavae, the pulmonary veins, coronary vessels; a fridge has the cabinet and door seal, shelves, the compressor, the condenser coil on the back, the capillary tube, the evaporator inside, the refrigerant line. The programmer draws every one, and a reviewer checks them.
- When what flows changes on the way (blood turns from blue to red in the lungs, hot gas cools into liquid in the condenser, water turns to vapour), say so in the flow meaning, so the drawing shows the change.
- moves is true for a prop that is alive or working and so moves on its own all the time (a beating heart, lungs, a spinning fan, flowing water, fire, a running engine, swaying plants). Its drawing never freezes; states only make the motion stronger or weaker.
- Prop states (0 to 1) change what a prop shows (valves open, a chamber squeezes, a screen lights up, dough rises). Use states for every change the narration describes, so each beat visibly changes something.
- cast: 0 to 3 people, only when needed (see above). Each has a fixed look that fits the role (an apron for a cook, a caping and long sleeves for a farmer, a coat for a doctor, hijab when it fits). Heights: adults 1.55 to 1.8, children 1.0 to 1.3. hairStyle 'cap' is a baseball cap and 'caping' a conical farmer's hat; never add another hat. People are 1.7 m tall, so they only share a shot with things of a similar scale.
- details are close-ups for things too small or hidden to see in the place: blood cells, germs on a hand, the valve leaflets opening, the refrigerant turning from gas to liquid inside the coil, the layers inside a battery. 1 to 4 when the topic explains a process or a machine (0 only for a story without hidden insides), each the focus of the beat it explains. Each one shows what is inside or how it works, not just a bigger view of the outside. They show props or diagrams, never people.

STORY RULES
- The narration lines are given and fixed: write one beat per line, in order, and copy each line into text.
- Each beat happens in one place. Keep the same place for neighbouring beats unless the story moves to another scale or location.
- focus is the prop, person, or detail the line is about. Use null (the whole place) only for the opening or the ending; every other beat points the camera at something. The camera frames the focus together with the beat's people.
- Camera, so the video never sits still: part frames one part of the focused prop. shot is 'wide' (the whole prop or group), 'medium' (the part with its surroundings), or 'close' (the part alone). move is 'push' (travel from the previous shot, then a slow push in), 'follow' (ride along flow from its start to its end, for a line about something moving from one place to another), 'pull' (start close on the part and pull back to reveal the whole), or 'cut' (jump straight to the new shot). Open wide, then visit the parts the lines talk about in order, follow the flows they describe, and end with a pull or a wide shot. Two beats in a row never use the same focus, part, and shot.
- set lists prop and place state changes during that beat that stay afterwards. Show what the line says; avoid beats where nothing changes. word is the word of the line the change happens on ("memompa", "masuk", "meledak"), copied exactly from the line, so the picture changes the moment the narrator says it. cue is the word the camera arrives on and the label appears with, or null.
- When there are people, pose them to act the line, and give each beat a different action: 'bend' or 'crouch' to work near the ground, 'wash' at a sink, 'phone' to look at a screen they hold, 'sit' and 'lie' with on set to a prop that has a surface, any pose with walkTo to walk there (fleeing, arriving), 'point' or 'explain' toward the focus, 'lookUp', 'raiseHand', 'crossArms', 'wave', 'kneel', 'hold'. x is where the person stands (hips), near the props they use and facing them. hold is a small prop id drawn in the near hand.
- label names the focused thing in at most 3 words taken from the line itself, or null.
- Use a sticker on at most 2 beats, written in Bahasa Indonesia.
- value and clock show a number on the top panel. Use one only when that exact number is spoken in the narration or written in the topic. Otherwise they are null. Never invent a number.

COLOR RULES
- look is "bright" or "dark", decided from when and where the topic really happens. Choose dark only for night, a dark room, the deep sea, space, or the inside of a body when it fits.
- hud is a strong panel color, hudText reads on hud, accent stands out on hud, ground is the main base color, and ink is a dark color.

${COPY_ANTI_SLOP_RULES}`;

/** Ids a plan refers to that it never defines, and people placed far outside their place. */
export function storyPlanProblems(plan: StoryCanvasPlan, sceneCount: number): string[] {
  const problems: string[] = [];
  const props = new Map(plan.props.map((prop) => [prop.id, prop]));
  const places = new Map(plan.places.map((place) => [place.id, place]));
  const cast = new Set(plan.cast.map((member) => member.id));
  const details = new Set(plan.details.map((detail) => detail.id));
  const ids = [...props.keys(), ...places.keys(), ...cast, ...details];
  if (new Set(ids).size !== ids.length) problems.push('All cast, place, prop, and detail ids must be different.');
  if (plan.beats.length !== sceneCount) problems.push(`Write exactly ${sceneCount} beats, one for each narration line.`);
  plan.props.forEach((prop) => {
    const place = places.get(prop.place);
    if (!place) problems.push(`props "${prop.id}" uses unknown place "${prop.place}".`);
    else if (prop.at[0] < -place.width * 0.1 || prop.at[0] > place.width * 1.1) problems.push(`props "${prop.id}" at x=${prop.at[0]} is outside its place (0 to ${place.width}).`);
    if (prop.size.some((value) => value <= 0 || value > 20_000)) problems.push(`props "${prop.id}" size must be positive meters at real scale.`);
    else if (Math.max(prop.size[0] / prop.size[1], prop.size[1] / prop.size[0]) > 8) problems.push(`props "${prop.id}" is ${prop.size[0]} × ${prop.size[1]} m, too thin to read on screen; draw long flat things (a river, the sea, a road) as part of the place, or give the prop a readable shape.`);
  });
  plan.details.forEach((detail) => detail.props.forEach((id) => {
    if (!props.has(id)) problems.push(`details "${detail.id}" uses unknown prop "${id}".`);
  }));
  // A process with hidden insides (flows, moving parts, named parts) needs at least one close-up, and
  // every close-up must be shown by a beat; the septic tank plan had none and stayed on one diagram.
  const explains = plan.props.some((prop) => prop.moves || prop.flows?.length || (prop.parts?.length ?? 0) >= 2);
  if (explains && !plan.details.length && sceneCount >= 4) problems.push('Add at least one close-up in details that shows what is inside or how it works, and point one beat at it.');
  plan.details.forEach((detail) => {
    if (!plan.beats.some((beat) => beat.focus === detail.id)) problems.push(`details "${detail.id}" is never shown: set it as the focus of the beat whose line it explains.`);
  });
  plan.beats.forEach((beat, index) => {
    const place = places.get(beat.place);
    if (!place) problems.push(`beats[${index}].place "${beat.place}" is not a place id.`);
    if (beat.focus && !props.has(beat.focus) && !cast.has(beat.focus) && !details.has(beat.focus)) problems.push(`beats[${index}].focus "${beat.focus}" is not a prop, cast, or detail id.`);
    if (beat.focus && props.has(beat.focus) && props.get(beat.focus)?.place !== beat.place) problems.push(`beats[${index}].focus "${beat.focus}" is a prop of another place.`);
    for (const actor of beat.actors) {
      if (!cast.has(actor.cast)) problems.push(`beats[${index}].actors uses unknown cast "${actor.cast}".`);
      if (place && (actor.x < -place.width * 0.1 - 0.5 || actor.x > place.width * 1.1 + 0.5)) problems.push(`beats[${index}] puts "${actor.cast}" at x=${actor.x}, outside the place (0 to ${place.width}).`);
      if (actor.hold && !props.has(actor.hold)) problems.push(`beats[${index}] "${actor.cast}" holds unknown prop "${actor.hold}".`);
      if (actor.on) {
        const seat = props.get(actor.on);
        if (!seat) problems.push(`beats[${index}] "${actor.cast}" is on unknown prop "${actor.on}".`);
        else if (!seat.surface) problems.push(`beats[${index}] "${actor.cast}" is on "${actor.on}", which has no surface height.`);
      }
      if ((actor.pose === 'lie' || actor.pose === 'sit') && !actor.on) problems.push(`beats[${index}] "${actor.cast}" uses pose ${actor.pose}; set on to the prop they ${actor.pose} on.`);
    }
    const focusProp = beat.focus ? props.get(beat.focus) : undefined;
    if (beat.part && !focusProp?.parts?.some((part) => part.id === beat.part)) problems.push(`beats[${index}].part "${beat.part}" is not a part of the focused prop.`);
    if (beat.flow && !focusProp?.flows?.some((flow) => flow.id === beat.flow)) problems.push(`beats[${index}].flow "${beat.flow}" is not a flow of the focused prop.`);
    if (beat.move === 'follow' && !beat.flow) problems.push(`beats[${index}] uses move follow without a flow.`);
    const previous = index > 0 ? plan.beats[index - 1] : null;
    if (previous && previous.focus && previous.focus === beat.focus && (previous.part ?? null) === (beat.part ?? null) && (previous.shot ?? 'wide') === (beat.shot ?? 'wide') && beat.move !== 'follow') {
      problems.push(`beats[${index}] repeats the shot of beats[${index - 1}] (same focus, part, and shot); frame another part, change the shot, or follow a flow.`);
    }
    for (const change of beat.set) {
      const prop = props.get(change.prop);
      const states = prop?.states ?? places.get(change.prop)?.states;
      if (!states) problems.push(`beats[${index}].set uses unknown prop or place "${change.prop}".`);
      else if (!states.some((state) => state.key === change.key)) problems.push(`beats[${index}].set uses state "${change.key}" that "${change.prop}" does not define.`);
    }
  });
  return problems;
}

const words = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean);

/** Keeps a label only when its words come from the line, the topic, or the focused thing's own name. */
export function keepGroundedStoryLabels(plan: StoryCanvasPlan, topic: string): StoryCanvasPlan {
  const names = new Map([...plan.props, ...plan.details, ...plan.cast].map((item) => [item.id, item.label]));
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

/** Part, flow, and camera move that still make sense for the beat's focus; the rest falls back. */
function cameraOf(beat: StoryCanvasBeat, focus: StoryCanvasProp | undefined) {
  const part = beat.part && focus?.parts?.some((item) => item.id === beat.part) ? beat.part : null;
  const flow = beat.flow && focus?.flows?.some((item) => item.id === beat.flow) ? beat.flow : null;
  const move = beat.move === 'follow' && !flow ? 'push' : beat.move ?? null;
  return { part, flow, shot: beat.shot ?? null, move };
}

/** Approved narration wins word for word; unknown references are dropped instead of failing. */
export function finishStoryPlan(raw: StoryCanvasPlan, story: string[], topic: string): StoryCanvasPlan {
  const props = new Map(raw.props.map((prop) => [prop.id, prop]));
  const cast = new Set(raw.cast.map((member) => member.id));
  const details = new Set(raw.details.map((detail) => detail.id));
  const places = new Set(raw.places.map((place) => place.id));
  const placeStates = new Map(raw.places.map((place) => [place.id, place.states ?? []]));
  const fallbackPlace = raw.places[0].id;
  const { palette } = raw;
  const withStory: StoryCanvasPlan = {
    ...raw,
    palette: {
      ...palette,
      hudText: ensureContrast(palette.hudText, palette.hud, 4.5),
      accent: ensureContrast(palette.accent, palette.hud, 3),
      ink: contrastRatio(palette.ink, '#FFFFFF') >= 7 ? palette.ink : '#1F2421',
    },
    beats: story.map((text, index) => {
      const beat = raw.beats[index] ?? { text, headline: text.slice(0, 60), accent: '', value: null, status: '', clock: null, sticker: null, place: fallbackPlace, focus: null, label: null, actors: [], set: [] };
      const place = places.has(beat.place) ? beat.place : fallbackPlace;
      const focusOk = beat.focus && (cast.has(beat.focus) || details.has(beat.focus) || props.get(beat.focus)?.place === place);
      return {
        ...beat,
        text,
        place,
        focus: focusOk ? beat.focus : null,
        ...cameraOf(beat, focusOk ? props.get(beat.focus as string) : undefined),
        actors: beat.actors
          .filter((actor) => cast.has(actor.cast))
          .map((actor) => {
            const seat = actor.on ? props.get(actor.on) : undefined;
            const onOk = seat && seat.surface && seat.place === place;
            const pose = (actor.pose === 'lie' || actor.pose === 'sit') && !onOk ? 'stand' : actor.pose;
            return { ...actor, pose, on: onOk ? actor.on : null, hold: actor.hold && props.has(actor.hold) ? actor.hold : null };
          }),
        set: beat.set.filter((change) => (props.get(change.prop)?.states ?? placeStates.get(change.prop))?.some((state) => state.key === change.key)),
      };
    }),
  };
  const numbers = keepStatedNumbers({ unit: withStory.unit, beats: withStory.beats, objects: [] } as unknown as IsoPlan, topic);
  const beats = withStory.beats.map((beat, index) => {
    const checked = numbers.beats[index];
    return { ...beat, value: checked.value, clock: checked.clock, headline: checked.headline, status: checked.status, label: checked.label };
  });
  return keepGroundedStoryLabels({ ...withStory, beats }, topic);
}

export interface StoryCanvasPlanResult {
  plan: StoryCanvasPlan;
  attempts: number;
  notes: string[];
  usage: LlmUsage;
}

export async function generateStoryCanvasPlan(model: string, topic: string, story: string[]): Promise<StoryCanvasPlanResult> {
  const usage: LlmUsage = { promptTokens: 0, completionTokens: 0, seconds: 0 };
  const request = `Topic: "${topic}"\n\nThis narration is already approved. Keep it word for word. Write exactly ${story.length} beats, one for each line, in this order.\n${story.map((line, index) => `${index}. ${line}`).join('\n')}`;
  let schemaError = '';
  const result = await writeUntilValid({
    ask: async (feedback) => {
      const reply = await callChat({ model, system: STORY_CANVAS_PLAN_PROMPT, content: request + (schemaError ? `\n\nThe previous JSON did not match the format: ${schemaError}` : '') + feedback, maxTokens: 12_000 });
      usage.promptTokens += reply.usage.promptTokens;
      usage.completionTokens += reply.usage.completionTokens;
      usage.seconds += reply.usage.seconds;
      return reply.text;
    },
    parse: (text) => {
      const json = text.match(/\{[\s\S]*\}/);
      if (!json) return null;
      try {
        const parsed = StoryCanvasPlanSchema.safeParse(JSON.parse(json[0]));
        if (parsed.success) {
          schemaError = '';
          return parsed.data;
        }
        schemaError = parsed.error.issues.slice(0, 12).map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
        return null;
      } catch (error) {
        schemaError = String(error instanceof Error ? error.message : error).slice(0, 300);
        return null;
      }
    },
    check: (plan) => storyPlanProblems(plan, story.length),
    show: (plan) => JSON.stringify(plan),
    attempts: 3,
  });
  // The schema detail says what was wrong; "did not follow the required format" alone hid the cause.
  if (!result.value) throw new Error(`Rencana cerita gagal dibuat: ${schemaError || result.problems.join('; ')}`);
  return { plan: finishStoryPlan(result.value, story, topic), attempts: result.attempts, notes: result.notes, usage };
}
