import sharp from 'sharp';
import { z } from 'zod';
import type { Storyboard } from '@/types/studio';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { mapWithConcurrency, PIPELINE_CONCURRENCY } from '@/lib/pipeline/concurrency';
import { renderNamedComponents } from '@/lib/assets/draft-runtime';
import { callChat } from './asset-generator';
import { HUMAN_RIG_NAMES, HUMAN_RIG_POSES, HUMAN_RIG_SOURCE } from './human-rig';
import { loadHumanRig, renderCharacterPoses } from './human-rig-runtime';
import { worldViewBox } from './story-svg-shared';
import { canvasWidthFor, MAX_CANVAS_WIDTH } from './asset-contract';

/**
 * Full SVG object draft. The art is planned once, then the setting and every object are drawn
 * in their own call with the whole token budget, checked by rendering, and reviewed from pictures.
 * Scenes may only place and animate these components, so this step sets the video's visual ceiling.
 */

const START = '// SHARED-WORLD:START';
const END = '// SHARED-WORLD:END';
const WORLD = 'WorldBase';

const componentName = z.string().regex(/^[A-Z][A-Za-z0-9]*$/).refine(
  (name) => ![WORLD, 'Asset', 'React', ...HUMAN_RIG_NAMES].includes(name),
  'Use the name of an object component.',
);

export const DraftPlanSchema = z.object({
  world: z.object({
    label: z.string().min(1).max(40),
    description: z.string().min(1),
    groundY: z.number().min(200).max(980),
  }),
  objects: z.array(z.object({
    name: componentName,
    /** Characters are people drawn on the fixed HumanRig skeleton; everything else is an object. */
    kind: z.enum(['object', 'character']).default('object'),
    label: z.string().min(1).max(40),
    description: z.string().min(1),
    width: z.number().min(10).max(MAX_CANVAS_WIDTH),
    height: z.number().min(10).max(1000),
    props: z.array(z.object({
      name: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
      default: z.union([z.number(), z.string()]),
      meaning: z.string().min(1),
    })).max(6).default([]),
    closeups: z.array(z.object({ part: z.string().min(1), scale: z.number().min(1).max(4) })).max(4).default([]),
  })).min(1).max(8),
  sceneObjects: z.array(z.array(componentName)),
});

export type DraftPlan = z.infer<typeof DraftPlanSchema>;

const draftSchema = z.object({
  sharedWorld: z.string().min(1).max(200_000),
  sceneObjects: z.array(z.array(componentName)),
  /** Present on drafts drawn per object. Older drafts only have the joined block. */
  plan: DraftPlanSchema.optional(),
  pieces: z.record(z.string(), z.string()).optional(),
  /** Width of the canvas the setting was drawn for. Older drafts are 1000 wide. */
  canvasWidth: z.number().optional(),
});

export type StorySvgDraft = z.infer<typeof draftSchema>;

const ART_STANDARD = `VISUAL STANDARD (premium editorial textbook illustration, not clip art)
- Layer every major form: base gradient, core shadow, reflected light, rim light, and specular highlights, then an outline in a darker shade of that form's own color.
- Light comes from the upper left in every piece of this video.
- Use organic cubic Bezier paths. Do not build forms from plain circles and rectangles.
- Add believable secondary detail: fibres, seams, panels, rivets, veins, droplets, grain, texture lines. Build repeated detail from data arrays with .map.
- Real-world materials and colors. Accurate structure: every part the brief names is present and in the right place.
- Pure SVG geometry. No text, raster images, foreignObject, CSS animation, filters that blur the subject into mush, Math.random, Date, time, or actionProgress.`;

const CODE_RULES = (name: string) => `CODE
Output exactly one \`\`\`tsx block and nothing else.
- Start with one /** ... */ comment: the component name, its size and origin, each prop with its range and default, and "Parts:" with the local x,y of every named part.
- Then exactly one top-level declaration: function ${name}(...). Put helpers and data arrays inside it.
- No imports, exports, hooks, or React APIs. Return one <g>.
- Prefix every gradient, clipPath, mask, and filter id with "asset-world-${name.toLowerCase()}-".
- Use inline SVG attributes. Output is deterministic.
- Keep the answer under 9000 tokens. Do not think out loud.`;

