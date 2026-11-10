import fs from 'fs';
import path from 'path';
import { generateText } from 'ai';
import { getDirectorModel, isApiKeyConfigured } from '@/lib/ai/llm-client';
import { continuedScenes } from '@/lib/explainer/continuity';
import { dataVisualStart, spokenDataVisual } from '@/lib/explainer/data-visual';
import { guardRevisedScenes, type RevisionCheckOutcome, type RevisionCheckTools } from '@/lib/render/scene-check';
import { isValidProjectId } from '@/lib/security/project-input';
import type { SceneSpec, Storyboard, StudioProject } from '@/types/studio';
import { COPY_ANTI_SLOP_RULES } from './anti-slop';
import { generateMainVideoCode } from './coder-agent';
import { mapWithConcurrency, PIPELINE_CONCURRENCY } from './concurrency';
import type { generateSceneAudio } from './tts-engine';

/** What one chat request changes in a scene: the spoken words, the headline, the picture, or several. */
export interface RevisionPlan {
  voiceoverText?: string;
  kineticHeadline?: string;
  visualInstruction?: string;
}

const PLAN_SYSTEM_PROMPT = `You edit one scene of a short motion graphic video narrated in Bahasa Indonesia.
Split the user's revision request into three independent parts:
- "voiceoverText": the full new narration for this scene, only if the user asks to change what is spoken (wording, length, tone, or content). Otherwise null.
- "kineticHeadline": the full new on-screen headline (3-6 words), only if the user asks to change it, or if the new narration makes the old headline wrong. Otherwise null.
- "visualInstruction": an English instruction for the programmer describing only the visual change (colors, layout, motion, objects, sizes). Otherwise null.
If the request clearly concerns a different scene, return null for all three.
Keep the narration natural Indonesian, about as long as before unless the user asks for a different length.
${COPY_ANTI_SLOP_RULES}
Output only JSON: {"voiceoverText": string|null, "kineticHeadline": string|null, "visualInstruction": string|null}`;

const textOrUndefined = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

export function parseRevisionPlan(text: string): RevisionPlan | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      voiceoverText: textOrUndefined(raw.voiceoverText),
      kineticHeadline: textOrUndefined(raw.kineticHeadline),
      visualInstruction: textOrUndefined(raw.visualInstruction),
    };
  } catch {
    return null;
  }
}

/** Without a usable plan the whole request goes to the code reviser, as before. */
export interface ScenePosition {
  sceneNumber: number;
  sceneCount: number;
}

export async function planSceneRevision(scene: SceneSpec, instruction: string, position?: ScenePosition): Promise<RevisionPlan> {
  if (!isApiKeyConfigured()) return { visualInstruction: instruction };
  try {
    const response = await generateText({
      model: getDirectorModel(),
      system: PLAN_SYSTEM_PROMPT,
      prompt: `${position ? `This is scene ${position.sceneNumber} of ${position.sceneCount}.\n` : ''}Scene title: ${scene.title}
Current narration: ${JSON.stringify(scene.voiceoverText)}
Current headline: ${JSON.stringify(scene.kineticHeadline)}
Visual direction: ${JSON.stringify(scene.visualPrompt)}
User request: ${JSON.stringify(instruction)}`,
    });
    return parseRevisionPlan(response.text) ?? { visualInstruction: instruction };
  } catch (error) {
    console.warn('[SceneRevision] Revision planning failed, sending the request to the code reviser:', error);
    return { visualInstruction: instruction };
  }
}

/** Index just past the string or bracket group that opens at `start`, skipping quoted text. */
function skipGroup(code: string, start: number): number {
  const open = code[start];
  if (open === '"' || open === "'" || open === '`') {
    for (let i = start + 1; i < code.length; i++) {
      if (code[i] === '\\') i++;
      else if (code[i] === open) return i + 1;
    }
    return -1;
  }
  const close: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
  const stack = [close[open]];
  for (let i = start + 1; i < code.length; i++) {
    const char = code[i];
    if (char === '"' || char === "'" || char === '`') {
      const next = skipGroup(code, i);
      if (next < 0) return -1;
      i = next - 1;
    } else if (close[char]) {
      stack.push(close[char]);
    } else if (char === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return i + 1;
    }
  }
  return -1;
}

interface Span { start: number; end: number }

/** The opening tag of the first JSX element with this tag, as written by the composer or reformatted by a model. */
function findElement(code: string, tag: string): Span | null {
  const match = new RegExp(String.raw`<${tag}(?=[\s/>])`).exec(code);
  if (!match) return null;
  for (let i = match.index + tag.length + 1; i < code.length; i++) {
    const char = code[i];
    if (char === '{' || char === '"' || char === "'") {
      const next = skipGroup(code, i);
      if (next < 0) return null;
      i = next - 1;
    } else if (char === '/' && code[i + 1] === '>') {
      return { start: match.index, end: i + 2 };
    } else if (char === '>') {
      return { start: match.index, end: i + 1 };
    }
  }
  return null;
}

