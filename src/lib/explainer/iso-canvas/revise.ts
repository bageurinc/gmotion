import { z } from 'zod';
import { AspectRatioDimensions, type StudioProject } from '@/types/studio';
import { callChat } from '../asset-generator';
import { assembleScenes, buildWorldScenes, isoCanvasMainVideo, sceneTimings } from './assemble';
import {
  detailTask, improve, isoQualityThreshold, objectTask, worldFile, worldSamples, worldTask,
  type IsoCanvasReport, type IsoQualityItem, type IsoTaskContext,
} from './build';
import { applyMotion, detailBodies, readFunction, replaceFunction, shapeName, worldBody, type MotionObject } from './code-parts';
import { dryRunIsoCanvas } from './dry-run';
import { keepGroundedLabels, type IsoCanvasObject, type IsoCanvasPlan } from './plan';
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
  /** object and to are null when only the timing of state changes is revised. */
  | { target: 'motion'; scene: number; object: string | null; to: [number, number, number] | null; at: number; over: number; events: IsoMotionEvent[]; walks: boolean }
  | { target: 'none'; reason: string };

/** A state change timed inside the scene, e.g. the gate's alarm when the walker reaches it. */
export interface IsoMotionEvent {
  object: string;
  key: string;
  value: number;
  at: number;
}

const DecisionSchema = z.object({
  target: z.enum(['object', 'world', 'detail', 'shot', 'motion', 'none']),
  moveTo: z.array(z.number()).length(3).nullable().optional(),
  moveAt: z.number().nullable().optional(),
  moveOver: z.number().nullable().optional(),
  events: z.array(z.object({ object: z.string(), key: z.string(), value: z.number(), at: z.number() })).max(4).nullable().optional(),
  walks: z.boolean().nullable().optional(),
  object: z.string().nullable().optional(),
  scene: z.number().int().nullable().optional(),
  instruction: z.string().max(1500).nullable().optional(),
  zoomScale: z.number().nullable().optional(),
  focus: z.string().nullable().optional(),
  label: z.string().max(40).nullable().optional(),
  reason: z.string().max(400).nullable().optional(),
});

export const ISO_REVISION_TARGET_PROMPT = `You route a user's revision request for an isometric explainer video to the one part that must change.
The video is one world. Objects are drawn by one function each, always at their place, and appear in every scene. The world function draws the floor, walls, and surroundings. A "world" scene is camera data plus object state changes: which object it focuses on, zoom, one label, and states that change during the scene. A "detail" scene is a close-up with its own drawing code. Narration, audio, and scene lengths cannot change here.
World units are meters; x and y are the floor, z is up. Each object lists its position (the centre of its footprint), its size [w, d, h], and its states (numbers from 0 to 1).

Output only JSON:
{"target":"object|world|detail|shot|motion|none","object":"object id or null","scene":1-based scene number or null,"instruction":"English: the concrete drawing change to make, or null","zoomScale":number or null,"focus":"object id, \\"wide\\", or null","label":"new label text, \\"\\" to remove it, or null","moveTo":[x,y,z] or null,"moveAt":seconds or null,"moveOver":seconds or null,"events":[{"object":"id","key":"state","value":0 to 1,"at":seconds}] or null,"walks":true or false,"reason":"Bahasa Indonesia, one short sentence, only for none"}

Rules:
- motion: the request is about where an object goes or when something happens in a world scene: an object travels somewhere (a person walks through a gate, a car drives off), or a state must change at a moment (an alarm goes off when the person is under the gate, a light turns on after the door opens). Give the moving object (or null when only timing changes), moveTo as the absolute destination of its footprint centre, moveAt and moveOver as scene seconds for the trip, and events for the state changes timed to it (only states the objects list). To pass through something, the destination is on its far side, in a straight line through its opening. Time an event for when the mover reaches the spot: moveAt + moveOver × (distance to the spot ÷ whole distance). Everything must fit inside the scene's length. Give the world scene number. Set walks to true when the mover travels on legs (a person or an animal), so its legs step on the way; false for vehicles and things that roll, slide, or fly.
- object: the request is only about how an object looks or animates in place (shape, parts, colors, proportions, a person's pose, legs swinging). An object function cannot move the object to another place and cannot time anything to other objects: use motion for that. Give its id and an instruction.
- world: the request is about the floor, walls, background, surroundings, or the place itself. Give an instruction.
- detail: the request is about what a close-up scene draws. Give the scene number of a detail scene and an instruction.
- shot: the request is about the camera or the label of a world scene: closer or wider (zoomScale, e.g. 1.4 closer, 0.7 wider), look at another object (focus, or "wide"), or change or remove its label. Give the scene number of a world scene. Leave fields that do not change as null.
- If the user picked a scene, a shot or detail request is about that scene; an object or world request still targets the object or world, because it shows in every scene.
- none: the request asks to change the narration, voice, music, duration, or text panel, it is too unclear to act on, or no target above can do it. Never pick the closest target for a request it cannot fulfil. Explain briefly in Bahasa Indonesia what can be revised: objects, the world, close-ups, the camera and labels, and where objects go and when things happen.
- Never invent facts, numbers, or brand names in an instruction or label.`;

