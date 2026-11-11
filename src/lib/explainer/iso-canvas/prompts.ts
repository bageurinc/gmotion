import type { IsoCanvasDetail, IsoCanvasObject, IsoCanvasPlan } from './plan';

/** The engine API as the model sees it. Kept in one place so every writer agrees. */
export const ISO_API = `World: units are meters, z points up, the ground is the x–y plane. +x goes to the lower right on screen, +y to the lower left, +z up. The viewer looks from (+1,+1,+1), so the visible sides of a box are its top, its +x side (right), and its +y side (left). Faces are shaded automatically from a fixed light; you only give base colors. All colors are "#RRGGBB".

API:
- iso.background(topColor, bottomColor) — fill the canvas.
- iso.look(x, y, z, zoom) — put world point (x,y,z) at the frame centre with zoom pixels per meter.
- iso.camPath([{at: seconds, look: [x,y,z], zoom}, ...], t) — eased camera moves between keys; repeat a key later to hold.
- iso.ground(color, z=0) — floor, grass, water, or table top that always covers the whole frame.
- iso.strip(axis, from, to, color, z=0) — endless band along 'x' or 'y' between from and to on the other axis: roads, sidewalks, rivers, rails.
- iso.dashes(axis, across, length, gap, width, color, phase, z=0.01) — repeating lane marks; animate phase (e.g. t*6).
- iso.shadow(x, y, w, d, z=0) — soft contact shadow under a footprint (min corner x, y; size w, d).
- iso.box(x, y, z, w, d, h, color, {top, alpha, glow, stroke, flat}) — box from its min corner; w along x, d along y, h up.
- iso.cyl(axis, x, y, z, radius, length, color, {sides, seg:[colors], rot, cap, alpha, glow}) — cylinder along 'x' | 'y' | 'z'; (x,y,z) is the centre of its start cap; it extends +length along the axis. seg stripes the side; rot (radians) spins the stripes.
- iso.cone(axis, x, y, z, radius, length, color, {topRadius, sides}) — cone or frustum from base centre along +axis.
- iso.prism(profile, axis, x, y, z, length, color, style) — extrude a 2D polygon [[u,v],...] along an axis. For axis 'x' the profile is (y,z); 'y' → (x,z); 'z' → (x,y). Curved casings, blades, wedges, brackets, shaped panels.
- iso.face(points3D, color, style) — one flat polygon from [[x,y,z],...].
- iso.sphere(x, y, z, radius, color, {alpha, glow}) — shaded ball.
- iso.pipe(points3D, width, color, {flow, flowColor}) — a tube through points; flow (e.g. t*4) animates dashes along it for air, water, current, blood.
- iso.arrow(from3D, to3D, color, {width, alpha}).
- iso.label(x, y, z, text, {dx, dy, sub, color, alpha}) — callout; the engine keeps it inside the safe area. Text in Bahasa Indonesia.
- iso.at(ox, oy, oz, () => {...}) — draw a group shifted.
- iso.rotate(axis, angle, [px,py,pz], () => {...}) — draw a group rotated around an axis through a pivot (radians). Nesting works.
- iso.ramp(t, a, b) → smooth 0..1 between seconds a and b. iso.win(t, a, b) → 0..1..0 window. iso.mixColor(a, b, k). iso.P(x,y,z) → [screenX, screenY].
There is no raw canvas access.

Drawing order: draw solids back to front yourself (painter's algorithm): smaller x+y+z (farther) first, nearer later. Faces inside one solid are sorted for you.
Code must be pure: the same inputs always draw the same picture. No Math.random, Date, timers, fetch, window, document, images, imports, or variables kept between calls.`;

const fnName = (id: string) => `draw${id.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('')}`;
export const objectFunctionName = fnName;

export const OBJECT_SYSTEM = `You model one real object in TypeScript with a small isometric engine, for an explainer video. Another program places it in the world and moves the camera.

${ISO_API}

Answer with exactly one fenced \`\`\`ts block containing only the function (no imports, no other exports). Helper functions go inside it.

Rules:
- The object stands on z = 0 with its footprint centred on the origin, and fills its given size: x from -w/2 to w/2, y from -d/2 to d/2, z from 0 to h.
- It must be instantly recognizable as the real thing, with correct proportions and the characteristic parts a viewer knows. Build it from many primitives: 20–80 calls is normal. A stack of plain blocks is a failure.
- Read each state as \`state.key ?? 0\`, a number from 0 to 1, and make the change clearly visible. Use t (seconds) only for continuous motion such as spinning or flowing, scaled by the state that drives it.
- Draw only the object and its shadow: no background, ground, camera, or labels.
- Use real-world colors. Outlines and shading come from the engine.`;

export function objectRequest(plan: IsoCanvasPlan, object: IsoCanvasObject): string {
  const states = object.states.length ? object.states.map((state) => `- ${state.key}: ${state.meaning}`).join('\n') : '- none';
  return `Video topic setting: ${plan.setting}

Object: ${object.label} (id ${object.id})
Looks like: ${object.look}
Size in meters [w, d, h]: ${JSON.stringify(object.size)}
States (0..1):
${states}

Write: export function ${fnName(object.id)}(iso: Iso, state: Record<string, number>, t: number) { ... }`;
}