const PLAN_SYSTEM = `You are the art director of an animated explainer drawn entirely in SVG. Read the storyboard and plan the fixed setting and the cast of objects before anything is drawn.
Return only JSON in exactly this shape:
{"world": {"label": "Tepi sungai", "description": "...", "groundY": 720},
 "objects": [{"name": "WaterWheel", "kind": "object", "label": "Kincir air", "description": "...", "width": 620, "height": 640,
   "props": [{"name": "turn", "default": 0, "meaning": "rotation 0 to 1"}],
   "closeups": [{"part": "axle bearing", "scale": 3}]}],
 "sceneObjects": [["WaterWheel"], []]}
- world.label: short Bahasa Indonesia name of the place. world.description: an English art brief of the real place: sky or wall, horizon, ground or floor material, layers below the surface when the story shows them, time of day. world.groundY: the canvas y of the main ground or floor line. The canvas is canvas.width by 1000, as given in the brief.
- objects: every focal subject and recurring prop, 1 to 8. name: English PascalCase, never WorldBase, Asset, or React. label: short Bahasa Indonesia name the user reads. description: an English brief precise enough for an illustrator: silhouette, proportions, real materials and colors, every part the narration names, and how each state looks.
- An object is a thing with its own silhouette. Ground, rock layers, faults, the sea, or tissue seen in cross-section belong to the world: describe them in world.description, below groundY, and never make them an object, because an object would be drawn as a box-shaped slice.
- width and height: the object's size in canvas units. Sizes stay true to each other at one sensible scene scale, and the focal subject is large, about 500 to 850 units on its long side.
- props: only the state or pose changes the story needs, such as openAmount from 0 to 1, each with a default and its meaning.
- kind: "character" for every person who appears, even as a silhouette, a crowd member, or a figure seen once. Everything else is "object". A character is drawn once on a fixed skeleton that already walks and takes the poses ${HUMAN_RIG_POSES.join(', ')}, so its props never describe a pose or movement: only costume or carried-item switches, such as "carryRifle" from 0 to 1. Its description names the clothing, hair, skin tone, build, and anything it carries, in believable real colors that stand out from the setting; never give a character the video palette's background or surface color. A character's height is about 700 to 820 and its width about 0.4 of its height. Several people who look alike, such as a row of soldiers, are one character placed several times.
- closeups: parts the visual directions zoom into, with the zoom scale from 1 to 4.
- A canvas wider than 1000 is a landscape frame. Plan a cast that can fill that width with meaning: besides the focal subject, plan the related objects the story really has (what feeds it, what it feeds, the people and structures around it), so each scene can place two or three connected objects side by side instead of one subject with empty sides.
- sceneObjects: one array per scene, in order, with the object names visible in that scene. In a landscape frame, list the focal object plus the supporting objects that belong in that moment. [] for CTA scenes. Every other scene lists at least its focal object. Incidental one-off effects are left to the animator and are not objects.
- Facts must be accurate.`;

const WORLD_SYSTEM = `You are a senior editorial vector illustrator. Draw the fixed setting of an animated explainer as one SVG React component.

${ART_STANDARD}

SETTING RULES
- Draw only the place. No story objects or subjects.
- Draw the place at rest, as it looks in every scene. Events and effects such as shock waves, cracks spreading, fire, glow, arrows, or flowing particles are not part of the setting: the animator adds them in the scenes that need them. Permanent structure, such as rock layers or a fault line, stays.
- The canvas is W units wide and 1000 tall; the brief states W (1000 for vertical videos, wider for landscape). It only marks where subjects stand. The video frame shows more, and the camera may zoom anywhere in the canvas.
- Fill the whole area from x=-1000 to x=W+1000 and from y=-1000 to y=2000 with no gaps: sky or wall above the ground line, the ground or floor surface at groundY across the full width, and everything below the surface down to y=2000. Never stop at the canvas edge, and never draw a box, card, or diorama slice.
- Outdoors: sky with soft clouds, horizon, distant hills or buildings. Indoors: a real wall surface plus a window or shelf that fits. Other places get their own fitting setting.
- The headline sits over the area above y=100. Keep it a calm, low-contrast tone with no clouds, objects, or strong patterns.
- Keep the setting quieter and lower in contrast than the subjects that will stand in it.

${CODE_RULES(WORLD)}
- WorldBase takes no props. Its origin is the canvas origin.`;

const OBJECT_SYSTEM = (name: string) => `You are a senior editorial vector illustrator. Draw one reusable object of an animated explainer as one SVG React component.

${ART_STANDARD}

OBJECT RULES
- Draw only this object. No background, ground, panel, or card. A soft contact shadow under it is fine.
- Origin (0,0) is the centre of the object's base, where it stands. It spans x from -width/2 to width/2 and y from -height to 0, at the planned size.
- Use at least 40 meaningful shapes. The object is the star of the video and must hold up full screen.
- Parts listed in closeups are seen up to that zoom scale S. Give them detail fine enough for it: strokes around 2/S units, small bolts, seams, and layers.
- Every prop changes the drawing visibly. Destructure props with the planned defaults.
- A part that moves (a door, lid, lever, arm, wheel) is its own <g transform={"rotate(" + angle + " " + jointX + " " + jointY + ")"}> around its hinge or joint, or a translate along its track. Never interpolate path coordinates between two shapes: that shrinks and warps the part mid-motion.

${CODE_RULES(name)}`;

const round = (value: number) => Math.round(value);

