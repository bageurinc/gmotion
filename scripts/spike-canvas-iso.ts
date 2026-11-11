import fs from 'fs';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import sharp from 'sharp';
import { callChat, parseCritique } from '../src/lib/explainer/asset-generator';
import { createIso } from '../src/motion-kit/iso-canvas/engine';

/**
 * Spike: can Gemini draw a recognizable isometric object with the Canvas engine?
 * Gemini writes one `function draw(iso, t)` for a 3-second clip; the script dry-runs it
 * against a fake canvas (errors go back to the model, max 3 attempts), then renders stills
 * and an MP4 with Remotion.
 *   npx tsx --env-file=.env scripts/spike-canvas-iso.ts --name kipas --topic "Kipas angin meja berputar"
 *   npx tsx --env-file=.env scripts/spike-canvas-iso.ts --name sanity --code path/to/scene.js
 * Each round is rendered and scored by a critic; below --threshold (default 6) the model
 * revises from its frames and the critic's issues, up to --rounds (default 3). The best
 * round becomes clip.mp4 and summary.txt lists scores, tokens, and cost.
 */
const argument = (name: string, fallback = '') => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const name = argument('name', 'kipas');
const topic = argument('topic', 'Kipas angin meja berputar');
const codeFile = argument('code');
const model = argument('model', process.env.DIRECTOR_MODEL || 'ag/gemini-3.8-flash-high');
const directory = path.join(process.cwd(), 'storage', 'spike', 'canvas-iso', name);
const FPS = 30;
const DURATION = 90;
const WIDTH = 1080;
const HEIGHT = 1920;

const SYSTEM = `You write one JavaScript function that draws one frame of a 3-second isometric explainer clip on a 1080x1920 (portrait) canvas.

Answer with exactly one fenced \`\`\`js block containing:
function draw(iso, t) { ... }
t is time in seconds (0 to 3). The function must be pure: same t → same picture. No Math.random, Date, timers, fetch, window, document, images, or imports.

World: units are arbitrary, z points up, the ground is the x–y plane. +x goes to the lower right on screen, +y to the lower left, +z up. The viewer looks from (+1,+1,+1), so the visible sides of a box are its top, its +x side (right), and its +y side (left). Faces are shaded automatically from a fixed light; you only give base colors.

API (all colors are "#RRGGBB"):
- iso.background(topColor, bottomColor) — fill the canvas. Call first.
- iso.look(x, y, z, zoom) — put world point (x,y,z) at the frame centre with zoom pixels per unit. Prefer this over cam.
- iso.camPath([{at: seconds, look: [x,y,z], zoom}, ...], t) — eased camera moves between keys; repeat a key later to hold. Use it for a slow push-in or a move between parts.
- iso.cam(screenX, screenY, pixelsPerUnit) — low-level: where world origin lands on screen.
- iso.ground(color, z=0) — a floor, grass, water, or table top that always covers the whole frame. Use it instead of a finite slab whenever the scene stands on ground, so the floor never ends inside the frame.
- iso.strip(axis, from, to, color, z=0) — an endless band along 'x' or 'y' between from and to on the other axis: roads, sidewalks, rivers, rails. It always runs past both frame edges.
- iso.dashes(axis, across, length, gap, width, color, phase, z=0.01) — repeating lane marks along an axis; animate phase (e.g. t*6) to show motion.
- iso.shadow(x, y, w, d, z=0) — soft contact shadow under an object's footprint, so it does not float.
- iso.box(x, y, z, w, d, h, color, {top, alpha, glow, stroke, flat}) — box from its min corner; w along x, d along y, h up.
- iso.cyl(axis, x, y, z, radius, length, color, {sides, seg:[colors], rot, cap, alpha, glow}) — cylinder along 'x' | 'y' | 'z'; (x,y,z) is the centre of its start cap; it extends +length along the axis. seg stripes the side; rot (radians) spins the stripes.
- iso.cone(axis, x, y, z, radius, length, color, {topRadius, sides}) — cone or frustum from base centre along +axis.
- iso.prism(profile, axis, x, y, z, length, color, style) — extrude a 2D polygon profile [[u,v],...] along an axis. For axis 'x' the profile is (y,z); 'y' → (x,z); 'z' → (x,y). Use it for curved casings, blades, wedges, brackets, panels with a shaped outline.
- iso.face(points3D, color, style) — one flat polygon from [[x,y,z],...].
- iso.sphere(x, y, z, radius, color, {alpha, glow}) — shaded ball.
- iso.pipe(points3D, width, color, {flow, flowColor}) — a tube through points; flow (e.g. t*4) animates dashes along it, for air, water, current, refrigerant.
- iso.arrow(from3D, to3D, color, {width, alpha}).
- iso.label(x, y, z, text, {dx, dy, sub, color, alpha, size}) — callout dot on the world point, line to a text box near (dx, dy) pixels from it. The engine keeps boxes inside the safe area and apart, so just pick a side. Text in Bahasa Indonesia.
- iso.at(ox, oy, oz, () => {...}) — draw a group shifted.
- iso.rotate(axis, angle, [px,py,pz], () => {...}) — draw a group rotated around an axis through a pivot (radians). Use it for spinning fans, opening lids, swinging arms. Nesting works.
- iso.ramp(t, a, b) → smooth 0..1 between seconds a and b. iso.win(t, a, b) → 0..1..0 window.
- iso.mixColor(a, b, k), iso.P(x,y,z) → [screenX, screenY]. There is no raw canvas access; draw everything through this API.

Drawing order: you draw solids back to front yourself (painter's algorithm). Objects with smaller x+y+z (farther) first; objects in front later. Inside one solid, faces are sorted for you.

Goal: the object must be instantly recognizable as the real thing a viewer knows, with correct proportions and the characteristic parts (not a stack of generic blocks). Build it from many primitives: 20–60 calls is normal. Put it on iso.ground or a strip only when the real thing stands on one; never draw a floor slab that ends inside the frame. Keep the subject large and centred, filling most of the width. Something must move during the 3 seconds in a way that explains the topic (spin, flow, open, light up), plus a slow camera push-in. Add 1–3 labels that fade in at different times for the parts the topic is about. Use the background color that suits the topic; avoid dark backgrounds unless the topic is dark.`;

function fakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: String(text).length * 18 }),
    save: () => undefined,
    restore: () => undefined,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  return new Proxy(target, {
    get: (object, key) => (key in object ? object[key as string] : typeof key === 'string' && /^[a-z]/.test(key) ? () => undefined : undefined),
    set: (object, key, value) => {
      object[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function extractCode(text: string): string | null {
  const match = /```(?:js|javascript)?\s*\n([\s\S]*?)```/.exec(text);
  const code = (match ? match[1] : text).trim();
  return /function\s+draw\s*\(/.test(code) ? code : null;
}

const FORBIDDEN = /\b(Math\.random|Date|setTimeout|setInterval|fetch|window|document|import|require|eval|Function)\b/;

function dryRun(code: string): string | null {
  if (FORBIDDEN.test(code)) return `Forbidden identifier: ${FORBIDDEN.exec(code)?.[0]}`;
  try {
    const draw = new Function(`${code}\nreturn draw;`)() as (iso: unknown, t: number) => void;
    for (const t of [0, 0.7, 1.5, 2.2, 2.97]) {
      const iso = createIso(fakeContext(), WIDTH, HEIGHT);
      draw(iso, t);
      iso.finish();
    }
    return null;
  } catch (error) {
    return String((error as Error)?.stack ?? error).split('\n').slice(0, 3).join(' | ');
  }
}

const seconds = (startedAt: number) => ((Date.now() - startedAt) / 1000).toFixed(1) + 's';

const THRESHOLD = Number(argument('threshold', '6'));
const ROUNDS = Number(argument('rounds', '3'));
const criticModel = process.env.CRITIC_MODEL || model;
// IDR per million tokens for ag/gemini-3.8-flash-high (model_rates, November 2026).
const RATE = { input: 13_597.5, output: 67_987.5 };
const spent = { input: 0, output: 0 };
const track = (label: string, startedAt: number, usage: { promptTokens?: number; completionTokens?: number }) => {
  spent.input += usage.promptTokens ?? 0;
  spent.output += usage.completionTokens ?? 0;
  console.log(label, seconds(startedAt), `in ${usage.promptTokens} out ${usage.completionTokens}`);
};

const CRITIC = `You are a strict art director reviewing a 3-second isometric explainer clip. The first image is a contact sheet of frames at t = 0, 1, 2, 2.97 s; the second is t = 2 s larger.
Score each criterion from 1 to 10:
- recognizability: every main object is instantly recognized as the real thing the topic is about, with correct proportions and characteristic parts. Generic blocks or blobs score 4 or lower.
- isometricCorrectness: consistent isometric view, objects do not pass through each other, nothing is drawn in front of what should cover it, nothing floats.
- composition: the subject is large and readable; ground, road, or floor reaches the frame edges instead of stopping inside the frame with empty background around it; no big empty areas; labels sit fully inside the frame and do not overlap each other.
- motion: something changes across the frames in a way that explains the topic.
- labelAccuracy: each label points at the part it names and the facts are right.
Return only JSON: {"imageVisible":true,"scores":{"recognizability":0,"isometricCorrectness":0,"composition":0,"motion":0,"labelAccuracy":0},"issues":["specific fix"]}.
Set imageVisible to false if you cannot see the frames. List at most 8 issues, ordered by visual impact, each saying exactly what to change.`;

type Critique = ReturnType<typeof parseCritique>;

const jpegPart = (buffer: Buffer) => ({ type: 'image_url' as const, image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` } });

/** First draft: retries only when the code does not run. */
async function firstCode(): Promise<string> {
  if (codeFile) return fs.readFileSync(codeFile, 'utf8');
  let feedback = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const startedAt = Date.now();
    const { text, usage } = await callChat({ model, system: SYSTEM, content: `Topic (Indonesian): "${topic}"${feedback}`, maxTokens: 24_000 });
    fs.writeFileSync(path.join(directory, `answer-1-${attempt}.md`), text);
    track(`WRITE round 1 attempt ${attempt}`, startedAt, usage);
    const code = extractCode(text);
    const problem = code ? dryRun(code) : 'No ```js block with function draw(iso, t).';
    if (code && !problem) return code;
    console.log('WRITE rejected:', problem);
    feedback = `\n\nYour previous answer failed: ${problem}\nFix it and return the full function again.${code ? `\n\nPrevious code:\n${code.slice(0, 20_000)}` : ''}`;
  }
  throw new Error('Gemini did not return runnable code in 3 attempts');
}

/** Revision: the model sees its own frames plus the critic's issues and rewrites the code. */
async function revisedCode(round: number, previous: string, critique: Critique, sheet: Buffer, still: Buffer): Promise<string | null> {
  const startedAt = Date.now();
  const { text, usage } = await callChat({
    model,
    system: SYSTEM,
    maxTokens: 24_000,
    content: [
      {
        type: 'text',
        text: `Topic (Indonesian): "${topic}"\n\nBelow is your previous code and its render: a contact sheet of frames at t = 0, 1, 2, 2.97 s, then frame t = 2 s larger.\nAn art director scored it ${critique.average}/10 (${JSON.stringify(critique.scores)}) and asked for these fixes:\n${critique.issues.map((issue) => `- ${issue}`).join('\n')}\n\nFix every issue while keeping what already works. Return the full corrected function.\n\nPrevious code:\n\`\`\`js\n${previous}\n\`\`\``,
      },
      jpegPart(sheet),
      jpegPart(still),
    ],
  });
  fs.writeFileSync(path.join(directory, `answer-${round}.md`), text);
  track(`WRITE round ${round}`, startedAt, usage);
  const code = extractCode(text);
  const problem = code ? dryRun(code) : 'no code';
  if (!code || problem) {
    console.log('WRITE revision rejected:', problem);
    return null;
  }
  return code;
}

async function critique(sheet: Buffer, still: Buffer): Promise<Critique> {
  const startedAt = Date.now();
  const { text, usage } = await callChat({
    model: criticModel,
    system: CRITIC,
    maxTokens: 3_000,
    content: [{ type: 'text', text: `Topic (Indonesian): "${topic}"` }, jpegPart(sheet), jpegPart(still)],
  });
  track('CRITIC', startedAt, usage);
  return parseCritique(text);
}

/** Bundles one version of the scene and renders its sample frames. */
async function renderRound(round: number, code: string) {
  const roundDir = path.join(directory, `round-${round}`);
  fs.mkdirSync(roundDir, { recursive: true });
  fs.writeFileSync(path.join(roundDir, 'scene.js'), `${code}\nexport default draw;\n`);
  const entryPoint = path.join(roundDir, 'Root.tsx');
  fs.writeFileSync(
    entryPoint,
    `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { CanvasScene } from '@/motion-kit/iso-canvas/CanvasScene';
import draw from './scene.js';

const Clip: React.FC = () => <CanvasScene draw={draw as never} />;
registerRoot(() => <Composition id="Clip" component={Clip} durationInFrames={${DURATION}} fps={${FPS}} width={${WIDTH}} height={${HEIGHT}} />);
`,
  );
  const serveUrl = await bundle({
    entryPoint,
    ignoreRegisterRootWarning: true,
    webpackOverride: (config) => ({ ...config, resolve: { ...config.resolve, alias: { ...(config.resolve?.alias || {}), '@': path.join(process.cwd(), 'src') } } }),
  });
  const composition = await selectComposition({ serveUrl, id: 'Clip' });
  const frames: Buffer[] = [];
  for (const frame of [0, 30, 60, 89]) {
    const { buffer } = await renderStill({ composition, serveUrl, frame, output: null, imageFormat: 'png' });
    frames.push(buffer as Buffer);
    fs.writeFileSync(path.join(roundDir, `frame-${frame}.png`), buffer as Buffer);
  }
  const thumbs = await Promise.all(frames.map((input) => sharp(input).resize(405, 720).toBuffer()));
  const sheet = await sharp({ create: { width: 405 * thumbs.length, height: 720, channels: 3, background: '#000000' } })
    .composite(thumbs.map((input, index) => ({ input, left: index * 405, top: 0 })))
    .jpeg({ quality: 88 })
    .toBuffer();
  fs.writeFileSync(path.join(roundDir, 'sheet.jpg'), sheet);
  const still = await sharp(frames[2]).resize(540, 960).jpeg({ quality: 85 }).toBuffer();
  return { roundDir, serveUrl, composition, sheet, still };
}

async function main() {
  fs.mkdirSync(directory, { recursive: true });
  let code = await firstCode();
  let best: { round: number; average: number; render: Awaited<ReturnType<typeof renderRound>> } | null = null;
  const history: string[] = [];
  for (let round = 1; round <= ROUNDS; round += 1) {
    const lines = code.split('\n').length;
    const calls = (code.match(/iso\.(box|cyl|cone|prism|face|sphere|pipe)\(/g) ?? []).length;
    const render = await renderRound(round, code);
    const review = await critique(render.sheet, render.still);
    fs.writeFileSync(path.join(render.roundDir, 'critique.json'), JSON.stringify(review, null, 2));
    history.push(`round ${round}: ${review.average} ${JSON.stringify(review.scores)} (${lines} lines, ${calls} primitives)`);
    console.log('SCORE', history[history.length - 1]);
    if (!best || review.average > best.average) best = { round, average: review.average, render };
    if (review.average >= THRESHOLD || round === ROUNDS) break;
    const next = await revisedCode(round + 1, code, review, render.sheet, render.still);
    if (!next) break;
    code = next;
  }
  if (!best) throw new Error('No round rendered');
  const renderedAt = Date.now();
  await renderMedia({ composition: best.render.composition, serveUrl: best.render.serveUrl, codec: 'h264', pixelFormat: 'yuv420p', crf: 18, outputLocation: path.join(directory, 'clip.mp4') });
  console.log('RENDER best', `round ${best.round}`, seconds(renderedAt));
  const idr = (spent.input * RATE.input + spent.output * RATE.output) / 1_000_000;
  const passed = best.average >= THRESHOLD;
  const summary = `${topic}\nthreshold ${THRESHOLD}, ${passed ? 'passed' : 'not reached'}; best round ${best.round} (${best.average})\n${history.join('\n')}\ntokens in ${spent.input} out ${spent.output}, about Rp${Math.round(idr)}\n`;
  fs.writeFileSync(path.join(directory, 'summary.txt'), summary);
  console.log('SUMMARY\n' + summary);
}

main().catch((error) => {
  console.log('SPIKE FAILED', String(error?.stack ?? error).slice(0, 1500));
  process.exitCode = 1;
});
