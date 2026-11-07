import { z } from 'zod';
import { contrastRatio } from '../pipeline/anti-slop';
import { ISO_RIGHT, ISO_UP, roundPolyline, type Vec3 } from '../../motion-kit/world/iso-geometry';
import type { IsoSolid, IsoWorld } from '../../motion-kit/world/IsoStage';

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Size = z.tuple([z.number().min(0.1).max(30), z.number().min(0.05).max(30), z.number().min(0.1).max(30)]);

export const IsoObjectSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/),
  label: z.string().min(1).max(24),
  shape: z.enum(['box', 'plate', 'cylinder', 'cone', 'wedge']),
  size: Size,
  color: HexColor,
  on: z.string().nullable(),
  x: z.number().min(-40).max(40),
  z: z.number().min(-40).max(40),
  axis: z.enum(['x', 'y', 'z']).nullish(),
  radius: z.number().min(0).max(5).nullish(),
  wall: z.number().min(0.05).max(3).nullish(),
  lid: z.boolean().nullish(),
  liftAtBeat: z.number().int().min(0).nullish(),
});

export const IsoLinkSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/),
  through: z.array(z.string()).min(2).max(6),
  color: HexColor,
  radius: z.number().min(0.05).max(1.2).nullish(),
  activeBeats: z.array(z.number().int().min(0)).max(12),
});

export const IsoBeatSchema = z.object({
  text: z.string().min(1).max(800),
  headline: z.string().min(1).max(60),
  accent: z.string().max(40),
  value: z.number().nullable(),
  status: z.string().max(24),
  clock: z.string().max(16).nullable(),
  focus: z.string().nullable(),
  label: z.string().max(24).nullable(),
  sticker: z.string().max(24).nullable(),
});

export const IsoPlanSchema = z.object({
  look: z.enum(['bright', 'dark']),
  unit: z.string().max(6),
  palette: z.object({ ground: HexColor, surface: HexColor, hud: HexColor, hudText: HexColor, accent: HexColor, ink: HexColor }),
  objects: z.array(IsoObjectSchema).min(6).max(48),
  links: z.array(IsoLinkSchema).max(8),
  beats: z.array(IsoBeatSchema).min(3).max(12),
});

export type IsoPlan = z.infer<typeof IsoPlanSchema>;
export type IsoObject = z.infer<typeof IsoObjectSchema>;
export type IsoBeat = z.infer<typeof IsoBeatSchema>;

interface Placement {
  object: IsoObject;
  center: Vec3;
  size: Vec3;
  /** Height children rest on. */
  rest: number;
  /** Footprint available to children. */
  inner: [number, number];
  parent: string | null;
  lifts: Array<{ beat: number; offset: Vec3 }>;
}

export interface ResolvedLink {
  id: string;
  color: string;
  radius: number;
  points: Vec3[];
  activeBeats: number[];
}

export interface ResolvedIso {
  plan: IsoPlan;
  placements: Placement[];
  links: ResolvedLink[];
  /** Beat focus ids after dropped objects are removed. */
  focus: Array<string | null>;
  errors: string[];
  warnings: string[];
}

const BASE_HEIGHT = 0.5;
const BASE_MARGIN = 2;
/** Keeps a child's sides off its parent's sides, because coplanar visible faces z-fight. */
const EDGE_MARGIN = 0.06;
const OVERLAP_TOLERANCE = 0.02;
const TRAY_FLOOR = 0.16;
const FLOOR_INSET = 0.05;
const LINK_CLEARANCE = 0.25;
const LINK_CORNER = 0.45;
const DEFAULT_LINK_RADIUS = 0.14;
/** Smallest share of the world's footprint the biggest ground object must cover. */
const MIN_SUBJECT_SHARE = 0.25;
/** Contrast a ground must keep against the opposite extreme to count as bright or dark. */
const LOOK_CONTRAST = 7;
const BRIGHT_FALLBACK = { ground: '#F2F5F1', surface: '#E7E1D3' };
const DARK_FALLBACK = { ground: '#14181C', surface: '#232A30' };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function overlapOf(a: Placement, b: { center: Vec3; size: Vec3 }) {
  const dx = (a.size[0] + b.size[0]) / 2 - Math.abs(a.center[0] - b.center[0]);
  const dz = (a.size[2] + b.size[2]) / 2 - Math.abs(a.center[2] - b.center[2]);
  return { dx, dz, hit: dx > OVERLAP_TOLERANCE && dz > OVERLAP_TOLERANCE };
}