export const WORLD_SYSTEM = `You draw the world of an isometric explainer video in TypeScript with a small isometric engine. The objects already exist as functions; you place them and draw their surroundings. A camera program moves through the world; do not set the camera.

${ISO_API}

Answer with exactly one fenced \`\`\`ts block containing only:
export function drawWorld(iso: Iso, t: number, states: IsoStates) { ... }
No imports; the object functions are already imported for you. Helper functions go inside drawWorld.

Rules:
- First iso.background, then iso.ground (and iso.strip for roads, paths, rivers) so the floor always reaches the frame edges. Never draw a floor slab that ends inside the frame.
- Place every object exactly at its given position with iso.at(x, y, z, () => drawName(iso, states['id'] ?? {}, t)).
- Add the surroundings the setting describes so the place is recognizable, built from primitives and kept lower or behind the objects so they stay visible. Surroundings must not cover the objects.
- Draw back to front: things with smaller x+y first.
- Keep movement subtle in the surroundings; the objects carry the story.`;

export function worldRequest(plan: IsoCanvasPlan): string {
  const objects = plan.objects.map((object) => `- ${object.label}: call ${fnName(object.id)}(iso, states['${object.id}'] ?? {}, t) at [${object.at.join(', ')}], size ${JSON.stringify(object.size)}`).join('\n');
  return `Setting: ${plan.setting}
Look: ${plan.look}. Background ${plan.background.top} → ${plan.background.bottom}; ground ${plan.palette.ground}.
Objects:
${objects}`;
}

export const DETAIL_SYSTEM = `You draw one close-up scene of an isometric explainer video in TypeScript with a small isometric engine.

${ISO_API}

Answer with exactly one fenced \`\`\`ts block containing only the BODY of a function (iso, t) => { ... } — statements, no function header, no imports. t is seconds from the start of the scene.

Rules:
- Start with iso.background and set the camera with iso.look or iso.camPath, with a slow push-in. Keep the subject large, centred slightly below the middle; the top 30% of the frame is covered by a headline panel.
- Use iso.ground when the close-up stands on a surface, so the floor reaches the frame edges.
- Show exactly what the description says, recognizably, with something moving that explains the line.
- You may call the listed object functions, scaled with a larger zoom, or model new parts from primitives.
- At most 2 labels, words taken from the spoken line, without sub text.`;

export function detailRequest(plan: IsoCanvasPlan, detail: IsoCanvasDetail, line: string, duration: number): string {
  const objects = detail.objects.map((id) => plan.objects.find((object) => object.id === id)).filter((object): object is IsoCanvasObject => Boolean(object));
  const available = objects.length
    ? objects.map((object) => `- ${fnName(object.id)}(iso, state, t): ${object.label}, size ${JSON.stringify(object.size)}, states ${object.states.map((state) => state.key).join(', ') || 'none'}`).join('\n')
    : '- none';
  return `Setting: ${plan.setting}
Close-up: ${detail.label} — ${detail.draw}
Spoken line: "${line}"
Duration: ${duration.toFixed(1)} s
Colors: background ${plan.background.top} → ${plan.background.bottom}, accent ${plan.palette.accent}
Object functions you may call:
${available}`;
}

export function revisionRequest(original: string, code: string, score: number, issues: string[]): string {
  return `${original}

Below is your previous code and its render: a contact sheet of frames in time order, then one frame larger.
An art director scored it ${score}/10 and asked for these fixes:
${issues.map((issue) => `- ${issue}`).join('\n')}

Fix every issue while keeping what already works. Return the complete corrected code in the same format.

Previous code:
\`\`\`ts
${code}
\`\`\``;
}

export type CriticKind = 'object' | 'world' | 'detail';

const CRITERIA: Record<CriticKind, string> = {
  object: `- recognizability: instantly recognized as the real object, correct proportions and characteristic parts. Generic blocks or blobs score 4 or lower.
- isometricCorrectness: consistent isometric view, parts do not pass through each other, nothing drawn in front of what should cover it, nothing floats.
- detail: enough parts, materials, and color to read as a premium illustration, not clip art.
- stateChange: the frames show the object's states changing visibly (frames go from state 0 to state 1).
Return scores for exactly these keys: recognizability, isometricCorrectness, detail, stateChange.`,
  world: `- recognizability: the place and every object are instantly recognized for the topic.
- isometricCorrectness: consistent isometric view, objects do not pass through each other, nothing floats.
- composition: the floor or ground reaches every frame edge, the focused object is large and readable, surroundings do not cover it, no big empty areas.
- setting: the surroundings make the real place recognizable.
- labelAccuracy: labels point at the thing they name; score 10 if there are no labels.
Return scores for exactly these keys: recognizability, isometricCorrectness, composition, setting, labelAccuracy.`,
  detail: `- recognizability: the close-up subject is instantly recognized and matches the description.
- isometricCorrectness: consistent isometric view, parts do not pass through each other, nothing floats.
- composition: the subject is large, below the top 30% panel area, floor reaches the frame edges when there is one, labels inside the frame and not overlapping.
- motion: something changes across the frames in a way that explains the line.
- labelAccuracy: labels point at the thing they name and add no invented facts; score 10 if there are no labels.
Return scores for exactly these keys: recognizability, isometricCorrectness, composition, motion, labelAccuracy.`,
};

export function criticSystem(kind: CriticKind): string {
  return `You are a strict art director reviewing frames from an isometric explainer video. The first image is a contact sheet of frames in time order; the second is one frame larger.
Score each criterion from 1 to 10:
${CRITERIA[kind]}
Return only JSON: {"imageVisible":true,"scores":{...},"issues":["specific fix"]}.
Set imageVisible to false if you cannot see the frames. List at most 8 issues, ordered by visual impact, each saying exactly what to change in the drawing.`;
}
