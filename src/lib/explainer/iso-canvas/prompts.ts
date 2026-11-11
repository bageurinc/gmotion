import { ISO_STYLE, objectExamples, worldExample } from './examples';
import type { IsoCanvasDetail, IsoCanvasObject, IsoCanvasPlan } from './plan';
import { TITLE_FONT_NAMES } from '@/motion-kit/iso-canvas/title-fonts';

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
- Use real-world colors. Outlines and shading come from the engine.

${ISO_STYLE}

${objectExamples()}`;

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
- Keep movement subtle in the surroundings; the objects carry the story.
- Never call iso.label: the scenes add their own labels, timed to the narration.

${ISO_STYLE}

${worldExample()}`;

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
- Every listed object function MUST be called to draw that object, so it looks exactly as it does in the rest of the video. Never redraw a listed object from primitives, not even a simplified copy: a second version with other colors or shapes breaks the film.
- Place listed objects with iso.at at the world positions given, so the close-up matches the wide shots, and get close with the camera zoom instead of rebuilding them bigger.
- Use primitives only for what the object functions do not draw: hidden insides, cut-away layers, wires, fields, flows, and arrows. To reveal something inside or under an object, draw those parts around or in front of it.
- At most 2 labels, words taken from the spoken line, without sub text.

${ISO_STYLE}`;

export function detailRequest(plan: IsoCanvasPlan, detail: IsoCanvasDetail, line: string, duration: number): string {
  const objects = detail.objects.map((id) => plan.objects.find((object) => object.id === id)).filter((object): object is IsoCanvasObject => Boolean(object));
  const available = objects.length
    ? objects.map((object) => `- ${fnName(object.id)}(iso, state, t): ${object.label}. Looks like: ${object.look} World position [${object.at.join(', ')}], size ${JSON.stringify(object.size)}, states ${object.states.map((state) => state.key).join(', ') || 'none'}`).join('\n')
    : '- none';
  return `Setting: ${plan.setting}
Close-up: ${detail.label} — ${detail.draw}
Spoken line: "${line}"
Duration: ${duration.toFixed(1)} s
Colors: background ${plan.background.top} → ${plan.background.bottom}, accent ${plan.palette.accent}
Object functions you must call for these objects (never redraw them yourself):
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

export type CriticKind = 'object' | 'world' | 'detail' | 'title' | 'caption' | 'panel';