function isInside(id: string, ancestor: string, byId: Map<string, Placement>): boolean {
  for (let current = byId.get(id); current?.parent; current = byId.get(current.parent)) {
    if (current.parent === ancestor) return true;
  }
  return false;
}

/** Elbow route that climbs over anything between two objects. */
function routeLink(ids: string[], placements: Placement[], byId: Map<string, Placement>): Vec3[] {
  const route: Vec3[] = [];
  for (let index = 1; index < ids.length; index += 1) {
    const from = byId.get(ids[index - 1])!;
    const to = byId.get(ids[index])!;
    const start: Vec3 = [from.center[0], from.center[1] + from.size[1], from.center[2]];
    const end: Vec3 = [to.center[0], to.center[1] + to.size[1], to.center[2]];
    const corner: Vec3 = [end[0], 0, start[2]];
    const crossed = placements.filter((item) => {
      if (item === from || item === to || item.lifts.length) return false;
      const halfX = item.size[0] / 2;
      const halfZ = item.size[2] / 2;
      const onFirstLeg = Math.abs(item.center[2] - start[2]) < halfZ
        && item.center[0] + halfX > Math.min(start[0], end[0]) && item.center[0] - halfX < Math.max(start[0], end[0]);
      const onSecondLeg = Math.abs(item.center[0] - end[0]) < halfX
        && item.center[2] + halfZ > Math.min(start[2], end[2]) && item.center[2] - halfZ < Math.max(start[2], end[2]);
      return onFirstLeg || onSecondLeg;
    });
    const travel = Math.max(start[1], end[1], ...crossed.map((item) => item.center[1] + item.size[1])) + LINK_CLEARANCE;
    route.push(start, [start[0], travel, start[2]], [corner[0], travel, corner[2]], [end[0], travel, end[2]], end);
  }
  return roundPolyline(route.filter((point, index) => {
    const previous = route[index - 1];
    return !previous || Math.hypot(point[0] - previous[0], point[1] - previous[1], point[2] - previous[2]) > 1e-3;
  }), LINK_CORNER);
}

/**
 * Turns the model's object list into exact positions. The model only says what rests on what.
 * Without repair, problems become errors for a retry. With repair, overlaps are pushed apart
 * and whatever still cannot fit is dropped, with a warning that names it.
 */
