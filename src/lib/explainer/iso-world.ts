import { z } from 'zod';
import { contrastRatio } from '../pipeline/anti-slop';
import { blobMesh, blobSurfaceY, ISO_RIGHT, ISO_UP, roundPolyline, type BlobLobe, type BlobMesh, type Vec3 } from '../../motion-kit/world/iso-geometry';
import type { IsoSolid, IsoWorld } from '../../motion-kit/world/IsoStage';

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Size = z.tuple([z.number().min(0.1).max(30), z.number().min(0.05).max(30), z.number().min(0.1).max(30)]);

const Unit = z.number().min(-1).max(1);
const UnitPoint = z.tuple([Unit, Unit, Unit]);

export const IsoLobeSchema = z.object({
  /** Names a region the story can focus on or link to, without splitting the body. */
  id: z.string().regex(/^[a-z0-9-]{1,32}$/).nullish(),
  at: UnitPoint,
  r: z.number().min(0.05).max(1),
  to: UnitPoint.nullish(),
  toR: z.number().min(0.03).max(1).nullish(),
  color: HexColor.nullish(),
});

export const IsoScreenItemSchema = z.object({
  kind: z.enum(['stat', 'row', 'button']),
  text: z.string().min(1).max(32),
  value: z.string().max(20).nullish(),
});

export const IsoScreenSchema = z.object({
  face: z.enum(['top', 'left', 'right']),
  background: HexColor,
  ink: HexColor,
  accent: HexColor,
  states: z.array(z.object({
    fromBeat: z.number().int().min(0),
    title: z.string().min(1).max(32),
    items: z.array(IsoScreenItemSchema).max(6),
  })).min(1).max(4),
});

export const IsoObjectSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/),
  label: z.string().min(1).max(24),
  shape: z.enum(['box', 'plate', 'cylinder', 'cone', 'wedge', 'blob']),
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
  lobes: z.array(IsoLobeSchema).min(1).max(24).nullish(),
  screen: IsoScreenSchema.nullish(),
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
  objects: z.array(IsoObjectSchema).min(1).max(48),
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
  /** Where a link attaches, which on a blob is the curve and not the bounding box. */
  top: number;
  /** Coarse copy of a blob's surface, for resting children on it. */
  surface?: BlobMesh;
  parent: string | null;
  lifts: Array<{ beat: number; offset: Vec3 }>;
}

/** A named part of a blob, with its own box for the camera and for links. */
export interface BlobRegion {
  owner: string;
  lobe: number;
  center: Vec3;
  size: Vec3;
  top: number;
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
  regions: Map<string, BlobRegion>;
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
/** Coarse grid for layout. The drawn blob uses the fine one. */
const BLOB_LAYOUT_RESOLUTION = 28;
/** How far a child sinks into a curve, so no gap shows under its edge. */
const BLOB_REST_SINK = 0.08;
const SCREEN_SHAPES = new Set(['box', 'plate']);
/** Part of its peak share a vertex needs to count toward a named region. */
const REGION_SHARE = 0.5;
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
function routeLink(ids: string[], placements: Placement[], byId: Map<string, Placement>, regions: Map<string, BlobRegion>): Vec3[] {
  const route: Vec3[] = [];
  for (let index = 1; index < ids.length; index += 1) {
    const ends = [ids[index - 1], ids[index]].map((id) => (byId.get(id) ?? regions.get(id)) as Placement | BlobRegion);
    const [from, to] = ends;
    const owners = [ids[index - 1], ids[index]].map((id) => byId.get(regions.get(id)?.owner ?? id));
    const start: Vec3 = [from.center[0], from.top, from.center[2]];
    const end: Vec3 = [to.center[0], to.top, to.center[2]];
    const corner: Vec3 = [end[0], 0, start[2]];
    const crossed = placements.filter((item) => {
      if (owners.includes(item) || item.lifts.length) return false;
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

function regionsOf(placement: Placement): BlobRegion[] {
  const { surface, object, center } = placement;
  if (!surface) return [];
  return (object.lobes ?? []).flatMap((lobe, index) => {
    if (!lobe.id) return [];
    const count = surface.positions.length / 3;
    const shareOf = (vertex: number) => surface.weights[vertex * surface.lobeCount + index];
    const peak = Math.max(...Array.from({ length: count }, (_, vertex) => shareOf(vertex)));
    // Read against the peak, so a lobe buried inside the body still maps to the skin above it.
    const points: Vec3[] = [];
    for (let vertex = 0; vertex < count; vertex += 1) {
      if (shareOf(vertex) >= peak * REGION_SHARE) points.push([0, 1, 2].map((axis) => surface.positions[vertex * 3 + axis] + center[axis]) as Vec3);
    }
    const low = [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis])));
    const high = [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis])));
    const size: Vec3 = [high[0] - low[0], high[1] - low[1], high[2] - low[2]];
    return [{ owner: object.id, lobe: index, center: [(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2], size, top: high[1] }];
  });
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