function describeVideo(project: StudioProject, plan: IsoCanvasPlan, worldScenes: ReturnType<typeof buildWorldScenes>): string {
  const objects = plan.objects.map((object) => {
    const states = object.states.map((state) => `${state.key} (${state.meaning})`).join('; ') || 'none';
    const moves = object.path ? `, already travels to [${object.path.to.join(', ')}] with state ${object.path.key}` : '';
    return `- ${object.id}: ${object.label}. ${object.look} Position [${object.at.join(', ')}], size [${object.size.join(', ')}]${moves}. States: ${states}`;
  }).join('\n');
  const durations = sceneTimings(project.storyboard).map((timing) => timing.duration);
  const scenes = plan.beats.map((beat, index) => {
    const kind = worldScenes[index] ? 'world' : 'detail';
    const focus = beat.focus ?? 'wide';
    const changes = beat.set.map((change) => `${change.object}.${change.key}→${change.value}${change.at !== undefined ? ` at ${change.at}s` : ''}`).join(', ');
    return `${index + 1}. [${kind}, ${durations[index].toFixed(1)} s] focus ${focus}${beat.label ? `, label "${beat.label}"` : ''}${changes ? `, changes ${changes}` : ''}: "${beat.text}"`;
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
  if (raw.target === 'motion') {
    if (!worldScenes[scene]) return unclear(`Adegan ${scene + 1} adalah close-up, jadi benda tidak bisa berpindah di sana. Pilih adegan yang memperlihatkan dunianya.`);
    const byId = new Map(plan.objects.map((object) => [object.id, object]));
    const mover = raw.object ? byId.get(raw.object) : undefined;
    const to = raw.moveTo && raw.moveTo.every((value) => Number.isFinite(value) && Math.abs(value) <= 30) ? raw.moveTo as [number, number, number] : null;
    const events = (raw.events ?? [])
      .filter((event) => byId.get(event.object)?.states.some((state) => state.key === event.key) && event.value >= 0 && event.value <= 1 && Number.isFinite(event.at))
      .map((event) => ({ ...event, at: Math.max(0, event.at) }));
    if (raw.object && (!mover || !to)) return unclear();
    if (!mover && !events.length) return unclear();
    return {
      target: 'motion',
      scene,
      object: mover ? mover.id : null,
      walks: Boolean(mover && raw.walks),
      to: mover ? to : null,
      at: Math.max(0, raw.moveAt ?? 0.3),
      over: Math.max(0.3, Math.min(30, raw.moveOver ?? 2)),
      events,
    };
  }
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

/** How far a revised drawing's score may fall below the old one before it is rejected. */
const WORSE_MARGIN = 0.15;

/** One decimal with a comma, as Indonesian text writes numbers. */
const seconds = (value: number) => value.toFixed(1).replace('.', ',');

/**
 * Moves a destination on along the trip until the mover's footprint no longer overlaps another
 * object (the gate test sent the key carrier onto the other visitor's spot). Up to 3 m further.
 */
export function clearDestination(plan: IsoCanvasPlan, moverId: string, to: [number, number, number]): [number, number, number] {
  const mover = plan.objects.find((object) => object.id === moverId);
  if (!mover) return to;
  const [dx, dy] = [to[0] - mover.at[0], to[1] - mover.at[1]];
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return to;
  const others = plan.objects.filter((object) => object.id !== moverId).map((object) => ({ at: object.path?.to ?? object.at, size: object.size }));
  // Tall objects that merely touch still overlap on screen, so keep a gap between footprints.
  const gap = 0.35;
  const overlaps = (point: [number, number, number]) => others.some((other) =>
    Math.abs(point[0] - other.at[0]) < (mover.size[0] + other.size[0]) / 2 + gap && Math.abs(point[1] - other.at[1]) < (mover.size[1] + other.size[1]) / 2 + gap);
  let point = to;
  for (let step = 0; step < 12 && overlaps(point); step += 1) {
    point = [point[0] + (dx / length) * 0.25, point[1] + (dy / length) * 0.25, point[2]];
  }
  return overlaps(point) ? to : point.map((value) => Math.round(value * 100) / 100) as [number, number, number];
}

/** Objects with their paths, for the motion wrappers in IsoObjects.ts. */
export function motionObjects(plan: IsoCanvasPlan): MotionObject[] {
  return plan.objects.map((object) => ({ name: objectFunctionName(object.id), at: object.at, path: object.path }));
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
 * Rewrites one object's drawing from its current code and an instruction, through the quality
 * loop. Once motion wraps an object, its drawing lives in <name>Shape; the model still sees and
 * returns it under the exported name, so its checks stay the same.
 */
async function rewriteObject(ctx: IsoTaskContext, objectsFile: string, object: IsoCanvasObject, instruction: string): Promise<{ error: string } | { file: string; item: IsoQualityItem }> {
  const name = objectFunctionName(object.id);
  const shape = readFunction(objectsFile, shapeName(name));
  const current = shape?.replace(new RegExp(`^function\\s+${shapeName(name)}\\s*\\(`), `export function ${name}(`) ?? readFunction(objectsFile, name);
  if (!current) return { error: `Kode benda "${object.label}" tidak ditemukan.` };
  const result = await improve(objectTask(ctx, object, revisionRequest(objectRequest(ctx.plan, object), instruction, current)));
  if (!result.code) return { error: `Benda "${object.label}" gagal direvisi karena kode barunya tidak lolos pemeriksaan.` };
  const file = shape
    ? replaceFunction(objectsFile, shapeName(name), result.code.replace(new RegExp(`\\bexport\\s+function\\s+${name}\\s*\\(`), `function ${shapeName(name)}(`))
    : replaceFunction(objectsFile, name, result.code);
  if (!file) return { error: `Kode benda "${object.label}" tidak bisa diganti.` };
  return { file, item: result.item };
}

/** Axis words for the direction of a trip, as the object prompt names them. */
function travelDirection(from: [number, number, number], to: [number, number, number]): string {
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? '+x' : '-x') : (dy >= 0 ? '+y' : '-y');
}

/** What a walker's drawing needs once the engine moves it: steps while travelling, still otherwise. */
export function walkInstruction(key: string, direction: string): string {
  return `The engine now moves this object across the world with state "${key}": 0 is its place, 1 is the destination, and in between it is travelling toward ${direction}. Make it walk while it travels: while ${key} is strictly between 0 and 1, the legs step forward and back in a walk cycle (about 2 steps per second, driven by t), the arms swing opposite to the legs, and the body bobs slightly. At 0 and at 1 it stands still in its normal pose. Fade the cycle in and out with a factor like Math.min(1, Math.min(k, 1 - k) * 20), where k is state["${key}"] ?? 0. Turn the figure to face ${direction}, the way it walks. Do not move the object yourself: it stays centred on the origin. Keep every other part of the drawing as it is.`;
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

  // Shots, motion, and close-ups rebuild IsoScenes.ts, which needs every close-up body.
  const needsScenes = decision.target === 'shot' || decision.target === 'detail' || decision.target === 'motion';
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
  } else if (decision.target === 'motion') {
    const scene = decision.scene;
    const duration = timings[scene].duration;
    const start = Math.min(decision.at, Math.max(0, duration - 0.5));
    const over = Math.min(decision.over, Math.max(0.3, duration - start));
    const beat = plan.beats[scene];
    let objects = plan.objects;
    let sets = [...beat.set];
    const notes: string[] = [];
    const label = (id: string) => plan.objects.find((object) => object.id === id)?.label ?? id;
    if (decision.object && decision.to) {
      const mover = plan.objects.find((object) => object.id === decision.object)!;
      let key = mover.path?.key;
      if (!key) {
        if (mover.states.length >= 3) return unchanged(`Benda "${mover.label}" sudah punya 3 keadaan, jadi belum bisa diberi gerakan berpindah. Video tidak berubah.`);
        key = mover.states.some((state) => state.key === 'jalan') ? 'jalanRevisi' : 'jalan';
      }
      const moveKey = key;
      // The meaning tells later object revisions that this state is a walk (legs can swing while 0 < k < 1).
      const states = mover.states.some((state) => state.key === moveKey) ? mover.states : [...mover.states, { key: moveKey, meaning: '0 at its place, 1 at the destination; between 0 and 1 it is travelling' }];
      const to = clearDestination(plan, mover.id, decision.to);
      objects = plan.objects.map((object) => (object.id === mover.id ? { ...object, states, path: { key: moveKey, to } } : object));
      sets = [...sets.filter((change) => !(change.object === mover.id && change.key === moveKey)), { object: mover.id, key: moveKey, value: 1, at: start, over }];
      notes.push(`"${mover.label}" kini berpindah dari detik ${seconds(start)} sampai ${seconds(start + over)}`);
    }
    for (const event of decision.events) {
      const at = Math.min(event.at, Math.max(0, duration - 0.2));
      sets = [...sets.filter((change) => !(change.object === event.object && change.key === event.key)), { object: event.object, key: event.key, value: event.value, at, over: 0.4 }];
      notes.push(`keadaan "${event.key}" pada ${label(event.object)} berubah di detik ${seconds(at)}`);
    }
    if (sets.length > 4) return unchanged(`Adegan ${scene + 1} akan punya lebih dari 4 perubahan sekaligus, jadi revisi ini belum bisa dipasang. Video tidak berubah.`);
    // Keep the trip in frame: look at the object the event happens on, a little wider for a trip.
    const focus = decision.events[0]?.object ?? beat.focus;
    const zoomScale = decision.object ? Math.min(beat.zoomScale ?? 1, 0.75) : beat.zoomScale;
    nextPlan = { ...plan, objects, beats: plan.beats.map((item, index) => (index === scene ? { ...item, set: sets, focus, zoomScale } : item)) };
    nextFiles['IsoObjects.ts'] = applyMotion(files['IsoObjects.ts'], motionObjects(nextPlan));
    nextFiles['IsoScenes.ts'] = scenesFile(nextPlan, bodies!);
    reply = `Adegan ${scene + 1}: ${notes.join('; ')}.`;
    // A walker that only slides reads as a cut-out: its drawing learns to step while it travels.
    const walker = decision.walks && decision.object ? nextPlan.objects.find((object) => object.id === decision.object) : undefined;
    if (walker?.path) {
      const path = walker.path;
      const walked = await withIsoBrowser((browser) => rewriteObject(
        { model, plan: nextPlan, frame, topic: `Topic: "${project.userPrompt}". Setting: ${plan.setting}`, browser },
        nextFiles['IsoObjects.ts'],
        walker,
        walkInstruction(path.key, travelDirection(walker.at, path.to)),
      ));
      const before = report?.items.find((item) => item.kind === 'object' && item.id === walker.id)?.score ?? null;
      if ('error' in walked) {
        reply += ` Langkah kakinya belum bisa ditambahkan, jadi "${walker.label}" bergerak tanpa melangkah.`;
      } else if (before !== null && walked.item.score !== null && walked.item.score < before - WORSE_MARGIN) {
        reply += ` Langkah kaki tidak dipasang karena gambar "${walker.label}" jadi lebih buruk (skor ${seconds(walked.item.score)}, sebelumnya ${seconds(before)}), jadi ia bergerak tanpa melangkah.`;
      } else {
        nextFiles['IsoObjects.ts'] = walked.file;
        report = mergeReport(report, walked.item);
        reply += ` "${walker.label}" kini melangkah saat berjalan. ${qualityNote(walked.item, threshold, before)}`;
      }
    }
  } else {
    const topic = `Topic: "${project.userPrompt}". Setting: ${plan.setting}`;
    type Outcome = { error: string } | { files: Record<string, string>; item: IsoQualityItem; what: string };
    const outcome = await withIsoBrowser(async (browser): Promise<Outcome> => {
      const ctx: IsoTaskContext = { model, plan, frame, topic, browser };
      if (decision.target === 'object') {
        const object = plan.objects.find((item) => item.id === decision.object)!;
        const result = await rewriteObject(ctx, files['IsoObjects.ts'], object, decision.instruction);
        if ('error' in result) return result;
        return { files: { 'IsoObjects.ts': result.file }, item: result.item, what: `Benda "${object.label}" sudah direvisi dan berlaku di semua adegan.` };
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
    // A clearly worse drawing is not kept: the critic cannot see the request, but a drop usually
    // means the change broke what worked (the gate test fell from 6.0 to 5.8 without the walk).
    if (before !== null && outcome.item.score !== null && outcome.item.score < before - WORSE_MARGIN) {
      return unchanged(`Hasil revisi dinilai lebih buruk (skor ${seconds(outcome.item.score)}, sebelumnya ${seconds(before)}), jadi video tidak diubah. Coba tulis bagian yang ingin diubah dengan lebih spesifik.`);
    }
    nextFiles = { ...nextFiles, ...outcome.files };
    report = mergeReport(report, outcome.item);
    reply = `${outcome.what} ${qualityNote(outcome.item, threshold, before)}`;
  }

  const iso = { 'IsoObjects.ts': nextFiles['IsoObjects.ts'], 'IsoWorld.ts': nextFiles['IsoWorld.ts'], 'IsoScenes.ts': nextFiles['IsoScenes.ts'] };
  const check = dryRunIsoCanvas(iso);
  if (!check.ok) return unchanged(`Hasil revisi tidak lolos pemeriksaan video (${check.problems[0]}), jadi video dikembalikan ke versi sebelumnya.`);
  nextFiles['MainVideo.tsx'] = isoCanvasMainVideo(storyboard, nextPlan, { title: Boolean(nextFiles['IsoTitle.tsx']), caption: Boolean(nextFiles['IsoCaption.tsx']), panel: Boolean(nextFiles['IsoPanel.tsx']) });
  return {
    project: { ...project, files: nextFiles, isoCanvasPlan: nextPlan, isoCanvasReport: report },
    changed: true,
    reply,
  };
}