export function resolveIsoPlan(input: IsoPlan, options: { repair?: boolean } = {}): ResolvedIso {
  const errors: string[] = [];
  const warnings: string[] = [];
  let plan = input;

  const opposite = plan.look === 'bright' ? '#000000' : '#FFFFFF';
  const offLook = (['ground', 'surface'] as const).filter((key) => contrastRatio(plan.palette[key], opposite) < LOOK_CONTRAST);
  if (offLook.length) {
    const message = `Palette ${offLook.join(' and ')} does not match look "${plan.look}"`;
    if (options.repair) {
      warnings.push(`${message}, replaced`);
      plan = { ...plan, palette: { ...plan.palette, ...(plan.look === 'bright' ? BRIGHT_FALLBACK : DARK_FALLBACK) } };
    } else {
      errors.push(message);
    }
  }

  const declared = new Set<string>();
  for (const object of plan.objects) {
    if (declared.has(object.id)) errors.push(`Duplicate object id "${object.id}"`);
    declared.add(object.id);
  }

  const lidded = new Set(plan.objects.filter((object) => object.lid && object.on).map((object) => object.on as string));
  const byId = new Map<string, Placement>();
  const placements: Placement[] = [];
  const dropped = new Set<string>();

  for (const object of plan.objects) {
    if (byId.has(object.id)) continue;
    if (object.on && !byId.has(object.on)) {
      if (dropped.has(object.on)) {
        dropped.add(object.id);
        continue;
      }
      errors.push(`"${object.id}" rests on "${object.on}", which must exist earlier in the list`);
      continue;
    }
    const parent = object.on ? byId.get(object.on)! : null;
    let size = [...object.size] as Vec3;
    let center: Vec3;

    if (object.lid && parent) {
      size = [parent.size[0], size[1], parent.size[2]];
      center = [parent.center[0], parent.center[1] + parent.size[1], parent.center[2]];
    } else if (parent) {
      const [areaX, areaZ] = parent.inner;
      const fitX = areaX - EDGE_MARGIN * 2;
      const fitZ = areaZ - EDGE_MARGIN * 2;
      if (size[0] > fitX || size[2] > fitZ) {
        const message = `"${object.id}" (${size[0]}x${size[2]}) does not fit on "${parent.object.id}" (${areaX}x${areaZ})`;
        if (options.repair) warnings.push(`${message}, shrunk`);
        else errors.push(message);
        size = [Math.min(size[0], fitX), size[1], Math.min(size[2], fitZ)];
      }
      if (lidded.has(parent.object.id) && parent.object.wall) {
        size[1] = Math.min(size[1], parent.size[1] - TRAY_FLOOR - EDGE_MARGIN);
      }
      center = [
        parent.center[0] + clamp(object.x, -(fitX - size[0]) / 2, (fitX - size[0]) / 2),
        parent.rest,
        parent.center[2] + clamp(object.z, -(fitZ - size[2]) / 2, (fitZ - size[2]) / 2),
      ];
    } else {
      center = [object.x, BASE_HEIGHT, object.z];
    }

    const isTray = Boolean(object.wall);
    const wall = object.wall ?? 0;
    const placement: Placement = {
      object,
      center,
      size,
      rest: center[1] + (isTray ? TRAY_FLOOR : size[1]),
      inner: isTray ? [size[0] - wall * 2, size[2] - wall * 2] : [size[0], size[2]],
      parent: parent?.object.id ?? null,
      lifts: [...(parent?.lifts ?? [])],
    };

    if (!object.lid) {
      const siblings = placements.filter((item) => item.parent === placement.parent && !item.object.lid);
      for (const sibling of siblings) {
        const overlap = overlapOf(sibling, placement);
        if (!overlap.hit) continue;
        if (!options.repair) {
          errors.push(`"${object.id}" overlaps "${sibling.object.id}" on the same surface`);
          continue;
        }
        const axis = overlap.dx < overlap.dz ? 0 : 2;
        const push = (axis === 0 ? overlap.dx : overlap.dz) + OVERLAP_TOLERANCE * 2;
        placement.center[axis] += placement.center[axis] >= sibling.center[axis] ? push : -push;
        if (parent) {
          const half = (parent.inner[axis === 0 ? 0 : 1] - size[axis]) / 2 - EDGE_MARGIN;
          placement.center[axis] = clamp(placement.center[axis], parent.center[axis] - half, parent.center[axis] + half);
        }
      }
      const stillHit = options.repair ? siblings.find((sibling) => overlapOf(sibling, placement).hit) : undefined;
      if (stillHit) {
        warnings.push(`"${object.id}" dropped, no room beside "${stillHit.object.id}"`);
        dropped.add(object.id);
        continue;
      }
    }

    placements.push(placement);
    byId.set(object.id, placement);
  }

  const roots = placements.filter((item) => !item.parent);
  if (roots.length > 1) {
    const edges = (axis: 0 | 2) => roots.flatMap((item) => [item.center[axis] - item.size[axis] / 2, item.center[axis] + item.size[axis] / 2]);
    const span = (axis: 0 | 2) => Math.max(...edges(axis)) - Math.min(...edges(axis));
    const biggest = Math.max(...roots.map((item) => item.size[0] * item.size[2]));
    if (biggest / (span(0) * span(2)) < MIN_SUBJECT_SHARE) {
      const message = 'The main subject is too small. It must cover at least a quarter of the world footprint, so enlarge it or remove side objects';
      if (options.repair) warnings.push(message);
      else errors.push(message);
    }
  }

  const focus = plan.beats.map((beat, index) => {
    if (beat.focus === null) return null;
    if (byId.has(beat.focus)) return beat.focus;
    if (dropped.has(beat.focus)) warnings.push(`Beat ${index} lost its focus "${beat.focus}"`);
    else if (options.repair) warnings.push(`Beat ${index} focus "${beat.focus}" is unknown`);
    else errors.push(`Beat ${index} focus "${beat.focus}" is unknown`);
    return null;
  });

  // Anything shut under a lid must be opened by the time the story looks at it.
  for (const placement of placements.filter((item) => item.object.lid && item.parent)) {
    const opened = focus.findIndex((id) => id !== null && isInside(id, placement.parent as string, byId));
    const beats = [placement.object.liftAtBeat, opened >= 0 ? opened : null].filter((beat): beat is number => beat !== null && beat !== undefined);
    if (!beats.length) continue;
    const reach = Math.max(placement.size[0], placement.size[2]);
    placement.lifts = [...placement.lifts, { beat: Math.min(...beats), offset: [reach * 0.5, reach * 0.6, -reach * 0.75] }];
  }
  for (const placement of placements.filter((item) => !item.object.lid && typeof item.object.liftAtBeat === 'number')) {
    const reach = Math.max(placement.size[0], placement.size[2]);
    placement.lifts = [...placement.lifts, { beat: placement.object.liftAtBeat as number, offset: [reach * 0.5, reach * 0.6, -reach * 0.75] }];
  }
  for (const placement of placements) {
    if (placement.parent) {
      const parentLifts = byId.get(placement.parent)!.lifts;
      placement.lifts = [...new Set([...parentLifts, ...placement.lifts])];
    }
  }

  const links: ResolvedLink[] = [];
  for (const link of plan.links) {
    const known = link.through.filter((id) => byId.has(id));
    if (known.length < link.through.length) {
      const missing = link.through.filter((id) => !byId.has(id)).join(', ');
      if (options.repair) warnings.push(`Link "${link.id}" lost ${missing}`);
      else errors.push(`Link "${link.id}" uses unknown objects: ${missing}`);
    }
    if (known.length < 2) continue;
    links.push({
      id: link.id,
      color: link.color,
      radius: link.radius ?? DEFAULT_LINK_RADIUS,
      points: routeLink(known, placements, byId),
      activeBeats: link.activeBeats.filter((beat) => beat < plan.beats.length),
    });
  }

  return { plan, placements, links, focus, errors, warnings };
}

