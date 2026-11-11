import vm from 'node:vm';
import { transform } from 'sucrase';
import { createIso, lit, mixColor, ramp, win } from '@/motion-kit/iso-canvas/engine';
import { paintIsoScene, statesAt, type IsoSceneSpec, type IsoStates, type IsoWorldDraw } from '@/motion-kit/iso-canvas/scenes';
import { ISO_CANVAS_FILES, validateIsoCanvasFiles, type IsoCanvasFiles } from './contract';

/** Per call into model-written code; a frame that needs longer would also stall the preview. */
const CALL_TIMEOUT_MS = 1_000;
const WIDTH = 1080;
const HEIGHT = 1920;

/** What the sandbox sees for '@/motion-kit': the pure engine, without React. */
const KIT = Object.freeze({ createIso, ramp, win, lit, mixColor, statesAt, paintIsoScene });

export interface IsoDryRunReport {
  ok: boolean;
  /** Problems written for the model, so they can be sent back as they are. */
  problems: string[];
  /** Calls made per sampled frame, a rough measure of drawing detail. */
  drawCalls: number;
}

type Recorded = { name: string; args: unknown[] };

/** Canvas stand-in that records calls and flags coordinates that are not finite numbers. */
function recordingContext() {
  const calls: Recorded[] = [];
  let fills = 0;
  let badNumbers = 0;
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: String(text).length * 18 }),
    createLinearGradient: (...args: unknown[]) => {
      if (args.some((value) => typeof value === 'number' && !Number.isFinite(value))) badNumbers += 1;
      return gradient;
    },
    createRadialGradient: (...args: unknown[]) => {
      if (args.some((value) => typeof value === 'number' && !Number.isFinite(value))) badNumbers += 1;
      return gradient;
    },
  };
  const ctx = new Proxy(target, {
    get: (object, key) => {
      if (typeof key !== 'string') return undefined;
      if (key in object) return object[key];
      return (...args: unknown[]) => {
        if (args.some((value) => typeof value === 'number' && !Number.isFinite(value))) badNumbers += 1;
        if (key === 'fill' || key === 'stroke' || key === 'fillRect' || key === 'fillText') fills += 1;
        calls.push({ name: key, args: args.map((value) => (typeof value === 'number' ? Math.round(value * 100) / 100 : value)) });
      };
    },
    set: (object, key, value) => {
      object[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, fills: () => fills, badNumbers: () => badNumbers };
}

/** Loads the three modules in one fresh VM context with a tiny CommonJS loader. */
function loadModules(files: IsoCanvasFiles, context: vm.Context) {
  const cache: Record<string, { exports: Record<string, unknown> }> = {};
  const load = (name: string): Record<string, unknown> => {
    if (cache[name]) return cache[name].exports;
    const record = { exports: {} as Record<string, unknown> };
    cache[name] = record;
    const compiled = transform(files[name as keyof IsoCanvasFiles], { transforms: ['typescript', 'imports'], production: true }).code;
    const factory = vm.runInContext(`(function (require, module, exports) {\n${compiled}\n})`, context, { timeout: CALL_TIMEOUT_MS, filename: name });
    const require = (path: string) => {
      if (path === '@/motion-kit') return KIT;
      const file = `${path.replace(/^\.\//, '')}.ts`;
      if (!(ISO_CANVAS_FILES as readonly string[]).includes(file)) throw new Error(`Module ${path} is not available`);
      return load(file);
    };
    context.__factory = factory;
    context.__args = [require, record, record.exports];
    vm.runInContext('__factory.apply(null, __args)', context, { timeout: CALL_TIMEOUT_MS, filename: name });
    return record.exports;
  };
  return { objects: load('IsoObjects.ts'), world: load('IsoWorld.ts'), scenes: load('IsoScenes.ts') };
}

const sceneProblem = (scene: unknown, index: number): string | null => {
  const item = scene as Partial<IsoSceneSpec> | null;
  if (!item || typeof item !== 'object') return `scenes[${index}] is not an object.`;
  if (item.kind !== 'world' && item.kind !== 'detail') return `scenes[${index}].kind must be 'world' or 'detail'.`;
  if (!Number.isFinite(item.start) || !Number.isFinite(item.duration) || (item.duration ?? 0) <= 0) return `scenes[${index}] needs a finite start and a positive duration.`;
  if (item.kind === 'detail' && typeof (item as { draw?: unknown }).draw !== 'function') return `scenes[${index}] is a detail scene without a draw function.`;
  if (item.kind === 'world' && (!Array.isArray((item as { camera?: unknown }).camera) || !(item as { camera: unknown[] }).camera.length)) return `scenes[${index}] is a world scene without camera keys.`;
  return null;
};

/**
 * Runs the modules against a recording canvas: every object alone, the world, and three
 * moments of every scene, plus one frame twice to prove it is deterministic. Model code runs
 * in a VM context with a time limit per call; it reaches the context only after the static
 * validator, which is the real gate.
 */
export function dryRunIsoCanvas(files: IsoCanvasFiles, size = { width: WIDTH, height: HEIGHT }): IsoDryRunReport {
  const problems = validateIsoCanvasFiles(files);
  if (problems.length) return { ok: false, problems, drawCalls: 0 };

  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  /** Runs host code that calls into the sandbox under the VM's time limit. */
  const guarded = <T,>(label: string, job: () => T): T | undefined => {
    context.__job = job;
    try {
      return vm.runInContext('__job()', context, { timeout: CALL_TIMEOUT_MS, filename: label }) as T;
    } catch (error) {
      const text = String(error instanceof Error ? error.message : error);
      problems.push(/timed out/i.test(text) ? `${label} took longer than ${CALL_TIMEOUT_MS} ms for one frame.` : `${label} threw: ${text.slice(0, 300)}`);
      return undefined;
    }
  };

  let modules: ReturnType<typeof loadModules>;
  try {
    modules = loadModules(files, context);
  } catch (error) {
    return { ok: false, problems: [`Loading the modules failed: ${String(error instanceof Error ? error.message : error).slice(0, 300)}`], drawCalls: 0 };
  }

  const frame = (label: string, paint: (iso: ReturnType<typeof createIso>) => void) => {
    const recorder = recordingContext();
    guarded(label, () => {
      const iso = createIso(recorder.ctx, size.width, size.height);
      paint(iso);
      iso.finish();
    });
    return recorder;
  };

  const objectFns = Object.entries(modules.objects).filter(([, value]) => typeof value === 'function') as [string, (iso: unknown, state: Record<string, number>, t: number) => void][];
  if (!objectFns.length) problems.push('IsoObjects.ts exports no object functions.');
  const drawWorld = modules.world.drawWorld as IsoWorldDraw | undefined;
  if (typeof drawWorld !== 'function') problems.push('IsoWorld.ts must export function drawWorld(iso, t, states).');
  const scenes = modules.scenes.scenes as unknown[];
  if (!Array.isArray(scenes) || !scenes.length) problems.push('IsoScenes.ts must export a non-empty array named scenes.');
  if (problems.length) return { ok: false, problems, drawCalls: 0 };

  for (const [name, draw] of objectFns) {
    const recorder = frame(`IsoObjects.${name}`, (iso) => {
      iso.look(0, 0, 0, 60);
      draw(iso, {}, 0);
    });
    if (!recorder.fills() && !problems.some((problem) => problem.includes(name))) problems.push(`IsoObjects.${name} draws nothing with an empty state.`);
    if (recorder.badNumbers()) problems.push(`IsoObjects.${name} produces NaN or infinite coordinates.`);
  }

  const shapeProblems = scenes.map(sceneProblem).filter((problem): problem is string => Boolean(problem));
  problems.push(...shapeProblems);
  if (shapeProblems.length) return { ok: false, problems, drawCalls: 0 };

  let drawCalls = 0;
  const typed = scenes as IsoSceneSpec[];
  typed.forEach((scene, index) => {
    for (const t of [0, scene.duration / 2, Math.max(0, scene.duration - 1 / 30)]) {
      const label = `scenes[${index}] (${scene.kind}) at ${t.toFixed(2)} s`;
      const recorder = frame(label, (iso) => paintIsoScene(iso, scene, t, drawWorld as IsoWorldDraw));
      if (recorder.badNumbers()) problems.push(`${label} produces NaN or infinite coordinates.`);
      if (!recorder.fills()) problems.push(`${label} draws nothing.`);
      drawCalls = Math.max(drawCalls, recorder.calls.length);
    }
  });

  // A frame rendered twice must be identical, or parallel export frames would flicker.
  const probe = typed[0];
  const first = frame('determinism check', (iso) => paintIsoScene(iso, probe, probe.duration / 3, drawWorld as IsoWorldDraw));
  const second = frame('determinism check', (iso) => paintIsoScene(iso, probe, probe.duration / 3, drawWorld as IsoWorldDraw));
  if (JSON.stringify(first.calls) !== JSON.stringify(second.calls)) problems.push('The same frame drew differently twice. Remove any state kept between calls.');

  for (let index = 1; index < typed.length; index += 1) {
    const expected = typed[index - 1].start + typed[index - 1].duration;
    if (Math.abs(typed[index].start - expected) > 0.05) problems.push(`scenes[${index}].start should be ${expected.toFixed(2)} so world time runs on without a jump.`);
  }

  return { ok: problems.length === 0, problems: [...new Set(problems)], drawCalls };
}

export type { IsoStates };
