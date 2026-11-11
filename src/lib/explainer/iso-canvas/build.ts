import type { IsoWorldScene } from '@/motion-kit/iso-canvas';
import { mapWithConcurrency } from '@/lib/pipeline/concurrency';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { AspectRatioDimensions, type StudioProject } from '@/types/studio';
import { callChat, parseCritique, type AssetCritique } from '../asset-generator';
import { assembleObjects, assembleScenes, buildWorldScenes, fitZoom, isoCanvasMainVideo, sceneTimings, type FrameSize, type SceneTiming } from './assemble';
import { dryRunIsoCanvas } from './dry-run';
import { generateIsoCanvasPlan, type IsoCanvasDetail, type IsoCanvasObject, type IsoCanvasPlan } from './plan';
import {
  criticSystem, DETAIL_SYSTEM, detailRequest, objectFunctionName, objectRequest, OBJECT_SYSTEM, revisionRequest, WORLD_SYSTEM, worldRequest,
  type CriticKind,
} from './prompts';
import { renderIsoSheet, withIsoBrowser, type IsoBrowser } from './render';
import { writeUntilValid } from './writer';

/** Score a drawing must reach to stop revising. Lowered to 5.5 if 6 is rarely reached in practice. */
export const isoQualityThreshold = () => Number(process.env.ISO_QUALITY_THRESHOLD) || 6;
// Two rounds: in the first job test a third round rarely raised the score but added cost and time.
const isoQualityRounds = () => Math.max(1, Math.min(4, Number(process.env.ISO_QUALITY_ROUNDS) || 2));
const OBJECT_CONCURRENCY = 4;

export interface IsoQualityItem {
  kind: CriticKind;
  id: string;
  label: string;
  /** Best critic average; null when the drawing could not be scored. */
  score: number | null;
  rounds: number;
  passed: boolean;
  /** True when the model never produced runnable code and a plain stand-in was used. */
  fallback: boolean;
  issues: string[];
  history: number[];
}

export interface IsoCanvasReport {
  threshold: number;
  items: IsoQualityItem[];
}

export interface IsoCanvasBuild {
  files: Record<string, string>;
  plan: IsoCanvasPlan;
  report: IsoCanvasReport;
}

type Image = { type: 'image_url'; image_url: { url: string } };
const image = (buffer: Buffer): Image => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` } });

const codeBlock = (text: string): string | null => {
  const match = /```(?:ts|typescript|js|javascript|tsx)?\s*\n([\s\S]*?)```/.exec(text);
  return match ? match[1].trim() : null;
};

async function critique(model: string, kind: CriticKind, context: string, sheet: Buffer, still: Buffer): Promise<AssetCritique | null> {
  try {
    const { text } = await callChat({ model, system: criticSystem(kind), maxTokens: 3_000, content: [{ type: 'text', text: context }, image(sheet), image(still)] });
    return parseCritique(text);
  } catch (error) {
    console.warn(`[IsoCanvas] Critic failed for ${kind}:`, error);
    return null;
  }
}

/**
 * The quality loop shared by objects, the world, and close-ups: write until the code runs,
 * render, score, and revise from the frames and the critic's issues while below the threshold.
 * The best-scoring round is kept, because a later round can be worse.
 */
export async function improve(options: {
  model: string;
  kind: CriticKind;
  id: string;
  label: string;
  system: string;
  request: string;
  /** Runtime and contract problems of a candidate; empty when it runs. */
  check: (code: string) => string[];
  render: (code: string) => Promise<{ sheet: Buffer; still: Buffer }>;
  criticContext: string;
}): Promise<{ code: string | null; item: IsoQualityItem }> {
  const threshold = isoQualityThreshold();
  const item: IsoQualityItem = { kind: options.kind, id: options.id, label: options.label, score: null, rounds: 0, passed: false, fallback: false, issues: [], history: [] };
  const write = (content: (feedback: string) => string | Array<{ type: 'text'; text: string } | Image>) => writeUntilValid({
    ask: async (feedback) => (await callChat({ model: options.model, system: options.system, content: content(feedback), maxTokens: 24_000 })).text,
    parse: codeBlock,
    check: options.check,
    show: (code) => `\`\`\`ts\n${code}\n\`\`\``,
  });

  const first = await write((feedback) => options.request + feedback);
  if (!first.value || first.problems.length) {
    item.fallback = true;
    item.issues = first.problems.slice(0, 5);
    return { code: null, item };
  }
  let code = first.value;
  let best: { code: string; score: number; issues: string[] } | null = null;
  for (let round = 1; round <= isoQualityRounds(); round += 1) {
    item.rounds = round;
    let frames: { sheet: Buffer; still: Buffer };
    try {
      frames = await options.render(code);
    } catch (error) {
      console.warn(`[IsoCanvas] Render failed for ${options.kind} ${options.id}:`, error);
      break;
    }
    const review = await critique(options.model, options.kind, options.criticContext, frames.sheet, frames.still);
    if (!review) {
      best ??= { code, score: 0, issues: [] };
      break;
    }
    item.history.push(review.average);
    if (!best || review.average > best.score) best = { code, score: review.average, issues: review.issues };
    if (review.average >= threshold || round === isoQualityRounds()) break;
    const revised = await write((feedback) => [
      { type: 'text', text: revisionRequest(options.request, code, review.average, review.issues) + feedback },
      image(frames.sheet),
      image(frames.still),
    ]);
    if (!revised.value || revised.problems.length) break;
    code = revised.value;
  }
  const chosen = best ?? { code, score: 0, issues: [] };
  item.score = item.history.length ? chosen.score : null;
  item.passed = item.score !== null && item.score >= threshold;
  item.issues = chosen.issues.slice(0, 5);
  return { code: chosen.code, item };
}

