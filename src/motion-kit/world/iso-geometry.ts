/** Pure geometry shared with server code, so this file must never import remotion or React. */
export type Vec3 = [number, number, number];

const SQRT2 = Math.SQRT2;
const SQRT3 = Math.sqrt(3);
const SQRT6 = Math.sqrt(6);

/** True isometric view: world axes land 30 degrees from the horizontal on screen. */
export const ISO_DIRECTION: Vec3 = [1 / SQRT3, 1 / SQRT3, 1 / SQRT3];
export const ISO_RIGHT: Vec3 = [1 / SQRT2, 0, -1 / SQRT2];
export const ISO_UP: Vec3 = [-1 / SQRT6, 2 / SQRT6, -1 / SQRT6];

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const addVec = (a: Vec3, b: Vec3, scale = 1): Vec3 => [
  a[0] + b[0] * scale,
  a[1] + b[1] * scale,
  a[2] + b[2] * scale,
];

/** Replaces each interior corner with a short curve, so pipes and cables bend smoothly. */
export function roundPolyline(points: Vec3[], radius: number, steps = 6): Vec3[] {
  if (points.length < 3) return points;
  const rounded: Vec3[] = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const corner = points[index];
    const toward = (other: Vec3): Vec3 => {
      const length = Math.hypot(other[0] - corner[0], other[1] - corner[1], other[2] - corner[2]);
      const reach = Math.min(radius, length / 2) / Math.max(length, 1e-6);
      return addVec(corner, addVec(other, corner, -1), reach);
    };
    const enter = toward(points[index - 1]);
    const leave = toward(points[index + 1]);
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const inverse = 1 - t;
      rounded.push([0, 1, 2].map((axis) =>
        inverse * inverse * enter[axis] + 2 * inverse * t * corner[axis] + t * t * leave[axis]) as Vec3);
    }
  }
  rounded.push(points[points.length - 1]);
  return rounded;
}
