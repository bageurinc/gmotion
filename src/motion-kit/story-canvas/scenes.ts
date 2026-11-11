import { ramp, win } from '../iso-canvas/engine';
import { createStory, type CameraKey2D, type FaceExpression, type HairStyle, type PersonOptions, type Story, type Vec2 } from './engine';
import type { IsoSafeInsets } from '../iso-canvas/engine';
import { rigWalk, type RigPoseName } from './rig';
import { pointAt, samplePath } from './motion';

/** Numeric state of each prop and place, keyed by id then state name (e.g. { adonan: { naik: 1 } }). */
export type StoryStates = Record<string, Record<string, number>>;

/** Draws one prop standing on y = 0 with its base centred on x = 0. */
export type StoryPropDraw = (s: Story, state: Record<string, number>, t: number) => void;
/** Draws one place: background, far layers, ground, and fixed parts, reading its own states. Never people or props. */
export type StoryPlaceDraw = (s: Story, t: number, state: Record<string, number>) => void;

/** How one person always looks, so every scene shows the same character. */
export interface StoryCastMember {
  height: number;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  bottom: string;
  shoes: string;
  sleeves?: 'short' | 'long';
  outfit?: 'pants' | 'skirt';
  apron?: string;
  coat?: string;
  glasses?: boolean;
}

/** One person in one scene. Times are scene seconds, decided by the engine. */
export interface StoryActor {
  cast: string;
  x: number;
  y: number;
  facing: 1 | -1;
  pose: RigPoseName;
  poseTo?: RigPoseName;
  poseFrom: number;
  poseUntil: number;
  walkTo?: number;
  walkFrom: number;
  walkUntil: number;
  face?: FaceExpression;
  /** Prop id drawn in the near hand instead of at its place. */
  hold?: string;
}

export interface StoryPropPlacement {
  id: string;
  x: number;
  y: number;
  /** Front props are drawn after the people (a table someone sits behind). */
  front?: boolean;
}

/** A state that eases from its previous value to `to` between scene seconds `from` and `until`. */
export interface StoryStateChange {
  prop: string;
  key: string;
  to: number;
  from: number;
  until: number;
}

export interface StorySceneLabel {
  at: Vec2;
  text: string;
  sub?: string;
  from: number;
  to: number;
  dx?: number;
  dy?: number;
  color?: string;
  /** A path the label rides along between scene seconds travel[0] and travel[1] (a camera follow). */
  along?: Vec2[];
  travel?: [number, number];
}

interface SceneBase {
  /** Global start time in seconds, so continuous motion never jumps between scenes. */
  start: number;
  duration: number;
}

/** A shot in one place, as data: camera, props, people, state changes, labels. */
export interface StoryWorldScene extends SceneBase {
  kind: 'world';
  place: string;
  camera: CameraKey2D[];
  /** Screen height share where the camera target sits; below centre leaves room for the top panel. */
  anchorY?: number;
  states: StoryStates;
  changes?: StoryStateChange[];
  props: StoryPropPlacement[];
  actors: StoryActor[];
  labels?: StorySceneLabel[];
  /** Cast ids the shot is framed to show whole; close shots on a part may crop the others. */
  keep?: string[];
}

/** A close-up or cutaway with its own model-written drawing. */
export interface StoryDetailScene extends SceneBase {
  kind: 'detail';
  draw: (s: Story, t: number) => void;
}

export type StorySceneSpec = StoryWorldScene | StoryDetailScene;

/** Everything world scenes draw from: places, props, and the cast by id. */
export interface StoryWorld {
  places: Record<string, StoryPlaceDraw>;
  props: Record<string, StoryPropDraw>;
  cast: Record<string, StoryCastMember>;
}

/** Prop states at scene time t: the scene's starting states with every change eased in. */
export function storyStatesAt(scene: StoryWorldScene, t: number): StoryStates {
  const states: StoryStates = Object.fromEntries(Object.entries(scene.states).map(([id, values]) => [id, { ...values }]));
  for (const change of [...(scene.changes ?? [])].sort((a, b) => a.from - b.from)) {
    const prop = (states[change.prop] ??= {});
    const before = prop[change.key] ?? 0;
    prop[change.key] = before + (change.to - before) * ramp(t, change.from, change.until);
  }
  return states;
}