const CHARACTER_SYSTEM = (name: string, height: number) => {
  const m = loadHumanRig().HUMAN_RIG.metrics(height);
  return `You are a senior editorial character illustrator. Draw one character of an animated explainer as the skin of a fixed skeleton.

${ART_STANDARD}

THE RIG (already defined, do not define it)
HumanRig draws a side (profile) view facing +x and moves every part with its joints. You only draw the parts, each in its own bone's local space, for height ${height}.
- thigh: hip joint at (0,0), knee at (0,${round(m.thigh)}). About ${round(m.height * 0.085)} wide at the hip, ${round(m.height * 0.06)} at the knee.
- shin: knee at (0,0), ankle at (0,${round(m.shin)}). About ${round(m.height * 0.06)} wide at the knee, ${round(m.height * 0.045)} at the ankle.
- foot: ankle at (0,0). The sole lies on y=${round(m.ankle)} from the heel at x=${round(-0.22 * m.foot)} to the toe at x=${round(0.78 * m.foot)}.
- upperArm: shoulder at (0,0), elbow at (0,${round(m.upperArm)}). About ${round(m.height * 0.05)} wide.
- foreArm: elbow at (0,0), wrist at (0,${round(m.foreArm)}). About ${round(m.height * 0.038)} wide.
- hand: wrist at (0,0), fingertips at (0,${round(m.hand)}), thumb toward +x.
- torso: hip joint at (0,0), neck base at (0,${round(-m.spine)}). Chest and belly face +x; back toward -x. About ${round(m.height * 0.11)} deep at the chest.
- pelvis: hips, seat, and belt around (0,0), from y=${round(-m.height * 0.06)} to y=${round(m.height * 0.05)}. It covers the tops of both thighs.
- neck: from (0,0) up to (0,${round(-m.neck)}), about ${round(m.head * 0.42)} wide. Extend it ${round(m.head * 0.25)} past its top so it tucks under the jaw and skull, and down into the collar.
- head: a profile facing +x. The origin (0,0) is the top of the neck, under the base of the skull just behind the jaw angle, never the chin. The head is about as deep as it is tall (${round(m.head)}): a round cranium from the back of the skull at x=${round(-0.5 * m.head)} to the brow at x=${round(0.42 * m.head)}, crown at y=${round(-m.head)}. Face landmarks: eye at (${round(0.3 * m.head)}, ${round(-0.55 * m.head)}) with a brow above it, nose tip at (${round(0.52 * m.head)}, ${round(-0.4 * m.head)}), mouth at (${round(0.38 * m.head)}, ${round(-0.22 * m.head)}), chin at (${round(0.33 * m.head)}, ${round(-0.05 * m.head)}). The jaw runs from the chin back to its angle at (${round(-0.02 * m.head)}, ${round(-0.2 * m.head)}); the ear sits behind it, centred at (${round(-0.08 * m.head)}, ${round(-0.45 * m.head)}) and about ${round(0.28 * m.head)} tall. The skull and jaw cover the area around (0,0), so the neck disappears under them with no gap. Hair is one solid filled shape, never an outline or a stroke, covering the whole top and back of the cranium down to above the ear and the nape, with no bare scalp showing unless the brief says bald; a bun, ponytail, or hat sits on that skull outline. Sideburns are a small shape in front of the ear. No thick stroke crosses the face. Any hat goes above the crown.
- coatTail (optional): coat skirt or long hem hanging from the waist at (0,0) downward, so it swings with the legs.

PART RULES
- Every part overruns its joints by about 6% of the bone with a rounded end and no outline across that end, so rotating joints never open a gap.
- One drawing serves both sides: the far arm and leg are the same drawing, darkened by the rig. A part may be a function (side) => <g>...</g> when the two sides must differ.
- Skin, hair, and clothing use believable real colors with clear light and shadow, and the face shows its features. Never paint the figure in the video palette's background or surface color: it must read clearly against a dark setting too.
- Clothing goes on the parts it covers: sleeves on upperArm and foreArm, trousers on thigh and shin, shoes on foot, coat on torso and pelvis, coat tails in coatTail.
- Put every gradient definition inside one <defs> in the torso part.
- Shapes never move with props, and path data is never a template literal. Props only switch costume pieces or colors on and off.
- A carried item (rifle, phone, flag, document) is drawn in this component along +y from the grip at (0,0), barrel or screen toward +y. Pass it as holding={{ item: <g>...</g>, hand: 'near', angle: 0 }} only while the prop that shows it is on. A long item such as a rifle extends both ways: stock toward -y.

COMPONENT
function ${name}({ pose = 'stand', poseTo, poseMix = 0, walkPhase, walkMix = 1, facing = 1, ...the planned props with their defaults }) {
  const parts = { head: <g>...</g>, neck: ..., torso: ..., pelvis: ..., upperArm: ..., foreArm: ..., hand: ..., thigh: ..., shin: ..., foot: ... };
  return <HumanRig height={${height}} pose={pose} poseTo={poseTo} poseMix={poseMix} walkPhase={walkPhase} walkMix={walkMix} facing={facing} parts={parts} holding={...or null} />;
}
- The header comment lists pose (${HUMAN_RIG_POSES.join(', ')}), poseTo and poseMix (0..1, blend to poseTo), walkPhase and walkMix (walking), facing (1 faces right, -1 faces left), then the planned props. "Parts:" lists the slots you drew.
- Use at least 30 meaningful shapes across the parts.

${CODE_RULES(name)}`;
};

const CRITIC_SYSTEM = `You are a strict art director reviewing the reusable art of an animated explainer before it is animated.
The image is a contact sheet of cards in reading order, left to right, top to bottom. Card 1 is the setting; the others are objects.
Score each card from 1 to 10 for overall quality: recognizable at a glance, accurate to its brief, premium layered illustration with light, depth, and detail. A flat icon, clip art, or basic shapes scores 4 or lower. A setting with visible gaps, a hard edge, or a plain empty backdrop scores 4 or lower.
A character card shows the same person three times: standing, mid-stride, and pointing. Score it 4 or lower when a limb, hand, or foot changes size or shape between the three, a part floats off its joint, a gap opens at a joint, or clothing breaks apart when the limbs move.
Return only JSON: {"imageVisible": true, "items": [{"name": "...", "score": 0, "issues": ["specific fix"]}]}. At most 4 issues per card, ordered by visual impact. Set imageVisible to false if you cannot see the cards.`;

/** Cards below this score get one redraw before the user sees the draft. */
export const DRAFT_REDRAW_BELOW = 7;
const CARD = 360;
const DRAW_TOKENS = 24_000;

const fence = (text: string, lang: string) => text.match(new RegExp(`\`\`\`${lang}\\s*([\\s\\S]*?)\`\`\``))?.[1]?.trim();
const parseJson = (text: string) => JSON.parse(fence(text, 'json') ?? text.trim().replace(/^`{3}(?:json)?\s*|\s*`{3}$/gi, ''));

