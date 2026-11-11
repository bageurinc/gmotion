/**
 * Spike: a flat side-view story engine on Canvas 2D, the 2D sibling of iso-canvas/engine.ts.
 * World units are meters, y points up, the ground line is y = 0. Every filled shape gets the
 * house look for free: base color, a soft shade band on its lower-right edge, a thin highlight
 * on its upper-left edge, and a colored outline. People come from the HumanRig skeleton, so
 * model-written code only places and poses them. Everything is a pure function of its inputs.
 */

import { layoutLabels, lit, mixColor, ramp, win, type IsoBounds, type IsoLabelBox, type IsoSafeInsets, type LabelOptions } from '../iso-canvas/engine';
import { rigSolve, rigWalk, type RigOptions, type RigPoint } from './rig';
import { beatAt, emitParticles, flowParticles, oscAt, samplePath } from './motion';

export type Vec2 = [number, number];
type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const apply = (m: Matrix, [x, y]: Vec2): Vec2 => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const multiply = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];
const darken = (color: string, amount: number) => mixColor(color, '#000000', amount);

export interface ShapeStyle {
  alpha?: number;
  /** Outline color; false hides it. Defaults to a darker tone of the fill. */
  line?: string | false;
  lineWidth?: number;
  /** Shade and highlight strength, 0 turns them off (flat color). Default 1. */
  shade?: number;
  /** Corner radius in meters, for rect. */
  r?: number;
  /** For poly: draw a smooth closed curve through the points instead of straight edges. */
  smooth?: boolean;
}

export type FlowKind = 'cells' | 'drops' | 'bubbles' | 'dashes' | 'sparks' | 'packets' | 'dots';

export interface FlowOptions {
  /** What travels: blood cells, water drops, bubbles, dashes, electric sparks, data packets, or dots. */
  kind?: FlowKind;
  /** Meters per second along the path; negative runs backwards; 0 stands still. */
  speed?: number;
  /** Meters between particles (default 2.5 × size). */
  spacing?: number;
  /** Particle size in meters. */
  size?: number;
  color?: string;
  t: number;
  /** Spread across the path in meters (the inside width of a vessel or pipe). */
  width?: number;
  smooth?: boolean;
  alpha?: number;
  seed?: number;
}

export interface EmitOptions {
  kind?: 'steam' | 'smoke' | 'ash' | 'bubbles' | 'sparks' | 'drops';
  /** Particles born per second. */
  rate?: number;
  /** Seconds each particle lives. */
  life?: number;
  /** Meters per second. */
  speed?: number;
  /** Radians; default straight up. */
  direction?: number;
  spread?: number;
  /** Meters per second squared; negative falls. */
  gravity?: number;
  /** Size in meters at birth. */
  size?: number;
  /** How much a particle grows by the end of its life (1 = doubles). */
  grow?: number;
  color?: string;
  t: number;
  alpha?: number;
  seed?: number;
}

export interface LineOptions {
  alpha?: number;
  /** Dash pattern in meters, e.g. [0.1, 0.08]. */
  dash?: [number, number];
  /** Moves the dashes along the line by this many meters (e.g. t * 0.5), for flow and steam. */
  flow?: number;
  /** Round ends (default) or flat. */
  cap?: 'round' | 'butt';
}

export type HairStyle = 'short' | 'long' | 'bun' | 'curly' | 'bald' | 'hijab' | 'cap' | 'caping';
export type FaceExpression = 'smile' | 'neutral' | 'open' | 'worried' | 'surprised';

export interface PersonOptions extends RigOptions {
  /** Body height in meters (adult about 1.6–1.8, child 1.0–1.3). */
  height?: number;
  /** 1 faces right, -1 faces left. */
  facing?: 1 | -1;
  skin?: string;
  hair?: string;
  hairStyle?: HairStyle;
  top?: string;
  bottom?: string;
  shoes?: string;
  sleeves?: 'short' | 'long';
  outfit?: 'pants' | 'skirt';
  /** Apron color over the torso and thighs (cook, baker, shopkeeper). */
  apron?: string;
  /** Long open coat color (doctor, lab worker). */
  coat?: string;
  glasses?: boolean;
  face?: FaceExpression;
  /** Draws an item in the near hand. Local origin is the palm, +x points where the person faces. */
  hold?: (s: Story) => void;
  /** Darkens the whole figure, for people farther back. */
  dim?: number;
}

export interface CameraKey2D {
  at: number;
  look: Vec2;
  zoom: number;
  /** Arrive at this key at an even speed instead of easing, so a ride along a path never stops at each key. */
  glide?: boolean;
}

interface PendingLabel {
  anchorX: number;
  anchorY: number;
  text: string;
  options: LabelOptions;
}

type Path = { points: Vec2[]; smooth: boolean };