function corners(center: Vec3, size: Vec3): Vec3[] {
  const halfX = size[0] / 2;
  const halfZ = size[2] / 2;
  return [0, size[1]].flatMap((height) => [-1, 1].flatMap((sideX) => [-1, 1].map((sideZ): Vec3 => [
    center[0] + sideX * halfX,
    center[1] + height,
    center[2] + sideZ * halfZ,
  ])));
}

/** Target and on-screen extent of a set of points, in world units. */
function frameOf(points: Vec3[]) {
  const project = (axis: Vec3) => points.map((point) => point[0] * axis[0] + point[1] * axis[1] + point[2] * axis[2]);
  const across = project(ISO_RIGHT);
  const up = project(ISO_UP);
  const axisCenter = (values: number[]) => (Math.min(...values) + Math.max(...values)) / 2;
  const middle = [0, 1, 2].map((axis) => axisCenter(points.map((point) => point[axis])));
  return {
    target: middle as Vec3,
    spanX: Math.max(Math.max(...across) - Math.min(...across), 0.1),
    spanY: Math.max(Math.max(...up) - Math.min(...up), 0.1),
  };
}

function screenBox(placement: Placement) {
  const points = corners(placement.center, placement.size);
  const across = points.map((point) => point[0] * ISO_RIGHT[0] + point[1] * ISO_RIGHT[1] + point[2] * ISO_RIGHT[2]);
  const up = points.map((point) => point[0] * ISO_UP[0] + point[1] * ISO_UP[1] + point[2] * ISO_UP[2]);
  return { minX: Math.min(...across), maxX: Math.max(...across), minY: Math.min(...up), maxY: Math.max(...up) };
}