function storyBrief(storyboard: Storyboard): string {
  return JSON.stringify({
    title: storyboard.title,
    aspectRatio: storyboard.aspectRatio,
    canvas: { width: canvasWidthFor(storyboard.aspectRatio), height: 1000 },
    palette: storyboard.palette,
    scenes: storyboard.scenes.map(({ title, role, voiceoverText, visualPrompt }) => ({
      title, role, narration: voiceoverText, visual: visualPrompt,
    })),
  });
}

/** Checks the plan against the storyboard, so every scene's objects exist before drawing starts. */
export function checkPlan(plan: DraftPlan, storyboard: Storyboard): DraftPlan {
  const names = new Set(plan.objects.map((object) => object.name));
  if (names.size !== plan.objects.length) throw new Error('Object names must be unique.');
  if (plan.sceneObjects.length !== storyboard.scenes.length) throw new Error('sceneObjects must cover every scene.');
  plan.sceneObjects.forEach((objects, index) => {
    if (storyboard.scenes[index].role !== 'cta' && !objects.length) throw new Error(`Scene ${index + 1} is missing its focal object.`);
    const unknown = objects.filter((name) => !names.has(name));
    if (unknown.length) throw new Error(`Scene ${index + 1} lists objects that are not planned: ${unknown.join(', ')}.`);
  });
  return plan;
}

async function planDraft(model: string, storyboard: Storyboard, extra = ''): Promise<DraftPlan> {
  const content = `${storyBrief(storyboard)}${extra}`;
  const ask = (text: string) => callChat({ model, system: PLAN_SYSTEM, content: text, maxTokens: 12_000, timeoutMs: 5 * 60_000 });
  const first = await ask(content);
  try {
    return checkPlan(DraftPlanSchema.parse(parseJson(first.text)), storyboard);
  } catch (error) {
    const retry = await ask(`${content}\nThe previous answer failed: ${String(error)}\nPrevious answer:\n${first.text.slice(0, 20_000)}\nReturn the complete corrected JSON.`);
    return checkPlan(DraftPlanSchema.parse(parseJson(retry.text)), storyboard);
  }
}

const svgDocument = (markup: string, viewBox: string, size: { width: number; height: number }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="${viewBox}">${markup}</svg>`;

/** The world must reach x=-1000..W+1000 and y=-1000..2000; transparent probes there mean a gap or a hard edge. */
async function worldGaps(markup: string, canvasWidth: number): Promise<string[]> {
  const span = canvasWidth + 2000;
  const { data, info } = await sharp(Buffer.from(svgDocument(markup, `-1000 -1000 ${span} 3000`, { width: Math.round(span / 10), height: 300 })))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [left, middle, right] = [-950, canvasWidth / 2, canvasWidth + 950];
  const probes: Array<[number, number]> = [[left, -950], [middle, -950], [right, -950], [left, 500], [right, 500], [left, 1950], [middle, 1950], [right, 1950]];
  return probes
    .filter(([x, y]) => {
      const px = Math.min(info.width - 1, Math.round((x + 1000) / 10));
      const py = Math.min(info.height - 1, Math.round((y + 1000) / 10));
      return data[(py * info.width + px) * info.channels + 3] < 200;
    })
    .map(([x, y]) => `(${x}, ${y})`);
}

const CHARACTER_SLOTS = ['head', 'torso', 'pelvis', 'upperArm', 'foreArm', 'hand', 'thigh', 'shin', 'foot'];

/** Opaque bounds of a rendered character, in rig units, from a raster of a wide area around its feet. */
async function characterBounds(svg: string, height: number) {
  const [x0, y0, w, h] = [-2 * height, -2.4 * height, 4 * height, 3 * height];
  const scale = 480 / w;
  const { data, info } = await sharp(Buffer.from(svgDocument(svg, `${x0} ${y0} ${w} ${h}`, { width: 480, height: Math.round(h * scale) })))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] < 40) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { left: minX / scale + x0, right: (maxX + 1) / scale + x0, top: minY / scale + y0, bottom: (maxY + 1) / scale + y0 };
}

/** Props a character's path data is built from. Paths built from local constants (folds from an array) are fine. */
function morphedByProps(name: string, code: string): string[] {
  const params = code.match(new RegExp(`function\\s+${name}\\s*\\(\\s*\\{([^}]*)\\}`))?.[1] ?? '';
  const props = params.split(',').map((item) => item.trim().split(/[\s=:]/)[0]).filter((item) => /^[A-Za-z_$][\w$]*$/.test(item));
  if (!props.length) return [];
  const used = new Set<string>();
  for (const [, body] of code.matchAll(/\bd=\{\s*`([^`]*)`/g)) {
    for (const [, expression] of body.matchAll(/\$\{([^}]*)\}/g)) {
      for (const prop of props) if (new RegExp(`\\b${prop.replace('$', '\\$')}\\b`).test(expression)) used.add(prop);
    }
  }
  return [...used];
}

