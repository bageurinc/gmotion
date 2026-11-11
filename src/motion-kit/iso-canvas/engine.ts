/**
 * Spike: a small isometric engine on Canvas 2D. World units, z points up, the ground is the
 * x–y plane. Every solid is built from flat faces; each face gets an outward normal, faces
 * turned away from the viewer are skipped, and brightness follows a fixed light (Lambert).
 * Draw order between solids is the caller's job (back to front); faces inside one solid are
 * sorted by depth. Everything is a pure function of its inputs, so any frame renders alone.
 */

export type Vec3 = [number, number, number];
type Axis = 'x' | 'y' | 'z';

const COS30 = Math.sqrt(3) / 2;
const VIEW: Vec3 = norm([1, 1, 1]);
// Key light from above, a little toward +x. The +y side still gets some of it: with almost
// none (the old 0.1), every left face came out at ~57% and white casings read as grey.
const LIGHT: Vec3 = norm([0.5, 0.35, 1]);
const OUTLINE = 'rgba(20,28,40,0.55)';

function norm([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const centroid = (points: Vec3[]): Vec3 => {
  const sum = points.reduce<Vec3>((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
};

function parseColor(color: string): [number, number, number] {
  const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(color);
  const hex = short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : color;
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!match) return [128, 128, 128];
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

/** Scales a color's brightness: 1 keeps it, below 1 darkens, above 1 lightens toward white. */
export function lit(color: string, brightness: number, alpha = 1): string {
  const [r, g, b] = parseColor(color);
  const channel = (value: number) => {
    const out = brightness <= 1 ? value * brightness : value + (255 - value) * (brightness - 1);
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  return `rgba(${channel(r)},${channel(g)},${channel(b)},${alpha})`;
}

/**
 * Linear mix between two #RRGGBB colors. Returns #RRGGBB so the result can be passed to any
 * shape: the shading code only parses hex, and an rgb() string would turn grey.
 */
export function mixColor(a: string, b: string, amount: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  const k = Math.max(0, Math.min(1, amount));
  return `#${ca.map((value, i) => Math.round(value + (cb[i] - value) * k).toString(16).padStart(2, '0')).join('')}`;
}

/** Smooth 0→1 between seconds a and b (clamped). */
export function ramp(t: number, a: number, b: number): number {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a || 1)));
  return k * k * (3 - 2 * k);
}

/** 0→1→0 window: rises over [a, a+fade], falls over [b-fade, b]. */
export function win(t: number, a: number, b: number, fade = 0.3): number {
  return Math.min(ramp(t, a, a + fade), 1 - ramp(t, b - fade, b));
}

type Transform = (p: Vec3) => Vec3;

function rotation(axis: Axis, angle: number, pivot: Vec3): Transform {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return ([x, y, z]) => {
    const [dx, dy, dz] = [x - pivot[0], y - pivot[1], z - pivot[2]];
    if (axis === 'z') return [pivot[0] + dx * c - dy * s, pivot[1] + dx * s + dy * c, z];
    if (axis === 'x') return [x, pivot[1] + dy * c - dz * s, pivot[2] + dy * s + dz * c];
    return [pivot[0] + dx * c + dz * s, y, pivot[2] - dx * s + dz * c];
  };
}

export interface FaceStyle {
  /** Disable shading (flat color as given). */
  flat?: boolean;
  alpha?: number;
  /** Outline color; false hides it. */
  stroke?: string | false;
  lineWidth?: number;
  /** Extra brightness multiplier, e.g. 1.4 for a highlighted part. */
  glow?: number;
}

export interface CylinderOptions extends FaceStyle {
  sides?: number;
  /** Colors repeated around the side, for striped rotors or N/S magnets. */
  seg?: string[];
  /** Rotates the side pattern (radians), so a striped rotor looks like it spins. */
  rot?: number;
  /** Cap color (defaults to the side color). */
  cap?: string;
}

export interface PipeOptions {
  /** Moving dashes along the pipe: phase in world units (e.g. t * 3). */
  flow?: number;
  flowColor?: string;
  alpha?: number;
}

export interface LabelOptions {
  /** Screen offset of the text from the anchor, in pixels. */
  dx?: number;
  dy?: number;
  color?: string;
  size?: number;
  alpha?: number;
  /** Second, smaller line. */
  sub?: string;
}

/** A label box on screen, tied to the anchor point it points at. */
export interface IsoLabelBox {
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface IsoBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const LABEL_GAP = 14;

const clampBox = (box: IsoLabelBox, bounds: IsoBounds) => {
  box.x = Math.max(bounds.left, Math.min(bounds.right - box.w, box.x));
  box.y = Math.max(bounds.top, Math.min(bounds.bottom - box.h, box.y));
};

const overlapY = (a: IsoLabelBox, b: IsoLabelBox) => {
  const horizontal = a.x < b.x + b.w + LABEL_GAP && b.x < a.x + a.w + LABEL_GAP;
  if (!horizontal) return 0;
  return Math.min(a.y + a.h + LABEL_GAP - b.y, b.y + b.h + LABEL_GAP - a.y);
};

/**
 * Keeps label boxes inside the bounds and pushes overlapping boxes apart vertically.
 * Boxes are changed in place and returned. A box larger than the bounds is pinned to the
 * top-left edge rather than dropped, so a label never disappears.
 */
export function layoutLabels(boxes: IsoLabelBox[], bounds: IsoBounds): IsoLabelBox[] {
  boxes.forEach((box) => clampBox(box, bounds));
  for (let pass = 0; pass < 24; pass += 1) {
    let moved = false;
    const ordered = [...boxes].sort((a, b) => a.y - b.y);
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const [upper, lower] = [ordered[i], ordered[j]];
        const overlap = overlapY(upper, lower);
        if (overlap <= 0) continue;
        const roomAbove = upper.y - bounds.top;
        const roomBelow = bounds.bottom - (lower.y + lower.h);
        // Split the push between both boxes, giving more to the side with room.
        const up = Math.min(roomAbove, overlap / 2 + Math.max(0, overlap / 2 - roomBelow));
        upper.y -= up;
        lower.y += overlap - up;
        clampBox(upper, bounds);
        clampBox(lower, bounds);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return boxes;
}

/** Fractions of the frame kept free on each side (platform UI), as from getSocialSafeInsets. */
export interface IsoSafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CameraKey {
  /** Arrival time in seconds. */
  at: number;
  /** World point placed at the screen anchor. */
  look: Vec3;
  /** Pixels per world unit. */
  zoom: number;
}

interface PendingLabel {
  anchorX: number;
  anchorY: number;
  text: string;
  options: LabelOptions;
}

export function createIso(ctx: CanvasRenderingContext2D, width: number, height: number, setup: { safe?: IsoSafeInsets } = {}) {
  let cx = width / 2;
  let cy = height / 2;
  let scale = 40;
  const stack: Transform[] = [];
  const labels: PendingLabel[] = [];
  const safe = setup.safe ?? { top: 0.12, right: 0.16, bottom: 0.22, left: 0.08 };
  const safeBounds: IsoBounds = {
    left: width * safe.left,
    top: height * safe.top,
    right: width * (1 - safe.right),
    bottom: height * (1 - safe.bottom),
  };

  /** World extent (x and y) of the plane z that the current screen shows, plus a margin. */
  const visiblePlane = (z: number) => {
    const corners: [number, number][] = [[0, 0], [width, 0], [0, height], [width, height]];
    const points = corners.map(([sx, sy]) => {
      const u = (sx - cx) / (COS30 * scale);
      const v = (sy - cy) / scale + z;
      return [v + u / 2, v - u / 2] as [number, number];
    });
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const margin = 4;
    return { x0: Math.min(...xs) - margin, x1: Math.max(...xs) + margin, y0: Math.min(...ys) - margin, y1: Math.max(...ys) + margin };
  };

  const world = (p: Vec3): Vec3 => stack.reduceRight((acc, fn) => fn(acc), p);

  /** Projects a world point (after the current transforms) to screen pixels. */
  const P = (x: number, y: number, z: number): [number, number] => {
    const [wx, wy, wz] = world([x, y, z]);
    return [cx + (wx - wy) * COS30 * scale, cy + (wx + wy) * 0.5 * scale - wz * scale];
  };
  const screen = ([x, y, z]: Vec3): [number, number] => [cx + (x - y) * COS30 * scale, cy + (x + y) * 0.5 * scale - z * scale];

  const strokePath = (points: [number, number][]) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };

  /** Paints already-transformed faces of one solid: cull, sort by depth, shade. */
  const paint = (faces: { points: Vec3[]; color: string }[], center: Vec3 | null, style: FaceStyle) => {
    const prepared = faces
      .map((face) => {
        let normal = norm(cross(sub(face.points[1], face.points[0]), sub(face.points[2], face.points[0])));
        const middle = centroid(face.points);
        if (center) {
          if (dot(normal, sub(middle, center)) < 0) normal = [-normal[0], -normal[1], -normal[2]];
          if (dot(normal, VIEW) <= 1e-4) return null;
        } else if (dot(normal, VIEW) < 0) {
          normal = [-normal[0], -normal[1], -normal[2]];
        }
        return { ...face, normal, depth: middle[0] + middle[1] + middle[2] };
      })
      .filter((face): face is NonNullable<typeof face> => face !== null)
      .sort((a, b) => a.depth - b.depth);
    for (const face of prepared) {
      // Top ≈ 0.98, +x side ≈ 0.79, +y side ≈ 0.73: the sides stay apart without going muddy.
      const brightness = style.flat ? 1 : 0.6 + 0.45 * Math.max(-0.2, dot(face.normal, LIGHT));
      strokePath(face.points.map(screen));
      ctx.fillStyle = lit(face.color, brightness * (style.glow ?? 1), style.alpha ?? 1);
      ctx.fill();
      if (style.stroke !== false) {
        ctx.strokeStyle = style.stroke ?? OUTLINE;
        ctx.lineWidth = style.lineWidth ?? 1.2;
        ctx.lineJoin = 'round';
        ctx.globalAlpha = style.alpha ?? 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  };

  // The raw context is deliberately not exposed: model-written code draws only through this API.
  const iso = {
    width,
    height,
    P,
    ramp,
    win,
    lit,
    mixColor,

    /** Sets where world origin lands on screen and how many pixels one world unit is. */
    cam(x: number, y: number, s: number) {
      cx = x;
      cy = y;
      scale = s;
    },

    /** Places world point look at screen point (sx, sy), default the frame centre. */
    look(x: number, y: number, z: number, zoom: number, sx = width / 2, sy = height / 2) {
      scale = zoom;
      cx = sx - (x - y) * COS30 * zoom;
      cy = sy - ((x + y) * 0.5 - z) * zoom;
    },

    /**
     * Camera along keys sorted by arrival time: holds before the first and after the last key,
     * and eases between consecutive keys. Repeat a key's look at a later time to hold there.
     */
    camPath(keys: CameraKey[], t: number, sx = width / 2, sy = height / 2) {
      if (!keys.length) return;
      const sorted = [...keys].sort((a, b) => a.at - b.at);
      let from = sorted[0];
      let to = sorted[0];
      for (let i = 0; i < sorted.length; i += 1) {
        if (sorted[i].at <= t) from = sorted[i];
        if (sorted[i].at >= t) {
          to = sorted[i];
          break;
        }
        to = sorted[i];
      }
      const k = from === to ? 1 : ramp(t, from.at, to.at);
      const look = from.look.map((value, i) => value + (to.look[i] - value) * k) as Vec3;
      // Zoom is eased in log space so pushes in and out feel even.
      const zoom = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * k);
      iso.look(look[0], look[1], look[2], zoom, sx, sy);
    },

    /** Ground plane at height z that covers the whole frame at any camera, lit as a top face. */
    ground(color: string, z = 0) {
      const { x0, x1, y0, y1 } = visiblePlane(z);
      paint([{ points: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], color }], null, { stroke: false });
    },

    /**
     * Endless band on the plane z between from and to across the other axis, for roads,
     * sidewalks, rivers, and lane strips. It always runs past both frame edges.
     */
    strip(axis: 'x' | 'y', from: number, to: number, color: string, z = 0) {
      const { x0, x1, y0, y1 } = visiblePlane(z);
      const [a, b] = [Math.min(from, to), Math.max(from, to)];
      const points: Vec3[] = axis === 'x'
        ? [[x0, a, z], [x1, a, z], [x1, b, z], [x0, b, z]]
        : [[a, y0, z], [b, y0, z], [b, y1, z], [a, y1, z]];
      paint([{ points, color }], null, { stroke: false });
    },

    /** Dashes repeating along an axis line at offset across, moving by phase (world units). */
    dashes(axis: 'x' | 'y', across: number, length: number, gap: number, width: number, color: string, phase = 0, z = 0.01) {
      const { x0, x1, y0, y1 } = visiblePlane(z);
      const [start, end] = axis === 'x' ? [x0, x1] : [y0, y1];
      const period = length + gap;
      const first = Math.floor((start - phase) / period) * period + phase;
      for (let along = first; along < end; along += period) {
        const points: Vec3[] = axis === 'x'
          ? [[along, across - width / 2, z], [along + length, across - width / 2, z], [along + length, across + width / 2, z], [along, across + width / 2, z]]
          : [[across - width / 2, along, z], [across + width / 2, along, z], [across + width / 2, along + length, z], [across - width / 2, along + length, z]];
        paint([{ points: points.map(world), color }], null, { stroke: false, flat: true });
      }
    },

    /** Soft contact shadow on the plane z under a footprint (min corner x, y; size w, d). */
    shadow(x: number, y: number, w: number, d: number, z = 0, strength = 0.22) {
      const spread = Math.min(w, d) * 0.12;
      const corners: Vec3[] = [[x - spread, y - spread, z], [x + w + spread, y - spread, z], [x + w + spread, y + d + spread, z], [x - spread, y + d + spread, z]];
      ctx.save();
      ctx.filter = `blur(${Math.max(2, spread * scale * 0.8)}px)`;
      strokePath(corners.map(world).map(screen));
      ctx.fillStyle = `rgba(10,16,28,${strength})`;
      ctx.fill();
      ctx.restore();
    },

    /** Draws every label queued by label(), laid out inside the safe area. Called once per frame. */
    finish() {
      const boxes = labels.map((pending) => {
        const size = pending.options.size ?? 34;
        const subSize = Math.round(size * 0.62);
        ctx.font = `700 ${size}px Inter, Helvetica, Arial, sans-serif`;
        const titleWidth = ctx.measureText(pending.text).width;
        ctx.font = `500 ${subSize}px Inter, Helvetica, Arial, sans-serif`;
        const subWidth = pending.options.sub ? ctx.measureText(pending.options.sub).width : 0;
        const w = Math.max(titleWidth, subWidth) + 36;
        const h = size + 26 + (pending.options.sub ? subSize + 8 : 0);
        const dx = pending.options.dx ?? 140;
        const tx = pending.anchorX + dx;
        const ty = pending.anchorY + (pending.options.dy ?? -80);
        return { anchorX: pending.anchorX, anchorY: pending.anchorY, x: dx >= 0 ? tx : tx - w, y: ty - h / 2, w, h };
      });
      layoutLabels(boxes, safeBounds);
      labels.forEach((pending, index) => drawLabel(pending, boxes[index]));
      labels.length = 0;
    },

    /** Fills the whole canvas with a vertical gradient. */
    background(top: string, bottom = top) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, top);
      gradient.addColorStop(1, bottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    },

    /** Runs fn with its geometry shifted by (ox, oy, oz). */
    at(ox: number, oy: number, oz: number, fn: () => void) {
      stack.push(([x, y, z]) => [x + ox, y + oy, z + oz]);
      try {
        fn();
      } finally {
        stack.pop();
      }
    },

    /** Runs fn with its geometry rotated around an axis through pivot (radians). */
    rotate(axis: Axis, angle: number, pivot: Vec3, fn: () => void) {
      stack.push(rotation(axis, angle, pivot));
      try {
        fn();
      } finally {
        stack.pop();
      }
    },

    /** One flat polygon (3+ points), shaded by its own facing, drawn from either side. */
    face(points: Vec3[], color: string, style: FaceStyle = {}) {
      paint([{ points: points.map(world), color }], null, style);
    },

    /** Box from its min corner (x, y, z) with size (w along x, d along y, h up). */
    box(x: number, y: number, z: number, w: number, d: number, h: number, color: string, style: FaceStyle & { top?: string } = {}) {
      const v = (i: number, j: number, k: number): Vec3 => world([x + i * w, y + j * d, z + k * h]);
      const quad = (a: Vec3, b: Vec3, c: Vec3, e: Vec3, faceColor = color) => ({ points: [a, b, c, e], color: faceColor });
      const faces = [
        quad(v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1), style.top ?? color),
        quad(v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)),
        quad(v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)),
        quad(v(0, 1, 0), v(1, 1, 0), v(1, 1, 1), v(0, 1, 1)),
        quad(v(0, 0, 0), v(0, 1, 0), v(0, 1, 1), v(0, 0, 1)),
        quad(v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)),
      ];
      paint(faces, world([x + w / 2, y + d / 2, z + h / 2]), style);
    },

    /** Cylinder along an axis; (x, y, z) is the centre of its start cap. */
    cyl(axis: Axis, x: number, y: number, z: number, radius: number, length: number, color: string, options: CylinderOptions = {}) {
      const sides = options.sides ?? 32;
      const ring = (offset: number) =>
        Array.from({ length: sides }, (_, i) => {
          const angle = (i / sides) * Math.PI * 2;
          const a = Math.cos(angle) * radius;
          const b = Math.sin(angle) * radius;
          if (axis === 'z') return world([x + a, y + b, z + offset]);
          if (axis === 'x') return world([x + offset, y + a, z + b]);
          return world([x + a, y + offset, z + b]);
        });
      const start = ring(0);
      const end = ring(length);
      const seg = options.seg;
      const shift = seg ? Math.round(((options.rot ?? 0) / (Math.PI * 2)) * sides) : 0;
      const faces = start.map((point, i) => {
        const next = (i + 1) % sides;
        const faceColor = seg ? seg[(((i - shift) % sides) + sides) % sides % seg.length] : color;
        return { points: [point, start[next], end[next], end[i]], color: faceColor };
      });
      faces.push({ points: [...start].reverse(), color: options.cap ?? color }, { points: end, color: options.cap ?? color });
      const half: Vec3 = axis === 'z' ? [x, y, z + length / 2] : axis === 'x' ? [x + length / 2, y, z] : [x, y + length / 2, z];
      paint(faces, world(half), { stroke: false, ...options });
      if (options.stroke !== false) {
        // Outline only the cap that faces the viewer, so the side stays smooth.
        const center = world(half);
        for (const capRing of [start, end]) {
          if (dot(sub(centroid(capRing), center), VIEW) <= 0) continue;
          strokePath(capRing.map(screen));
          ctx.strokeStyle = (typeof options.stroke === 'string' && options.stroke) || OUTLINE;
          ctx.lineWidth = options.lineWidth ?? 1.2;
          ctx.globalAlpha = options.alpha ?? 1;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    },

    /** Cone along +axis from base centre (x, y, z); topRadius > 0 gives a frustum. */
    cone(axis: Axis, x: number, y: number, z: number, radius: number, length: number, color: string, style: FaceStyle & { topRadius?: number; sides?: number } = {}) {
      const sides = style.sides ?? 32;
      const ring = (offset: number, r: number) =>
        Array.from({ length: sides }, (_, i) => {
          const angle = (i / sides) * Math.PI * 2;
          const a = Math.cos(angle) * r;
          const b = Math.sin(angle) * r;
          if (axis === 'z') return world([x + a, y + b, z + offset]);
          if (axis === 'x') return world([x + offset, y + a, z + b]);
          return world([x + a, y + offset, z + b]);
        });
      const base = ring(0, radius);
      const top = ring(length, Math.max(0.0001, style.topRadius ?? 0.0001));
      const faces = base.map((point, i) => ({ points: [point, base[(i + 1) % sides], top[(i + 1) % sides], top[i]], color }));
      faces.push({ points: [...base].reverse(), color });
      if ((style.topRadius ?? 0) > 0) faces.push({ points: top, color });
      const half: Vec3 = axis === 'z' ? [x, y, z + length / 3] : axis === 'x' ? [x + length / 3, y, z] : [x, y + length / 3, z];
      paint(faces, world(half), { stroke: false, ...style });
    },

    /**
     * Extrudes a 2D profile along an axis. Profile points are [u, v]: for axis 'x' they are
     * (y, z), for 'y' (x, z), for 'z' (x, y). (x, y, z) offsets the start of the extrusion.
     */
    prism(profile: [number, number][], axis: Axis, x: number, y: number, z: number, length: number, color: string, style: FaceStyle = {}) {
      const lift = (u: number, v: number, offset: number): Vec3 => {
        if (axis === 'x') return world([x + offset, y + u, z + v]);
        if (axis === 'y') return world([x + u, y + offset, z + v]);
        return world([x + u, y + v, z + offset]);
      };
      const start = profile.map(([u, v]) => lift(u, v, 0));
      const end = profile.map(([u, v]) => lift(u, v, length));
      const faces = start.map((point, i) => {
        const next = (i + 1) % start.length;
        return { points: [point, start[next], end[next], end[i]], color };
      });
      faces.push({ points: [...start].reverse(), color }, { points: end, color });
      paint(faces, centroid([...start, ...end]), style);
    },

    /** Shaded ball (screen-space gradient), for organic blobs, bulbs, droplets. */
    sphere(x: number, y: number, z: number, radius: number, color: string, style: { alpha?: number; glow?: number } = {}) {
      const [sx, sy] = P(x, y, z);
      const r = radius * scale;
      const gradient = ctx.createRadialGradient(sx - r * 0.35, sy - r * 0.4, r * 0.1, sx, sy, r);
      const glow = style.glow ?? 1;
      gradient.addColorStop(0, lit(color, 1.35 * glow, style.alpha ?? 1));
      gradient.addColorStop(0.6, lit(color, 0.95 * glow, style.alpha ?? 1));
      gradient.addColorStop(1, lit(color, 0.6 * glow, style.alpha ?? 1));
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    },

    /** Tube through world points: dark edge, color, highlight; optional moving dashes. */
    pipe(points: Vec3[], width: number, color: string, options: PipeOptions = {}) {
      const screenPoints = points.map(([x, y, z]) => P(x, y, z));
      const line = (stroke: string, lineWidth: number, dash: number[] = [], offset = 0) => {
        ctx.beginPath();
        screenPoints.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy)));
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash(dash);
        ctx.lineDashOffset = offset;
        ctx.stroke();
        ctx.setLineDash([]);
      };
      const px = width * scale;
      ctx.globalAlpha = options.alpha ?? 1;
      line(lit(color, 0.45), px + 3);
      line(lit(color, 1), px);
      line(lit(color, 1.45), Math.max(1, px * 0.28));
      if (options.flow !== undefined) line(options.flowColor ?? '#ffffff', Math.max(2, px * 0.45), [px * 1.2, px * 1.6], -options.flow * scale);
      ctx.globalAlpha = 1;
    },

    /** Straight arrow between two world points (flat, screen space). */
    arrow(from: Vec3, to: Vec3, color: string, options: { width?: number; alpha?: number } = {}) {
      const [ax, ay] = P(...from);
      const [bx, by] = P(...to);
      const angle = Math.atan2(by - ay, bx - ax);
      const w = options.width ?? 6;
      ctx.globalAlpha = options.alpha ?? 1;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx - Math.cos(angle) * w * 2, by - Math.sin(angle) * w * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - Math.cos(angle - 0.45) * w * 3.5, by - Math.sin(angle - 0.45) * w * 3.5);
      ctx.lineTo(bx - Math.cos(angle + 0.45) * w * 3.5, by - Math.sin(angle + 0.45) * w * 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    },

    /**
     * Callout: dot on the world anchor, leader line, and a text box near (dx, dy) pixels from it.
     * Labels are queued and drawn by finish(), which keeps them inside the safe area and apart.
     */
    label(x: number, y: number, z: number, text: string, options: LabelOptions = {}) {
      if ((options.alpha ?? 1) <= 0.01) return;
      const [anchorX, anchorY] = P(x, y, z);
      labels.push({ anchorX, anchorY, text, options });
    },
  };

  function drawLabel({ anchorX, anchorY, text, options }: PendingLabel, box: IsoLabelBox) {
    const size = options.size ?? 34;
    const subSize = Math.round(size * 0.62);
    const color = options.color ?? '#38BDF8';
    // The leader ends at the box point nearest to the anchor.
    const endX = Math.max(box.x, Math.min(box.x + box.w, anchorX));
    const endY = Math.max(box.y, Math.min(box.y + box.h, anchorY));
    ctx.save();
    ctx.globalAlpha = options.alpha ?? 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, 7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = 'rgba(10,18,34,0.86)';
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${size}px Inter, Helvetica, Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(text, box.x + 18, box.y + 13);
    if (options.sub) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `500 ${subSize}px Inter, Helvetica, Arial, sans-serif`;
      ctx.fillText(options.sub, box.x + 18, box.y + 13 + size + 8);
    }
    ctx.restore();
  }

  return iso;
}

export type Iso = ReturnType<typeof createIso>;