/** Objects standing between the camera and a focus, by screen overlap and depth. */
function occludersOf(focus: Placement, placements: Placement[], beat: number): Placement[] {
  const byId = new Map(placements.map((item) => [item.object.id, item]));
  const box = screenBox(focus);
  const area = (box.maxX - box.minX) * (box.maxY - box.minY);
  const low = (item: Placement, axis: 0 | 2) => item.center[axis] - item.size[axis] / 2;
  const high = (item: Placement, axis: 0 | 2) => item.center[axis] + item.size[axis] / 2;
  // With boxes that do not intersect, one separating axis decides which is farther from the camera.
  const isBehind = (item: Placement) => high(item, 0) <= low(focus, 0)
    || high(item, 2) <= low(focus, 2)
    || item.center[1] + item.size[1] <= focus.center[1];
  return placements.filter((item) => {
    if (item === focus || isBehind(item)) return false;
    if (isInside(item.object.id, focus.object.id, byId) || isInside(focus.object.id, item.object.id, byId)) return false;
    if (item.lifts.some((lift) => lift.beat <= beat)) return false;
    const other = screenBox(item);
    const width = Math.min(box.maxX, other.maxX) - Math.max(box.minX, other.minX);
    const height = Math.min(box.maxY, other.maxY) - Math.max(box.minY, other.minY);
    return width > 0 && height > 0 && (width * height) / area >= MIN_OCCLUSION;
  });
}

export interface IsoView {
  width: number;
  height: number;
  centerY: number;
}

const WIDE_FILL = { x: 0.92, y: 0.46 };
const FOCUS_FILL = { x: 0.62, y: 0.26 };
const MAX_FOCUS_ZOOM = 5;
const MIN_FOCUS_ZOOM = 1.35;
const CAMERA_FRAMES = 26;
const LIFT_FRAMES = 36;
const HIGHLIGHT_DELAY = 10;
/** Share of a focus's screen box another object must cover before it fades. */
const MIN_OCCLUSION = 0.2;

function solidsFor(placement: Placement, moveFor: (lift: Placement['lifts'][number]) => IsoSolid['moves']): IsoSolid[] {
  const { object, center, size, lifts } = placement;
  const moves = lifts.flatMap((lift) => moveFor(lift) ?? []);
  const shared = { color: object.color, radius: object.radius ?? undefined, moves };
  const solid: IsoSolid = { ...shared, id: object.id, shape: object.shape, at: center, size, axis: object.axis ?? undefined };
  if (!object.wall) return [solid];
  const floorRadius = Math.max((object.radius ?? 0) - FLOOR_INSET, 0);
  return [
    { ...shared, radius: floorRadius, id: `${object.id}-floor`, shape: 'plate', at: center, size: [size[0] - FLOOR_INSET * 2, TRAY_FLOOR, size[2] - FLOOR_INSET * 2] },
    { ...solid, shape: 'plate', wall: object.wall },
  ];
}