/** A plain stand-in when the model never wrote runnable code: honest, labelled in the report. */
function fallbackObject(object: IsoCanvasObject): string {
  const [w, d, h] = object.size;
  return `export function ${objectFunctionName(object.id)}(iso: Iso, state: Record<string, number>, t: number) {
  void state;
  void t;
  iso.shadow(${-w / 2}, ${-d / 2}, ${w}, ${d});
  iso.box(${-w / 2}, ${-d / 2}, 0, ${w}, ${d}, ${h}, '#94A3B8');
}`;
}

export function fallbackWorld(plan: IsoCanvasPlan): string {
  const calls = [...plan.objects]
    .sort((a, b) => a.at[0] + a.at[1] - (b.at[0] + b.at[1]))
    .map((object) => `  iso.at(${object.at.join(', ')}, () => ${objectFunctionName(object.id)}(iso, states['${object.id}'] ?? {}, t));`)
    .join('\n');
  return `export function drawWorld(iso: Iso, t: number, states: IsoStates) {
  iso.background('${plan.background.top}', '${plan.background.bottom}');
  iso.ground('${plan.palette.ground}');
${calls}
}`;
}

export const worldFile = (plan: IsoCanvasPlan, body: string) => {
  const names = plan.objects.map((object) => objectFunctionName(object.id));
  return `import type { Iso, IsoStates } from '@/motion-kit';\nimport { ${names.join(', ')} } from './IsoObjects';\n\n${body.trim()}\n`;
};

/** A one-scene video around a single object, so the dry run can check it alone. */
function objectProbe(object: IsoCanvasObject, code: string) {
  const name = objectFunctionName(object.id);
  const state = Object.fromEntries(object.states.map((item) => [item.key, 1]));
  return {
    'IsoObjects.ts': assembleObjects([code]),
    'IsoWorld.ts': `import type { Iso, IsoStates } from '@/motion-kit';\nimport { ${name} } from './IsoObjects';\n\nexport function drawWorld(iso: Iso, t: number, states: IsoStates) {\n  iso.background('#F1F5F9', '#E2E8F0');\n  iso.ground('#E5E7EB');\n  ${name}(iso, states['${object.id}'] ?? {}, t);\n}\n`,
    'IsoScenes.ts': `import type { IsoSceneSpec } from '@/motion-kit';\n\nexport const scenes: IsoSceneSpec[] = [${JSON.stringify({ kind: 'world', start: 0, duration: 2, camera: [{ at: 0, look: [0, 0, object.size[2] / 2], zoom: 60 }], states: { [object.id]: state } })}];\n`,
  };
}

/**
 * Objects and the world are drawn in every shot, so a label written there would sit on screen
 * for the whole video and outside the narration (the AC test showed English sub lines such as
 * "Fixed Speed (On/Off)"). Scene labels come from the plan and are checked against the line.
 */
