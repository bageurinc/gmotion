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

/** One soft mass of a blob. Coordinates and radii use a -1 to 1 box, stretched later to the object's size. */
export interface BlobLobe {
  at: Vec3;
  r: number;
  /** End of a tapered limb. Without it the lobe is a ball. */
  to?: Vec3 | null;
  toR?: number | null;
  color?: string | null;
}

export interface BlobMesh {
  /** x, y, z triples, stretched to the size with the base at y = 0 and centered on x and z. */
  positions: Float32Array;
  indices: Uint32Array;
  /** Share of each lobe at each vertex, with one row per vertex. Soft shares keep color borders smooth. */
  weights: Float32Array;
  lobeCount: number;
}

const BLOB_BLEND = 0.22;
/** Width of the soft border between two lobe colors, in the -1 to 1 box. */
const BLOB_COLOR_SOFTNESS = 0.018;
export const BLOB_RESOLUTION = 64;

function lobeDistance(lobe: BlobLobe, x: number, y: number, z: number): number {
  const [ax, ay, az] = lobe.at;
  if (!lobe.to) return Math.hypot(x - ax, y - ay, z - az) - lobe.r;
  const [dx, dy, dz] = [lobe.to[0] - ax, lobe.to[1] - ay, lobe.to[2] - az];
  const lengthSq = dx * dx + dy * dy + dz * dz;
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / lengthSq));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t, z - az - dz * t) - lerp(lobe.r, lobe.toR ?? lobe.r, t);
}

function blobField(lobes: BlobLobe[], x: number, y: number, z: number): number {
  let distance = Infinity;
  for (const lobe of lobes) {
    const next = lobeDistance(lobe, x, y, z);
    const h = Math.max(BLOB_BLEND - Math.abs(distance - next), 0) / BLOB_BLEND;
    distance = Math.min(distance, next) - (h * h * BLOB_BLEND) / 4;
  }
  return distance;
}

function lobeShares(lobes: BlobLobe[], x: number, y: number, z: number): number[] {
  const distances = lobes.map((lobe) => lobeDistance(lobe, x, y, z));
  const nearest = Math.min(...distances);
  const shares = distances.map((distance) => Math.exp((nearest - distance) / BLOB_COLOR_SOFTNESS));
  const total = shares.reduce((sum, share) => sum + share, 0);
  return shares.map((share) => share / total);
}

const CELL_CORNERS: Vec3[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const CELL_EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

/** Meshes smoothly joined lobes with surface nets, so any rounded form needs no custom component. */
export function blobMesh(lobes: BlobLobe[], size: Vec3, resolution = BLOB_RESOLUTION): BlobMesh {
  const reach = (axis: number, side: -1 | 1) => lobes.flatMap((lobe) => [
    lobe.at[axis] + side * lobe.r,
    ...(lobe.to ? [lobe.to[axis] + side * (lobe.toR ?? lobe.r)] : []),
  ]);
  const low = [0, 1, 2].map((axis) => Math.min(...reach(axis, -1)));
  const high = [0, 1, 2].map((axis) => Math.max(...reach(axis, 1)));
  const step = Math.max(...high.map((value, axis) => value - low[axis])) / resolution;
  const pad = BLOB_BLEND + step * 2;
  const counts = high.map((value, axis) => Math.ceil((value - low[axis] + pad * 2) / step) + 1);
  const [nx, ny, nz] = counts;
  const origin = low.map((value) => value - pad);
  const at = (i: number, j: number, k: number) => i + j * nx + k * nx * ny;

  const field = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        field[at(i, j, k)] = blobField(lobes, origin[0] + i * step, origin[1] + j * step, origin[2] + k * step);
      }
    }
  }

  const vertices: number[] = [];
  const cellVertex = new Int32Array(nx * ny * nz).fill(-1);
  for (let k = 0; k < nz - 1; k += 1) {
    for (let j = 0; j < ny - 1; j += 1) {
      for (let i = 0; i < nx - 1; i += 1) {
        const samples = CELL_CORNERS.map(([cx, cy, cz]) => field[at(i + cx, j + cy, k + cz)]);
        if (samples.every((value) => value > 0) || samples.every((value) => value <= 0)) continue;
        const sum = [0, 0, 0];
        let crossings = 0;
        for (const [a, b] of CELL_EDGES) {
          if (samples[a] > 0 === samples[b] > 0) continue;
          const t = samples[a] / (samples[a] - samples[b]);
          for (let axis = 0; axis < 3; axis += 1) sum[axis] += lerp(CELL_CORNERS[a][axis], CELL_CORNERS[b][axis], t);
          crossings += 1;
        }
        cellVertex[at(i, j, k)] = vertices.length / 3;
        vertices.push(
          origin[0] + (i + sum[0] / crossings) * step,
          origin[1] + (j + sum[1] / crossings) * step,
          origin[2] + (k + sum[2] / crossings) * step,
        );
      }
    }
  }

  const indices: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, inside: boolean) => {
    const corners = [cellVertex[a], cellVertex[b], cellVertex[c], cellVertex[d]];
    if (corners.includes(-1)) return;
    const [p, q, r, s] = inside ? corners : [corners[3], corners[2], corners[1], corners[0]];
    indices.push(p, q, r, p, r, s);
  };
  for (let k = 1; k < nz - 1; k += 1) {
    for (let j = 1; j < ny - 1; j += 1) {
      for (let i = 1; i < nx - 1; i += 1) {
        const here = field[at(i, j, k)] <= 0;
        if (here !== field[at(i + 1, j, k)] <= 0) quad(at(i, j - 1, k - 1), at(i, j, k - 1), at(i, j, k), at(i, j - 1, k), here);
        if (here !== field[at(i, j + 1, k)] <= 0) quad(at(i - 1, j, k - 1), at(i - 1, j, k), at(i, j, k), at(i, j, k - 1), here);
        if (here !== field[at(i, j, k + 1)] <= 0) quad(at(i - 1, j - 1, k), at(i, j - 1, k), at(i, j, k), at(i - 1, j, k), here);
      }
    }
  }

  const count = vertices.length / 3;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < count; index += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], vertices[index * 3 + axis]);
      max[axis] = Math.max(max[axis], vertices[index * 3 + axis]);
    }
  }
  const weights = new Float32Array(count * lobes.length);
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    weights.set(lobeShares(lobes, vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2]), index * lobes.length);
    for (let axis = 0; axis < 3; axis += 1) {
      const t = (vertices[index * 3 + axis] - min[axis]) / Math.max(max[axis] - min[axis], 1e-6);
      positions[index * 3 + axis] = axis === 1 ? t * size[1] : (t - 0.5) * size[axis];
    }
  }
  return { positions, indices: Uint32Array.from(indices), weights, lobeCount: lobes.length };
}

/** Height of a blob's top at an offset from its center, so a child rests on the curve and not on its bounding box. */
export function blobSurfaceY(mesh: BlobMesh, x: number, z: number, tolerance: number): number {
  let nearest = Infinity;
  let top = 0;
  for (let index = 0; index < mesh.positions.length; index += 3) {
    const distance = Math.max(Math.hypot(mesh.positions[index] - x, mesh.positions[index + 2] - z), tolerance);
    const y = mesh.positions[index + 1];
    if (distance < nearest || (distance === nearest && y > top)) {
      nearest = distance;
      top = y;
    }
  }
  return top;
}