  const fixObject = (object: IsoObject): IsoObject => {
    let fixed = object;
    if (object.shape === 'blob' && !object.lobes?.length) {
      const message = `Blob "${object.id}" needs lobes`;
      if (options.repair) warnings.push(`${message}, drawn as one ball`);
      else errors.push(message);
      fixed = { ...fixed, lobes: [{ at: [0, 0, 0], r: 1 }] };
    }
    if (object.screen && !SCREEN_SHAPES.has(object.shape)) {
      const message = `"${object.id}" is a ${object.shape}, and only box or plate can hold a screen`;
      if (options.repair) warnings.push(`${message}, screen removed`);
      else errors.push(message);
      fixed = { ...fixed, screen: null };
    }
    return fixed;
  };

  for (const source of plan.objects) {
    const object = fixObject(source);
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
      const offsetX = clamp(object.x, -(fitX - size[0]) / 2, (fitX - size[0]) / 2);
      const offsetZ = clamp(object.z, -(fitZ - size[2]) / 2, (fitZ - size[2]) / 2);
      const rest = parent.surface
        ? parent.center[1] + blobSurfaceY(parent.surface, offsetX, offsetZ, Math.max(parent.size[0], parent.size[2]) / BLOB_LAYOUT_RESOLUTION) - Math.min(BLOB_REST_SINK, size[1] / 4)
        : parent.rest;
      center = [parent.center[0] + offsetX, rest, parent.center[2] + offsetZ];
    } else {
      center = [object.x, BASE_HEIGHT, object.z];
    }

    const isBlob = object.shape === 'blob';
    const isTray = Boolean(object.wall) && !isBlob;
    const wall = isTray ? object.wall ?? 0 : 0;
    const surface = isBlob ? blobMesh(object.lobes as BlobLobe[], size, BLOB_LAYOUT_RESOLUTION) : undefined;
    const placement: Placement = {
      object,
      center,
      size,
      rest: center[1] + (isTray ? TRAY_FLOOR : size[1]),
      inner: isTray ? [size[0] - wall * 2, size[2] - wall * 2] : [size[0], size[2]],
      top: center[1] + (surface ? blobSurfaceY(surface, 0, 0, Math.max(size[0], size[2]) / BLOB_LAYOUT_RESOLUTION) : size[1]),
      surface,
      parent: parent?.object.id ?? null,
      lifts: [...(parent?.lifts ?? [])],
    };

    if (!object.lid) {
      const siblings = placements.filter((item) => item.parent === placement.parent && !item.object.lid);
      for (const sibling of siblings) {
        // A blob's box is far bigger than its curve, and curved forms may press into each other.
        if (isBlob || sibling.object.shape === 'blob') continue;
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
      const stillHit = options.repair && !isBlob ? siblings.find((sibling) => sibling.object.shape !== 'blob' && overlapOf(sibling, placement).hit) : undefined;
      if (stillHit) {
        warnings.push(`"${object.id}" dropped, no room beside "${stillHit.object.id}"`);
        dropped.add(object.id);
        continue;
      }
    }

    placements.push(placement);
    byId.set(object.id, placement);
  }

