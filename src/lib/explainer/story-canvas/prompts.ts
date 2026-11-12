import { EXAMPLE_CHEST, EXAMPLE_HEART, EXAMPLE_PLACE, EXAMPLE_WATER, STORY_STYLE } from './examples';
import { placeFunctionName, propFunctionName, propMapName } from './assemble';
import type { StoryCanvasDetail, StoryCanvasPlace, StoryCanvasPlan, StoryCanvasProp } from './plan';

/** The engine API as the prop, place, and close-up writers see it. People are drawn by the engine. */
export const STORY_API = `World: units are meters, seen straight from the side. x goes right, y goes up, the floor or ground line is y = 0. Every filled shape is shaded automatically (base color, soft shade on its lower-right, highlight on its upper-left, darker outline); you only give base colors "#RRGGBB". Later calls are drawn on top of earlier ones.

API:
- s.light({dir, color, strength, rim}) — the scene light for everything drawn after it. dir is the direction toward the light source in radians (Math.PI * 0.75 upper left, the default; Math.PI / 2 from above; 0 from the right; -Math.PI / 2 from below for lava, fire, or a screen in the lap). color tints highlights and surfaces (warm '#FFD9A0' for late afternoon, cold '#9DB4FF' for night, red '#FF6A3D' for lava). strength 0–1.6. rim: a bright edge on the shadow side, automatic on dark backgrounds.
- s.background(topColor, bottomColor) — fill the frame (sky or wall).
- s.layer(depth, () => {...}) — parallax: depth 0.3–0.7 for far things (they drift less when the camera pans), 1.2–1.4 for a foreground edge. Draw far layers first.
- s.ground(color, y=0, bottomColor) — fills everything below y across the full width: floor, grass, road, water.
- s.band(y0, y1, color, {alpha}) — full-width horizontal stripe: skirting, a far field, a wall panel.
- s.shadow(x, w, y=0) — soft contact shadow centred at x, w meters wide.
- s.rect(x, y, w, h, color, style) — from its lower-left corner; style.r rounds corners (meters).
- s.circle(x, y, r, color, style), s.ellipse(x, y, rx, ry, color, style).
- s.poly([[x, y], ...], color, style) — closed polygon; style.smooth: true makes a soft curved blob (leaves, clouds, dough, bags).
- s.capsule(x1, y1, x2, y2, w, color, style) — thick segment with round ends: handles, pipes, branches, stems, cables.
- Shape style: {alpha, line: color | false, lineWidth (px, default 3), shade: 0..1 (0 = flat, for screens, lights, far details), r, smooth, fillTo, texture, material, lift}.
  material: how the surface takes light: 'matte' (default: cloth, wood, paper, skin), 'metal' (steel, copper, aluminium: sharp bright bands), 'glass' (see-through with a bright streak), 'wet' (organs, tongue, liquid, a wet leaf: small glints), 'glossy' (plastic, paint, ceramic, a phone body: one soft bright spot).
  lift: meters a shape stands in front of what is behind it; it casts a soft shadow away from the light. Use it for a pipe on a wall, a valve inside a chamber, a part on top of a housing, a label plate, a leaf over a branch.
  fillTo: a second color, the fill runs from color at the top to fillTo at the bottom (liquids, metal, glass, organs, skin).
  texture: {kind, size, color, alpha, angle, seed} — a surface pattern clipped inside the shape; size is its spacing in meters, so it shows as the camera comes close. kind: 'muscle' (parallel fibers), 'grain' (wood), 'stripes' (fins, ribs, folds), 'hatch', 'dots' (pores, alveoli), 'speckle' (stone, soil, sand, granite), 'cells' (tissue, fat), 'tiles', 'bricks', 'scales', 'waves' (water surface). Give every large shape a texture that fits its material.
- s.detail(size, () => {...}) — fine detail that fades in as the camera comes close (once something size meters big covers a few pixels): screws, small vessels, fibers, vents, leaf veins, tiny parts. The wide shot stays clean, the close shot is rich.
- s.branch(x, y, {angle, length, width, color, depth, spread, ratio, taper, seed, t, sway, line, alpha}) → tip points — a branching structure splitting in two at each level (depth 1–7): blood vessels, bronchi, roots, a tree, nerves, a river delta, lightning. angle in radians (default straight up), length and width of the trunk in meters. Put leaves, alveoli, or drops at the returned tips.
- s.coil(x1, y1, x2, y2, {turns, amplitude, w, color, wall}) — a serpentine pipe between two points: condenser and evaporator coils, heating elements, springs, radiators.
- s.line([[x, y], ...], w, color, {alpha, dash: [on, off], flow, cap}) — open stroke w meters wide: steam, wind, motion lines, water streams; animate flow (e.g. t * 0.4) to move the dashes.
- s.arrow([x, y], [x, y], color, {width, alpha}).
- s.glow(x, y, r, color, alpha) — soft radial light from a real light source only: a lamp, heat, the sun, a screen, fire, a spark. Never use it as shine on a surface (materials add their own shine); white glows on walls or liquids look like lens flares.
MOTION (driven by t, so it moves in every frame):
- s.tube(points, w, color, {wall, alpha, smooth}) — a vessel, pipe, river, or cable along a smooth path, w meters wide, with a darker wall and a highlight.
- s.flow(points, {kind, t, speed, size, spacing, width, color, alpha, seed}) — particles travelling along the same path: kind 'cells' (blood cells), 'drops' (water), 'bubbles', 'dashes', 'sparks' (electric current), 'packets' (data), 'dots'. speed is meters per second (negative runs backwards, scale it by a state to speed up or stop), size and spacing are meters, width spreads them inside a tube. colorTo changes the particles' color along the path (blue blood turning red in the lungs, hot red gas cooling to blue liquid). Draw it right after the tube it runs in, in a color clearly lighter or brighter than the tube (pale blue cells in a dark blue vein, bright red cells in a dark red artery).
- s.flowArrow(points, {t, width, speed, spacing, color, alpha}) — chevrons marching along a path for big flows: wind, ocean currents, heat, traffic.
- s.emit(x, y, {kind, t, rate, life, speed, direction, spread, gravity, size, grow, color, alpha}) — particles born at a point: 'steam', 'smoke', 'ash', 'bubbles', 'sparks', 'drops'.
- s.beat(t, bpm) → {phase, squeeze}: squeeze rises to 1 and back during a contraction, then rests; scale a heart, a pump, or lungs with it. s.osc(t, period, phase) → -1..1 for swaying, bobbing, idling.
- s.at(x, y, () => {...}), s.rotate(angle, px, py, () => {...}) (radians, counter-clockwise), s.scale(kx, ky, px, py, () => {...}) (grow, squash), s.fade(alpha, () => {...}).
- s.label(x, y, text, {dx, dy, color, alpha}) — callout, only where a task allows it. Text in Bahasa Indonesia.
- s.ramp(t, a, b) → smooth 0..1 between seconds a and b. s.win(t, a, b) → 0..1..0. s.mixColor(a, b, k), s.lit(color, k) (k < 1 darker, > 1 lighter).
There is no raw canvas access and no way to draw people: the engine draws the cast.
Code must be pure: the same inputs always draw the same picture. No Math.random, Date, timers, fetch, window, document, images, imports, or variables kept between calls.`;