/** The value span of `prop=` inside an element, quotes or braces included. */
function findProp(code: string, element: Span, prop: string): Span | null {
  const re = new RegExp(String.raw`\s${prop}=`, 'g');
  re.lastIndex = element.start;
  const match = re.exec(code);
  if (!match || match.index >= element.end) return null;
  const start = match.index + match[0].length;
  const end = skipGroup(code, start);
  return end > 0 && end <= element.end ? { start, end } : null;
}

const splice = (code: string, span: Span, value: string) => code.slice(0, span.start) + value + code.slice(span.end);

function setProp(code: string, tag: string, prop: string, value: string): string {
  const element = findElement(code, tag);
  const span = element && findProp(code, element, prop);
  return span ? splice(code, span, value) : code;
}

function removeProp(code: string, tag: string, prop: string): string {
  const element = findElement(code, tag);
  const span = element && findProp(code, element, prop);
  if (!span) return code;
  let start = span.start - prop.length - 1;
  while (start > 0 && /\s/.test(code[start - 1])) start--;
  return splice(code, { start, end: span.end }, '');
}

/** Scales every `from`/`to` frame inside one prop value, whether written as JSON or as a JS object. */
function scaleFrames(code: string, tag: string, prop: string, retime: (frame: number) => number): string {
  const element = findElement(code, tag);
  const span = element && findProp(code, element, prop);
  if (!span) return code;
  const value = code.slice(span.start, span.end)
    .replace(/((?:"|\b)(?:from|to)"?\s*:\s*)(\d+)/g, (_, key: string, frame: string) => `${key}${retime(Number(frame))}`);
  return splice(code, span, value);
}

/**
 * Updates the narration-bound parts of a scene (captions, headline, data card, and camera or
 * action timings) without asking a model. It reads JSX props rather than exact text, so it still
 * works after a model reformatted the scene. Timings scale with the new duration, so they keep
 * their place in the scene but are not re-matched to individual new words.
 * Returns null when the scene has no captions with a text and wordTimings prop to update.
 */
export function retimeSceneCode(code: string, before: SceneSpec, after: SceneSpec, storyboard: Storyboard): string | null {
  const captions = findElement(code, 'SyncedCaptions');
  if (!captions || !findProp(code, captions, 'text') || !findProp(code, captions, 'wordTimings')) return null;
  const fps = storyboard.fps || 30;
  const scale = after.durationInFrames / Math.max(1, before.durationInFrames);
  const last = Math.max(0, after.durationInFrames - 1);
  const retime = (frame: number) => Math.min(last, Math.round(frame * scale));

  let next = setProp(code, 'SyncedCaptions', 'text', `{${JSON.stringify(after.voiceoverText)}}`);
  next = setProp(next, 'SyncedCaptions', 'wordTimings', `{${JSON.stringify(after.wordTimings)}}`);

  if (after.kineticHeadline !== before.kineticHeadline) {
    next = setProp(next, 'KineticHeadline', 'text', `{${JSON.stringify(after.kineticHeadline)}}`);
    const focus = after.headlineFocus && after.kineticHeadline.toLowerCase().includes(after.headlineFocus.toLowerCase())
      ? after.headlineFocus
      : undefined;
    const headline = findElement(next, 'KineticHeadline');
    if (headline && findProp(next, headline, 'highlightWords')) {
      next = focus ? setProp(next, 'KineticHeadline', 'highlightWords', `{${JSON.stringify([focus])}}`) : removeProp(next, 'KineticHeadline', 'highlightWords');
    }
  }

  next = next.replace(/buildAssetShots\(manifest,\s*\d+/, `buildAssetShots(manifest, ${after.durationInFrames}`);
  for (const tag of ['ImageStage', 'AssetStage']) {
    next = scaleFrames(next, tag, 'shots', retime);
    next = scaleFrames(next, tag, 'actionCues', retime);
  }

  const card = findElement(next, 'DataCard');
  if (card) {
    const visual = spokenDataVisual(after.dataVisual, after.voiceoverText);
    if (!visual && next.slice(card.end - 2, card.end) === '/>') {
      let start = card.start;
      while (start > 0 && /[ \t]/.test(next[start - 1])) start--;
      if (start > 0 && next[start - 1] === '\n') start--;
      next = splice(next, { start, end: card.end }, '');
    } else if (visual) {
      next = setProp(next, 'DataCard', 'visual', `{${JSON.stringify(visual)}}`);
      next = setProp(next, 'DataCard', 'from', `{${dataVisualStart(visual, after, fps)}}`);
    }
  }
  return next;
}

function audioFilePath(project: StudioProject, scene: SceneSpec): string | null {
  const name = scene.audioUrl?.split('?')[0].split('/').pop();
  if (!name || !/^[\w-]+\.(?:wav|mp3)$/.test(name) || !isValidProjectId(project.id)) return null;
  return path.join(process.cwd(), 'storage', 'projects', project.id, 'assets', name);
}

export interface NarratorVoice {
  voice: string;
  provider?: Storyboard['voiceProvider'];
}

export interface SceneRevisionDeps {
  plan: (scene: SceneSpec, instruction: string, position: ScenePosition) => Promise<RevisionPlan>;
  speak: typeof generateSceneAudio;
  reviseCode: (code: string, scene: SceneSpec, instruction: string) => Promise<string>;
  check: RevisionCheckTools;
  /** Set to speak every target scene again with this voice, even when its words stay the same. */
  voice?: NarratorVoice;
}

export interface SceneRevisionOutcome {
  index: number;
  outcome: RevisionCheckOutcome | 'unchanged';
  narrationChanged: boolean;
  headlineChanged: boolean;
}

export interface SceneRevisionResult extends SceneRevisionOutcome {
  project: StudioProject;
}

const readyIndexes = (project: StudioProject) =>
  project.storyboard.scenes.flatMap((scene, index) =>
    !project.sceneProgress || project.sceneProgress[scene.id]?.stage === 'ready' ? [index] : []);

interface PreparedRevision {
  index: number;
  before: SceneSpec;
  scene: SceneSpec;
  previousCode: string;
  code: string;
  /** The version to fall back to if the revised code crashes. */
  safeCode: string;
  narrationChanged: boolean;
  headlineChanged: boolean;
  restoreAudio: () => void;
}

/** Plans, speaks, and rewrites one scene without rendering it. */
async function prepareRevision(project: StudioProject, index: number, instruction: string, deps: SceneRevisionDeps): Promise<PreparedRevision> {
  const before = project.storyboard.scenes[index];
  const previousCode = project.files[`Scene${index + 1}.tsx`] ?? '';
  const plan = await deps.plan(before, instruction, { sceneNumber: index + 1, sceneCount: project.storyboard.scenes.length });

  const narrationChanged = !!plan.voiceoverText && plan.voiceoverText !== before.voiceoverText.trim();
  const headlineChanged = !!plan.kineticHeadline && plan.kineticHeadline !== before.kineticHeadline.trim();
  let scene: SceneSpec = {
    ...before,
    ...(narrationChanged ? { voiceoverText: plan.voiceoverText } : {}),
    ...(headlineChanged ? { kineticHeadline: plan.kineticHeadline } : {}),
  };

  const respeak = narrationChanged || Boolean(deps.voice);
  // Speech is written over the old file name, so the old audio is kept in memory for a full revert.
  const audioPath = respeak ? audioFilePath(project, before) : null;
  const audioBackup = audioPath && fs.existsSync(audioPath) ? fs.readFileSync(audioPath) : null;
  const restoreAudio = () => {
    if (audioPath && audioBackup) fs.writeFileSync(audioPath, audioBackup);
  };
  if (respeak) {
    const { voice, provider } = deps.voice ?? { voice: project.storyboard.voice, provider: project.storyboard.voiceProvider };
    const audio = await deps.speak(scene, { fps: project.storyboard.fps, projectId: project.id, voice, provider });
    scene = { ...scene, ...audio };
  }

  try {
    // Text and timing changes are applied by code when possible; that version is the safe fallback.
    let code = previousCode;
    let safeCode = previousCode;
    if (respeak || headlineChanged) {
      const retimed = retimeSceneCode(previousCode, before, scene, project.storyboard);
      code = retimed ?? await deps.reviseCode(previousCode, scene,
        `The narration is now ${JSON.stringify(scene.voiceoverText)} and the headline is ${JSON.stringify(scene.kineticHeadline)}. The scene now lasts ${scene.durationInFrames} frames. Update every caption, headline text, and timing to match, and keep the visuals.`);
      if (retimed) safeCode = retimed;
    }
    if (plan.visualInstruction) code = await deps.reviseCode(code, scene, plan.visualInstruction);
    return { index, before, scene, previousCode, code, safeCode, narrationChanged, headlineChanged, restoreAudio };
  } catch (error) {
    restoreAudio();
    throw error;
  }
}

/**
 * Applies one chat request to several scenes. Each scene is prepared in parallel (new speech
 * first, because length, captions, and timings follow the audio), then all changed scenes are
 * rendered in one check. A scene that crashes and cannot be repaired returns to the last version
 * known to render. A scene the request does not concern comes back unchanged.
 */
export async function reviseScenes(
  project: StudioProject,
  indexes: number[],
  instruction: string,
  deps: SceneRevisionDeps
): Promise<{ project: StudioProject; scenes: SceneRevisionOutcome[] }> {
  const settled = await mapWithConcurrency(indexes, PIPELINE_CONCURRENCY, (index) =>
    prepareRevision(project, index, instruction, deps).then(
      (prepared) => ({ prepared }),
      (error: unknown) => ({ error, index })
    ));
  const failed = settled.filter((item): item is { error: unknown; index: number } => 'error' in item);
  const prepared = settled.flatMap((item) => ('prepared' in item ? [item.prepared] : []));
  // A single scene request reports its error; in a multi-scene request the others still count.
  if (failed.length && !prepared.length) throw failed[0].error;
  for (const item of failed) console.error(`[SceneRevision] Scene ${item.index + 1} revision failed:`, item.error);

  const changed = prepared.filter((item) => item.code !== item.previousCode || item.narrationChanged || item.headlineChanged || Boolean(deps.voice));
  const build = (specs: Map<number, SceneSpec>, codes: Map<number, string>): StudioProject => {
    const storyboard = { ...project.storyboard, scenes: project.storyboard.scenes.map((item, i) => specs.get(i) ?? item) };
    const files = { ...project.files, ...Object.fromEntries([...codes].map(([i, code]) => [`Scene${i + 1}.tsx`, code])) };
    const next = { ...project, storyboard, files };
    const continued = continuedScenes(storyboard.scenes, next.sceneAssets);
    return { ...next, files: { ...files, 'MainVideo.tsx': generateMainVideoCode(storyboard, readyIndexes(next), continued) } };
  };

  const candidate = build(new Map(changed.map((item) => [item.index, item.scene])), new Map(changed.map((item) => [item.index, item.code])));
  const checks = await guardRevisedScenes(candidate, new Map(changed.map((item) => [item.index, item.safeCode])), deps.check);

  const specs = new Map<number, SceneSpec>();
  const codes = new Map<number, string>();
  const outcomes = new Map<number, SceneRevisionOutcome>();
  for (const item of prepared) {
    const check = checks.get(item.index);
    if (!check) {
      outcomes.set(item.index, { index: item.index, outcome: 'unchanged', narrationChanged: false, headlineChanged: false });
    } else if (check.outcome === 'reverted' && item.safeCode === item.previousCode) {
      // The old code still shows the old words, so the old narration, headline, and audio come back with it.
      item.restoreAudio();
      outcomes.set(item.index, { index: item.index, outcome: 'reverted', narrationChanged: false, headlineChanged: false });
    } else {
      specs.set(item.index, item.scene);
      codes.set(item.index, check.code);
      outcomes.set(item.index, { index: item.index, outcome: check.outcome, narrationChanged: item.narrationChanged, headlineChanged: item.headlineChanged });
    }
  }
  for (const item of failed) outcomes.set(item.index, { index: item.index, outcome: 'unchanged', narrationChanged: false, headlineChanged: false });

  return {
    project: specs.size || codes.size ? build(specs, codes) : project,
    scenes: indexes.map((index) => outcomes.get(index)!),
  };
}

export async function reviseScene(
  project: StudioProject,
  index: number,
  instruction: string,
  deps: SceneRevisionDeps
): Promise<SceneRevisionResult> {
  const result = await reviseScenes(project, [index], instruction, deps);
  return { project: result.project, ...result.scenes[0] };
}

/**
 * Speaks the given scenes again with another narrator voice. The words stay the same, but the
 * length changes with the voice, so captions and timings follow the new audio like a narration edit.
 * The storyboard takes the new voice only when every scene changed, so the video never mixes voices.
 */
export async function revoiceScenes(
  project: StudioProject,
  indexes: number[],
  voice: NarratorVoice,
  deps: Omit<SceneRevisionDeps, 'plan' | 'voice'>
): Promise<{ project: StudioProject; changed: number[]; failed: number[] }> {
  let result: Awaited<ReturnType<typeof reviseScenes>>;
  try {
    result = await reviseScenes(project, indexes, '', { ...deps, voice, plan: async () => ({}) });
  } catch (error) {
    // Every scene failed, so nothing changed.
    console.error('[SceneRevision] Voice change failed:', error);
    return { project, changed: [], failed: indexes };
  }
  const changed = result.scenes.filter((scene) => scene.outcome !== 'unchanged' && scene.outcome !== 'reverted').map((scene) => scene.index);
  const failed = indexes.filter((index) => !changed.includes(index));
  const storyboard = failed.length ? result.project.storyboard : { ...result.project.storyboard, voice: voice.voice, voiceProvider: voice.provider };
  return { project: { ...result.project, storyboard }, changed, failed };
}