export const LABEL_FORBIDDEN = 'Do not call iso.label here: labels are added by the scenes, timed to the narration.';
const callsLabel = (code: string) => /\biso\s*\.\s*label\s*\(/.test(code);

export function objectProblems(object: IsoCanvasObject, code: string): string[] {
  const name = objectFunctionName(object.id);
  if (!new RegExp(`export\\s+function\\s+${name}\\s*\\(`).test(code)) return [`Export exactly: export function ${name}(iso: Iso, state: Record<string, number>, t: number).`];
  if (/^\s*import\s/m.test(code)) return ['Do not write imports; return only the function.'];
  if (callsLabel(code)) return [LABEL_FORBIDDEN];
  return dryRunIsoCanvas(objectProbe(object, code)).problems;
}

/** Preview.tsx for an object sheet: state 0 at the start, every state at 1 later, as time runs. */
export function objectPreview(object: IsoCanvasObject, frame: FrameSize): string {
  const name = objectFunctionName(object.id);
  const zoom = fitZoom(object.size, frame, 0.8);
  const keys = JSON.stringify(object.states.map((state) => state.key));
  return `import React from 'react';
import { CanvasScene } from '@/motion-kit';
import { ${name} } from './IsoObjects';

const keys: string[] = ${keys};
const levels = [0, 1, 1, 0.5];

export default function Preview() {
  return (
    <CanvasScene
      draw={(iso, t) => {
        const step = Math.min(3, Math.floor(t + 0.001));
        const state: Record<string, number> = {};
        keys.forEach((key) => { state[key] = levels[step]; });
        iso.background('#F1F5F9', '#E2E8F0');
        iso.look(0, 0, ${object.size[2] / 2}, ${zoom});
        iso.ground('#E2E8F0');
        ${name}(iso, state, step * 0.4);
      }}
    />
  );
}
`;
}

/** Preview.tsx for the world: a wide shot and up to two focus shots, each mid-scene. */
export function worldPreview(scenes: IsoWorldScene[]): string {
  return `import React from 'react';
import { CanvasScene, paintIsoScene } from '@/motion-kit';
import type { IsoSceneSpec } from '@/motion-kit';
import { drawWorld } from './IsoWorld';

const scenes: IsoSceneSpec[] = ${JSON.stringify(scenes)};

export default function Preview() {
  return (
    <CanvasScene
      labelTop={0.31}
      draw={(iso, t) => {
        const scene = scenes[Math.min(scenes.length - 1, Math.floor(t + 0.001))];
        paintIsoScene(iso, scene, scene.duration * 0.7, drawWorld);
      }}
    />
  );
}
`;
}

export function detailPreview(body: string, objectNames: string[]): string {
  return `import React from 'react';
import { CanvasScene } from '@/motion-kit';
import type { Iso } from '@/motion-kit';
${objectNames.length ? `import { ${objectNames.join(', ')} } from './IsoObjects';\n` : ''}
const draw = (iso: Iso, t: number) => {
${body}
};

export default function Preview() {
  return <CanvasScene labelTop={0.31} draw={draw} />;
}
`;
}

/** Picks the world scenes the world critic sees: the first wide shot and two focus shots. */
export function sampleWorldScenes(scenes: IsoWorldScene[]): IsoWorldScene[] {
  if (scenes.length <= 3) return scenes;
  return [scenes[0], scenes[Math.floor(scenes.length / 2)], scenes[scenes.length - 1]];
}

/** What every drawing task of one video shares. */
export interface IsoTaskContext {
  model: string;
  plan: IsoCanvasPlan;
  frame: FrameSize;
  /** Topic and setting line given to every critic. */
  topic: string;
  browser: IsoBrowser;
}

type ImproveOptions = Parameters<typeof improve>[0];

/** The quality-loop task for one object; request defaults to the generate request. */
export function objectTask(ctx: IsoTaskContext, object: IsoCanvasObject, request = objectRequest(ctx.plan, object)): ImproveOptions {
  return {
    model: ctx.model,
    kind: 'object',
    id: object.id,
    label: object.label,
    system: OBJECT_SYSTEM,
    request,
    check: (code) => objectProblems(object, code),
    render: (code) => renderIsoSheet(ctx.browser, { 'IsoObjects.ts': assembleObjects([code]), 'Preview.tsx': objectPreview(object, ctx.frame) }, [0.2, 1.2, 2.2, 3.2], ctx.frame),
    criticContext: `${ctx.topic}\nObject: ${object.label}. ${object.look}\nFrames go from state 0 to every state at 1: ${object.states.map((state) => state.meaning).join('; ') || 'no states'}.`,
  };
}

/** World scenes the world check and critic look at (a wide shot when every beat is a close-up). */
export function worldSamples(plan: IsoCanvasPlan, worldScenes: Array<IsoWorldScene | null>, frame: FrameSize): IsoWorldScene[] {
  const playable = worldScenes.filter((scene): scene is IsoWorldScene => Boolean(scene));
  const probeScenes = playable.length ? playable : [{ kind: 'world' as const, start: 0, duration: 2, camera: buildWorldScenes({ ...plan, beats: [{ ...plan.beats[0], focus: null }] }, [{ start: 0, duration: 2 }], frame)[0]?.camera ?? [], states: {} }];
  return sampleWorldScenes(probeScenes);
}

export function worldProblems(plan: IsoCanvasPlan, objectsFile: string, sampled: IsoWorldScene[], code: string): string[] {
  if (!/export\s+function\s+drawWorld\s*\(/.test(code)) return ['Export exactly: export function drawWorld(iso: Iso, t: number, states: IsoStates).'];
  if (/^\s*import\s/m.test(code)) return ['Do not write imports; the object functions are already imported.'];
  if (callsLabel(code)) return [LABEL_FORBIDDEN];
  const scenes = sampled.map((scene, index) => ({ ...scene, start: index === 0 ? 0 : sampled.slice(0, index).reduce((sum, item) => sum + item.duration, 0) }));
  const probe = { 'IsoObjects.ts': objectsFile, 'IsoWorld.ts': worldFile(plan, code), 'IsoScenes.ts': `import type { IsoSceneSpec } from '@/motion-kit';\n\nexport const scenes: IsoSceneSpec[] = ${JSON.stringify(scenes)};\n` };
  return dryRunIsoCanvas(probe).problems;
}

export function worldTask(ctx: IsoTaskContext, objectsFile: string, sampled: IsoWorldScene[], request = worldRequest(ctx.plan)): ImproveOptions {
  const { plan } = ctx;
  return {
    model: ctx.model,
    kind: 'world',
    id: 'world',
    label: 'Dunia',
    system: WORLD_SYSTEM,
    request,
    check: (code) => worldProblems(plan, objectsFile, sampled, code),
    render: (code) => renderIsoSheet(ctx.browser, { 'IsoObjects.ts': objectsFile, 'IsoWorld.ts': worldFile(plan, code), 'Preview.tsx': worldPreview(sampled) }, sampled.map((_, index) => index + 0.5), ctx.frame),
    criticContext: `${ctx.topic}\nFrames: a wide shot of the world, then shots focused on: ${sampled.map((scene) => scene.labels?.[0]?.text ?? 'wide').join(', ')}. Objects: ${plan.objects.map((object) => object.label).join(', ')}.`,
  };
}

export function detailProblems(plan: IsoCanvasPlan, objectsFile: string, detail: IsoCanvasDetail, duration: number, body: string): string[] {
  if (/^\s*(?:import|export)\s/m.test(body)) return ['Return only the function body: statements, no imports or exports.'];
  // Close-up probes need some IsoWorld.ts; the plain world is enough for a runtime check.
  const probe = {
    'IsoObjects.ts': objectsFile,
    'IsoWorld.ts': worldFile(plan, fallbackWorld(plan)),
    'IsoScenes.ts': assembleScenes([null], [{ start: 0, duration, body }], detail.objects.map(objectFunctionName)),
  };
  try {
    return dryRunIsoCanvas(probe).problems;
  } catch (error) {
    return [String(error instanceof Error ? error.message : error)];
  }
}

export function detailTask(ctx: IsoTaskContext, objectsFile: string, detail: IsoCanvasDetail, index: number, timing: SceneTiming, request?: string): ImproveOptions {
  const { plan } = ctx;
  const beat = plan.beats[index];
  const names = detail.objects.map(objectFunctionName);
  return {
    model: ctx.model,
    kind: 'detail',
    id: `${detail.id}-${index + 1}`,
    label: detail.label,
    system: DETAIL_SYSTEM,
    request: request ?? detailRequest(plan, detail, beat.text, timing.duration),
    check: (body) => detailProblems(plan, objectsFile, detail, timing.duration, body),
    render: (body) => renderIsoSheet(ctx.browser, { 'IsoObjects.ts': objectsFile, 'Preview.tsx': detailPreview(body, names) }, [0.3, timing.duration / 2, Math.max(0.4, timing.duration - 0.3)], ctx.frame),
    criticContext: `${ctx.topic}\nClose-up: ${detail.label}. ${detail.draw}\nSpoken line: "${beat.text}"`,
  };
}

export function fallbackDetail(plan: IsoCanvasPlan, detail: IsoCanvasDetail): string {
  const names = detail.objects.map(objectFunctionName);
  return `iso.background('${plan.background.top}', '${plan.background.bottom}');\niso.look(0, 0, 1, 160);\niso.ground('${plan.palette.ground}');\n${names.map((name) => `${name}(iso, {}, t);`).join('\n')}`;
}

/**
 * Writes an isometric canvas video for a project whose narration and audio are ready:
 * plan, objects (in parallel), world, close-ups, then the assembled files. Every drawing goes
 * through the quality loop; anything below the threshold or replaced by a stand-in is listed
 * in the report so the editor can say so.
 */
export async function buildIsoCanvasFiles(model: string, project: StudioProject): Promise<IsoCanvasBuild> {
  const storyboard = project.storyboard;
  const frame = AspectRatioDimensions[storyboard.aspectRatio];
  const story = storyboard.scenes.map((scene) => scene.voiceoverText);
  const { plan } = await generateIsoCanvasPlan(model, project.userPrompt, story);
  const timings = sceneTimings(storyboard);
  const worldScenes = buildWorldScenes(plan, timings, frame);
  const objectNames = plan.objects.map((object) => objectFunctionName(object.id));
  const topic = `Topic: "${project.userPrompt}". Setting: ${plan.setting}`;

  return withIsoBrowser(async (browser: IsoBrowser) => {
    const items: IsoQualityItem[] = [];
    const ctx: IsoTaskContext = { model, plan, frame, topic, browser };

    const objects = await mapWithConcurrency(plan.objects, OBJECT_CONCURRENCY, async (object) => {
      const result = await improve(objectTask(ctx, object));
      items.push(result.item);
      return result.code ?? fallbackObject(object);
    });
    const objectsFile = assembleObjects(objects);
    const sampled = worldSamples(plan, worldScenes, frame);
    // The world and the close-ups only need the objects, so they are written at the same time.
    const worldJob = improve(worldTask(ctx, objectsFile, sampled));
    const detailsJob = mapWithConcurrency(plan.beats.map((beat, index) => ({ beat, index })), OBJECT_CONCURRENCY, async ({ beat, index }) => {
      if (worldScenes[index]) return null;
      const detail = plan.details.find((item) => item.id === beat.focus);
      if (!detail) return null;
      const timing = timings[index];
      const result = await improve(detailTask(ctx, objectsFile, detail, index, timing));
      items.push(result.item);
      return { start: timing.start, duration: timing.duration, body: result.code ?? fallbackDetail(plan, detail) };
    });
    const [world, details] = await Promise.all([worldJob, detailsJob]);
    items.push(world.item);
    const worldCode = worldFile(plan, world.code ?? fallbackWorld(plan));

    const files = {
      'IsoObjects.ts': objectsFile,
      'IsoWorld.ts': worldCode,
      'IsoScenes.ts': assembleScenes(worldScenes, details, objectNames),
    };
    const final = dryRunIsoCanvas(files);
    if (!final.ok) throw new Error(`Video Isometrik tidak lolos pemeriksaan: ${final.problems.slice(0, 3).join('; ')}`);
    const main = isoCanvasMainVideo(storyboard, plan);
    const mainCheck = validateSceneCode(main, 'MainVideo.tsx');
    if (!mainCheck.valid) throw new Error(`MainVideo tidak valid: ${mainCheck.errors.join('; ')}`);
    return { files: { ...files, 'MainVideo.tsx': main }, plan, report: { threshold: isoQualityThreshold(), items } };
  });
}