export function createStory(ctx: CanvasRenderingContext2D, width: number, height: number, setup: { safe?: IsoSafeInsets } = {}) {
  let scale = 300;
  let lookX = 0;
  let lookY = 0.9;
  let anchorX = width / 2;
  let anchorY = height / 2;
  // Camera position at the start of camPath; parallax layers drift by how far it moved since.
  let refX = 0;
  let refY = 0.9;
  let parallax = 1;
  // Set while person() draws the upright figure inside a lying turn, so it does not turn again.
  let uprightOnly = false;
  let groupAlpha = 1;
  const stack: Matrix[] = [];
  const labels: PendingLabel[] = [];
  const safe = setup.safe ?? { top: 0.12, right: 0.16, bottom: 0.22, left: 0.08 };
  const safeBounds: IsoBounds = { left: width * safe.left, top: height * safe.top, right: width * (1 - safe.right), bottom: height * (1 - safe.bottom) };

  const current = (): Matrix => stack.reduce((acc, m) => multiply(acc, m), IDENTITY);
  const toScreen = ([x, y]: Vec2): Vec2 => {
    const driftX = (1 - parallax) * (lookX - refX);
    const driftY = (1 - parallax) * (lookY - refY);
    return [anchorX + (x - lookX + driftX) * scale, anchorY - (y - lookY + driftY) * scale];
  };
  const project = (points: Vec2[]): Vec2[] => {
    const m = current();
    return points.map((p) => toScreen(apply(m, p)));
  };
  /** World to screen pixels, after the current transforms. */
  const P = (x: number, y: number): Vec2 => project([[x, y]])[0];
  /** Pixels per meter after the current transforms (for widths that should scale with the shape). */
  const unit = () => {
    const m = current();
    return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) * scale;
  };

  const trace = ({ points, smooth }: Path, dx = 0, dy = 0) => {
    const n = points.length;
    if (n < 2) return;
    if (!smooth || n < 3) {
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
      ctx.closePath();
      return;
    }
    const mid = (a: Vec2, b: Vec2): Vec2 => [(a[0] + b[0]) / 2 + dx, (a[1] + b[1]) / 2 + dy];
    const start = mid(points[n - 1], points[0]);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i += 1) {
      const next = mid(points[i], points[(i + 1) % n]);
      ctx.quadraticCurveTo(points[i][0] + dx, points[i][1] + dy, next[0], next[1]);
    }
    ctx.closePath();
  };

  /** Fills one screen-space path in the house look: base, lower-right shade, upper-left highlight, outline. */
  const paint = (path: Path, color: string, style: ShapeStyle = {}) => {
    const xs = path.points.map(([x]) => x);
    const ys = path.points.map(([, y]) => y);
    const size = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const offset = Math.max(0, Math.min(size * 0.16, 36)) * (style.shade ?? 1);
    ctx.save();
    ctx.globalAlpha = groupAlpha * (style.alpha ?? 1);
    ctx.beginPath();
    trace(path);
    ctx.fillStyle = color;
    ctx.fill();
    if (offset > 0.6) {
      ctx.save();
      ctx.beginPath();
      trace(path);
      ctx.clip();
      // The path minus itself shifted up-left is the band along the lower-right edge.
      ctx.beginPath();
      trace(path);
      trace(path, -offset, -offset);
      ctx.fillStyle = lit(color, 0.84);
      ctx.fill('evenodd');
      const glint = Math.max(1, offset * 0.4);
      ctx.beginPath();
      trace(path);
      trace(path, glint, glint);
      ctx.fillStyle = lit(color, 1.16);
      ctx.fill('evenodd');
      ctx.restore();
    }
    if (style.line !== false) {
      ctx.beginPath();
      trace(path);
      ctx.strokeStyle = style.line ?? lit(color, 0.55);
      ctx.lineWidth = style.lineWidth ?? 3;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.restore();
  };

  const ellipsePoints = (x: number, y: number, rx: number, ry: number, steps = 40): Vec2[] =>
    Array.from({ length: steps }, (_, i) => {
      const a = (i / steps) * Math.PI * 2;
      return [x + Math.cos(a) * rx, y + Math.sin(a) * ry];
    });

  const roundRectPoints = (x: number, y: number, w: number, h: number, r: number): Vec2[] => {
    const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    if (radius <= 0) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const corners: [number, number, number][] = [
      [x + w - radius, y + radius, -Math.PI / 2],
      [x + w - radius, y + h - radius, 0],
      [x + radius, y + h - radius, Math.PI / 2],
      [x + radius, y + radius, Math.PI],
    ];
    const out: Vec2[] = [];
    for (const [cx, cy, start] of corners) {
      for (let i = 0; i <= 6; i += 1) {
        const a = start + (i / 6) * (Math.PI / 2);
        out.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
      }
    }
    return out;
  };

  const capsulePoints = (x1: number, y1: number, x2: number, y2: number, w: number): Vec2[] => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const r = w / 2;
    const out: Vec2[] = [];
    for (let i = 0; i <= 10; i += 1) {
      const a = angle + Math.PI / 2 - (i / 10) * Math.PI;
      out.push([x2 + Math.cos(a) * r, y2 + Math.sin(a) * r]);
    }
    for (let i = 0; i <= 10; i += 1) {
      const a = angle - Math.PI / 2 - (i / 10) * Math.PI;
      out.push([x1 + Math.cos(a) * r, y1 + Math.sin(a) * r]);
    }
    return out;
  };

  const withMatrix = (m: Matrix, fn: () => void) => {
    stack.push(m);
    try {
      fn();
    } finally {
      stack.pop();
    }
  };

  // The raw context is deliberately not exposed: model-written code draws only through this API.
  const s = {
    width,
    height,
    P,
    ramp,
    win,
    mixColor,
    lit: (color: string, brightness: number) => mixColor(color, brightness < 1 ? '#000000' : '#ffffff', Math.abs(1 - brightness)),

    /** Puts world point (x, y) at the frame centre (or at screen point sx, sy) with zoom pixels per meter. */
    look(x: number, y: number, zoom: number, sx = width / 2, sy = height / 2) {
      lookX = x;
      lookY = y;
      refX = x;
      refY = y;
      scale = zoom;
      anchorX = sx;
      anchorY = sy;
    },

    /** Eased camera between keys sorted by time; repeat a key later to hold. Parallax layers drift from the first key. */
    camPath(keys: CameraKey2D[], t: number, sx = width / 2, sy = height / 2) {
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
      const linear = Math.max(0, Math.min(1, (t - from.at) / (to.at - from.at || 1)));
      const k = from === to ? 1 : to.glide ? linear : ramp(t, from.at, to.at);
      s.look(from.look[0] + (to.look[0] - from.look[0]) * k, from.look[1] + (to.look[1] - from.look[1]) * k, Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * k), sx, sy);
      refX = sorted[0].look[0];
      refY = sorted[0].look[1];
    },

    /** Fills the whole frame with a vertical gradient (sky, wall). Call first. */
    background(top: string, bottom = top) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, top);
      gradient.addColorStop(1, bottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    },

    /** Everything below the line y (default 0) to the bottom of the frame, full width: floor, grass, road, water. */
    ground(color: string, y = 0, bottomColor = color) {
      const top = Math.max(0, Math.min(height, P(0, y)[1]));
      const gradient = ctx.createLinearGradient(0, top, 0, height);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, bottomColor);
      ctx.save();
      ctx.globalAlpha = groupAlpha;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, top, width, height - top);
      ctx.strokeStyle = lit(color, 0.7);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.lineTo(width, top);
      ctx.stroke();
      ctx.restore();
    },

    /** A full-width horizontal band between heights y0 and y1: a wall stripe, a skirting board, a far field, a road. */
    band(y0: number, y1: number, color: string, style: { alpha?: number } = {}) {
      const a = P(0, y0)[1];
      const b = P(0, y1)[1];
      ctx.save();
      ctx.globalAlpha = groupAlpha * (style.alpha ?? 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, Math.min(a, b), width, Math.abs(b - a));
      ctx.restore();
    },

    /** Soft contact shadow on the line y under something centred at x and w meters wide. */
    shadow(x: number, w: number, y = 0, strength = 0.22) {
      const [sx, sy] = P(x, y);
      const rx = (w / 2) * unit() * 1.1;
      if (rx <= 0) return;
      ctx.save();
      ctx.globalAlpha = groupAlpha;
      ctx.translate(sx, sy);
      ctx.scale(1, 0.16);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      gradient.addColorStop(0, `rgba(20,24,36,${strength})`);
      gradient.addColorStop(1, 'rgba(20,24,36,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    /** Rectangle from its lower-left corner (x, y), w wide and h tall. style.r rounds the corners. */
    rect(x: number, y: number, w: number, h: number, color: string, style: ShapeStyle = {}) {
      paint({ points: project(roundRectPoints(x, y, w, h, style.r ?? 0)), smooth: false }, color, style);
    },

    circle(x: number, y: number, r: number, color: string, style: ShapeStyle = {}) {
      paint({ points: project(ellipsePoints(x, y, r, r)), smooth: false }, color, style);
    },

    ellipse(x: number, y: number, rx: number, ry: number, color: string, style: ShapeStyle = {}) {
      paint({ points: project(ellipsePoints(x, y, rx, ry)), smooth: false }, color, style);
    },

    /** Closed polygon through [[x, y], ...]; style.smooth turns it into a soft curved blob. */
    poly(points: Vec2[], color: string, style: ShapeStyle = {}) {
      paint({ points: project(points), smooth: !!style.smooth }, color, style);
    },

    /** Thick segment with round ends from (x1, y1) to (x2, y2), w meters thick: handles, pipes, branches, limbs. */
    capsule(x1: number, y1: number, x2: number, y2: number, w: number, color: string, style: ShapeStyle = {}) {
      paint({ points: project(capsulePoints(x1, y1, x2, y2, w)), smooth: false }, color, style);
    },

    /** Open stroke through points, w meters wide, no shading: wires, steam, motion lines, cracks. */
    line(points: Vec2[], w: number, color: string, options: LineOptions = {}) {
      const screenPoints = project(points);
      const px = Math.max(1, w * unit());
      ctx.save();
      ctx.globalAlpha = groupAlpha * (options.alpha ?? 1);
      ctx.beginPath();
      screenPoints.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = color;
      ctx.lineWidth = px;
      ctx.lineCap = options.cap ?? 'round';
      ctx.lineJoin = 'round';
      if (options.dash) {
        ctx.setLineDash([options.dash[0] * unit(), options.dash[1] * unit()]);
        ctx.lineDashOffset = -(options.flow ?? 0) * unit();
      }
      ctx.stroke();
      ctx.restore();
    },

    /** Arrow from one world point to another, w meters thick. */
    arrow(from: Vec2, to: Vec2, color: string, options: { width?: number; alpha?: number } = {}) {
      const [ax, ay] = P(from[0], from[1]);
      const [bx, by] = P(to[0], to[1]);
      const angle = Math.atan2(by - ay, bx - ax);
      const w = Math.max(3, (options.width ?? 0.03) * unit());
      ctx.save();
      ctx.globalAlpha = groupAlpha * (options.alpha ?? 1);
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
      ctx.restore();
    },

    /** Soft radial light around (x, y), r meters: lamp glow, heat, sunlight, a highlight on a part. */
    glow(x: number, y: number, r: number, color: string, alpha = 0.35) {
      const [sx, sy] = P(x, y);
      const radius = r * unit();
      if (radius <= 0) return;
      const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      gradient.addColorStop(0, lit(color, 1, alpha));
      gradient.addColorStop(1, lit(color, 1, 0));
      ctx.save();
      ctx.globalAlpha = groupAlpha;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    /**
     * A vessel, pipe, river, or cable: a smooth path w meters wide with a darker wall and a
     * soft highlight. Pair it with s.flow on the same points to show what moves inside.
     */
    tube(points: Vec2[], w: number, color: string, options: { wall?: string | false; alpha?: number; smooth?: boolean } = {}) {
      const path = samplePath(points, options.smooth ?? true);
      const screenPoints = project(path.points);
      const px = Math.max(1.5, w * unit());
      const stroke = (style: string, lineWidth: number, alpha = 1) => {
        ctx.beginPath();
        screenPoints.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.strokeStyle = style;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = groupAlpha * (options.alpha ?? 1) * alpha;
        ctx.stroke();
      };
      ctx.save();
      if (options.wall !== false) stroke(options.wall ?? lit(color, 0.55), px + Math.max(3, px * 0.18));
      stroke(color, px);
      stroke(lit(color, 1.3), Math.max(1, px * 0.22), 0.55);
      ctx.restore();
    },

    /**
     * Particles travelling along a path: blood cells in a vessel, drops in a pipe, sparks along
     * a wire, packets through a cable. Driven by t only, so it keeps moving in every frame.
     */
    flow(points: Vec2[], options: FlowOptions) {
      const kind = options.kind ?? 'dots';
      const size = options.size ?? 0.05;
      const color = options.color ?? (kind === 'cells' ? '#D7263D' : kind === 'sparks' ? '#FFD23F' : kind === 'drops' || kind === 'bubbles' ? '#6EC6FF' : '#FFFFFF');
      const path = samplePath(points, options.smooth ?? true);
      const particles = flowParticles(path, { t: options.t, speed: options.speed ?? 0.3, spacing: options.spacing ?? size * 2.5, width: options.width ?? 0, seed: options.seed });
      const px = Math.max(1, size * unit());
      ctx.save();
      for (const particle of particles) {
        const [sx, sy] = P(particle.x, particle.y);
        const [tx, ty] = P(particle.x + Math.cos(particle.angle) * 0.01, particle.y + Math.sin(particle.angle) * 0.01);
        const angle = Math.atan2(ty - sy, tx - sx);
        ctx.globalAlpha = groupAlpha * (options.alpha ?? 1) * particle.alpha;
        drawParticle(kind, sx, sy, px, angle, color);
      }
      ctx.restore();
    },

    /** Chevrons marching along a path for big flows: wind, ocean currents, heat moving, traffic. */
    flowArrow(points: Vec2[], options: { color?: string; width?: number; speed?: number; spacing?: number; t: number; alpha?: number; smooth?: boolean }) {
      const width = options.width ?? 0.1;
      const path = samplePath(points, options.smooth ?? true);
      const particles = flowParticles(path, { t: options.t, speed: options.speed ?? 0.4, spacing: options.spacing ?? width * 2.2 });
      const px = Math.max(3, width * unit());
      ctx.save();
      ctx.strokeStyle = options.color ?? '#FFFFFF';
      ctx.lineWidth = Math.max(2, px * 0.28);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const particle of particles) {
        const [sx, sy] = P(particle.x, particle.y);
        const [tx, ty] = P(particle.x + Math.cos(particle.angle) * 0.01, particle.y + Math.sin(particle.angle) * 0.01);
        const angle = Math.atan2(ty - sy, tx - sx);
        ctx.globalAlpha = groupAlpha * (options.alpha ?? 0.85) * particle.alpha;
        const back = angle + Math.PI;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(back - 0.6) * px * 0.5, sy + Math.sin(back - 0.6) * px * 0.5);
        ctx.lineTo(sx, sy);
        ctx.lineTo(sx + Math.cos(back + 0.6) * px * 0.5, sy + Math.sin(back + 0.6) * px * 0.5);
        ctx.stroke();
      }
      ctx.restore();
    },

    /** Particles born at (x, y): steam from a cup, smoke, falling ash, rising bubbles, sparks. */
    emit(x: number, y: number, options: EmitOptions) {
      const kind = options.kind ?? 'steam';
      const size = options.size ?? 0.04;
      const color = options.color ?? (kind === 'smoke' || kind === 'ash' ? '#8A8F98' : kind === 'sparks' ? '#FFB347' : kind === 'bubbles' || kind === 'drops' ? '#8FD3FF' : '#FFFFFF');
      const particles = emitParticles({
        t: options.t, rate: options.rate ?? 6, life: options.life ?? 1.6, speed: options.speed ?? 0.25,
        direction: options.direction, spread: options.spread ?? 0.6, gravity: options.gravity ?? (kind === 'ash' || kind === 'drops' ? -0.4 : 0), seed: options.seed,
      });
      ctx.save();
      for (const particle of particles) {
        const [sx, sy] = P(x + particle.x, y + particle.y);
        const grown = Math.max(1, size * (1 + (options.grow ?? (kind === 'steam' || kind === 'smoke' ? 1.5 : 0)) * particle.age) * unit());
        const fade = (1 - particle.age) * Math.min(1, particle.age * 6);
        ctx.globalAlpha = groupAlpha * (options.alpha ?? (kind === 'steam' ? 0.5 : 0.85)) * fade;
        if (kind === 'steam' || kind === 'smoke' || kind === 'ash') {
          const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, grown);
          gradient.addColorStop(0, lit(color, 1, 1));
          gradient.addColorStop(1, lit(color, 1, 0));
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(sx, sy, grown, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawParticle(kind, sx, sy, grown, Math.PI / 2, color);
        }
      }
      ctx.restore();
    },

    /** A rhythmic cycle: phase 0..1 per beat and squeeze 0..1 (a fast contraction, then rest). Heartbeats, pumps, breathing. */
    beat(t: number, bpm = 72) {
      return beatAt(t, bpm);
    },

    /** A smooth wave -1..1 with period seconds: swaying leaves, bobbing boats, idle machines. */
    osc(t: number, period = 2, phase = 0) {
      return oscAt(t, period, phase);
    },

    /** Runs fn shifted by (x, y). */
    at(x: number, y: number, fn: () => void) {
      withMatrix([1, 0, 0, 1, x, y], fn);
    },

    /** Runs fn rotated by angle (radians, counter-clockwise) around (px, py). */
    rotate(angle: number, px: number, py: number, fn: () => void) {
      const c = Math.cos(angle);
      const n = Math.sin(angle);
      withMatrix([c, n, -n, c, px - c * px + n * py, py - n * px - c * py], fn);
    },

    /** Runs fn scaled by (kx, ky) around (px, py): rising dough, a growing plant, a squash on impact. kx = -1 mirrors. */
    scale(kx: number, ky: number, px: number, py: number, fn: () => void) {
      withMatrix([kx, 0, 0, ky, px - kx * px, py - ky * py], fn);
    },

    /** Runs fn with everything faded to alpha (0..1). */
    fade(alpha: number, fn: () => void) {
      const saved = groupAlpha;
      groupAlpha = saved * Math.max(0, Math.min(1, alpha));
      try {
        if (groupAlpha > 0.003) fn();
      } finally {
        groupAlpha = saved;
      }
    },

    /**
     * Runs fn on a parallax layer: depth 1 is the main plane, 0.3 is far away (moves 30% as much
     * when the camera pans), 1.3 is a foreground layer that passes faster. Draw far layers first.
     */
    layer(depth: number, fn: () => void) {
      const saved = parallax;
      parallax = depth;
      try {
        fn();
      } finally {
        parallax = saved;
      }
    },

    /** Walk from fromX to toX as progress runs 0..1, feet planted: pass the result's walkPhase, walkMix, facing, and x to person(). */
    walk(options: { progress: number; fromX: number; toX: number; height?: number }) {
      return rigWalk(options);
    },

    /**
     * Draws a person standing with feet on (x, y), seen from the side, on the HumanRig skeleton.
     * Pose 'lie' lays the figure on its back on the surface y, head toward facing.
     * Returns world points of the head top, near hand, and chest for labels and props.
     */
    person(x: number, y: number, options: PersonOptions = {}): { head: Vec2; hand: Vec2; chest: Vec2; farHand: Vec2 } {
      const h = options.height ?? 1.7;
      // Lying is the upright figure turned a quarter around its pelvis, so pose blends into and
      // out of 'lie' turn the body too. The upright figure faces away from the head side so its
      // front ends up facing the sky.
      const lieAmount = uprightOnly ? 0 : (options.pose === 'lie' ? 1 - (options.poseTo === undefined ? 0 : options.poseMix ?? 0) : 0)
        + (options.poseTo === 'lie' && options.pose !== 'lie' ? options.poseMix ?? 0 : 0);
      if (lieAmount > 0) {
        const headSide = options.facing === -1 ? -1 : 1;
        const pelvisHeight = -rigSolve(h, { pose: 'lie' }).pelvisY;
        const angle = -headSide * (Math.PI / 2) * lieAmount;
        const c = Math.cos(angle);
        const n = Math.sin(angle);
        const [px, py] = [x, y + pelvisHeight];
        const drop = (pelvisHeight - h * 0.085) * lieAmount;
        const m: Matrix = [c, n, -n, c, px - c * px + n * py, py - n * px - c * py - drop];
        let local: ReturnType<Story['person']> | null = null;
        uprightOnly = true;
        try {
          withMatrix(m, () => {
            local = s.person(x, y, { ...options, facing: -headSide as 1 | -1 });
          });
        } finally {
          uprightOnly = false;
        }
        const out = local as unknown as ReturnType<Story['person']>;
        return { head: apply(m, out.head), hand: apply(m, out.hand), chest: apply(m, out.chest), farHand: apply(m, out.farHand) };
      }
      const f = options.facing === -1 ? -1 : 1;
      const solved = rigSolve(h, options);
      const j = solved.joints;
      const W = (p: RigPoint): Vec2 => [x + f * p[0], y - p[1]];
      const dim = options.dim ?? 0;
      const tone = (color: string, extra = 0) => darken(color, Math.min(0.9, dim + extra));
      const skin = options.skin ?? '#E0AC85';
      const hair = options.hair ?? '#3A2A22';
      const top = options.top ?? '#4C8BF5';
      const bottom = options.bottom ?? '#3B4A63';
      const shoes = options.shoes ?? '#2F3540';
      const longSleeves = options.sleeves === 'long' || !!options.coat;
      const skirt = options.outfit === 'skirt';
      const style: ShapeStyle = { lineWidth: 2.5 };
      const FAR = 0.18;

      const limb = (a: RigPoint, b: RigPoint, w: number, color: string) => s.capsule(...W(a), ...W(b), w, color, style);
      const leg = (side: 'near' | 'far') => {
        const L = j[side];
        const extra = side === 'far' ? FAR : 0;
        const pants = tone(skirt ? skin : bottom, extra);
        limb(L.hip, L.knee, h * 0.086, skirt ? tone(skin, extra) : pants);
        limb(L.knee, L.ankle, h * 0.068, pants);
        const heel = W(L.heel);
        const toe = W(L.toe);
        s.capsule(heel[0], heel[1] + h * 0.018, toe[0], toe[1] + h * 0.016, h * 0.045, tone(shoes, extra), style);
      };
      const arm = (side: 'near' | 'far') => {
        const L = j[side];
        const extra = side === 'far' ? FAR : 0;
        const sleeve = tone(options.coat ?? top, extra);
        limb(L.shoulder, L.elbow, h * 0.062, sleeve);
        limb(L.elbow, L.wrist, h * 0.054, longSleeves ? sleeve : tone(skin, extra));
        const hand = W([(L.wrist[0] + L.fingers[0]) / 2, (L.wrist[1] + L.fingers[1]) / 2]);
        s.circle(hand[0], hand[1], h * 0.032, tone(skin, extra), style);
      };

      // Spine frame: along runs 0 at the pelvis to 1 at the neck base, across is meters forward / h.
      const [px, py] = j.pelvis;
      const [nx, ny] = j.neckBase;
      const spine = Math.hypot(nx - px, ny - py) || 1;
      const u: RigPoint = [(nx - px) / spine, (ny - py) / spine];
      // In rig space y is down and the figure faces +x, so forward is the perpendicular with positive x.
      const fwd: RigPoint = -u[1] >= 0 ? [-u[1], u[0]] : [u[1], -u[0]];
      const at = (along: number, across: number): Vec2 => W([px + u[0] * along * spine + fwd[0] * across * h, py + u[1] * along * spine + fwd[1] * across * h]);
      const torso = (length: number, front: number, back: number): Vec2[] => {
        const lowest = 1 - length;
        return [
          at(lowest - 0.05, -back), at(lowest + 0.2, -back - 0.004), at(0.8, -0.07), at(1.0, -0.04),
          at(1.02, 0.03), at(0.78, front + 0.012), at(0.45, front - 0.006), at(lowest - 0.05, front),
        ];
      };

      arm('far');
      leg('far');
      leg('near');
      if (skirt) {
        const hip = W(j.pelvis);
        const knee = W([(j.near.knee[0] + j.far.knee[0]) / 2, (j.near.knee[1] + j.far.knee[1]) / 2]);
        const drop = hip[1] - knee[1];
        s.poly([[hip[0] - f * h * 0.08, hip[1] + h * 0.02], [hip[0] + f * h * 0.08, hip[1] + h * 0.02], [knee[0] + f * h * 0.12, hip[1] - drop * 0.95], [knee[0] - f * h * 0.11, hip[1] - drop * 0.95]], tone(bottom), style);
      } else {
        const hip = W(j.pelvis);
        s.ellipse(hip[0], hip[1] - h * 0.005, h * 0.075, h * 0.06, tone(bottom), { ...style, line: false });
      }
      if (options.coat) s.poly(torso(1.45, 0.08, 0.085), tone(options.coat), { ...style, smooth: true });
      s.poly(torso(1.05, 0.08, 0.076), tone(top), { ...style, smooth: true });
      if (options.apron) {
        s.poly([at(0.8, 0.035), at(0.78, 0.084), at(0.45, 0.079), at(0.05, 0.08), at(-0.42, 0.085), at(-0.44, 0.0), at(0.05, 0.005), at(0.45, 0.015)], tone(options.apron), style);
        s.capsule(...at(0.12, -0.07), ...at(0.12, 0.06), h * 0.014, tone(options.apron, 0.12), style);
      }

      // Neck and head. The head sits a little forward of the neck line.
      limb(j.neckBase, j.headBase, h * 0.045, tone(skin));
      const headCenterRig: RigPoint = [(j.headBase[0] + j.headTop[0]) / 2 + h * 0.008, (j.headBase[1] + j.headTop[1]) / 2];
      const [hx, hy] = W(headCenterRig);
      const r = h * 0.074;
      const hairColor = tone(hair);
      const back = (k: number) => hx - f * k * r;
      if (options.hairStyle === 'long') s.poly([[back(0.9), hy + r * 0.3], [back(1.15), hy - r * 1.6], [back(0.2), hy - r * 1.7], [back(0.1), hy - r * 0.2]], hairColor, { ...style, smooth: true });
      const hijab = options.hairStyle === 'hijab';
      if (hijab) {
        // Drape over the shoulders first, then the hood; the face is an opening in the hood.
        s.poly([[hx + f * r * 0.85, hy + r * 0.9], [back(1.25), hy + r * 0.6], [back(1.35), hy - r * 1.9], [hx + f * r * 0.9, hy - r * 1.75], [hx + f * r * 1.05, hy - r * 0.6]], hairColor, { ...style, smooth: true });
        s.poly([[hx + f * r * 1.05, hy - r * 0.6], [hx + f * r * 1.02, hy + r * 0.5], [hx, hy + r * 1.22], [back(1.2), hy + r * 0.4], [back(1.18), hy - r * 0.5], [hx + f * r * 0.25, hy - r * 1.05]], hairColor, { ...style, smooth: true });
        s.circle(hx + f * r * 0.35, hy - r * 0.05, r * 0.72, tone(skin), { ...style, shade: 0.5 });
      } else {
        s.circle(hx, hy, r, tone(skin), style);
      }
      // Ear, eye, brow, mouth on the facing side.
      if (!hijab) s.circle(back(0.05), hy - r * 0.05, r * 0.2, tone(skin, 0.06), { ...style, shade: 0.5 });
      const eye: Vec2 = [hx + f * r * 0.55, hy + r * 0.12];
      s.circle(eye[0], eye[1], r * 0.1, '#232A35', { line: false, shade: 0 });
      const mouthY = hy - r * 0.45;
      const expr = options.face ?? 'smile';
      if (expr === 'open' || expr === 'surprised') s.ellipse(hx + f * r * 0.62, mouthY, r * 0.1, r * (expr === 'surprised' ? 0.16 : 0.12), '#7A2E2E', { line: false, shade: 0 });
      else {
        const curve = expr === 'smile' ? -0.1 : expr === 'worried' ? 0.08 : 0;
        s.line([[hx + f * r * 0.4, mouthY], [hx + f * r * 0.58, mouthY + curve * r], [hx + f * r * 0.78, mouthY]], r * 0.07, '#7A2E2E');
      }
      if (expr === 'worried' || expr === 'surprised') s.line([[hx + f * r * 0.38, hy + r * 0.38], [hx + f * r * 0.72, hy + r * (expr === 'worried' ? 0.3 : 0.46)]], r * 0.07, hairColor);
      if (options.glasses) {
        s.line([[hx + f * r * 0.35, eye[1]], [hx + f * r * 0.42, eye[1]]], r * 0.05, '#2B3440');
        s.circle(eye[0] + f * r * 0.05, eye[1], r * 0.22, '#CFE3F5', { alpha: 0.55, line: '#2B3440', lineWidth: 2.5, shade: 0 });
      }
      const hairTop = (cover: number) => s.poly([[back(1.08), hy - r * 0.1], [back(1.05), hy + r * 0.7], [hx, hy + r * 1.12], [hx + f * r * 0.85, hy + r * 0.7], [hx + f * r * cover, hy + r * 0.45], [back(0.15), hy + r * 0.5], [back(0.35), hy + r * 0.05]], hairColor, { ...style, smooth: true });
      switch (options.hairStyle ?? 'short') {
        case 'short':
        case 'long':
          hairTop(0.95);
          break;
        case 'bun':
          hairTop(0.9);
          s.circle(back(0.95), hy + r * 0.75, r * 0.38, hairColor, style);
          break;
        case 'curly':
          for (let i = 0; i < 7; i += 1) {
            const a = Math.PI * (0.15 + (i / 6) * 0.85);
            s.circle(hx - f * Math.cos(a) * r * 0.85 + f * r * 0.05, hy + Math.sin(a) * r * 0.85, r * 0.36, hairColor, { ...style, line: false });
          }
          break;
        case 'caping': {
          // Conical farmer's hat, wider than the shoulders.
          hairTop(0.9);
          const brim = hy + r * 0.55;
          s.poly([[hx - r * 2.1, brim], [hx + f * r * 0.1, hy + r * 1.75], [hx + r * 2.1, brim], [hx, brim - r * 0.2]], '#D8B26A', { ...style, smooth: false });
          break;
        }
        case 'cap':
          s.poly([[back(1.05), hy + r * 0.15], [back(0.95), hy + r * 0.85], [hx, hy + r * 1.1], [hx + f * r * 0.95, hy + r * 0.55], [hx + f * r * 1.0, hy + r * 0.3]], tone(top), { ...style, smooth: true });
          s.capsule(hx + f * r * 0.6, hy + r * 0.32, hx + f * r * 1.55, hy + r * 0.24, r * 0.16, tone(top), style);
          break;
        default:
          break;
      }
      arm('near');

      const handRig: RigPoint = [(j.near.wrist[0] + j.near.fingers[0]) / 2, (j.near.wrist[1] + j.near.fingers[1]) / 2];
      const hand = W(handRig);
      if (options.hold) {
        const hold = options.hold;
        s.at(hand[0], hand[1], () => s.scale(f, 1, 0, 0, () => hold(s)));
      }
      return { head: W(j.headTop), hand, chest: W([(j.neckBase[0] + j.pelvis[0]) / 2, (j.neckBase[1] + j.pelvis[1]) / 2]), farHand: W(j.far.wrist) };
    },

    /** Callout: dot on the world point, leader line, and a text box near (dx, dy) pixels from it. Text in Bahasa Indonesia. */
    label(x: number, y: number, text: string, options: LabelOptions = {}) {
      if ((options.alpha ?? 1) * groupAlpha <= 0.01) return;
      const [ax, ay] = P(x, y);
      labels.push({ anchorX: ax, anchorY: ay, text, options: { ...options, alpha: (options.alpha ?? 1) * groupAlpha } });
    },

    /** Draws queued labels, laid out inside the safe area. Called once per frame after draw. */
    finish() {
      const boxes: IsoLabelBox[] = labels.map((pending) => {
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
  };

  /** One particle in screen space, px across, facing angle (screen radians). */
  function drawParticle(kind: string, x: number, y: number, px: number, angle: number, color: string) {
    const r = px / 2;
    switch (kind) {
      case 'cells': {
        // A red blood cell seen from the side of the stream: a flat disc with a paler dimple.
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.62, 0, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        // A light rim keeps cells readable on a vessel of a similar color.
        ctx.lineWidth = Math.max(1.5, px * 0.14);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.45, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fillStyle = lit(color, 0.78);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'bubbles':
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = lit(color, 1.2, 0.25);
        ctx.fill();
        ctx.lineWidth = Math.max(1, px * 0.1);
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fill();
        break;
      case 'dashes':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.roundRect(-r, -px * 0.17, px, px * 0.34, px * 0.17);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
        break;
      case 'sparks': {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, px);
        glow.addColorStop(0, lit(color, 1.2, 0.9));
        glow.addColorStop(1, lit(color, 1, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, px, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, r * 0.45), 0, Math.PI * 2);
        ctx.fillStyle = '#FFFDF0';
        ctx.fill();
        break;
      }
      case 'packets':
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.roundRect(-r, -r * 0.7, px, px * 0.7, px * 0.15);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = Math.max(1, px * 0.08);
        ctx.strokeStyle = lit(color, 0.6);
        ctx.stroke();
        ctx.restore();
        break;
      default:
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = Math.max(1, px * 0.1);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.stroke();
        if (kind === 'drops') {
          ctx.beginPath();
          ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fill();
        }
    }
  }

  function drawLabel({ anchorX: ax, anchorY: ay, text, options }: PendingLabel, box: IsoLabelBox) {
    const size = options.size ?? 34;
    const subSize = Math.round(size * 0.62);
    const color = options.color ?? '#F97316';
    const endX = Math.max(box.x, Math.min(box.x + box.w, ax));
    const endY = Math.max(box.y, Math.min(box.y + box.h, ay));
    ctx.save();
    ctx.globalAlpha = options.alpha ?? 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ax, ay, 7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1F2937';
    ctx.font = `700 ${size}px Inter, Helvetica, Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(text, box.x + 18, box.y + 13);
    if (options.sub) {
      ctx.fillStyle = '#4B5563';
      ctx.font = `500 ${subSize}px Inter, Helvetica, Arial, sans-serif`;
      ctx.fillText(options.sub, box.x + 18, box.y + 13 + size + 8);
    }
    ctx.restore();
  }

  return s;
}

export type Story = ReturnType<typeof createStory>;
export type StoryDraw = (s: Story, t: number) => void;