/** Person options for an actor at scene time t: walk, pose blend, and the held prop. */
export function actorOptions(actor: StoryActor, member: StoryCastMember, t: number, hold?: (s: Story) => void): { x: number; options: PersonOptions } {
  const base: PersonOptions = { ...member, face: actor.face, facing: actor.facing, pose: actor.pose, hold };
  if (actor.poseTo && actor.poseTo !== actor.pose) {
    base.poseTo = actor.poseTo;
    base.poseMix = ramp(t, actor.poseFrom, actor.poseUntil);
  }
  if (actor.walkTo === undefined || actor.walkTo === actor.x) return { x: actor.x, options: base };
  const span = Math.max(0.01, actor.walkUntil - actor.walkFrom);
  const walk = createStoryWalk((t - actor.walkFrom) / span, actor.x, actor.walkTo, member.height);
  return { x: walk.x, options: { ...base, walkPhase: walk.walkPhase, walkMix: walk.walkMix, facing: walk.walkMix > 0 ? (walk.facing as 1 | -1) : actor.facing } };
}

const createStoryWalk = (progress: number, fromX: number, toX: number, height: number) => rigWalk({ progress, fromX, toX, height });

/**
 * Paints one scene at scene time t (seconds from its start). The caller owns the canvas and
 * calls s.finish() afterwards, so labels are laid out once per frame.
 */
export function paintStoryScene(s: Story, scene: StorySceneSpec, t: number, world: StoryWorld): void {
  if (scene.kind === 'detail') {
    // Close-up code is model-written: its labels keep the name only, never an extra claim line.
    const label = s.label;
    s.label = (x, y, text, options = {}) => label(x, y, text, { ...options, sub: undefined });
    scene.draw(s, t);
    return;
  }
  const time = scene.start + t;
  s.camPath(scene.camera, t, s.width / 2, s.height * (scene.anchorY ?? 0.5));
  const states = storyStatesAt(scene, t);
  const place = world.places[scene.place];
  if (place) place(s, time, states[scene.place] ?? {});
  else s.background('#F6E7D2');
  const held = new Set(scene.actors.map((actor) => actor.hold).filter(Boolean));
  const drawProp = (placement: StoryPropPlacement) => {
    const draw = world.props[placement.id];
    if (!draw || held.has(placement.id)) return;
    s.at(placement.x, placement.y, () => draw(s, states[placement.id] ?? {}, time));
  };
  scene.props.filter((placement) => !placement.front).forEach(drawProp);
  for (const actor of scene.actors) {
    const member = world.cast[actor.cast];
    if (!member) continue;
    const propDraw = actor.hold ? world.props[actor.hold] : undefined;
    const hold = propDraw ? (q: Story) => propDraw(q, states[actor.hold as string] ?? {}, time) : undefined;
    const { x, options } = actorOptions(actor, member, t, hold);
    if (actor.pose !== 'lie') s.shadow(x, member.height * 0.28, actor.y);
    s.person(x, actor.y, options);
  }
  scene.props.filter((placement) => placement.front).forEach(drawProp);
  for (const label of scene.labels ?? []) {
    const alpha = win(t, label.from, label.to, 0.35);
    if (alpha <= 0.01) continue;
    let [x, y] = label.at;
    if (label.along && label.along.length >= 2) {
      const path = samplePath(label.along);
      const [a, b] = label.travel ?? [0, scene.duration];
      const point = pointAt(path, path.total * Math.max(0, Math.min(1, (t - a) / (b - a || 1))));
      x = point.x;
      y = point.y;
    }
    s.label(x, y, label.text, { sub: label.sub, dx: label.dx, dy: label.dy, color: label.color, alpha });
  }
}

/** Convenience for runtimes without React: one full frame including label layout. */
export function paintStoryFrame(
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number; safe?: IsoSafeInsets },
  scene: StorySceneSpec,
  t: number,
  world: StoryWorld,
): void {
  const s = createStory(ctx, size.width, size.height, { safe: size.safe });
  paintStoryScene(s, scene, t, world);
  s.finish();
}