/** Rig-specific checks for a character piece: it must draw on HumanRig and hold its shape in every pose. */
async function checkCharacter(name: string, code: string, height: number): Promise<{ errors: string[]; svg: string | null }> {
  const errors: string[] = [];
  if (!/<HumanRig\b/.test(code)) errors.push(`${name} must return <HumanRig height={${height}} ... parts={parts} />.`);
  if (/\b(?:function|const|let|var)\s+(?:HumanRig|HUMAN_RIG)\b/.test(code)) errors.push('HumanRig is already defined. Do not define it again.');
  const missing = CHARACTER_SLOTS.filter((slot) => !new RegExp(`\\b${slot}\\s*:`).test(code));
  if (missing.length) errors.push(`Draw these parts in the parts object: ${missing.join(', ')}.`);
  const propMorphs = morphedByProps(name, code);
  if (propMorphs.length) errors.push(`Path data must not depend on props (${propMorphs.join(', ')}). The rig moves the parts; props only switch costume pieces or colors.`);
  if (errors.length) return { errors, svg: null };

  let renders: ReturnType<typeof renderCharacterPoses>;
  try {
    renders = renderCharacterPoses(code, name);
  } catch (error) {
    return { errors: [`Rendering ${name} failed: ${String(error instanceof Error ? error.message : error).slice(0, 300)}`], svg: null };
  }
  const failed = renders.filter((render) => !render.svg);
  if (failed.length) return { errors: failed.map((render) => `Rendering ${name} in pose ${render.label} failed: ${render.error}`), svg: null };

  const still = renders.slice(1).filter((render) => render.svg === renders[0].svg).map((render) => render.label);
  if (still.length) return { errors: [`${name} looks the same standing and in pose ${still.join(', ')}. Pass pose, poseTo, poseMix, walkPhase, walkMix, and facing straight to HumanRig.`], svg: null };
  const bounds = await Promise.all(renders.map((render) => characterBounds(render.svg!, height).catch(() => null)));
  const [stand, walk] = bounds;
  if (!stand || !walk) return { errors: [`${name} renders nothing visible.`], svg: null };
  const tall = stand.bottom - stand.top;
  if (tall < 0.85 * height || tall > 1.3 * height) errors.push(`Standing, ${name} is ${Math.round(tall)} tall but the rig is ${height}. Draw every part in its bone's local space at the sizes given.`);
  if (Math.abs(stand.bottom) > 0.05 * height) errors.push(`Standing, the soles end at y=${Math.round(stand.bottom)} instead of 0. Put the sole of the foot part on y=${Math.round(loadHumanRig().HUMAN_RIG.metrics(height).ankle)}.`);
  if (stand.right - stand.left > 1.2 * height) errors.push(`Standing, ${name} is ${Math.round(stand.right - stand.left)} wide. A part is drawn far from its joint.`);
  const walkTall = walk.bottom - walk.top;
  if (Math.abs(walkTall - tall) > 0.12 * tall) errors.push(`Mid-stride, ${name} is ${Math.round(walkTall)} tall instead of about ${Math.round(tall)}. A part is drawn away from its joint.`);
  if (errors.length) return { errors, svg: null };

  // Review sheet: the three poses side by side.
  const gap = 0.85 * height;
  const svg = renders.map((render, index) => `<g transform="translate(${(index - 1) * gap} 0)">${render.svg}</g>`).join('');
  return { errors, svg };
}

/** Validates and renders one drawn piece in isolation. Returns the error list, empty when it passes. */
export async function checkPiece(
  name: string,
  code: string,
  options: { character?: { height: number }; canvasWidth?: number } = {},
): Promise<{ errors: string[]; svg: string | null }> {
  const errors: string[] = [];
  const declarations = [...code.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map((match) => match[1]);
  if (!declarations.includes(name)) errors.push(`Declare function ${name} at the top level.`);
  const others = declarations.filter((declared) => declared !== name);
  if (others.length) errors.push(`Move these top-level declarations inside ${name}: ${others.join(', ')}.`);
  if (/^[ \t]*(?:import|export)\b/m.test(code)) errors.push('Use no imports or exports.');
  if (code.includes(START) || code.includes(END)) errors.push('Do not write SHARED-WORLD markers.');
  const prefix = `asset-world-${name.toLowerCase()}-`;
  const badIds = [...code.matchAll(/\bid=(?:"([^"]*)"|\{\s*['"`]([^'"`$]*))/g)]
    .map((match) => match[1] ?? match[2]).filter((id) => !id.startsWith(prefix) && id !== prefix.slice(0, -1));
  if (badIds.length) errors.push(`Prefix every id with "${prefix}": ${[...new Set(badIds)].slice(0, 5).join(', ')}.`);
  const validation = validateSceneCode(code, `${name}.tsx`, {
    svgOnly: true,
    allowedImports: [],
    ...(options.character ? { providedNames: HUMAN_RIG_NAMES } : {}),
  });
  errors.push(...validation.errors);
  if (errors.length) return { errors, svg: null };
  if (options.character) return checkCharacter(name, code, options.character.height);

  let rendered: { svg: string | null; error: string | null };
  try {
    rendered = renderNamedComponents(code, [name])[name];
  } catch (error) {
    rendered = { svg: null, error: String(error instanceof Error ? error.message : error) };
  }
  if (!rendered.svg) return { errors: [`Rendering ${name} with default props failed: ${rendered.error}`], svg: null };
  if (name === WORLD) {
    const canvasWidth = options.canvasWidth ?? 1000;
    const gaps = await worldGaps(rendered.svg, canvasWidth).catch((error) => [`render error ${String(error)}`]);
    if (gaps.length) {
      errors.push(`The setting leaves gaps at ${gaps.join(', ')}. Fill x=-1000..${canvasWidth + 1000} and y=-1000..2000 completely: sky or wall above the ground line, ground and everything below it down to y=2000.`);
    }
  }
  return { errors, svg: errors.length ? null : rendered.svg };
}

interface PieceRequest {
  name: string;
  /** Set for characters: the rig height their parts are drawn for. */
  character?: { height: number };
  brief: string;
  previous?: string;
  note?: string;
  image?: Buffer;
}