export const PROP_SYSTEM = `You draw one real prop in TypeScript with a small flat side-view illustration engine, for a story explainer video. Another program places it in the scene, draws the people, and moves the camera.

${STORY_API}

Answer with exactly one fenced \`\`\`ts block containing the function and, when the request lists parts or flows, the map export (no imports, no other exports). Helper functions go inside the function.

Rules:
- The prop stands on y = 0 with its base centred on x = 0 and fills its given size: x from -w/2 to w/2, y from 0 to h.
- It must be instantly recognizable as the real thing seen from the side, with correct proportions, and drawn like an expert textbook illustration: every component in the request's "Must show" list, each in its real place and recognizable on its own.
- Build it in three levels: the true silhouette; every component, each with 2–3 tones (base, darker inner part, pale rim) and fillTo gradients; then fine detail: a texture on every large shape and small parts (screws, small vessels, fibers, vents) inside s.detail. 50–140 shape calls is normal; never a few flat blobs.
- The camera zooms right into each listed part, so every part must hold its own inner structure and small moving bits at close range.
- Read each state as \`state.key ?? 0\`, a number from 0 to 1, and make the change big enough to read in a wide shot: a part appears or disappears, a level rises or falls, a region changes color, a crack spreads across the wall, gas fills a space, a flow starts or reverses. A state that only moves a few small details is invisible on screen. Use t for continuous motion (a heartbeat, steam, a blinking light, water flowing); states scale how strong it is.
- Draw only the prop: no background, ground, shadow under the whole scene, camera, people, labels, or s.light (the place sets the light).
- Give every part the material it is really made of (metal housings and pipes, glossy plastic, glass, wet organs, matte fabric), and lift on parts that sit on top of others, so the prop reads as layered and real under the scene light.
- Parts and flows: when the request lists them, write \`export const drawNameMap = { parts: { 'part-id': { at: [x, y], size: [w, h] } }, flows: { 'flow-id': [[x, y], [x, y], ...] } };\` BEFORE the function, in the prop's own coordinates (meters, base centre at 0, 0, y up). A part's at is its centre and size its width and height, exactly where the drawing shows it. A flow is the path along which it moves, from start to end, 3 to 10 points. Then draw every flow from that same map inside the function (s.tube then s.flow on drawNameMap.flows['flow-id']), so the camera and the drawing always agree.
- Living or working things keep moving: a heart beats with s.beat, flows keep running, fans spin, leaves sway. States change how strong the motion is (a flow speeds up, a chamber squeezes harder); they do not switch all motion on from zero.

${STORY_STYLE}

Worked examples of the expected level of detail, the map export, flows drawn from the map, and motion that never stops (other props; do not copy them):
\`\`\`ts
${EXAMPLE_HEART}
\`\`\`
\`\`\`ts
${EXAMPLE_WATER}
\`\`\``;

