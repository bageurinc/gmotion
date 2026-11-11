import { z } from 'zod';
import { AspectRatioDimensions, type StudioProject } from '@/types/studio';
import { callChat } from '../asset-generator';
import { assembleScenes, buildWorldScenes, isoCanvasMainVideo, sceneTimings } from './assemble';
import {
  detailTask, improve, isoQualityThreshold, objectTask, worldFile, worldSamples, worldTask,
  type IsoCanvasReport, type IsoQualityItem, type IsoTaskContext,
} from './build';
import { detailBodies, readFunction, replaceFunction, worldBody } from './code-parts';
import { dryRunIsoCanvas } from './dry-run';
import { keepGroundedLabels, type IsoCanvasPlan } from './plan';
import { detailRequest, objectFunctionName, objectRequest, worldRequest } from './prompts';
import { withIsoBrowser } from './render';

/**
 * Chat revisions for isometric canvas videos. One video is one world: objects and the world are
 * drawn in every scene, world scenes are camera data, and only close-ups have code of their own.
 * So a revision first decides what the message is about, then changes only that part, through
 * the same checks and quality loop as generation. Narration, audio, and timing never change.
 */

export type IsoRevisionTarget =
  | { target: 'object'; object: string; instruction: string }
  | { target: 'world'; instruction: string }
  | { target: 'detail'; scene: number; instruction: string }
  | { target: 'shot'; scene: number; zoomScale: number | null; focus: string | null; label: string | null }
  | { target: 'none'; reason: string };

const DecisionSchema = z.object({
  target: z.enum(['object', 'world', 'detail', 'shot', 'none']),
  object: z.string().nullable().optional(),
  scene: z.number().int().nullable().optional(),
  instruction: z.string().max(1500).nullable().optional(),
  zoomScale: z.number().nullable().optional(),
  focus: z.string().nullable().optional(),
  label: z.string().max(40).nullable().optional(),
  reason: z.string().max(400).nullable().optional(),
});

export const ISO_REVISION_TARGET_PROMPT = `You route a user's revision request for an isometric explainer video to the one part that must change.
The video is one world. Objects are drawn by one function each and appear in every scene. The world function draws the floor, walls, and surroundings. A "world" scene is camera data only: which object it focuses on, zoom, and one label. A "detail" scene is a close-up with its own drawing code. Narration, audio, and timing cannot change here.

Output only JSON:
{"target":"object|world|detail|shot|none","object":"object id or null","scene":1-based scene number or null,"instruction":"English: the concrete drawing change to make, or null","zoomScale":number or null,"focus":"object id, \\"wide\\", or null","label":"new label text, \\"\\" to remove it, or null","reason":"Bahasa Indonesia, one short sentence, only for none"}

Rules:
- object: the request is about how an object looks or moves (shape, parts, colors, proportions, a person's pose or walk). Give its id and an instruction.
- world: the request is about the floor, walls, background, surroundings, or the place itself. Give an instruction.
- detail: the request is about what a close-up scene draws. Give the scene number of a detail scene and an instruction.
- shot: the request is about the camera or the label of a world scene: closer or wider (zoomScale, e.g. 1.4 closer, 0.7 wider), look at another object (focus, or "wide"), or change or remove its label. Give the scene number of a world scene. Leave fields that do not change as null.
- If the user picked a scene, a shot or detail request is about that scene; an object or world request still targets the object or world, because it shows in every scene.
- none: the request asks to change the narration, voice, music, duration, or text panel, or it is too unclear to act on. Explain briefly in Bahasa Indonesia what can be revised: objects, the world, close-ups, the camera, and labels.
- Never invent facts, numbers, or brand names in an instruction or label.`;

function describeVideo(project: StudioProject, plan: IsoCanvasPlan, worldScenes: ReturnType<typeof buildWorldScenes>): string {
  const objects = plan.objects.map((object) => `- ${object.id}: ${object.label}. ${object.look}`).join('\n');
  const scenes = plan.beats.map((beat, index) => {
    const kind = worldScenes[index] ? 'world' : 'detail';
    const focus = beat.focus ?? 'wide';
    return `${index + 1}. [${kind}] focus ${focus}${beat.label ? `, label "${beat.label}"` : ''}: "${beat.text}"`;
  }).join('\n');
  return `Topic: "${project.userPrompt}"\nSetting: ${plan.setting}\nObjects:\n${objects}\nScenes:\n${scenes}`;
}