function pieceBrief(plan: DraftPlan, name: string, storyboard: Storyboard): string {
  const story = `Video: "${storyboard.title}". Narration in order: ${storyboard.scenes.map((scene, index) => `${index + 1}. ${scene.voiceoverText}`).join(' ')}`;
  if (name === WORLD) {
    const width = canvasWidthFor(storyboard.aspectRatio);
    return `${story}\nCanvas: W=${width} by 1000 (${storyboard.aspectRatio}). Fill x=-1000..${width + 1000}, y=-1000..2000.\nSetting brief: ${plan.world.description}\nGround or floor line: y=${plan.world.groundY}.\nObjects that will stand in it: ${plan.objects.map((object) => `${object.name} ${object.width}x${object.height}`).join(', ')}.\nVideo palette for the sky or wall tone: ${JSON.stringify(storyboard.palette)}`;
  }
  const object = plan.objects.find((item) => item.name === name)!;
  return `${story}\nObject: ${object.name}\nBrief: ${object.description}\nSize: ${object.width} wide, ${object.height} tall.\nProps: ${JSON.stringify(object.props)}\nCloseups: ${JSON.stringify(object.closeups)}\nOther objects in the same video, for consistent scale and style: ${plan.objects.filter((item) => item.name !== name).map((item) => `${item.name} ${item.width}x${item.height}`).join(', ') || 'none'}.\nThe setting: ${plan.world.description}`;
}

/** Draws one piece, with up to two repairs when it fails the checks. */
async function drawPiece(model: string, request: PieceRequest, canvasWidth: number): Promise<{ code: string; svg: string }> {
  const system = request.name === WORLD ? WORLD_SYSTEM
    : request.character ? CHARACTER_SYSTEM(request.name, request.character.height) : OBJECT_SYSTEM(request.name);
  const base = [
    request.brief,
    request.previous && `Current code:\n\`\`\`tsx\n${request.previous}\n\`\`\``,
    request.note,
  ].filter(Boolean).join('\n\n');
  const ask = (text: string) => callChat({
    model, system, maxTokens: DRAW_TOKENS, timeoutMs: 10 * 60_000,
    content: request.image
      ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: `data:image/png;base64,${request.image.toString('base64')}` } }]
      : text,
  });

  let answer = await ask(base);
  for (let attempt = 0; ; attempt += 1) {
    const code = fence(answer.text, 'tsx') ?? fence(answer.text, 'typescript') ?? '';
    const checked = code ? await checkPiece(request.name, code, { character: request.character, canvasWidth }) : { errors: ['Return one ```tsx block.'], svg: null };
    if (!checked.errors.length && checked.svg) return { code, svg: checked.svg };
    if (attempt >= 2) throw new Error(`${request.name} failed the draft checks: ${checked.errors.join(' ')}`);
    answer = await ask(`${base}\n\nThe previous answer failed these checks:\n${checked.errors.map((error) => `- ${error}`).join('\n')}\n\nPrevious answer:\n${answer.text.slice(0, 40_000)}\n\nReturn the complete corrected tsx block.`);
  }
}

const objectViewBox = (object: DraftPlan['objects'][number]) => {
  if (object.kind === 'character') {
    const h = object.height;
    return `${-1.35 * h} ${-1.25 * h} ${2.9 * h} ${1.4 * h}`;
  }
  const side = Math.max(object.width, object.height) * 1.5;
  return `${-side / 2} ${-object.height / 2 - side / 2} ${side} ${side}`;
};

async function card(svg: string, viewBox: string, background: string): Promise<Buffer> {
  return sharp(Buffer.from(svgDocument(`<rect x="-5000" y="-5000" width="10000" height="10000" fill="${background}"/>${svg}`, viewBox, { width: CARD, height: CARD })))
    .png().toBuffer();
}

async function contactSheet(cards: Buffer[]): Promise<Buffer> {
  const columns = Math.min(4, cards.length);
  const rows = Math.ceil(cards.length / columns);
  return sharp({ create: { width: CARD * columns, height: CARD * rows, channels: 3, background: '#000000' } })
    .composite(cards.map((input, index) => ({ input, left: (index % columns) * CARD, top: Math.floor(index / columns) * CARD })))
    .jpeg({ quality: 82 }).toBuffer();
}

interface CardReview { name: string; score: number; issues: string[] }