export function propRequest(plan: StoryCanvasPlan, prop: StoryCanvasProp): string {
  const place = plan.places.find((item) => item.id === prop.place);
  const states = prop.states.length ? prop.states.map((state) => `- ${state.key}: ${state.meaning}`).join('\n') : '- none';
  return `Place: ${place?.label ?? prop.place}. ${place?.look ?? ''}

Prop: ${prop.label} (id ${prop.id})
Looks like: ${prop.look}
Size in meters [w, h]: ${JSON.stringify(prop.size)}${prop.must?.length ? `\nMust show (each component drawn and recognizable): ${prop.must.join('; ')}.` : ''}${prop.surface ? `\nA person sits or lies on its top at ${prop.surface} m: keep that top flat and clear.` : ''}
States (0..1):
${states}
${prop.parts?.length || prop.flows?.length ? `Parts the camera will visit (export where each is in ${propMapName(prop.id)}.parts):
${(prop.parts ?? []).map((part) => `- '${part.id}': ${part.label}`).join('\n') || '- none'}
Flows to draw and export as paths (in ${propMapName(prop.id)}.flows):
${(prop.flows ?? []).map((flow) => `- '${flow.id}': ${flow.label}. ${flow.meaning}`).join('\n') || '- none'}
` : ''}
Write: ${prop.parts?.length || prop.flows?.length ? `export const ${propMapName(prop.id)} = { ... }; then ` : ''}export function ${propFunctionName(prop.id)}(s: Story, state: Record<string, number>, t: number) { ... }`;
}