/** Turns the model's routing answer into a target that refers only to things that exist. */
export function resolveTarget(raw: z.infer<typeof DecisionSchema>, plan: IsoCanvasPlan, worldScenes: ReturnType<typeof buildWorldScenes>, chosen: number | null): IsoRevisionTarget {
  const instruction = raw.instruction?.trim() ?? '';
  const objects = new Set(plan.objects.map((object) => object.id));
  const unclear = (reason?: string | null): IsoRevisionTarget => ({ target: 'none', reason: reason?.trim() || 'Permintaan belum jelas. Yang bisa direvisi: bentuk benda, dunia di sekitarnya, close-up, kamera, dan label.' });
  if (raw.target === 'none') return unclear(raw.reason);
  if (raw.target === 'object') return raw.object && objects.has(raw.object) && instruction ? { target: 'object', object: raw.object, instruction } : unclear();
  if (raw.target === 'world') return instruction ? { target: 'world', instruction } : unclear();
  const scene = chosen ?? (raw.scene ? raw.scene - 1 : -1);
  if (scene < 0 || scene >= plan.beats.length) return unclear('Sebutkan adegan mana yang ingin diubah, atau pilih adegannya dulu.');
  if (raw.target === 'detail') {
    if (worldScenes[scene]) return unclear(`Adegan ${scene + 1} bukan close-up. Untuk adegan ini yang bisa diubah adalah kamera, label, atau benda yang tampil.`);
    return instruction ? { target: 'detail', scene, instruction } : unclear();
  }
  if (!worldScenes[scene]) return unclear(`Adegan ${scene + 1} adalah close-up. Tulis apa yang ingin diubah dari gambarnya.`);
  const focus = raw.focus === 'wide' ? 'wide' : raw.focus && objects.has(raw.focus) ? raw.focus : null;
  const zoomScale = typeof raw.zoomScale === 'number' && raw.zoomScale > 0 && Math.abs(raw.zoomScale - 1) > 0.02 ? raw.zoomScale : null;
  const label = typeof raw.label === 'string' ? raw.label.trim() : null;
  if (zoomScale === null && focus === null && label === null) return unclear();
  return { target: 'shot', scene, zoomScale, focus, label };
}

export async function decideIsoRevision(model: string, project: StudioProject, plan: IsoCanvasPlan, message: string, chosen: number | null): Promise<IsoRevisionTarget> {
  const frame = AspectRatioDimensions[project.storyboard.aspectRatio];
  const worldScenes = buildWorldScenes(plan, sceneTimings(project.storyboard), frame);
  const picked = chosen === null ? 'The user did not pick a scene.' : `The user picked scene ${chosen + 1}.`;
  const { text } = await callChat({
    model,
    system: ISO_REVISION_TARGET_PROMPT,
    content: `${describeVideo(project, plan, worldScenes)}\n\n${picked}\nRevision request (Bahasa Indonesia): "${message}"`,
    maxTokens: 1_500,
  });
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) return { target: 'none', reason: 'Permintaan revisi tidak bisa dibaca. Coba tulis dengan cara lain.' };
  try {
    const parsed = DecisionSchema.safeParse(JSON.parse(json[0]));
    if (!parsed.success) return { target: 'none', reason: 'Permintaan revisi tidak bisa dibaca. Coba tulis dengan cara lain.' };
    return resolveTarget(parsed.data, plan, worldScenes, chosen);
  } catch {
    return { target: 'none', reason: 'Permintaan revisi tidak bisa dibaca. Coba tulis dengan cara lain.' };
  }
}

/** The generate request plus the user's change and the code to change, so the model edits it. */
export function revisionRequest(request: string, instruction: string, code: string): string {
  return `${request}

CHANGE REQUESTED BY THE USER (apply it fully; keep everything else that already works):
${instruction}

Current code:
\`\`\`ts
${code}
\`\`\`
Return the complete updated code in the same format.`;
}

export interface IsoRevisionResult {
  /** The updated project, or the same project when nothing changed. */
  project: StudioProject;
  changed: boolean;
  /** Bahasa Indonesia, for the editor chat. */
  reply: string;
}

const scoreText = (score: number | null) => (score === null ? 'tanpa skor' : `skor ${score.toFixed(1).replace('.', ',')}`);

function mergeReport(report: IsoCanvasReport | undefined, item: IsoQualityItem): IsoCanvasReport {
  const items = (report?.items ?? []).filter((existing) => !(existing.kind === item.kind && existing.id === item.id));
  return { threshold: report?.threshold ?? isoQualityThreshold(), items: [...items, item] };
}