async function reviewCards(storyboard: Storyboard, plan: DraftPlan, names: string[], cards: Buffer[]): Promise<Map<string, CardReview>> {
  const model = process.env.CRITIC_MODEL || 'ag/gemini-3.8-flash-high';
  const briefs = names.map((name, index) => {
    const brief = name === WORLD ? plan.world.description : plan.objects.find((object) => object.name === name)?.description;
    return `Card ${index + 1}: ${name}: ${brief}`;
  }).join('\n');
  const { text } = await callChat({
    model, system: CRITIC_SYSTEM, maxTokens: 3_000, timeoutMs: 5 * 60_000,
    content: [
      { type: 'text', text: `Video: "${storyboard.title}"\n${briefs}` },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${(await contactSheet(cards)).toString('base64')}` } },
    ],
  });
  const parsed = parseJson(text.match(/\{[\s\S]*\}/)?.[0] ?? text) as { imageVisible?: boolean; items?: CardReview[] };
  if (parsed.imageVisible !== true || !Array.isArray(parsed.items)) throw new Error('Critic could not see the draft cards');
  return new Map(parsed.items.filter((item) => names.includes(item.name)).map((item) => [item.name, item]));
}

/** What the user sees while the draft is made. percent runs from 0 to 100. */
export interface DraftProgress {
  percent: number;
  label: string;
}
export type DraftProgressListener = (progress: DraftProgress) => void;

const quiet: DraftProgressListener = () => {};

function characterOf(plan: DraftPlan, name: string): { height: number } | undefined {
  const object = plan.objects.find((item) => item.name === name);
  return object?.kind === 'character' ? { height: object.height } : undefined;
}

export function joinPieces(plan: DraftPlan, pieces: Record<string, string>): string {
  const rig = plan.objects.some((object) => object.kind === 'character') ? [HUMAN_RIG_SOURCE] : [];
  return [START, ...rig, pieces[WORLD], ...plan.objects.map((object) => pieces[object.name]), END].join('\n\n').replace(`${START}\n\n`, `${START}\n`).replace(`\n\n${END}`, `\n${END}`);
}

async function drawAll(
  model: string,
  storyboard: Storyboard,
  plan: DraftPlan,
  requests: PieceRequest[],
  pieces: Record<string, string>,
  review: boolean,
  /** Percent range this step fills, so planning before it and assembly after it keep their share. */
  span: { from: number; to: number; report: DraftProgressListener },
): Promise<Record<string, string>> {
  const { from, to, report } = span;
  const labelOf = (name: string) => (name === WORLD ? plan.world.label : plan.objects.find((object) => object.name === name)?.label ?? name);
  // Drawing takes most of the time; the review and its redraws share what is left.
  const drawEnd = review ? from + (to - from) * 0.7 : to;
  const drawn = new Map<string, { code: string; svg: string }>();
  report({ percent: from, label: `Menggambar ${requests.length > 1 ? `${requests.length} gambar` : labelOf(requests[0]?.name ?? WORLD)}` });
  await mapWithConcurrency(requests, PIPELINE_CONCURRENCY, async (request) => {
    drawn.set(request.name, await drawPiece(model, request, canvasWidthFor(storyboard.aspectRatio)));
    report({
      percent: from + (drawEnd - from) * (drawn.size / requests.length),
      label: `${labelOf(request.name)} selesai digambar (${drawn.size} dari ${requests.length})`,
    });
  });
  const next = { ...pieces, ...Object.fromEntries([...drawn].map(([name, piece]) => [name, piece.code])) };
  if (!review || !drawn.size) return next;

  const background = storyboard.palette.surface;
  const cardFor = (name: string, svg: string) => name === WORLD
    ? card(svg, worldViewBox(storyboard.aspectRatio), background)
    : card(svg, objectViewBox(plan.objects.find((object) => object.name === name)!), background);

  try {
    const names = [...drawn.keys()].sort((a, b) => (a === WORLD ? -1 : b === WORLD ? 1 : 0));
    report({ percent: drawEnd, label: 'Menilai kualitas gambar' });
    const cards = await Promise.all(names.map((name) => cardFor(name, drawn.get(name)!.svg)));
    const reviews = await reviewCards(storyboard, plan, names, cards);
    const weak = names.filter((name) => (reviews.get(name)?.score ?? 10) < DRAFT_REDRAW_BELOW && reviews.get(name)?.issues.length);
    if (!weak.length) return next;
    console.log(`[StorySvgDraft] Redrawing ${weak.join(', ')}: ${weak.map((name) => reviews.get(name)!.score).join(' / ')}`);

    const reviewEnd = drawEnd + (to - drawEnd) * 0.15;
    const redrawEnd = drawEnd + (to - drawEnd) * 0.85;
    let fixed = 0;
    report({ percent: reviewEnd, label: `Memperbaiki ${weak.length} gambar yang kurang bagus` });
    const redrawn = new Map<string, { code: string; svg: string }>();
    await mapWithConcurrency(weak, PIPELINE_CONCURRENCY, async (name) => {
      try {
        const original = requests.find((request) => request.name === name)!;
        redrawn.set(name, await drawPiece(model, {
          ...original,
          previous: drawn.get(name)!.code,
          image: cards[names.indexOf(name)],
          note: `The attached card shows the current render. Art director issues:\n${reviews.get(name)!.issues.map((issue) => `- ${issue}`).join('\n')}\nImprove the illustration substantially, fix every issue, and return the complete tsx block.`,
        }, canvasWidthFor(storyboard.aspectRatio)));
      } catch (error) {
        console.warn(`[StorySvgDraft] Redraw of ${name} failed:`, error);
      }
      fixed += 1;
      report({ percent: reviewEnd + (redrawEnd - reviewEnd) * (fixed / weak.length), label: `Memperbaiki gambar (${fixed} dari ${weak.length})` });
    });
    if (!redrawn.size) return next;
    report({ percent: redrawEnd, label: 'Membandingkan gambar perbaikan' });

    // The critic is noisy, so a redraw replaces the first drawing only when it scores higher.
    const retryNames = [...redrawn.keys()];
    const retryCards = await Promise.all(retryNames.map((name) => cardFor(name, redrawn.get(name)!.svg)));
    const retried = await reviewCards(storyboard, plan, retryNames, retryCards);
    for (const name of retryNames) {
      const before = reviews.get(name)!.score;
      const after = retried.get(name)?.score ?? 0;
      console.log(`[StorySvgDraft] ${name}: ${before} -> ${after}`);
      if (after > before) next[name] = redrawn.get(name)!.code;
    }
  } catch (error) {
    console.warn('[StorySvgDraft] Review skipped:', error);
  }
  return next;
}

function assemble(plan: DraftPlan, pieces: Record<string, string>, storyboard: Storyboard): StorySvgDraft {
  const draft: StorySvgDraft = {
    sharedWorld: joinPieces(plan, pieces),
    sceneObjects: plan.sceneObjects,
    plan,
    pieces: Object.fromEntries([WORLD, ...plan.objects.map((object) => object.name)].map((name) => [name, pieces[name]])),
    canvasWidth: canvasWidthFor(storyboard.aspectRatio),
  };
  checkDraft(draft, storyboard);
  return draft;
}

/** Shape checks shared by new and older drafts. */
export function checkDraft(draft: StorySvgDraft, storyboard: Storyboard): StorySvgDraft {
  const { sharedWorld, sceneObjects } = draft;
  if (!new RegExp(`^${START}\\r?\\n`).test(sharedWorld) || !sharedWorld.trimEnd().endsWith(END)
    || sharedWorld.indexOf(END) !== sharedWorld.trimEnd().lastIndexOf(END)
    || !/\b(?:function|const)\s+WorldBase\b/.test(sharedWorld)) {
    throw new Error('Draft must define WorldBase inside the shared SVG block.');
  }
  if (/^[ \t]*(?:import|export)\b/m.test(sharedWorld)) throw new Error('Draft must use inline definitions without imports or exports.');
  if (sceneObjects.length !== storyboard.scenes.length) throw new Error('Draft must cover every scene.');
  for (const [index, objects] of sceneObjects.entries()) {
    if (storyboard.scenes[index].role !== 'cta' && !objects.length) {
      throw new Error(`Draft scene ${index + 1} is missing its focal object.`);
    }
    for (const object of objects) {
      if (!new RegExp(`\\b(?:function|const)\\s+${object}\\b`).test(sharedWorld)) {
        throw new Error(`Draft is missing the ${object} component.`);
      }
    }
  }
  const check = validateSceneCode(sharedWorld, 'StorySvgDraft.tsx', { svgOnly: true, allowedImports: [] });
  if (!check.valid) throw new Error(check.errors.join('\n'));
  return draft;
}

/** Parses a stored or model-written draft object. */
export function parseStorySvgDraft(response: string, storyboard: Storyboard): StorySvgDraft {
  return checkDraft(draftSchema.parse(parseJson(response)), storyboard);
}

export async function generateStorySvgDraft(
  model: string,
  storyboard: Storyboard,
  revision?: { draft: StorySvgDraft; instruction: string },
  report: DraftProgressListener = quiet,
): Promise<StorySvgDraft> {
  if (revision?.draft.plan && revision.draft.pieces) return reviseDraft(model, storyboard, revision.draft, revision.instruction, report);

  report({ percent: 2, label: 'Merencanakan latar dan objek' });
  const plan = await planDraft(model, storyboard, revision ? `\nUser corrections to apply: ${JSON.stringify(revision.instruction)}` : '');
  const requests = [WORLD, ...plan.objects.map((object) => object.name)].map((name) => ({
    name,
    character: characterOf(plan, name),
    brief: `${pieceBrief(plan, name, storyboard)}${revision ? `\nUser corrections: ${revision.instruction}` : ''}`,
  }));
  const pieces = await drawAll(model, storyboard, plan, requests, {}, true, { from: 12, to: 97, report });
  report({ percent: 98, label: 'Menyusun draf' });
  return assemble(plan, pieces, storyboard);
}

const REVISE_PLAN_NOTE = `
Revise this existing plan with the user's corrections. Keep everything the corrections do not touch.
Return only JSON: {"plan": <the complete plan in the same shape>, "redraw": ["WorldBase" and/or object names whose drawing must change]}.
New objects are always drawn. List an existing name in redraw only when its look, size, parts, or props change.`;

async function reviseDraft(
  model: string,
  storyboard: Storyboard,
  draft: StorySvgDraft,
  instruction: string,
  report: DraftProgressListener,
): Promise<StorySvgDraft> {
  report({ percent: 3, label: 'Membaca koreksi' });
  const content = `${storyBrief(storyboard)}\nCurrent plan: ${JSON.stringify(draft.plan)}\nUser corrections: ${JSON.stringify(instruction)}`;
  const ask = (text: string) => callChat({ model, system: `${PLAN_SYSTEM}\n${REVISE_PLAN_NOTE}`, content: text, maxTokens: 12_000, timeoutMs: 5 * 60_000 });
  const read = (text: string) => {
    const raw = parseJson(text) as { plan?: unknown; redraw?: unknown };
    const plan = checkPlan(DraftPlanSchema.parse(raw.plan), storyboard);
    const redraw = z.array(z.string()).parse(raw.redraw ?? []);
    return { plan, redraw };
  };
  const first = await ask(content);
  let result: ReturnType<typeof read>;
  try {
    result = read(first.text);
  } catch (error) {
    result = read((await ask(`${content}\nThe previous answer failed: ${String(error)}\nReturn the complete corrected JSON.`)).text);
  }

  const { plan } = result;
  const names = [WORLD, ...plan.objects.map((object) => object.name)];
  // An empty list is a plan-only change, such as which scenes show an object.
  const changed = names.filter((name) => !draft.pieces?.[name] || result.redraw.includes(name));
  const requests = changed.map((name) => ({
    name,
    character: characterOf(plan, name),
    brief: pieceBrief(plan, name, storyboard),
    previous: draft.pieces?.[name],
    note: draft.pieces?.[name] ? `Apply these user corrections and keep everything else: ${instruction}` : undefined,
  }));
  const kept = Object.fromEntries(names.filter((name) => draft.pieces?.[name]).map((name) => [name, draft.pieces![name]]));
  const pieces = requests.length
    ? await drawAll(model, storyboard, plan, requests, kept, false, { from: 15, to: 97, report })
    : kept;
  report({ percent: 98, label: 'Menyusun draf' });
  return assemble(plan, pieces, storyboard);
}