const CRITERIA: Record<CriticKind, string> = {
  object: `- recognizability: instantly recognized as the real object, correct proportions and characteristic parts. Generic blocks or blobs score 4 or lower.
- isometricCorrectness: consistent isometric view, parts do not pass through each other, nothing drawn in front of what should cover it, nothing floats.
- detail: enough parts, materials, and color to read as a premium illustration, not clip art.
- stateChange: the frames show the object's states changing visibly (frames go from state 0 to state 1).
The object is shown alone on a plain floor on purpose: the world around it is drawn by another program. Never score down or ask for a table, road, room, background, or other surroundings.
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
  title: `These frames show the opening title card of a vertical short, drawn over the first scene.
- readability: every word is readable at phone size once it has arrived, with strong contrast against what is behind it; nothing is cut off by the frame edges or hidden in the top 7%.
- typography: the fonts, colors, and layout suit the topic and look like a premium hand-designed cover, with a clear hierarchy (small lead-in, big key words). Generic centered white text scores 4 or lower.
- motion: the entrance and exit are designed animations that suit the topic, not a plain fade; the frames show the card arriving, holding, and leaving.
- composition: the card sits in the upper part of the frame and leaves the lower part of the scene visible; it never fills the whole frame with a solid block.
- accuracy: all text is Bahasa Indonesia and claims nothing beyond the topic and narration.
Return scores for exactly these keys: readability, typography, motion, composition, accuracy.`,
  caption: `These frames show the word-by-word captions of a vertical short at different moments, over the scene.
- readability: every caption word is easy to read at phone size over the busy scene in every frame, with strong contrast; at most two lines; nothing cut off.
- activeWord: the word being spoken stands out clearly from the others in each frame, and the highlight moves from frame to frame.
- style: font, color, and treatment suit the topic and look custom-designed (matching the title card when one is described), not a default white box. Captions should support the picture, not compete with it.
- composition: the caption sits at the bottom of the frame, moderate in size (well under a quarter of the height), never covering the middle of the scene.
- calm: words do not jump around or reflow as the highlight moves; no flashing or jitter that would tire a viewer over a whole video.
Return scores for exactly these keys: readability, activeWord, style, composition, calm.`,
  panel: `These frames show the top panel of a vertical explainer short across three scenes (two moments each, the last frame only one), over the scene.
- readability: the scene headline is easy to read at phone size with strong contrast; the status and any number are legible; nothing is cut off or hidden in the top 7%.
- hierarchy: the headline leads, the emphasised word stands out, status and number are clearly secondary.
- style: shapes, colors, and type suit the topic and look custom-designed (matching the title card when one is described). A plain solid band with a small fade scores 4 or lower.
- composition: the panel stays in the top part of the frame and ends above about 29% of the height, leaving the scene visible below it; it never covers the middle.
- transition: when the scene changes, the new headline arrives with a designed, calm animation; the frames show it.
Return scores for exactly these keys: readability, hierarchy, style, composition, transition.`,
};

export function criticSystem(kind: CriticKind): string {
  return `You are a strict art director reviewing frames from an explainer video. The first image is a contact sheet of frames in time order; the second is one frame larger.
Score each criterion from 1 to 10:
${CRITERIA[kind]}
Return only JSON: {"imageVisible":true,"scores":{...},"issues":["specific fix"]}.
Set imageVisible to false if you cannot see the frames. List at most 8 issues, ordered by visual impact, each saying exactly what to change in the drawing.`;
}

export const TITLE_SYSTEM = `You design the opening title card of a vertical explainer short (YouTube Shorts / TikTok) as one React component for Remotion. Every video gets its own design: choose the typography, color, layout, ornaments, and motion that fit this topic, the way a top motion designer would make a thumbnail-worthy cover. Do not fall back on a template look.

Answer with exactly one fenced \`\`\`tsx block containing the whole file:

import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTitleFont } from '@/motion-kit';

export const TITLE_TEXT = ['lead-in line', 'KEY WORDS', 'optional small line'];

export const TitleCard: React.FC<{ duration: number }> = ({ duration }) => { ... };

Contract:
- duration is the card's length in frames. Read frame with useCurrentFrame() and fps, width, height with useVideoConfig(); size everything from width and height, never fixed pixels.
- TITLE_TEXT lists every piece of text the card shows, in reading order; the component renders only text from TITLE_TEXT (you may split it into words or letters to animate them).
- Fonts: const display = useTitleFont('Font Name', weight) returns a CSS fontFamily. Call it at the top of the component, never inside conditions or loops. Use one or two fonts from this list only: ${TITLE_FONT_NAMES.map((name) => `'${name}'`).join(', ')}.
- Allowed tools: divs, spans, inline SVG shapes (rect, circle, path, line, polygon, linearGradient, radialGradient), CSS gradients, transforms, clipPath, text-shadow, -webkit-text-stroke, letter-spacing, mix of interpolate/spring/Easing. No images, no external URLs, no <style> tags, no Math.random, Date, timers, window, or document. The same frame always renders the same picture.

Design rules:
- Hierarchy like a cover: a small lead-in line, then 1–4 huge key words (at least 0.11 × unit tall for the biggest word, where unit = Math.min(width, height), so a landscape frame does not get giant text), optionally one small line under. A number the narration states may become the hero, huge.
- Text: casual Bahasa Indonesia, built from the given title and narration. Never add facts, numbers, years, or claims that are not in them.
- Place the card in the upper part of the frame: start below the top 7% (platform controls) and end above roughly 55% of the height, keeping 7% side margins. The first scene stays visible behind and below it, and captions sit at the bottom.
- The scene behind is a busy illustration in unknown colors, so give the text its own legibility: a soft gradient scrim, a panel, a glow, outlines, or heavy shadows.
- Motion: the full entrance lands within about 1.2 s (staggered letters or words, mask or wipe reveals, scale slams, counters, lines drawing, light sweeps, whatever suits the topic), a lively hold (subtle drift, shimmer, or pulse), and a designed exit in the last 0.4 s that clears the card completely by the final frame.
- Let the topic lead: e.g. history may feel engraved or gilded, space airy and starry, engineering precise and technical, nature organic, folklore playful, danger urgent. Invent beyond these.`;

export function titleRequest(input: { topic: string; title: string; narration: string[]; seconds: number; palette: IsoCanvasPlan['palette']; background: IsoCanvasPlan['background'] }): string {
  return `Topic asked by the user: "${input.topic}"
Video title: "${input.title}"
Narration, scene by scene (the first line plays under the card):
${input.narration.map((line, index) => `${index + 1}. ${line}`).join('\n')}
Card length: ${input.seconds.toFixed(1)} s
Scene colors behind the card: background ${input.background.top} → ${input.background.bottom}, ground ${input.palette.ground}; the video's accent is ${input.palette.accent}.`;
}

export const CAPTION_SYSTEM = `You design the word-by-word captions of a vertical explainer short (YouTube Shorts / TikTok) as one React component for Remotion. The engine already splits the narration into groups of up to 5 words, times every word to the voice, and places your component at the bottom inside the platform safe area. You decide only how the captions look and move: font, colors, background treatment, how the spoken word is highlighted, and how words appear. Make it fit this video's topic and its title card; do not fall back on a template look.

Answer with exactly one fenced \`\`\`tsx block containing the whole file:

import React from 'react';
import { Easing, interpolate, spring, useVideoConfig } from 'remotion';
import { useTitleFont, type CaptionProps } from '@/motion-kit';

export const CaptionCard: React.FC<CaptionProps> = ({ words, since, group }) => { ... };

Props:
- words: the current group in reading order, each { text, state, since }. state is 'past' (already spoken), 'active' (being spoken now), or 'future' (coming in this group). since is frames since that word started (negative while ahead).
- since: frames since this group appeared. group: index of the group within the scene.
- Read fps, width, and height from useVideoConfig(). Size everything from the shorter side, const unit = Math.min(width, height), never from width alone and never in fixed pixels: the video may be vertical (9:16), square-ish (4:5), or landscape (16:9).

Contract:
- Render only the words' text, in order, every word of the group; no other text, no emoji, no icons.
- Fonts: const font = useTitleFont('Font Name', weight) at the top of the component, never inside conditions or loops. Use one font from this list only: ${TITLE_FONT_NAMES.map((name) => `'${name}'`).join(', ')}.
- Allowed tools: divs, spans, inline SVG shapes, CSS gradients, transforms, text-shadow, -webkit-text-stroke, interpolate/spring/Easing. No images, URLs, <style> tags, Math.random, Date, timers, window, or document. The same props always render the same picture.

Design rules:
- Readable first: font size between 0.045 and 0.07 × unit, at most two centered lines, at most 0.8 × width wide, strong contrast against a busy illustration in unknown colors (a backing shape, outline, or heavy shadow).
- The active word must stand out (color, highlight shape, underline, weight via transform scale, glow), and its look must change smoothly as since grows.
- Layout must not reflow: highlighting a word may not change any word's size in the layout; scale with transform only. Words never jump position.
- Motion stays calm because it runs for the whole video: a short entrance per group or per word (under 0.3 s), no flashing, no constant shaking.
- Keep the whole caption under 20% of the frame height.`;

export function captionRequest(input: { topic: string; title: string; sample: string; palette: IsoCanvasPlan['palette']; background: IsoCanvasPlan['background']; titleCode: string | null }): string {
  return `Topic asked by the user: "${input.topic}"
Video title: "${input.title}"
A sample narration line: "${input.sample}"
Scene colors behind the captions: background ${input.background.top} → ${input.background.bottom}, ground ${input.palette.ground}; the video's accent is ${input.palette.accent}.
${input.titleCode ? `The opening title card of this video, so your captions feel like the same design (reuse its font family or colors where it helps readability):
\`\`\`tsx
${input.titleCode}
\`\`\`` : 'This video has no designed title card.'}`;
}

export const PANEL_SYSTEM = `You design the top information panel of a vertical explainer short (YouTube Shorts / TikTok) as one React component for Remotion. It shows each scene's headline, a status word, and, in videos that state numbers, a counting number with a small trend. The engine decides all the text and numbers; you decide how the panel looks and moves: shapes, colors, type, ornaments, and how each new scene's headline arrives. Make it fit this video's topic and its title card; avoid the plain solid band.

Answer with exactly one fenced \`\`\`tsx block containing the whole file:

import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useVideoConfig } from 'remotion';
import { useTitleFont, type PanelProps } from '@/motion-kit';

export const PanelCard: React.FC<PanelProps> = ({ headline, accent, status, clock, number, scene, scenes, since, safeTop, maxBottom }) => { ... };

Props:
- headline: this scene's heading. accent: one word of the headline to emphasise, or null.
- status: a short state word or null. clock: a short time text or null.
- number: null when the video states no numbers. Otherwise { reached, value, unit, history, all }: show value with unit only when reached is true (an empty spot before that), history is the numbers stated so far and all is every number, for an optional small trend line.
- scene and scenes: this scene's index from 0 and the scene count. since: frames since this scene started, for the headline's entrance.
- safeTop: pixels from the top where text may start (platform controls sit above). maxBottom: pixels from the top the whole panel must end above.
- Read fps, width, and height from useVideoConfig(); size everything from width and height, never fixed pixels. Position everything absolutely inside the full frame.

Contract:
- Render only the given text and numbers; never write other words, labels, or numbers.
- Fonts: const font = useTitleFont('Font Name', weight) at the top of the component, never inside conditions or loops. One or two fonts from this list only: ${TITLE_FONT_NAMES.map((name) => `'${name}'`).join(', ')}.
- Allowed tools: divs, spans, inline SVG shapes and gradients, CSS gradients, transforms, clipPath, text-shadow, -webkit-text-stroke, interpolate/spring/Easing. No images, URLs, <style> tags, Math.random, Date, timers, window, or document. The same props always render the same picture.

Design rules:
- The headline is the largest text, about 0.05–0.065 × unit where unit = Math.min(width, height), at most two lines, with 7% side margins.
- Everything, including backgrounds and shadows, ends above maxBottom; the scene's subject is drawn just below it.
- Give the text its own legibility over a busy illustration: a shaped panel, a translucent glass plate, a ribbon, a gradient that fades into the scene, or strong outlines.
- Each new scene's headline arrives within about 0.5 s (since counts from 0 at each scene); keep the rest calm, because the panel stays on screen for the whole video.`;

export function panelRequest(input: { topic: string; title: string; headlines: string[]; hasNumbers: boolean; palette: IsoCanvasPlan['palette']; background: IsoCanvasPlan['background']; titleCode: string | null }): string {
  return `Topic asked by the user: "${input.topic}"
Video title: "${input.title}"
Scene headlines in this video: ${input.headlines.map((line) => `"${line}"`).join(', ')}
${input.hasNumbers ? 'This video states numbers, so number is not null.' : 'This video states no numbers, so number is always null.'}
Scene colors behind the panel: background ${input.background.top} → ${input.background.bottom}, ground ${input.palette.ground}; the video's accent is ${input.palette.accent}.
${input.titleCode ? `The opening title card of this video, so the panel feels like the same design:
\`\`\`tsx
${input.titleCode}
\`\`\`` : 'This video has no designed title card.'}`;
}