  const regions = new Map<string, BlobRegion>();
  for (const placement of placements) {
    for (const region of regionsOf(placement)) {
      const lobeId = placement.object.lobes?.[region.lobe].id as string;
      if (byId.has(lobeId) || regions.has(lobeId)) errors.push(`Lobe id "${lobeId}" is already used`);
      else regions.set(lobeId, region);
    }
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
    if (byId.has(beat.focus) || regions.has(beat.focus)) return beat.focus;
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
    const known = link.through.filter((id) => byId.has(id) || regions.has(id));
    if (known.length < link.through.length) {
      const missing = link.through.filter((id) => !known.includes(id)).join(', ');
      if (options.repair) warnings.push(`Link "${link.id}" lost ${missing}`);
      else errors.push(`Link "${link.id}" uses unknown objects: ${missing}`);
    }
    if (known.length < 2) continue;
    links.push({
      id: link.id,
      color: link.color,
      radius: link.radius ?? DEFAULT_LINK_RADIUS,
      points: routeLink(known, placements, byId, regions),
      activeBeats: link.activeBeats.filter((beat) => beat < plan.beats.length),
    });
  }

  return { plan, placements, regions, links, focus, errors, warnings };
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

export interface IsoView {
  width: number;
  height: number;
  centerY: number;
  /** "lit" renders with lights and shadows on a desk that runs past the frame instead of a floating base. */
  look?: 'flat' | 'lit';
}

/** The lit desk reaches this many world spans past the objects, so its edge never shows. */
const DESK_REACH = 2;

const WIDE_FILL = { x: 0.92, y: 0.46 };
const FOCUS_FILL = { x: 0.7, y: 0.32 };
/** A big focus may not be pushed past this, or a close-up crops its own subject. */
const FOCUS_LIMIT = { x: 0.92, y: 0.42 };
const MAX_FOCUS_ZOOM = 5;
const MIN_FOCUS_ZOOM = 1.35;
const CAMERA_FRAMES = 26;
/** Zoom gained while a shot holds, so no beat is a frozen picture. */
const HOLD_PUSH = 1.08;
const LIFT_FRAMES = 36;
const HIGHLIGHT_DELAY = 10;

interface Shot {
  target: Vec3;
  zoom: number;
}

interface ScreenBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function boxOf(points: Vec3[]): ScreenBox {
  const across = points.map((point) => point[0] * ISO_RIGHT[0] + point[1] * ISO_RIGHT[1] + point[2] * ISO_RIGHT[2]);
  const up = points.map((point) => point[0] * ISO_UP[0] + point[1] * ISO_UP[1] + point[2] * ISO_UP[2]);
  return { minX: Math.min(...across), maxX: Math.max(...across), minY: Math.min(...up), maxY: Math.max(...up) };
}

const crosses = (a: ScreenBox, b: ScreenBox) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

/** What the camera sees in a shot, in the same units as boxOf. */
function shotBox(shot: Shot, view: IsoView): ScreenBox {
  const center = boxOf([shot.target]);
  const halfX = view.width / 2 / shot.zoom;
  const halfY = view.height / 2 / shot.zoom;
  return { minX: center.minX - halfX, maxX: center.minX + halfX, minY: center.minY - halfY, maxY: center.minY + halfY };
}

/**
 * Everything in a close-up that the focus does not depend on. It fades, so one subject carries the
 * shot. The focus keeps what it rests on, what rests on it, and the links that reach it.
 */
function clutterOf(focus: Placement, placements: Placement[], links: ResolvedLink[], linkEnds: Map<string, string[]>, shot: Shot, view: IsoView, beat: number): string[] {
  const byId = new Map(placements.map((item) => [item.object.id, item]));
  const family = (id: string) => id === focus.object.id || isInside(id, focus.object.id, byId) || isInside(focus.object.id, id, byId);
  const seen = shotBox(shot, view);
  const objects = placements.filter((item) => !family(item.object.id)
    && !item.lifts.some((lift) => lift.beat <= beat)
    && crosses(boxOf(corners(item.center, item.size)), seen));
  // A pipe crossing a screen hides what the shot is for, so a screen keeps no links.
  const routes = links.filter((link) => (focus.object.screen || !(linkEnds.get(link.id) ?? []).some(family)) && crosses(boxOf(link.points), seen));
  return [
    ...objects.flatMap((item) => (item.object.wall && item.object.shape !== 'blob' ? [item.object.id, `${item.object.id}-floor`] : [item.object.id])),
    ...routes.map((link) => `link-${link.id}`),
  ];
}

/** Joins a solid's windows across beats, so it stays faded instead of blinking at each cut. */
function mergeWindows(ghosts: NonNullable<IsoWorld['ghosts']>): NonNullable<IsoWorld['ghosts']> {
  const merged: NonNullable<IsoWorld['ghosts']> = [];
  for (const ghost of ghosts) {
    const last = merged.findLast((item) => item.id === ghost.id);
    if (last && ghost.from <= last.to + 1) last.to = ghost.to;
    else merged.push({ ...ghost });
  }
  return merged;
}

function solidsFor(placement: Placement, moveFor: (lift: Placement['lifts'][number]) => IsoSolid['moves'], beats: Array<{ from: number }>): IsoSolid[] {
  const { object, center, size, lifts } = placement;
  const moves = lifts.flatMap((lift) => moveFor(lift) ?? []);
  const shared = { color: object.color, radius: object.radius ?? undefined, moves };
  const solid: IsoSolid = {
    ...shared,
    id: object.id,
    shape: object.shape,
    at: center,
    size,
    axis: object.axis ?? undefined,
    lobes: object.lobes ?? undefined,
    screen: object.screen ? {
      ...object.screen,
      states: object.screen.states.map(({ fromBeat, ...state }) => ({ ...state, from: beats[fromBeat]?.from ?? Number.MAX_SAFE_INTEGER })),
    } : undefined,
  };
  if (!object.wall || object.shape === 'blob') return [solid];
  const floorRadius = Math.max((object.radius ?? 0) - FLOOR_INSET, 0);
  return [
    { ...shared, radius: floorRadius, id: `${object.id}-floor`, shape: 'plate', at: center, size: [size[0] - FLOOR_INSET * 2, TRAY_FLOOR, size[2] - FLOOR_INSET * 2] },
    { ...solid, shape: 'plate', wall: object.wall },
  ];
}

/** Converts a resolved plan and real beat timing into the data IsoStage draws. */
export function buildIsoWorld(resolved: ResolvedIso, beats: Array<{ from: number; duration: number }>, view: IsoView): IsoWorld {
  const { plan, placements, regions, links, focus } = resolved;
  const linkEnds = new Map(plan.links.map((link) => [link.id, link.through.map((id) => regions.get(id)?.owner ?? id)]));
  /** What a beat looks at: a whole placement, or one region of a blob. */
  const focusOf = (index: number) => {
    const id = focus[index];
    if (!id) return null;
    const region = regions.get(id);
    const placement = placements.find((item) => item.object.id === (region?.owner ?? id));
    if (!placement) return null;
    return { placement, box: region ?? placement, lobe: region?.lobe };
  };
  const closedBounds = placements.filter((item) => !item.object.lid);
  const worldPoints = closedBounds.flatMap((item) => corners(item.center, item.size));
  const wide = frameOf(worldPoints);
  const wideZoom = Math.min((view.width * WIDE_FILL.x) / wide.spanX, (view.height * WIDE_FILL.y) / wide.spanY);

  const span = Math.max(
    Math.max(...worldPoints.map((point) => point[0])) - Math.min(...worldPoints.map((point) => point[0])),
    Math.max(...worldPoints.map((point) => point[2])) - Math.min(...worldPoints.map((point) => point[2])),
  );
  const margin = view.look === 'lit' ? span * DESK_REACH : BASE_MARGIN;
  const minX = Math.min(...worldPoints.map((point) => point[0])) - margin;
  const maxX = Math.max(...worldPoints.map((point) => point[0])) + margin;
  const minZ = Math.min(...worldPoints.map((point) => point[2])) - margin;
  const maxZ = Math.max(...worldPoints.map((point) => point[2])) + margin;
  const base: IsoSolid = {
    id: 'world-base',
    shape: 'box',
    at: [(minX + maxX) / 2, 0, (minZ + maxZ) / 2],
    size: [maxX - minX, BASE_HEIGHT, maxZ - minZ],
    color: plan.palette.surface,
  };

  const shotFor = (index: number): Shot => {
    const seen = focusOf(index);
    if (!seen) return { target: wide.target, zoom: wideZoom };
    const frame = frameOf(corners(seen.box.center, seen.box.size));
    const zoom = Math.min((view.width * FOCUS_FILL.x) / frame.spanX, (view.height * FOCUS_FILL.y) / frame.spanY);
    const limit = Math.min((view.width * FOCUS_LIMIT.x) / frame.spanX, (view.height * FOCUS_LIMIT.y) / frame.spanY);
    // Screen text is only readable at the largest size the shot allows.
    if (seen.placement.object.screen) return { target: frame.target, zoom: limit };
    return { target: frame.target, zoom: Math.min(clamp(zoom, wideZoom * MIN_FOCUS_ZOOM, wideZoom * MAX_FOCUS_ZOOM), limit) };
  };

  const heldShot = (index: number): Shot => {
    const shot = shotFor(index);
    return { ...shot, zoom: shot.zoom * HOLD_PUSH };
  };
  const camera: IsoWorld['camera'] = [{ frame: 0, ...shotFor(0) }];
  beats.slice(1).forEach((beat, position) => {
    const index = position + 1;
    camera.push({ frame: beat.from, ...heldShot(index - 1) }, { frame: beat.from + CAMERA_FRAMES, ...shotFor(index) });
  });
  const finalBeat = beats[beats.length - 1];
  if (finalBeat) camera.push({ frame: finalBeat.from + finalBeat.duration, ...heldShot(beats.length - 1) });

  const moveFor = (lift: Placement['lifts'][number]) => {
    const beat = beats[lift.beat];
    return beat ? [{ from: beat.from, to: beat.from + LIFT_FRAMES, offset: lift.offset }] : [];
  };

  const lastFrame = (index: number) => beats[index].from + beats[index].duration - 1;
  const clutter = focus.map((_, index) => {
    const seen = focusOf(index);
    return seen ? clutterOf(seen.placement, placements, links, linkEnds, shotFor(index), view, index) : [];
  });
  return {
    background: plan.palette.ground,
    accent: plan.palette.accent,
    ink: plan.palette.ink,
    viewCenter: view.centerY,
    ...(view.look === 'lit' ? { look: 'lit' as const, reach: span / 2 + BASE_MARGIN } : {}),
    solids: [
      base,
      ...placements.flatMap((placement) => solidsFor(placement, moveFor, beats)),
      ...links.map((link): IsoSolid => ({ id: `link-${link.id}`, shape: 'tube', color: link.color, radius: link.radius, points: link.points })),
    ],
    camera,
    flows: links.flatMap((link) => link.activeBeats
      // A faded pipe must not leave its dots hanging in the air.
      .filter((index) => !clutter[index].includes(`link-${link.id}`))
      .map((index) => ({
        points: link.points,
        radius: link.radius,
        from: beats[index].from,
        to: lastFrame(index),
      }))),
    ghosts: mergeWindows(clutter.flatMap((ids, index) => ids.map((id) => ({ id, from: beats[index].from, to: lastFrame(index) })))),
    highlights: focus.flatMap((_, index) => {
      const seen = focusOf(index);
      return seen ? [{ id: seen.placement.object.id, lobe: seen.lobe, from: beats[index].from + HIGHLIGHT_DELAY, to: lastFrame(index) }] : [];
    }),
    labels: focus.flatMap((_, index) => {
      const text = plan.beats[index].label;
      const seen = focusOf(index);
      // A screen already names itself, and a label would sit on its title.
      if (!text || !seen || seen.placement.object.screen) return [];
      const at: Vec3 = [seen.box.center[0], seen.box.center[1] + seen.box.size[1], seen.box.center[2]];
      return [{ text, at, from: beats[index].from + CAMERA_FRAMES, to: lastFrame(index) }];
    }),
  };
}
