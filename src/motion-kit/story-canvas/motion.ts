/**
 * Pure math behind the story canvas motion primitives: smooth paths with arc length, stable
 * per-particle randomness, and rhythmic cycles. Everything is a function of its inputs and t,
 * so any frame renders alone and parallel export frames never disagree.
 */

export type Point = [number, number];

export interface SampledPath {
  points: Point[];
  /** Cumulative length at each sampled point, in the same units as the input. */
  lengths: number[];
  total: number;
}

/** Catmull-Rom through the given points (open curve), sampled densely; straight when smooth is false. */
export function samplePath(input: Point[], smooth = true, stepsPerSegment = 16): SampledPath {
  const points: Point[] = [];
  if (input.length < 2) {
    const only = input[0] ?? [0, 0];
    return { points: [only, only], lengths: [0, 0], total: 0 };
  }
  if (!smooth || input.length === 2) {
    points.push(...input);
  } else {
    for (let i = 0; i < input.length - 1; i += 1) {
      const p0 = input[Math.max(0, i - 1)];
      const p1 = input[i];
      const p2 = input[i + 1];
      const p3 = input[Math.min(input.length - 1, i + 2)];
      for (let step = 0; step < stepsPerSegment; step += 1) {
        const u = step / stepsPerSegment;
        const u2 = u * u;
        const u3 = u2 * u;
        const coord = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
        points.push([coord(p0[0], p1[0], p2[0], p3[0]), coord(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    points.push(input[input.length - 1]);
  }
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return { points, lengths, total: lengths[lengths.length - 1] };
}

/** Position and direction (radians) at distance d along a sampled path, clamped to its ends. */
export function pointAt(path: SampledPath, d: number): { x: number; y: number; angle: number } {
  const { points, lengths, total } = path;
  const target = Math.max(0, Math.min(total, d));
  let low = 0;
  let high = lengths.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (lengths[mid] <= target) low = mid;
    else high = mid;
  }
  const span = lengths[high] - lengths[low] || 1;
  const k = (target - lengths[low]) / span;
  const [ax, ay] = points[low];
  const [bx, by] = points[high];
  return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, angle: Math.atan2(by - ay, bx - ax) };
}

/** Stable pseudo-random number in [0, 1) for an integer index and a salt. */
export function hash(index: number, salt = 0): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Positive modulo. */
export const wrap = (value: number, size: number) => (size > 0 ? ((value % size) + size) % size : 0);

/**
 * One rhythmic cycle at bpm beats per minute. phase runs 0..1 per beat; squeeze rises fast
 * and falls in the first 40% of the beat (a contraction), then rests, like a heartbeat or a pump.
 */
export function beatAt(t: number, bpm = 72): { phase: number; squeeze: number; index: number } {
  const beats = (t * bpm) / 60;
  const phase = beats - Math.floor(beats);
  const squeeze = phase < 0.4 ? Math.sin((Math.PI * phase) / 0.4) ** 2 : 0;
  return { phase, squeeze, index: Math.floor(beats) };
}

/** Smooth wave -1..1 with the given period in seconds and phase offset (0..1). */
export const oscAt = (t: number, period = 2, phase = 0) => Math.sin((t / Math.max(0.01, period) + phase) * Math.PI * 2);

export interface FlowParticle {
  x: number;
  y: number;
  angle: number;
  /** 0..1: fades near the path ends so particles never pop in or out. */
  alpha: number;
  index: number;
}

/**
 * Particles travelling along a path: one every `spacing` units, moving `speed` units per
 * second, spread sideways within `width`. A pure function of t. Counts depend on world units,
 * not pixels, so the same flow keeps its look at any zoom.
 */
export function flowParticles(path: SampledPath, options: { t: number; speed: number; spacing: number; width?: number; max?: number; seed?: number }): FlowParticle[] {
  const { total } = path;
  if (total <= 0 || options.spacing <= 0) return [];
  const count = Math.min(options.max ?? 400, Math.max(1, Math.round(total / options.spacing)));
  const gap = total / count;
  const fade = Math.min(total * 0.12, gap * 1.5);
  const width = options.width ?? 0;
  const out: FlowParticle[] = [];
  for (let i = 0; i < count; i += 1) {
    // A small per-particle jitter keeps the stream from looking like a conveyor belt.
    const jitter = (hash(i, options.seed ?? 1) - 0.5) * gap * 0.6;
    const d = wrap(i * gap + jitter + options.speed * options.t, total);
    const at = pointAt(path, d);
    const side = (hash(i, (options.seed ?? 1) + 7) - 0.5) * width;
    const edge = Math.min(d, total - d);
    out.push({
      x: at.x - Math.sin(at.angle) * side,
      y: at.y + Math.cos(at.angle) * side,
      angle: at.angle,
      alpha: fade > 0 ? Math.max(0, Math.min(1, edge / fade)) : 1,
      index: i,
    });
  }
  return out;
}

export interface EmitParticle {
  x: number;
  y: number;
  /** 0 at birth, 1 at the end of its life. */
  age: number;
  index: number;
}

/**
 * Particles born at a point: `rate` per second, each living `life` seconds and moving at
 * `speed` in a direction within `spread` radians around `direction` (default straight up),
 * pulled by `gravity` (negative falls). Births are on a fixed schedule, so frames agree.
 */
export function emitParticles(options: { t: number; rate: number; life: number; speed: number; direction?: number; spread?: number; gravity?: number; seed?: number; max?: number }): EmitParticle[] {
  const rate = Math.max(0, options.rate);
  if (rate === 0 || options.life <= 0) return [];
  const direction = options.direction ?? Math.PI / 2;
  const spread = options.spread ?? 0.5;
  const gravity = options.gravity ?? 0;
  const first = Math.max(0, Math.ceil((options.t - options.life) * rate));
  const last = Math.floor(options.t * rate);
  const out: EmitParticle[] = [];
  for (let k = first; k <= last && out.length < (options.max ?? 300); k += 1) {
    const born = k / rate;
    const age = (options.t - born) / options.life;
    if (age < 0 || age > 1) continue;
    const seconds = options.t - born;
    const angle = direction + (hash(k, options.seed ?? 3) - 0.5) * spread;
    const speed = options.speed * (0.7 + 0.6 * hash(k, (options.seed ?? 3) + 5));
    out.push({
      x: Math.cos(angle) * speed * seconds,
      y: Math.sin(angle) * speed * seconds + 0.5 * gravity * seconds * seconds,
      age,
      index: k,
    });
  }
  return out;
}