export const PLACE_SYSTEM = `You draw one place (the setting of some scenes) of an explainer video in TypeScript with a small flat 2D illustration engine. It can be any setting at its real scale: a room, a field, a coastline with a volcano, the inside of a chest, the sea floor, outer space. The props (and people, if any) are drawn by another program on top of your place; do not draw them and do not set the camera.

${STORY_API}

Answer with exactly one fenced \`\`\`ts block containing only the function (no imports, no other exports). Helper functions go inside it.

Rules:
- First s.light for the setting's real light source (sun through a window from the left, a lamp above, the glow of lava from below, soft even light inside a body), then s.background, then far layers, then s.ground so the base reaches the frame edges at any camera position, then fixed parts and decoration on the main plane, then an optional foreground layer at an edge.
- The place spans x from 0 to its width in meters at real scale; extend the background, far scenery, and repeated details 40% of the width beyond both sides, so a camera near an edge never shows emptiness.
- Draw the fixed parts the description lists at the given positions. Keep the space at the listed prop positions clear, and keep fixed parts lower or behind them so the props stay visible.
- Read each place state as \`state.key ?? 0\` (0 to 1) and make it change the whole setting visibly, including the light (s.light color and direction mixed by the state): the sky darkens, ash fills the air, water rises, a far volcano erupts, the background pulses. Use t for continuous motion (waves, drifting clouds, flowing blood), scaled by the state that drives it.
- Settings look real and full: 50–150 shape calls is normal. Every large surface (wall, floor, ground, rock, tissue, water) gets a texture that fits its material, and near details (switches, plants, cables, small vessels) use s.detail. Fill the whole frame at every camera position: the background and far layer reach every edge, the base line runs across the full width, and the area around where the props stand holds the setting's own parts (ribs and lungs around a heart, shelves and tiles around a counter, waves and far islands around a volcano). Never leave a large flat empty area in the middle of the frame.
- Never call s.label.

${STORY_STYLE}

Worked examples of the expected level of detail (other places; do not copy them): a room, and the inside of a body.
\`\`\`ts
${EXAMPLE_PLACE}
\`\`\`
\`\`\`ts
${EXAMPLE_CHEST}
\`\`\``;

export function placeRequest(plan: StoryCanvasPlan, place: StoryCanvasPlace): string {
  const props = plan.props.filter((prop) => prop.place === place.id);
  const listed = props.length ? props.map((prop) => `- ${prop.label}: stands at x=${prop.at[0]}, y=${prop.at[1]}, size ${JSON.stringify(prop.size)} (drawn by another program)`).join('\n') : '- none';
  const states = place.states?.length ? place.states.map((state) => `- ${state.key}: ${state.meaning}`).join('\n') : '- none';
  return `Place: ${place.label} (id ${place.id}), ${place.width} m wide at real scale.
Looks like: ${place.look}
Look of the video: ${plan.look}; main base color ${plan.palette.ground}.
States (0..1) that change the whole setting:
${states}
Props that will stand here (leave room for them, do not draw them):
${listed}

Write: export function ${placeFunctionName(place.id)}(s: Story, t: number, state: Record<string, number>) { ... }`;
}

export const DETAIL_SYSTEM = `You draw one close-up scene of a story explainer video in TypeScript with a small flat side-view illustration engine.

${STORY_API}

Answer with exactly one fenced \`\`\`ts block containing only the BODY of a function (s, t) => { ... } — statements, no function header, no imports. t is seconds from the start of the scene.

Rules:
- Start with s.light (the same kind of light as the place this close-up comes from, or a soft lab light for a diagram), then s.background, and set the camera with s.look(x, y, zoom) or s.camPath([{at, look: [x, y], zoom}, ...], t) with a slow push-in. look is the world point placed at the frame centre and zoom is PIXELS PER METER: the frame is about 1080 px wide, so a subject 0.5 m wide fills most of the width at zoom 1600, and a subject 0.1 m wide at zoom 8000. Draw small things at their real size and zoom in; never pass a zoom below 100. Keep the subject large and centred slightly below the middle; the top 30% of the frame is covered by a headline panel and the bottom 20% by captions.
- Show exactly what the description says, recognizably, with something moving that explains the line: a magnified view in a circle, a cutaway, arrows, flows. Show what is inside or how it works (the leaflets swinging open, gas turning to liquid along a coil, layers inside a cell), drawn richly: textures, 2–3 tones per part, fine detail, 40–120 shape calls.
- Every listed prop function MUST be called to draw that prop (with s.at to place it), so it looks exactly as in the rest of the video. Never redraw a listed prop from shapes.
- No people.
- At most 2 labels, words taken from the spoken line.

${STORY_STYLE}`;

export function detailRequest(plan: StoryCanvasPlan, detail: StoryCanvasDetail, line: string, duration: number): string {
  const props = detail.props.map((id) => plan.props.find((prop) => prop.id === id)).filter((prop): prop is StoryCanvasProp => Boolean(prop));
  const available = props.length
    ? props.map((prop) => `- ${propFunctionName(prop.id)}(s, state, t): ${prop.label}. Looks like: ${prop.look} Size ${JSON.stringify(prop.size)}, states ${prop.states.map((state) => state.key).join(', ') || 'none'}`).join('\n')
    : '- none';
  return `Close-up: ${detail.label} — ${detail.draw}
Spoken line: "${line}"
Duration: ${duration.toFixed(1)} s
Accent color: ${plan.palette.accent}
Prop functions you must call for these props (never redraw them yourself):
${available}`;
}

