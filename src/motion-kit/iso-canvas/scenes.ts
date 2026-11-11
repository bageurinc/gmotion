import { createIso, ramp, win, type CameraKey, type Iso, type IsoSafeInsets, type Vec3 } from './engine';

/** Numeric state of each object, keyed by object id then state name (e.g. { kipas: { putar: 1 } }). */
export type IsoStates = Record<string, Record<string, number>>;

/** Draws the shared world: background, ground, and every object at its place. */
export type IsoWorldDraw = (iso: Iso, t: number, states: IsoStates) => void;

/** A state that eases from its previous value to `to` between scene seconds `from` and `until`. */
export interface IsoStateChange {
  object: string;
  key: string;
  to: number;
  from: number;
  until: number;
}

export interface IsoSceneLabel {
  at: Vec3;
  text: string;
  sub?: string;
  /** Scene seconds the label is shown. */
  from: number;
  to: number;
  dx?: number;
  dy?: number;
  color?: string;
}

interface SceneBase {
  /** Global start time in seconds, so world motion (spinning, flowing) never jumps between scenes. */
  start: number;
  duration: number;
}

/** A camera move through the shared world. Pure data, no model-written code. */
export interface IsoWorldScene extends SceneBase {
  kind: 'world';
  camera: CameraKey[];
  /** Screen height share where the camera target sits; below centre leaves room for a top panel. */
  anchorY?: number;
  states: IsoStates;
  changes?: IsoStateChange[];
  labels?: IsoSceneLabel[];
}

/** A close-up, cutaway, or diagram with its own drawing function. */
export interface IsoDetailScene extends SceneBase {
  kind: 'detail';
  draw: (iso: Iso, t: number) => void;
}

export type IsoSceneSpec = IsoWorldScene | IsoDetailScene;

/** Object states at scene time t: the scene's starting states with every change eased in. */
export function statesAt(scene: IsoWorldScene, t: number): IsoStates {
  const states: IsoStates = Object.fromEntries(Object.entries(scene.states).map(([id, values]) => [id, { ...values }]));
  const changes = [...(scene.changes ?? [])].sort((a, b) => a.from - b.from);
  for (const change of changes) {
    const object = (states[change.object] ??= {});
    const before = object[change.key] ?? 0;
    object[change.key] = before + (change.to - before) * ramp(t, change.from, change.until);
  }
  return states;
}

/**
 * Paints one scene at scene time t (seconds from its start). The caller owns the canvas and
 * calls iso.finish() afterwards, so labels are laid out once per frame.
 */
export function paintIsoScene(iso: Iso, scene: IsoSceneSpec, t: number, drawWorld: IsoWorldDraw): void {
  if (scene.kind === 'detail') {
    // Close-up code is model-written: its labels keep the name only, never an extra claim line.
    const label = iso.label;
    iso.label = (x, y, z, text, options = {}) => label(x, y, z, text, { ...options, sub: undefined });
    scene.draw(iso, t);
    return;
  }
  iso.camPath(scene.camera, t, iso.width / 2, iso.height * (scene.anchorY ?? 0.5));
  drawWorld(iso, scene.start + t, statesAt(scene, t));
  for (const label of scene.labels ?? []) {
    const alpha = win(t, label.from, label.to, 0.35);
    if (alpha <= 0.01) continue;
    iso.label(label.at[0], label.at[1], label.at[2], label.text, { sub: label.sub, dx: label.dx, dy: label.dy, color: label.color, alpha });
  }
}

/** Convenience for runtimes without React: one full frame including label layout. */
export function paintIsoFrame(
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number; safe?: IsoSafeInsets },
  scene: IsoSceneSpec,
  t: number,
  drawWorld: IsoWorldDraw,
): void {
  const iso = createIso(ctx, size.width, size.height, { safe: size.safe });
  paintIsoScene(iso, scene, t, drawWorld);
  iso.finish();
}
