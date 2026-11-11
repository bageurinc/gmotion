import vm from 'node:vm';
import { transform } from 'sucrase';
import { createStory } from '@/motion-kit/story-canvas/engine';
import { rigSolve, rigWalk } from '@/motion-kit/story-canvas/rig';
import { actorOptions, paintStoryScene, storyStatesAt, type StorySceneSpec, type StoryWorld } from '@/motion-kit/story-canvas/scenes';
import { STORY_CANVAS_FILES, validateStoryCanvasFiles, type StoryCanvasFiles } from './contract';

/** Per call into model-written code; a frame that needs longer would also stall the preview. */
const CALL_TIMEOUT_MS = 1_000;

/** What the sandbox sees for '@/motion-kit': the pure engine, without React. */
const KIT = Object.freeze({ createStory, paintStoryScene, storyStatesAt, actorOptions, rigSolve, rigWalk });

export interface StoryDryRunReport {
  ok: boolean;
  /** Problems written for the model, so they can be sent back as they are. */
  problems: string[];
  drawCalls: number;
}

type Recorded = { name: string; args: unknown[] };

/** Canvas stand-in that records calls and flags coordinates that are not finite numbers. */
function recordingContext() {
  const calls: Recorded[] = [];
  let fills = 0;
  let badNumbers = 0;
  const gradient = { addColorStop: () => undefined };
  const checkArgs = (args: unknown[]) => {
    if (args.some((value) => typeof value === 'number' && !Number.isFinite(value))) badNumbers += 1;
  };
  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: String(text).length * 18 }),
    createLinearGradient: (...args: unknown[]) => {
      checkArgs(args);
      return gradient;
    },
    createRadialGradient: (...args: unknown[]) => {
      checkArgs(args);
      return gradient;
    },
  };
  const ctx = new Proxy(target, {
    get: (object, key) => {
      if (typeof key !== 'string') return undefined;
      if (key in object) return object[key];
      return (...args: unknown[]) => {
        checkArgs(args);
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

function loadModules(files: StoryCanvasFiles, context: vm.Context) {
  const cache: Record<string, { exports: Record<string, unknown> }> = {};
  const load = (name: string): Record<string, unknown> => {
    if (cache[name]) return cache[name].exports;
    const record = { exports: {} as Record<string, unknown> };
    cache[name] = record;
    const compiled = transform(files[name as keyof StoryCanvasFiles], { transforms: ['typescript', 'imports'], production: true }).code;
    const factory = vm.runInContext(`(function (require, module, exports) {\n${compiled}\n})`, context, { timeout: CALL_TIMEOUT_MS, filename: name });
    const require = (path: string) => {
      if (path === '@/motion-kit') return KIT;
      const file = `${path.replace(/^\.\//, '')}.ts`;
      if (!(STORY_CANVAS_FILES as readonly string[]).includes(file)) throw new Error(`Module ${path} is not available`);
      return load(file);
    };
    context.__factory = factory;
    context.__args = [require, record, record.exports];
    vm.runInContext('__factory.apply(null, __args)', context, { timeout: CALL_TIMEOUT_MS, filename: name });
    return record.exports;
  };
  return { props: load('StoryProps.ts'), places: load('StoryPlaces.ts'), scenes: load('StoryScenes.ts') };
}

const sceneProblem = (scene: unknown, index: number): string | null => {
  const item = scene as Partial<StorySceneSpec> | null;
  if (!item || typeof item !== 'object') return `scenes[${index}] is not an object.`;
  if (item.kind !== 'world' && item.kind !== 'detail') return `scenes[${index}].kind must be 'world' or 'detail'.`;
  if (!Number.isFinite(item.start) || !Number.isFinite(item.duration) || (item.duration ?? 0) <= 0) return `scenes[${index}] needs a finite start and a positive duration.`;
  if (item.kind === 'detail' && typeof (item as { draw?: unknown }).draw !== 'function') return `scenes[${index}] is a detail scene without a draw function.`;
  return null;
};

/** Where a prop's parts and flows are, in its own coordinates (base centre at 0, 0; meters; y up). */
export interface PropMap {
  parts?: Record<string, { at: [number, number]; size: [number, number] }>;
  flows?: Record<string, [number, number][]>;
}

/**
 * Reads the `export const drawNameMap = { parts, flows }` objects from StoryProps.ts in a fresh
 * VM, keyed by export name. The server needs them to aim the camera at parts and along flows.
 */
export function readPropMaps(propsFile: string): Record<string, PropMap> {
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  const compiled = transform(propsFile, { transforms: ['typescript', 'imports'], production: true }).code;
  const record = { exports: {} as Record<string, unknown> };
  context.__factory = vm.runInContext(`(function (require, module, exports) {\n${compiled}\n})`, context, { timeout: CALL_TIMEOUT_MS, filename: 'StoryProps.ts' });
  context.__args = [(path: string) => (path === '@/motion-kit' ? KIT : {}), record, record.exports];
  vm.runInContext('__factory.apply(null, __args)', context, { timeout: CALL_TIMEOUT_MS, filename: 'StoryProps.ts' });
  const maps: Record<string, PropMap> = {};
  for (const [name, value] of Object.entries(record.exports)) {
    // Structured clone keeps the data and drops anything that still points into the sandbox.
    if (name.endsWith('Map') && value && typeof value === 'object') maps[name] = JSON.parse(JSON.stringify(value)) as PropMap;
  }
  return maps;
}

/**
 * Whether a prop's drawing changes over time with its state held still: drawn at t and at
 * t + 0.5 s, the recorded canvas calls must differ. A heart that does not beat fails this.
 */
export function propMoves(propsFile: string, name: string, state: Record<string, number>): boolean {
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  const compiled = transform(propsFile, { transforms: ['typescript', 'imports'], production: true }).code;
  const record = { exports: {} as Record<string, unknown> };
  context.__factory = vm.runInContext(`(function (require, module, exports) {\n${compiled}\n})`, context, { timeout: CALL_TIMEOUT_MS, filename: 'StoryProps.ts' });
  context.__args = [(path: string) => (path === '@/motion-kit' ? KIT : {}), record, record.exports];
  vm.runInContext('__factory.apply(null, __args)', context, { timeout: CALL_TIMEOUT_MS, filename: 'StoryProps.ts' });
  const draw = record.exports[name] as ((s: unknown, state: Record<string, number>, t: number) => void) | undefined;
  if (typeof draw !== 'function') return false;
  const at = (t: number) => {
    const recorder = recordingContext();
    context.__job = () => {
      const s = createStory(recorder.ctx, 1080, 1920);
      s.look(0, 0, 3000);
      draw(s, state, t);
    };
    vm.runInContext('__job()', context, { timeout: CALL_TIMEOUT_MS, filename: name });
    return JSON.stringify(recorder.calls);
  };
  return at(1.1) !== at(1.6) || at(2.3) !== at(2.9);
}

export interface StoryDryRunOptions {
  width?: number;
  height?: number;
  /** Fail when a person's head or feet leave the frame in a sampled moment of a shot. */
  framing?: boolean;
}

/**
 * Runs the modules against a recording canvas: every prop and place alone, then three moments
 * of every scene, plus one frame twice to prove it is deterministic. Model code runs in a VM
 * context with a time limit per call, after the static validator, which is the real gate.
 */
export function dryRunStoryCanvas(files: StoryCanvasFiles, options: StoryDryRunOptions = {}): StoryDryRunReport {
  const width = options.width ?? 1080;
  const height = options.height ?? 1920;
  const problems = validateStoryCanvasFiles(files);
  if (problems.length) return { ok: false, problems, drawCalls: 0 };

  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
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

  const frame = (label: string, paint: (s: ReturnType<typeof createStory>) => void) => {
    const recorder = recordingContext();
    guarded(label, () => {
      const s = createStory(recorder.ctx, width, height);
      paint(s);
      s.finish();
    });
    return recorder;
  };

  const world = modules.scenes.world as StoryWorld | undefined;
  const scenes = modules.scenes.scenes as unknown[];
  if (!world || typeof world !== 'object' || !world.places || !world.props || !world.cast) problems.push('StoryScenes.ts must export world with places, props, and cast.');
  if (!Array.isArray(scenes) || !scenes.length) problems.push('StoryScenes.ts must export a non-empty array named scenes.');
  if (problems.length || !world) return { ok: false, problems, drawCalls: 0 };

  for (const [name, draw] of Object.entries(modules.props).filter(([, value]) => typeof value === 'function') as [string, (s: unknown, state: Record<string, number>, t: number) => void][]) {
    const recorder = frame(`StoryProps.${name}`, (s) => {
      s.look(0, 0.5, 300);
      draw(s, {}, 0);
    });
    if (!recorder.fills() && !problems.some((problem) => problem.includes(name))) problems.push(`StoryProps.${name} draws nothing with an empty state.`);
    if (recorder.badNumbers()) problems.push(`StoryProps.${name} produces NaN or infinite coordinates.`);
  }
  for (const [name, draw] of Object.entries(modules.places).filter(([, value]) => typeof value === 'function') as [string, (s: unknown, t: number, state: Record<string, number>) => void][]) {
    const recorder = frame(`StoryPlaces.${name}`, (s) => {
      s.look(2, 1, 200);
      draw(s, 0, {});
    });
    if (!recorder.fills() && !problems.some((problem) => problem.includes(name))) problems.push(`StoryPlaces.${name} draws nothing.`);
    if (recorder.badNumbers()) problems.push(`StoryPlaces.${name} produces NaN or infinite coordinates.`);
  }

  const shapeProblems = scenes.map(sceneProblem).filter((problem): problem is string => Boolean(problem));
  problems.push(...shapeProblems);
  if (shapeProblems.length) return { ok: false, problems, drawCalls: 0 };

  let drawCalls = 0;
  const typed = scenes as StorySceneSpec[];
  typed.forEach((scene, index) => {
    if (scene.kind === 'world' && !world.places[scene.place]) problems.push(`scenes[${index}] uses place "${scene.place}", which world.places does not have.`);
    for (const t of [0, scene.duration / 2, Math.max(0, scene.duration - 1 / 30)]) {
      const label = `scenes[${index}] (${scene.kind}) at ${t.toFixed(2)} s`;
      const camera = { zoom: null as number | null };
      const recorder = frame(label, (s) => {
        paintStoryScene(s, scene, t, world);
        // The camera scale after drawing: one meter in pixels.
        camera.zoom = Math.abs(s.P(1, 0)[0] - s.P(0, 0)[0]);
        // At t = 0 the camera may still be travelling from the previous shot; the people must be in frame once it arrives.
        if (options.framing && scene.kind === 'world' && t > 0) {
          for (const actor of scene.actors) {
            if (!(scene.keep ?? []).includes(actor.cast)) continue;
            const member = world.cast[actor.cast];
            if (!member) continue;
            const { x } = actorOptions(actor, member, t);
            const lying = actor.pose === 'lie' && !actor.poseTo;
            const points = lying ? [s.P(x - member.height * 0.5, actor.y + 0.1), s.P(x + member.height * 0.5, actor.y + 0.1)] : [s.P(x, actor.y), s.P(x, actor.y + member.height)];
            if (points.some(([px, py]) => px < 0 || px > width || py < 0 || py > height)) problems.push(`${label}: ${actor.cast} is partly outside the frame.`);
          }
        }
      });
      if (recorder.badNumbers()) problems.push(`${label} produces NaN or infinite coordinates.`);
      if (!recorder.fills()) problems.push(`${label} draws nothing.`);
      if (scene.kind === 'detail' && camera.zoom !== null && camera.zoom < 100) {
        problems.push(`${label} sets the camera zoom to ${camera.zoom.toFixed(2)}, so a 1 m object is ${camera.zoom.toFixed(2)} px wide and the frame looks empty. zoom is pixels per meter: use about 1600 for a 0.5 m subject.`);
      }
      drawCalls = Math.max(drawCalls, recorder.calls.length);
    }
  });

  const probe = typed[0];
  const first = frame('determinism check', (s) => paintStoryScene(s, probe, probe.duration / 3, world));
  const second = frame('determinism check', (s) => paintStoryScene(s, probe, probe.duration / 3, world));
  if (JSON.stringify(first.calls) !== JSON.stringify(second.calls)) problems.push('The same frame drew differently twice. Remove any state kept between calls.');

  for (let index = 1; index < typed.length; index += 1) {
    const expected = typed[index - 1].start + typed[index - 1].duration;
    if (Math.abs(typed[index].start - expected) > 0.05) problems.push(`scenes[${index}].start should be ${expected.toFixed(2)} so time runs on without a jump.`);
  }

  return { ok: problems.length === 0, problems: [...new Set(problems)], drawCalls };
}
