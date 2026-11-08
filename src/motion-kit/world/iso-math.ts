import { Easing, interpolate } from 'remotion';
import { addVec, ISO_RIGHT, ISO_UP, lerp, type Vec3 } from './iso-geometry';

export * from './iso-geometry';

export interface IsoCameraKey {
  frame: number;
  target: Vec3;
  /** Pixels per world unit. */
  zoom: number;
}

export interface IsoMove {
  from: number;
  to: number;
  offset: Vec3;
}

const EASE = Easing.bezier(0.6, 0, 0.15, 1);
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Flat three-tone shading from a surface normal, with no lights in the scene.
 * Top is lightest, the screen-left face (+z) middle, and the screen-right face (+x) darkest.
 * Squared components blend smoothly around curved sides and sum to one on any unit normal.
 */
export function shadeForNormal([x, y, z]: Vec3): number {
  const top = y > 0 ? y * y : 0;
  const left = z > 0 ? z * z : 0;
  const right = x > 0 ? x * x : 0;
  return top + left * 0.84 + right * 0.68 + (1 - top - left - right) * 0.6;
}

export function isoCameraAt(frame: number, keys: IsoCameraKey[]): Omit<IsoCameraKey, 'frame'> {
  let { target, zoom } = keys[0];
  for (let index = 1; index < keys.length; index += 1) {
    const previous = keys[index - 1];
    const key = keys[index];
    const progress = interpolate(frame, [previous.frame, key.frame], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASE,
    });
    target = [
      lerp(target[0], key.target[0], progress),
      lerp(target[1], key.target[1], progress),
      lerp(target[2], key.target[2], progress),
    ];
    zoom = lerp(zoom, key.zoom, progress);
  }
  return { target, zoom };
}

export function offsetAt(frame: number, moves: IsoMove[] = []): Vec3 {
  return moves.reduce<Vec3>((offset, move) => {
    const progress = interpolate(frame, [move.from, move.to], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASE,
    });
    return addVec(offset, move.offset, progress);
  }, [0, 0, 0]);
}

/** 0 to 1: how far a solid is faded out, across any number of timed windows. */
export function ghostAt(frame: number, windows: Array<{ from: number; to: number }> = [], fadeFrames = 10): number {
  return windows.reduce((level, { from, to }) => Math.max(level, Math.min(
    interpolate(frame, [from, from + fadeFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    interpolate(frame, [to - fadeFrames, to], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  )), 0);
}

const PULSE_SECONDS = 1;
const PULSE_SIZE = 0.035;
const PULSE_FADE_FRAMES = 12;

/** Scale of a soft body in focus. A slow beat points at what the line is about. */
export function pulseAt(frame: number, from: number, fps: number): number {
  const fade = interpolate(frame, [from, from + PULSE_FADE_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return 1 + PULSE_SIZE * fade * Math.sin((Math.PI * (frame - from)) / (fps * PULSE_SECONDS)) ** 2;
}

/** Pure projection, so DOM labels can follow 3D points without reading the WebGL camera. */
export function projectIso(
  point: Vec3,
  camera: Omit<IsoCameraKey, 'frame'>,
  view: { width: number; height: number; centerY: number }
): { x: number; y: number } {
  const relative = addVec(point, camera.target, -1);
  return {
    x: view.width / 2 + dot(relative, ISO_RIGHT) * camera.zoom,
    y: view.height * view.centerY - dot(relative, ISO_UP) * camera.zoom,
  };
}

/** Point at a distance along a polyline. */
export function pointAlong(points: Vec3[], distance: number): Vec3 {
  let remaining = distance;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    if (remaining <= length && length > 0) {
      const t = remaining / length;
      return [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)];
    }
    remaining -= length;
  }
  return points[points.length - 1];
}

export function polylineLength(points: Vec3[]): number {
  return points.slice(1).reduce((total, point, index) => {
    const from = points[index];
    return total + Math.hypot(point[0] - from[0], point[1] - from[1], point[2] - from[2]);
  }, 0);
}