/** Converts a resolved plan and real beat timing into the data IsoStage draws. */
export function buildIsoWorld(resolved: ResolvedIso, beats: Array<{ from: number; duration: number }>, view: IsoView): IsoWorld {
  const { plan, placements, links, focus } = resolved;
  const closedBounds = placements.filter((item) => !item.object.lid);
  const worldPoints = closedBounds.flatMap((item) => corners(item.center, item.size));
  const wide = frameOf(worldPoints);
  const wideZoom = Math.min((view.width * WIDE_FILL.x) / wide.spanX, (view.height * WIDE_FILL.y) / wide.spanY);

  const minX = Math.min(...worldPoints.map((point) => point[0])) - BASE_MARGIN;
  const maxX = Math.max(...worldPoints.map((point) => point[0])) + BASE_MARGIN;
  const minZ = Math.min(...worldPoints.map((point) => point[2])) - BASE_MARGIN;
  const maxZ = Math.max(...worldPoints.map((point) => point[2])) + BASE_MARGIN;
  const base: IsoSolid = {
    id: 'world-base',
    shape: 'box',
    at: [(minX + maxX) / 2, 0, (minZ + maxZ) / 2],
    size: [maxX - minX, BASE_HEIGHT, maxZ - minZ],
    color: plan.palette.surface,
  };

  const shotFor = (index: number) => {
    const id = focus[index];
    const placement = id ? placements.find((item) => item.object.id === id) : undefined;
    if (!placement) return { target: wide.target, zoom: wideZoom };
    const frame = frameOf(corners(placement.center, placement.size));
    const zoom = Math.min((view.width * FOCUS_FILL.x) / frame.spanX, (view.height * FOCUS_FILL.y) / frame.spanY);
    return { target: frame.target, zoom: clamp(zoom, wideZoom * MIN_FOCUS_ZOOM, wideZoom * MAX_FOCUS_ZOOM) };
  };

  const camera: IsoWorld['camera'] = [{ frame: 0, ...shotFor(0) }];
  beats.slice(1).forEach((beat, position) => {
    const index = position + 1;
    camera.push({ frame: beat.from, ...shotFor(index - 1) }, { frame: beat.from + CAMERA_FRAMES, ...shotFor(index) });
  });

  const moveFor = (lift: Placement['lifts'][number]) => {
    const beat = beats[lift.beat];
    return beat ? [{ from: beat.from, to: beat.from + LIFT_FRAMES, offset: lift.offset }] : [];
  };

  const lastFrame = (index: number) => beats[index].from + beats[index].duration - 1;
  return {
    background: plan.palette.ground,
    accent: plan.palette.accent,
    ink: plan.palette.ink,
    viewCenter: view.centerY,
    solids: [
      base,
      ...placements.flatMap((placement) => solidsFor(placement, moveFor)),
      ...links.map((link): IsoSolid => ({ id: `link-${link.id}`, shape: 'tube', color: link.color, radius: link.radius, points: link.points })),
    ],
    camera,
    flows: links.flatMap((link) => link.activeBeats.map((index) => ({
      points: link.points,
      radius: link.radius,
      from: beats[index].from,
      to: lastFrame(index),
    }))),
    ghosts: focus.flatMap((id, index) => {
      const placement = id ? placements.find((item) => item.object.id === id) : undefined;
      if (!placement) return [];
      return occludersOf(placement, placements, index).flatMap((item) => {
        const window = { from: beats[index].from, to: lastFrame(index) };
        return item.object.wall
          ? [{ id: item.object.id, ...window }, { id: `${item.object.id}-floor`, ...window }]
          : [{ id: item.object.id, ...window }];
      });
    }),
    highlights: focus.flatMap((id, index) => (id ? [{ id, from: beats[index].from + HIGHLIGHT_DELAY, to: lastFrame(index) }] : [])),
    labels: focus.flatMap((id, index) => {
      const text = plan.beats[index].label;
      const placement = id ? placements.find((item) => item.object.id === id) : undefined;
      if (!text || !placement) return [];
      const at: Vec3 = [placement.center[0], placement.center[1] + placement.size[1], placement.center[2]];
      return [{ text, at, from: beats[index].from + CAMERA_FRAMES, to: lastFrame(index) }];
    }),
  };
}
