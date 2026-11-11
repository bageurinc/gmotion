import fs from 'fs';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import sharp from 'sharp';
import { callChat, parseCritique } from '../src/lib/explainer/asset-generator';
import { EXAMPLE_KITCHEN, STORY_STYLE } from '../src/lib/explainer/story-canvas/examples';
import { createStory } from '../src/motion-kit/story-canvas/engine';

/**
 * Spike: can Gemini draw a recognizable side-view story scene with people on the story canvas
 * engine? Same loop as spike-canvas-iso.ts: Gemini writes one `function draw(s, t)` for a
 * 3-second clip, the script dry-runs it against a fake canvas, renders frames, a critic scores
 * them, and below --threshold the model revises from its frames, up to --rounds.
 *   npx tsx --env-file=.env scripts/spike-story-canvas.ts --name roti --topic "Kenapa adonan roti bisa mengembang?"
 *   npx tsx scripts/spike-story-canvas.ts --name example --example
 *   npx tsx scripts/spike-story-canvas.ts --name sanity --code path/to/scene.js
 */
const argument = (name: string, fallback = '') => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const name = argument('name', 'roti');
const topic = argument('topic', 'Kenapa adonan roti bisa mengembang?');
const codeFile = argument('code');
const useExample = flag('example');
const model = argument('model', process.env.DIRECTOR_MODEL || 'ag/gemini-3.8-flash-high');
const directory = path.join(process.cwd(), 'storage', 'spike', 'story-canvas', name);
const FPS = 30;
const DURATION = 90;
const WIDTH = 1080;
const HEIGHT = 1920;

const SYSTEM = `You write one JavaScript function that draws one frame of a 3-second story explainer clip on a 1080x1920 (portrait) canvas, in a flat side-view illustration style.

Answer with exactly one fenced \`\`\`js block containing:
function draw(s, t) { ... }
t is time in seconds (0 to 3). The function must be pure: same t → same picture. No Math.random, Date, timers, fetch, window, document, images, or imports.

World: units are meters, seen straight from the side. x goes right, y goes up, the ground line is y = 0. Every filled shape is shaded automatically (base color, soft shade on its lower-right, highlight on its upper-left, darker outline); you only give base colors "#RRGGBB". Later calls are drawn on top of earlier ones.

API:
- s.background(topColor, bottomColor) — fill the frame (sky or wall). Call first.
- s.camPath([{at: seconds, look: [x, y], zoom}, ...], t) — eased camera; look is the world point at the frame centre, zoom is pixels per meter (a 1.7 m person fills about half the frame height at zoom 560). s.look(x, y, zoom) for a fixed camera.
- s.layer(depth, () => {...}) — parallax: depth 0.3–0.7 for far things (they drift less when the camera pans), 1 is the main plane, 1.2–1.4 for a foreground edge. Draw far layers first.
- s.ground(color, y=0, bottomColor) — fills everything below y across the full width: floor, grass, road, water.
- s.band(y0, y1, color, {alpha}) — full-width horizontal stripe: skirting, a far field, a wall panel, a road.
- s.shadow(x, w, y=0) — soft contact shadow centred at x, w meters wide, under anything that stands.
- s.rect(x, y, w, h, color, style) — from its lower-left corner; style.r rounds corners (meters).
- s.circle(x, y, r, color, style), s.ellipse(x, y, rx, ry, color, style).
- s.poly([[x, y], ...], color, style) — closed polygon; style.smooth: true makes a soft curved blob (leaves, clouds, dough, hair, bags).
- s.capsule(x1, y1, x2, y2, w, color, style) — thick segment with round ends: handles, pipes, branches, stems, cables.
- Shape style: {alpha, line: color | false, lineWidth (px, default 3), shade: 0..1 (0 = flat, for screens, lights, far details), r, smooth}.
- s.line([[x, y], ...], w, color, {alpha, dash: [on, off], flow, cap}) — open stroke w meters wide: steam, wind, motion lines, wires; animate flow (e.g. t * 0.4) to move the dashes.
- s.arrow([x, y], [x, y], color, {width, alpha}).
- s.glow(x, y, r, color, alpha) — soft radial light: a lamp, heat, sun, a screen.
- s.at(x, y, () => {...}), s.rotate(angle, px, py, () => {...}) (radians, counter-clockwise), s.scale(kx, ky, px, py, () => {...}) (grow, squash; kx = -1 mirrors), s.fade(alpha, () => {...}).
- s.person(x, y, options) — a person standing with feet at (x, y), drawn on a fixed skeleton. Returns {head, hand, chest, farHand} as world points for labels and props. Options:
  height (meters), facing 1 (right) | -1 (left), pose and poseTo with poseMix 0..1 to blend: 'stand', 'point', 'explain', 'hold', 'aim', 'raiseHand', 'crossArms', 'sit', 'lookUp', 'bend' (bent at the waist, hands toward the ground: planting, picking up), 'crouch' (deep squat), 'kneel' (on one knee), 'phone' (both hands hold something in front of the chest, head down: a phone, a book), 'wash' (forearms level in front of the waist, looking at the hands: washing, cooking, typing), 'wave', 'lie' (lying on the back), walkPhase/walkMix from s.walk, skin, hair, hairStyle ('short', 'long', 'bun', 'curly', 'bald', 'hijab', 'cap' = baseball cap, 'caping' = conical farmer's hat; never draw another hat on top), top, bottom, shoes, sleeves ('short' | 'long'), outfit ('pants' | 'skirt'), apron (color), coat (color), glasses (bool), face ('smile', 'neutral', 'open', 'worried', 'surprised'), dim (0..0.5 darkens people farther back), hold: (s) => {...} draws an item in the near hand (origin at the palm, +x points where the person faces, meters).
  'lie': (x, y) is the surface the person lies on (a bed top, a mat, the floor) and x is the hip position; the head points toward facing and the face looks up. Draw the bed or mat before the person and a blanket after if needed. Blending poseTo 'lie' turns the body down around the hips.
  'sit' needs a seat: put the person's y at ground level and draw a chair whose seat is about 0.45 × height high under the hips. 'point' raises the near arm level at shoulder height toward where the person faces.
- s.walk({progress, fromX, toX, height}) → {x, walkPhase, walkMix, facing}: use x for the person's x and pass the rest, so feet do not slide. Keep about 1.2 m per second of walking.
- s.label(x, y, text, {dx, dy, sub, color, alpha, size}) — callout dot on a world point, line to a text box (dx, dy) pixels away. The engine keeps boxes inside the safe area and apart. Text in Bahasa Indonesia.
- s.ramp(t, a, b) → smooth 0..1 between seconds a and b. s.win(t, a, b) → 0..1..0. s.mixColor(a, b, k), s.lit(color, k) (k < 1 darker, > 1 lighter), s.P(x, y) → screen pixels. There is no raw canvas access.

${STORY_STYLE}

Goal: a viewer instantly understands the place, who the person is, and what is happening, and the objects the topic is about are recognizable and large. Frame the action: the people and the key object fill most of the frame height between 30% and 75% from the top (the top has a title, the bottom has subtitles). Something must change during the 3 seconds in a way that explains the topic (the object changes, the person acts, something flows or grows), plus a slow camera move. Add 1–2 labels that fade in at different times, naming only things the topic is about.

Worked example of the expected level of detail and structure (a different topic; do not copy its objects):
\`\`\`js
${EXAMPLE_KITCHEN}
\`\`\``;

function fakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: String(text).length * 18 }),
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
  // Comments are skipped: "window" in "// window with a sky view" is not code.
  const bare = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  if (FORBIDDEN.test(bare)) return `Forbidden identifier: ${FORBIDDEN.exec(bare)?.[0]}`;
  try {
    const draw = new Function(`${code}\nreturn draw;`)() as (s: unknown, t: number) => void;
    for (const t of [0, 0.7, 1.5, 2.2, 2.97]) {
      const story = createStory(fakeContext(), WIDTH, HEIGHT);
      draw(story, t);
      story.finish();
    }
    return null;
  } catch (error) {
    return String((error as Error)?.stack ?? error).split('\n').slice(0, 3).join(' | ');
  }
}

const seconds = (startedAt: number) => ((Date.now() - startedAt) / 1000).toFixed(1) + 's';

const THRESHOLD = Number(argument('threshold', '6'));
const ROUNDS = Number(argument('rounds', '2'));
const criticModel = process.env.CRITIC_MODEL || model;
// IDR per million tokens for ag/gemini-3.8-flash-high (model_rates, November 2026).
const RATE = { input: 13_597.5, output: 67_987.5 };
const spent = { input: 0, output: 0 };
const track = (label: string, startedAt: number, usage: { promptTokens?: number; completionTokens?: number }) => {
  spent.input += usage.promptTokens ?? 0;
  spent.output += usage.completionTokens ?? 0;
  console.log(label, seconds(startedAt), `in ${usage.promptTokens} out ${usage.completionTokens}`);
};