function qualityNote(item: IsoQualityItem, threshold: number, before: number | null): string {
  const change = before !== null && item.score !== null ? ` (sebelumnya ${scoreText(before).replace('skor ', '')})` : '';
  if (item.passed) return `Skor penilai ${scoreText(item.score).replace('skor ', '')}${change}.`;
  return `Skor penilai ${scoreText(item.score).replace('skor ', '')}${change}, masih di bawah ${String(threshold).replace('.', ',')}. Periksa hasilnya di pratinjau.`;
}

/**
 * Applies one chat revision to an isometric canvas project. Returns the project unchanged, with
 * an honest reply, when the request cannot be acted on or the new code never passes the checks.
 */
export async function reviseIsoCanvas(model: string, project: StudioProject, message: string, chosen: number | null): Promise<IsoRevisionResult> {
  const plan = project.isoCanvasPlan;
  const files = project.files;
  const unchanged = (reply: string): IsoRevisionResult => ({ project, changed: false, reply });
  if (!plan || !files['IsoObjects.ts'] || !files['IsoWorld.ts'] || !files['IsoScenes.ts']) {
    return unchanged('Video ini dibuat dengan mesin Isometrik lama, jadi belum bisa direvisi lewat chat.');
  }

  const decision = await decideIsoRevision(model, project, plan, message, chosen);
  if (decision.target === 'none') return unchanged(decision.reason);

  const storyboard = project.storyboard;
  const frame = AspectRatioDimensions[storyboard.aspectRatio];
  const timings = sceneTimings(storyboard);
  const worldScenes = buildWorldScenes(plan, timings, frame);
  const objectNames = plan.objects.map((object) => objectFunctionName(object.id));
  const threshold = isoQualityThreshold();

  // Shots and close-ups rebuild IsoScenes.ts, which needs every close-up body.
  const needsScenes = decision.target === 'shot' || decision.target === 'detail';
  const bodies = needsScenes ? detailBodies(files['IsoScenes.ts']) : [];
  const detailIndexes = worldScenes.flatMap((scene, index) => (scene ? [] : [index]));
  if (needsScenes && (!bodies || bodies.length !== detailIndexes.length)) {
    return unchanged('Adegan video ini tidak bisa dibaca untuk direvisi. Coba buat ulang videonya.');
  }
  const scenesFile = (nextPlan: IsoCanvasPlan, nextBodies: string[]) => assembleScenes(
    buildWorldScenes(nextPlan, timings, frame),
    plan.beats.map((_, index) => {
      const at = detailIndexes.indexOf(index);
      return at < 0 ? null : { start: timings[index].start, duration: timings[index].duration, body: nextBodies[at] };
    }),
    objectNames,
  );

  let nextFiles = { ...files };
  let nextPlan = plan;
  let report = project.isoCanvasReport;
  let reply = '';

  if (decision.target === 'shot') {
    const beat = plan.beats[decision.scene];
    const focus = decision.focus === 'wide' ? null : decision.focus ?? beat.focus;
    const zoomScale = decision.zoomScale === null ? beat.zoomScale : Math.max(0.4, Math.min(2.5, (beat.zoomScale ?? 1) * decision.zoomScale));
    // A new focus fits its own zoom first; the user's closer or wider still applies on top.
    const keptScale = decision.focus !== null && decision.focus !== beat.focus && decision.zoomScale === null ? undefined : zoomScale;
    const label = decision.label === null ? beat.label : decision.label || null;
    const edited: IsoCanvasPlan = { ...plan, beats: plan.beats.map((item, index) => (index === decision.scene ? { ...item, focus, label, zoomScale: keptScale } : item)) };
    nextPlan = keepGroundedLabels(edited, project.userPrompt);
    const labelDropped = Boolean(label) && !nextPlan.beats[decision.scene].label;
    nextFiles['IsoScenes.ts'] = scenesFile(nextPlan, bodies!);
    const parts = [
      decision.zoomScale !== null ? (decision.zoomScale > 1 ? 'kamera lebih dekat' : 'kamera lebih jauh') : '',
      decision.focus !== null ? (focus ? `kamera kini menyorot ${plan.objects.find((object) => object.id === focus)?.label ?? focus}` : 'kamera kini mengambil bidikan lebar') : '',
      decision.label !== null && !labelDropped ? (label ? `label menjadi "${label}"` : 'label dihapus') : '',
    ].filter(Boolean);
    reply = `Adegan ${decision.scene + 1}: ${parts.join(', ') || 'tidak ada yang berubah'}.`;
    if (labelDropped) reply += ` Label "${label}" tidak dipakai karena kata-katanya tidak ada di narasi adegan ini.`;
  } else {
    const topic = `Topic: "${project.userPrompt}". Setting: ${plan.setting}`;
    type Outcome = { error: string } | { files: Record<string, string>; item: IsoQualityItem; what: string };
    const outcome = await withIsoBrowser(async (browser): Promise<Outcome> => {
      const ctx: IsoTaskContext = { model, plan, frame, topic, browser };
      if (decision.target === 'object') {
        const object = plan.objects.find((item) => item.id === decision.object)!;
        const name = objectFunctionName(object.id);
        const current = readFunction(files['IsoObjects.ts'], name);
        if (!current) return { error: `Kode benda "${object.label}" tidak ditemukan.` };
        const result = await improve(objectTask(ctx, object, revisionRequest(objectRequest(plan, object), decision.instruction, current)));
        if (!result.code) return { error: `Benda "${object.label}" gagal direvisi karena kode barunya tidak lolos pemeriksaan.` };
        const replaced = replaceFunction(files['IsoObjects.ts'], name, result.code);
        if (!replaced) return { error: `Kode benda "${object.label}" tidak bisa diganti.` };
        return { files: { 'IsoObjects.ts': replaced }, item: result.item, what: `Benda "${object.label}" sudah direvisi dan berlaku di semua adegan.` };
      }
      if (decision.target === 'world') {
        const sampled = worldSamples(plan, worldScenes, frame);
        const result = await improve(worldTask(ctx, files['IsoObjects.ts'], sampled, revisionRequest(worldRequest(plan), decision.instruction, worldBody(files['IsoWorld.ts']))));
        if (!result.code) return { error: 'Dunia gagal direvisi karena kode barunya tidak lolos pemeriksaan.' };
        return { files: { 'IsoWorld.ts': worldFile(plan, result.code) }, item: result.item, what: 'Dunia di sekitar benda sudah direvisi dan berlaku di semua adegan.' };
      }
      const at = detailIndexes.indexOf(decision.scene);
      const beat = plan.beats[decision.scene];
      const detail = plan.details.find((item) => item.id === beat.focus);
      if (!detail || at < 0) return { error: `Close-up adegan ${decision.scene + 1} tidak ditemukan.` };
      const timing = timings[decision.scene];
      const request = revisionRequest(detailRequest(plan, detail, beat.text, timing.duration), decision.instruction, bodies![at]);
      const result = await improve(detailTask(ctx, files['IsoObjects.ts'], detail, decision.scene, timing, request));
      if (!result.code) return { error: `Close-up adegan ${decision.scene + 1} gagal direvisi karena kode barunya tidak lolos pemeriksaan.` };
      const nextBodies = [...bodies!];
      nextBodies[at] = result.code;
      return { files: { 'IsoScenes.ts': scenesFile(plan, nextBodies) }, item: result.item, what: `Close-up adegan ${decision.scene + 1} sudah direvisi.` };
    });
    if ('error' in outcome) return unchanged(`${outcome.error} Video tidak berubah.`);
    const before = report?.items.find((item) => item.kind === outcome.item.kind && item.id === outcome.item.id)?.score ?? null;
    nextFiles = { ...nextFiles, ...outcome.files };
    report = mergeReport(report, outcome.item);
    reply = `${outcome.what} ${qualityNote(outcome.item, threshold, before)}`;
  }

  const iso = { 'IsoObjects.ts': nextFiles['IsoObjects.ts'], 'IsoWorld.ts': nextFiles['IsoWorld.ts'], 'IsoScenes.ts': nextFiles['IsoScenes.ts'] };
  const check = dryRunIsoCanvas(iso);
  if (!check.ok) return unchanged(`Hasil revisi tidak lolos pemeriksaan video (${check.problems[0]}), jadi video dikembalikan ke versi sebelumnya.`);
  nextFiles['MainVideo.tsx'] = isoCanvasMainVideo(storyboard, nextPlan);
  return {
    project: { ...project, files: nextFiles, isoCanvasPlan: nextPlan, isoCanvasReport: report },
    changed: true,
    reply,
  };
}