export type StoryCriticKind = 'prop' | 'place' | 'detail';

const CRITERIA: Record<StoryCriticKind, string> = {
  prop: `- recognizability: instantly recognized as the real thing seen from the side, with correct proportions and characteristic parts. Generic blocks or blobs score 4 or lower.
- detail: reads as a premium textbook or editorial illustration: many distinct parts, 2–3 tones per part, textures on large surfaces, fine detail. Score 5 or lower for a few flat blobs, large plain areas, or a drawing a child could make in a minute.
- completeness: every component in the "Must show" list is drawn, in its real place, and recognizable; score 10 if there is no list. Each missing or unrecognizable component costs at least 1 point; name the missing ones in issues.
- stateChange: the frames show the prop's states changing visibly (frames go from state 0 to state 1); score 8 if it has no states and still looks right.
- craft: shapes are clean, nothing floats or passes through other parts, colors are soft and real, and materials read right (metal looks metallic, organs wet, glass see-through, plastic glossy).
- alive: frames 3 and 4 are 0.2 s apart in the same state. A prop that moves on its own (beats, flows, spins, sways) visibly differs between them and its flows show particles travelling; score 3 or lower if it is frozen. Score 8 for a still object that should not move.
The prop is shown alone on a plain floor on purpose: the place around it is drawn by another program. Never score down or ask for a room, table, or background.
Return scores for exactly these keys: recognizability, detail, completeness, stateChange, craft, alive.`,
  place: `These frames show shots of the video in one place, with its props (and people, if any) drawn by the engine.
- recognizability: the setting and every prop are instantly recognized for the topic, at a believable scale.
- setting: the place looks furnished and real, with depth (far layer, main plane, floor) and no empty background.
- detail: rich like a premium editorial illustration: textures on walls, floors, and tissue, 2–3 tones per part, small details; score 5 or lower for flat plain areas and few parts.
- lighting: one clear light source that fits the setting and its states (day, night, lava glow), with highlights and shadows on every object agreeing with it and depth between layers; score 5 or lower for flat even light that makes everything look pasted on.
- characters: people stand on the floor or sit and lie on their furniture convincingly, and their pose fits the action; score 10 if there are no people. Do not judge the people's drawing style; it is fixed.
- composition: the focused subject (and any people) is large and readable below the top 30% panel area; the base reaches the frame edges; fixed parts do not cover the props or people.
- labelAccuracy: labels point at the thing they name; score 10 if there are no labels.
Return scores for exactly these keys: recognizability, setting, detail, lighting, characters, composition, labelAccuracy.`,
  detail: `- recognizability: the close-up subject is instantly recognized and matches the description.
- composition: the subject is large, below the top 30% panel area and above the bottom 20%, labels inside the frame and not overlapping.
- motion: something changes across the frames in a way that explains the line.
- detail: shows what is inside or how it works, drawn richly (textures, several tones, fine parts), not a bigger plain view of the outside; score 5 or lower for flat simple shapes.
- lighting: a clear light direction, materials that read right, and soft shadows that separate the layers; score 5 or lower for flat even light.
- craft: clean shapes, soft real colors, nothing broken or floating.
- labelAccuracy: labels point at the thing they name and add no invented facts; score 10 if there are no labels.
Return scores for exactly these keys: recognizability, composition, motion, detail, lighting, craft, labelAccuracy.`,
};

export function storyCriticSystem(kind: StoryCriticKind): string {
  return `You are a strict art director reviewing frames from a flat side-view story explainer video. The first image is a contact sheet of frames in time order; the second is one frame larger.
Score each criterion from 1 to 10:
${CRITERIA[kind]}
Return only JSON: {"imageVisible":true,"scores":{...},"issues":["specific fix"]}.
Set imageVisible to false if you cannot see the frames. List at most 8 issues, ordered by visual impact, each saying exactly what to change in the drawing.`;
}
