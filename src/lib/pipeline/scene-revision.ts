import fs from 'fs';
import path from 'path';
import { generateText } from 'ai';
import { getDirectorModel, isApiKeyConfigured } from '@/lib/ai/llm-client';
import { dataVisualStart, spokenDataVisual } from '@/lib/explainer/data-visual';
import { guardRevisedScene, type RevisionCheckOutcome, type RevisionCheckTools } from '@/lib/render/scene-check';
import { isValidProjectId } from '@/lib/security/project-input';
import type { SceneSpec, Storyboard, StudioProject } from '@/types/studio';
import { COPY_ANTI_SLOP_RULES } from './anti-slop';
import { generateMainVideoCode } from './coder-agent';
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
export async function planSceneRevision(scene: SceneSpec, instruction: string): Promise<RevisionPlan> {
  if (!isApiKeyConfigured()) return { visualInstruction: instruction };
  try {
    const response = await generateText({
      model: getDirectorModel(),
      system: PLAN_SYSTEM_PROMPT,
      prompt: `Scene title: ${scene.title}
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

const JSON_STRING = String.raw`"(?:[^"\\]|\\.)*"`;
const JSON_ARRAY = String.raw`\[(?:[^"\]]|${JSON_STRING})*\]`;
const CAPTIONS = new RegExp(String.raw`(<SyncedCaptions text=\{)${JSON_STRING}(\} wordTimings=\{)${JSON_ARRAY}(\})`);
const HEADLINE = new RegExp(String.raw`(<KineticHeadline text=\{)${JSON_STRING}\}( highlightWords=\{${JSON_ARRAY}\})?`);
const TIMED_PROP = new RegExp(String.raw`\b(shots|actionCues)=\{(${JSON_ARRAY})\}`, 'g');
const DATA_CARD = /\n?[ \t]*<DataCard [^\n]*?\/>/;

/**
 * Updates the narration-bound parts of a composed scene (captions, headline, data card, and
 * camera or action timings) without asking a model. Timings scale with the new duration, so
 * they keep their place in the scene but are not re-matched to individual new words.
 * Returns null when the scene was not built by the composer and has no captions to update.
 */
export function retimeSceneCode(code: string, before: SceneSpec, after: SceneSpec, storyboard: Storyboard): string | null {
  if (!CAPTIONS.test(code)) return null;
  const fps = storyboard.fps || 30;
  const scale = after.durationInFrames / Math.max(1, before.durationInFrames);
  const last = Math.max(0, after.durationInFrames - 1);
  const retime = (value: unknown) => (typeof value === 'number' ? Math.min(last, Math.round(value * scale)) : value);

  let next = code.replace(CAPTIONS, (_, open, middle, close) =>
    `${open}${JSON.stringify(after.voiceoverText)}${middle}${JSON.stringify(after.wordTimings)}${close}`);

  next = next.replace(HEADLINE, (whole, open, highlight) => {
    const focus = after.headlineFocus && after.kineticHeadline.toLowerCase().includes(after.headlineFocus.toLowerCase())
      ? after.headlineFocus
      : undefined;
    const keepHighlight = highlight && focus && after.kineticHeadline === before.kineticHeadline;
    return `${open}${JSON.stringify(after.kineticHeadline)}}${keepHighlight ? highlight : focus ? ` highlightWords={${JSON.stringify([focus])}}` : ''}`;
  });

  next = next.replace(/buildAssetShots\(manifest, \d+,/, `buildAssetShots(manifest, ${after.durationInFrames},`);

  next = next.replace(TIMED_PROP, (whole, prop: string, json: string) => {
    try {
      const items = JSON.parse(json) as Array<Record<string, unknown>>;
      const retimed = items.map((item) => ({ ...item, from: retime(item.from), ...('to' in item ? { to: retime(item.to) } : {}) }));
      return `${prop}={${JSON.stringify(retimed)}}`;
    } catch {
      return whole;
    }
  });

  const visual = spokenDataVisual(after.dataVisual, after.voiceoverText);
  next = next.replace(DATA_CARD, (card) =>
    visual
      ? card.replace(/visual=\{[^\n]*?\} from=\{\d+\}/, `visual={${JSON.stringify(visual)}} from={${dataVisualStart(visual, after, fps)}}`)
      : '');
  return next;
}

function audioFilePath(project: StudioProject, scene: SceneSpec): string | null {
  const name = scene.audioUrl?.split('?')[0].split('/').pop();
  if (!name || !/^[\w-]+\.(?:wav|mp3)$/.test(name) || !isValidProjectId(project.id)) return null;
  return path.join(process.cwd(), 'storage', 'projects', project.id, 'assets', name);
}

export interface SceneRevisionDeps {
  plan: (scene: SceneSpec, instruction: string) => Promise<RevisionPlan>;
  speak: typeof generateSceneAudio;
  reviseCode: (code: string, scene: SceneSpec, instruction: string) => Promise<string>;
  check: RevisionCheckTools;
}

export interface SceneRevisionResult {
  project: StudioProject;
  outcome: RevisionCheckOutcome | 'unchanged';
  narrationChanged: boolean;
  headlineChanged: boolean;
}

const readyIndexes = (project: StudioProject) =>
  project.storyboard.scenes.flatMap((scene, index) =>
    !project.sceneProgress || project.sceneProgress[scene.id]?.stage === 'ready' ? [index] : []);

/**
 * Applies one chat request to one scene. New narration gets new speech first, because the
 * scene's length, captions, and timings all follow the audio. The scene is then rendered; if
 * it crashes and cannot be repaired, it returns to the last version known to render.
 */
export async function reviseScene(
  project: StudioProject,
  index: number,
  instruction: string,
  deps: SceneRevisionDeps
): Promise<SceneRevisionResult> {
  const before = project.storyboard.scenes[index];
  const fileName = `Scene${index + 1}.tsx`;
  const previousCode = project.files[fileName] ?? '';
  const plan = await deps.plan(before, instruction);

  const narrationChanged = !!plan.voiceoverText && plan.voiceoverText !== before.voiceoverText.trim();
  const headlineChanged = !!plan.kineticHeadline && plan.kineticHeadline !== before.kineticHeadline.trim();
  let scene: SceneSpec = {
    ...before,
    ...(narrationChanged ? { voiceoverText: plan.voiceoverText } : {}),
    ...(headlineChanged ? { kineticHeadline: plan.kineticHeadline } : {}),
  };

  const audioPath = narrationChanged ? audioFilePath(project, before) : null;
  const audioBackup = audioPath && fs.existsSync(audioPath) ? fs.readFileSync(audioPath) : null;
  if (narrationChanged) {
    const audio = await deps.speak(scene, { fps: project.storyboard.fps, projectId: project.id, voice: project.storyboard.voice });
    scene = { ...scene, ...audio };
  }

  // Text and timing changes are applied by code when possible; that version is the safe fallback.
  let code = previousCode;
  let safeCode = previousCode;
  if (narrationChanged || headlineChanged) {
    const retimed = retimeSceneCode(previousCode, before, scene, project.storyboard);
    code = retimed ?? await deps.reviseCode(previousCode, scene,
      `The narration is now ${JSON.stringify(scene.voiceoverText)} and the headline is ${JSON.stringify(scene.kineticHeadline)}. The scene now lasts ${scene.durationInFrames} frames. Update every caption, headline text, and timing to match, and keep the visuals.`);
    if (retimed) safeCode = retimed;
  }
  if (plan.visualInstruction) code = await deps.reviseCode(code, scene, plan.visualInstruction);

  if (code === previousCode && !narrationChanged && !headlineChanged) {
    return { project, outcome: 'unchanged', narrationChanged, headlineChanged };
  }

  const withScene = (spec: SceneSpec, sceneCode: string): StudioProject => {
    const storyboard = { ...project.storyboard, scenes: project.storyboard.scenes.map((item, i) => (i === index ? spec : item)) };
    const next = { ...project, storyboard, files: { ...project.files, [fileName]: sceneCode } };
    return { ...next, files: { ...next.files, 'MainVideo.tsx': generateMainVideoCode(storyboard, readyIndexes(next)) } };
  };

  const candidate = withScene(scene, code);
  const checked = await guardRevisedScene(candidate, index, safeCode, deps.check);
  if (checked.outcome === 'reverted' && safeCode === previousCode) {
    // The old code still shows the old words, so the old narration, headline, and audio come back with it.
    if (audioPath && audioBackup) fs.writeFileSync(audioPath, audioBackup);
    return { project: withScene(before, previousCode), outcome: 'reverted', narrationChanged: false, headlineChanged: false };
  }
  return { project: withScene(scene, checked.code), outcome: checked.outcome, narrationChanged, headlineChanged };
}