const CRITIC = `You are a strict art director reviewing a 3-second flat side-view story explainer clip. The first image is a contact sheet of frames at t = 0, 1, 2, 2.97 s; the second is t = 2 s larger.
Score each criterion from 1 to 10:
- recognizability: the place and every object the topic is about are instantly recognized as the real thing, with correct proportions and characteristic parts. Generic blocks or blobs score 4 or lower.
- characters: people look natural and appealing, fit their role, stand on the ground, hold or point at things convincingly, and act out the topic. Broken limbs, floating people, or a person who does nothing related to the topic score 4 or lower.
- composition: the action is large and readable between 30% and 75% of the frame height; the setting reaches the frame edges with no empty background; nothing important is cut off; labels sit inside the frame and do not overlap each other or faces.
- motion: something changes across the frames in a way that explains the topic.
- labelAccuracy: each label points at the part it names and the facts are right.
Return only JSON: {"imageVisible":true,"scores":{"recognizability":0,"characters":0,"composition":0,"motion":0,"labelAccuracy":0},"issues":["specific fix"]}.
Set imageVisible to false if you cannot see the frames. List at most 8 issues, ordered by visual impact, each saying exactly what to change.`;

type Critique = ReturnType<typeof parseCritique>;

const jpegPart = (buffer: Buffer) => ({ type: 'image_url' as const, image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` } });

async function firstCode(): Promise<string> {
  if (useExample) return EXAMPLE_KITCHEN;
  if (codeFile) return fs.readFileSync(codeFile, 'utf8');
  let feedback = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const startedAt = Date.now();
    const { text, usage } = await callChat({ model, system: SYSTEM, content: `Topic (Indonesian): "${topic}"${feedback}`, maxTokens: 24_000 });
    fs.writeFileSync(path.join(directory, `answer-1-${attempt}.md`), text);
    track(`WRITE round 1 attempt ${attempt}`, startedAt, usage);
    const code = extractCode(text);
    const problem = code ? dryRun(code) : 'No ```js block with function draw(s, t).';
    if (code && !problem) return code;
    console.log('WRITE rejected:', problem);
    feedback = `\n\nYour previous answer failed: ${problem}\nFix it and return the full function again.${code ? `\n\nPrevious code:\n${code.slice(0, 20_000)}` : ''}`;
  }
  throw new Error('Gemini did not return runnable code in 3 attempts');
}

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

async function renderRound(round: number, code: string) {
  const roundDir = path.join(directory, `round-${round}`);
  fs.mkdirSync(roundDir, { recursive: true });
  fs.writeFileSync(path.join(roundDir, 'scene.js'), `${code}\nexport default draw;\n`);
  const entryPoint = path.join(roundDir, 'Root.tsx');
  fs.writeFileSync(
    entryPoint,
    `import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { StoryCanvasScene } from '@/motion-kit/story-canvas/StoryCanvasScene';
import draw from './scene.js';

const Clip: React.FC = () => <StoryCanvasScene draw={draw as never} />;
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
  const problem = dryRun(code);
  if (problem) throw new Error(`Code does not run: ${problem}`);
  const scoring = !useExample && !codeFile;
  let best: { round: number; average: number; render: Awaited<ReturnType<typeof renderRound>> } | null = null;
  const history: string[] = [];
  for (let round = 1; round <= (scoring ? ROUNDS : 1); round += 1) {
    const lines = code.split('\n').length;
    const calls = (code.match(/s\.(rect|circle|ellipse|poly|capsule|person|line)\(/g) ?? []).length;
    const render = await renderRound(round, code);
    if (!scoring && !flag('score')) {
      best = { round, average: 0, render };
      break;
    }
    const review = await critique(render.sheet, render.still);
    fs.writeFileSync(path.join(render.roundDir, 'critique.json'), JSON.stringify(review, null, 2));
    history.push(`round ${round}: ${review.average} ${JSON.stringify(review.scores)} (${lines} lines, ${calls} shape calls)`);
    console.log('SCORE', history[history.length - 1]);
    if (!best || review.average > best.average) best = { round, average: review.average, render };
    if (review.average >= THRESHOLD || round === ROUNDS || !scoring) break;
    const next = await revisedCode(round + 1, code, review, render.sheet, render.still);
    if (!next) break;
    code = next;
  }
  if (!best) throw new Error('No round rendered');
  const renderedAt = Date.now();
  await renderMedia({ composition: best.render.composition, serveUrl: best.render.serveUrl, codec: 'h264', pixelFormat: 'yuv420p', crf: 18, outputLocation: path.join(directory, 'clip.mp4') });
  console.log('RENDER best', `round ${best.round}`, seconds(renderedAt));
  const idr = (spent.input * RATE.input + spent.output * RATE.output) / 1_000_000;
  const summary = `${useExample ? 'example' : topic}\nthreshold ${THRESHOLD}; best round ${best.round} (${best.average})\n${history.join('\n')}\ntokens in ${spent.input} out ${spent.output}, about Rp${Math.round(idr)}\n`;
  fs.writeFileSync(path.join(directory, 'summary.txt'), summary);
  console.log('SUMMARY\n' + summary);
}

main().catch((error) => {
  console.log('SPIKE FAILED', String(error?.stack ?? error).slice(0, 1500));
  process.exitCode = 1;
});
