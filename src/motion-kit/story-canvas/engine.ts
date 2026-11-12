/**
 * Spike: a flat side-view story engine on Canvas 2D, the 2D sibling of iso-canvas/engine.ts.
 * World units are meters, y points up, the ground line is y = 0. Every filled shape gets the
 * house look for free: base color, a soft shade band on its lower-right edge, a thin highlight
 * on its upper-left edge, and a colored outline. People come from the HumanRig skeleton, so
 * model-written code only places and poses them. Everything is a pure function of its inputs.
 */

import { layoutLabels, lit, mixColor, parseColor, ramp, win, type IsoBounds, type IsoLabelBox, type IsoSafeInsets, type LabelOptions } from '../iso-canvas/engine';
import { rigSolve, rigWalk, type RigOptions, type RigPoint } from './rig';
import { beatAt, emitParticles, flowParticles, hash, oscAt, samplePath } from './motion';

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
  /** Second color: the fill runs from color at the top to fillTo at the bottom (liquids, metal, skin, sky). */
  fillTo?: string;
  /** Surface pattern clipped inside the shape: muscle fibers, wood grain, tiles, rock speckle. */
  texture?: TextureStyle;
  /** How the surface takes light: matte (default), metal (sharp bands), glass (see-through, bright edge), wet (organs, liquid), glossy (plastic, paint). */
  material?: Material;
  /** Meters this shape sits in front of what is behind it: casts a soft shadow away from the light (a pipe on a wall, a valve in a chamber). */
  lift?: number;
}

export type Material = 'matte' | 'metal' | 'glass' | 'wet' | 'glossy';

export interface LightOptions {
  /** Direction toward the light source in radians, world space: Math.PI * 0.75 is upper left (default), Math.PI / 2 straight above, 0 from the right, -Math.PI / 2 from below (lava, a fire, a screen in the lap). */
  dir?: number;
  /** Light color; it tints highlights and, a little, every surface (warm sunset, cold night, red lava). Default white. */
  color?: string;
  /** 0 flat, 1 normal (default), up to 1.6 for hard sun or a spotlight. */
  strength?: number;
  /** Bright edge on the shadow side of every shape; on by default against dark backgrounds. A color or false. */
  rim?: string | boolean;
}

export type TextureKind = 'stripes' | 'muscle' | 'grain' | 'dots' | 'speckle' | 'hatch' | 'bricks' | 'tiles' | 'scales' | 'cells' | 'waves';

export interface TextureStyle {
  kind: TextureKind;
  /** Spacing of the pattern in meters (a muscle fiber every 0.004 m, a tile every 0.2 m). */
  size: number;
  /** Pattern color; defaults to a darker tone of the fill. */
  color?: string;
  alpha?: number;
  /** Direction of stripes, fibers, and grain in radians (0 runs left to right). */
  angle?: number;
  seed?: number;
}

export interface BranchOptions {
  /** Direction of the trunk in radians; default straight up (Math.PI / 2). */
  angle?: number;
  /** Length of the trunk in meters; each level is shorter by ratio. */
  length: number;
  /** Width of the trunk in meters; each level is thinner by taper. */
  width: number;
  color: string;
  /** Levels of splitting, 1 to 7 (default 4). */
  depth?: number;
  /** Angle between the two children in radians (default 0.7). */
  spread?: number;
  ratio?: number;
  taper?: number;
  seed?: number;
  /** Seconds, with sway: branches move gently (trees in wind, seaweed). */
  t?: number;
  /** Sway amplitude in radians (default 0). */
  sway?: number;
  /** Outline color; false hides it. */
  line?: string | false;
  alpha?: number;
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
  /** Color at the end of the path: particles change color along the way (blue blood turning red in the lungs, hot gas cooling). */
  colorTo?: string;
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
  // Background tone that far layers fade toward (aerial perspective), set by background().
  let haze: string | null = null;
  // Scene light: toward-light vector in screen space (y down), color, strength, rim edge.
  let light = { x: -Math.SQRT1_2, y: -Math.SQRT1_2, color: '#FFFFFF', tint: 0, strength: 1, rim: null as string | boolean | null };
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

  /** Rim color for this fill, or null: explicit, or automatic when the background is dark. */
  const rimFor = (base: string): string | null => {
    if (light.rim === false) return null;
    if (typeof light.rim === 'string') return light.rim;
    const [r, g, b] = haze ? parseColor(haze) : [255, 255, 255];
    const dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 70;
    return light.rim === true || dark ? mixColor(mixColor(base, '#FFFFFF', 0.5), light.color, 0.4) : null;
  };

  /**
   * Fills one screen-space path in the house look, lit by the scene light: an optional lift
   * shadow, base (or a top-to-bottom gradient), texture, a volume sweep from the lit side, the
   * shade band on the far side, a highlight on the lit side, a rim edge on dark backgrounds,
   * the material's specular, and the outline. Far parallax layers fade toward the background.
   */
  const paint = (path: Path, color: string, style: ShapeStyle = {}, u = 1) => {
    const xs = path.points.map(([x]) => x);
    const ys = path.points.map(([, y]) => y);
    const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    const size = Math.min(box.x1 - box.x0, box.y1 - box.y0);
    const big = Math.max(box.x1 - box.x0, box.y1 - box.y0);
    const material = style.material ?? 'matte';
    const shade = (style.shade ?? 1) * light.strength;
    const offset = Math.max(0, Math.min(size * 0.16, 36)) * Math.min(1.4, shade);
    const far = parallax < 0.999 && haze ? Math.min(0.6, (1 - parallax) * 0.55) : 0;
    const tone = (value: string) => {
      const tinted = light.tint > 0 ? mixColor(value, light.color, light.tint) : value;
      return far > 0 && haze ? mixColor(tinted, haze, far) : tinted;
    };
    const base = tone(color);
    const alpha = groupAlpha * (style.alpha ?? 1) * (material === 'glass' ? 0.55 : 1);
    const lx = light.x;
    const ly = light.y;
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (style.lift && style.lift > 0) {
      // A soft shadow cast away from the light onto whatever is behind.
      const px = Math.min(40, style.lift * u);
      if (px > 0.5) {
        ctx.save();
        ctx.shadowColor = 'rgba(20,16,40,0.35)';
        ctx.shadowBlur = px * 1.6;
        ctx.shadowOffsetX = -lx * px;
        ctx.shadowOffsetY = -ly * px;
        ctx.beginPath();
        trace(path);
        ctx.fillStyle = base;
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.beginPath();
    trace(path);
    if (style.fillTo) {
      const gradient = ctx.createLinearGradient(0, box.y0, 0, box.y1);
      gradient.addColorStop(0, base);
      gradient.addColorStop(1, tone(style.fillTo));
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = base;
    }
    ctx.fill();
    const rim = big > 12 ? rimFor(base) : null;
    if (style.texture || (shade > 0 && big > 24) || offset > 0.6 || rim || material !== 'matte') {
      ctx.save();
      ctx.beginPath();
      trace(path);
      ctx.clip();
      ctx.globalAlpha = groupAlpha * (style.alpha ?? 1);
      if (style.texture) drawTexture(box, style.texture, base, u);
      const reach = Math.hypot(box.x1 - box.x0, box.y1 - box.y0) / 2;
      const litX = cx + lx * reach;
      const litY = cy + ly * reach;
      const darkX = cx - lx * reach;
      const darkY = cy - ly * reach;
      const [lr, lg, lb] = parseColor(light.color);
      if (shade > 0 && big > 24) {
        // A soft sweep from the lit side to the far side gives each shape volume.
        const sweep = ctx.createLinearGradient(litX, litY, darkX, darkY);
        const contrast = material === 'metal' ? 1.8 : material === 'glossy' || material === 'wet' ? 1.3 : 1;
        sweep.addColorStop(0, `rgba(${lr},${lg},${lb},${Math.min(0.5, 0.14 * shade * contrast)})`);
        sweep.addColorStop(0.5, 'rgba(255,255,255,0)');
        sweep.addColorStop(1, `rgba(20,16,40,${Math.min(0.5, 0.16 * shade * contrast)})`);
        ctx.fillStyle = sweep;
        ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      }
      if (material === 'metal' && big > 16) {
        // Brushed metal: alternating bright and dark bands across the light direction.
        const bands = ctx.createLinearGradient(litX, litY, darkX, darkY);
        [[0, 0.0], [0.18, 0.35], [0.32, 0], [0.55, 0.22], [0.7, 0], [1, 0]].forEach(([at, a]) => bands.addColorStop(at, `rgba(${lr},${lg},${lb},${a * Math.min(1.2, shade)})`));
        ctx.fillStyle = bands;
        ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      }
      if (offset > 0.6) {
        const k = offset * Math.SQRT2;
        // The path minus itself shifted toward the light is the band on the far side.
        ctx.beginPath();
        trace(path);
        trace(path, lx * k, ly * k);
        ctx.fillStyle = lit(base, 1 - 0.16 * Math.min(1.4, shade));
        ctx.fill('evenodd');
        const glint = Math.max(1, offset * 0.4) * Math.SQRT2;
        ctx.beginPath();
        trace(path);
        trace(path, -lx * glint, -ly * glint);
        ctx.fillStyle = mixColor(mixColor(base, '#FFFFFF', 0.16 * Math.min(1.4, shade)), light.color, 0.3);
        ctx.fill('evenodd');
      }
      if (rim) {
        // A thin bright edge on the shadow side separates shapes from a dark background.
        const k = Math.max(1.5, Math.min(5, big * 0.03)) * Math.SQRT2;
        ctx.beginPath();
        trace(path);
        trace(path, lx * k, ly * k);
        ctx.globalAlpha = groupAlpha * (style.alpha ?? 1) * 0.55;
        ctx.fillStyle = rim;
        ctx.fill('evenodd');
        ctx.globalAlpha = groupAlpha * (style.alpha ?? 1);
      }
      if ((material === 'glossy' || material === 'wet' || material === 'glass') && big > 16) {
        // Specular: a soft bright spot (glossy), a few small wet glints, or a glass streak, on the lit side.
        const spot = (x: number, y: number, r: number, a: number) => {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(255,255,255,${a})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        };
        const sx = cx + lx * reach * 0.45;
        const sy = cy + ly * reach * 0.45;
        if (material === 'glossy') spot(sx, sy, size * 0.3 + 2, 0.55);
        if (material === 'wet') {
          spot(sx, sy, size * 0.12 + 2, 0.7);
          spot(sx - ly * size * 0.25, sy + lx * size * 0.25, size * 0.07 + 1.5, 0.55);
          spot(cx + lx * reach * 0.2 + ly * size * 0.2, cy + ly * reach * 0.2 - lx * size * 0.2, size * 0.05 + 1.5, 0.45);
        }
        if (material === 'glass') {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(Math.atan2(ly, lx) + Math.PI / 2);
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.fillRect(-size * 0.06, -big, size * 0.12 + 1, big * 2);
          ctx.fillRect(size * 0.12, -big, size * 0.04 + 1, big * 2);
          ctx.restore();
        }
      }
      ctx.restore();
    }
    if (style.line !== false) {
      ctx.globalAlpha = groupAlpha * (style.alpha ?? 1);
      ctx.beginPath();
      trace(path);
      ctx.strokeStyle = style.line ? tone(style.line) : material === 'glass' ? mixColor(base, '#FFFFFF', 0.5) : lit(base, 0.55);
      ctx.lineWidth = style.lineWidth ?? 3;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.restore();
  };

  /**
   * A surface pattern over a screen box, inside the current clip. Spacing comes from meters, so
   * the pattern grows with the zoom; it fades in once its spacing is a few pixels and is skipped
   * when it would be denser than that, which makes it a natural level of detail.
   */
  const drawTexture = (box: { x0: number; y0: number; x1: number; y1: number }, texture: TextureStyle, base: string, u: number) => {
    let gap = texture.size * u;
    if (!(gap > 3)) return;
    const strength = Math.min(1, (gap - 3) / 6) * (texture.alpha ?? 0.35);
    if (strength <= 0.01) return;
    const w = box.x1 - box.x0;
    const h = box.y1 - box.y0;
    // Huge areas get a coarser pattern instead of thousands of marks.
    const marks = (w * h) / (gap * gap);
    if (marks > 1600) gap *= Math.sqrt(marks / 1600);
    const seed = texture.seed ?? 1;
    const color = texture.color ?? lit(base, 0.72);
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    const half = Math.hypot(w, h) / 2 + gap;
    const rows = Math.ceil((half * 2) / gap);
    ctx.save();
    ctx.globalAlpha = groupAlpha * strength;
    ctx.translate(cx, cy);
    ctx.rotate(-(texture.angle ?? 0));
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.beginPath();
    switch (texture.kind) {
      case 'stripes':
      case 'hatch':
        ctx.lineWidth = Math.max(1, gap * 0.22);
        for (let i = 0; i <= rows; i += 1) {
          const y = -half + i * gap;
          ctx.moveTo(-half, y);
          ctx.lineTo(half, y);
          if (texture.kind === 'hatch') {
            ctx.moveTo(y, -half);
            ctx.lineTo(y, half);
          }
        }
        ctx.stroke();
        break;
      case 'muscle':
      case 'grain':
      case 'waves': {
        // Long wavy lines: muscle fibers run in parallel, wood grain wanders, water ripples in short arcs.
        const wobble = texture.kind === 'grain' ? 0.35 : texture.kind === 'waves' ? 0.3 : 0.18;
        ctx.lineWidth = Math.max(1, gap * (texture.kind === 'muscle' ? 0.16 : 0.12));
        for (let i = 0; i <= rows; i += 1) {
          const y0 = -half + (i + (texture.kind === 'grain' ? (hash(i, seed) - 0.5) * 0.6 : 0)) * gap;
          const phase = hash(i, seed + 3) * Math.PI * 2;
          const period = gap * (texture.kind === 'waves' ? 2.2 : 5 + 4 * hash(i, seed + 5));
          if (texture.kind === 'waves') {
            for (let x = -half + (i % 2) * period * 0.5; x < half; x += period) {
              ctx.moveTo(x, y0);
              ctx.quadraticCurveTo(x + period * 0.25, y0 - gap * wobble, x + period * 0.5, y0);
            }
            continue;
          }
          for (let x = -half; x <= half; x += gap * 0.8) {
            const y = y0 + Math.sin(x / period * Math.PI * 2 + phase) * gap * wobble;
            if (x === -half) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        break;
      }
      case 'dots':
      case 'cells':
        ctx.lineWidth = Math.max(1, gap * 0.08);
        for (let i = 0; i <= rows; i += 1) {
          for (let j = 0; j <= rows; j += 1) {
            const x = -half + (j + (i % 2) * 0.5 + (hash(i * 131 + j, seed) - 0.5) * 0.3) * gap;
            const y = -half + (i + (hash(i * 131 + j, seed + 1) - 0.5) * 0.3) * gap;
            const r = gap * (texture.kind === 'cells' ? 0.4 : 0.14 + 0.08 * hash(i * 131 + j, seed + 2));
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, Math.PI * 2);
          }
        }
        if (texture.kind === 'cells') ctx.stroke();
        else ctx.fill();
        break;
      case 'speckle': {
        const count = Math.min(2400, Math.round(rows * rows));
        const light = lit(base, 1.18);
        for (let pass = 0; pass < 2; pass += 1) {
          ctx.beginPath();
          ctx.fillStyle = pass ? light : color;
          for (let k = pass; k < count; k += 2) {
            const x = -half + hash(k, seed) * half * 2;
            const y = -half + hash(k, seed + 7) * half * 2;
            const r = gap * (0.06 + 0.14 * hash(k, seed + 9));
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, Math.PI * 2);
          }
          ctx.fill();
        }
        break;
      }
      case 'bricks':
      case 'tiles':
        ctx.lineWidth = Math.max(1, gap * 0.08);
        for (let i = 0; i <= rows; i += 1) {
          const y = -half + i * gap;
          ctx.moveTo(-half, y);
          ctx.lineTo(half, y);
          const step = texture.kind === 'bricks' ? gap * 2 : gap;
          for (let x = -half + (texture.kind === 'bricks' && i % 2 ? gap : 0); x <= half; x += step) {
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + gap);
          }
        }
        ctx.stroke();
        break;
      case 'scales':
        ctx.lineWidth = Math.max(1, gap * 0.1);
        for (let i = 0; i <= rows; i += 1) {
          for (let j = 0; j <= rows; j += 1) {
            const x = -half + (j + (i % 2) * 0.5) * gap;
            const y = -half + i * gap * 0.6;
            ctx.moveTo(x - gap / 2, y);
            ctx.arc(x, y, gap / 2, Math.PI, 0, true);
          }
        }
        ctx.stroke();
        break;
    }
    ctx.restore();
  };

  /** Strokes a screen path as a pipe: darker wall, body, and a thin highlight. */
  const strokeTube = (screenPoints: Vec2[], px: number, color: string, wall: string | false | undefined, alpha: number) => {
    const body = parallax < 0.999 && haze ? mixColor(color, haze, Math.min(0.6, (1 - parallax) * 0.55)) : color;
    const stroke = (style: string, lineWidth: number, k = 1) => {
      ctx.beginPath();
      screenPoints.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = style;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = groupAlpha * alpha * k;
      ctx.stroke();
    };
    ctx.save();
    if (wall !== false) stroke(wall ?? lit(body, 0.55), px + Math.max(3, px * 0.18));
    stroke(body, px);
    stroke(lit(body, 0.82), Math.max(1, px * 0.3), 0.5);
    stroke(lit(body, 1.3), Math.max(1, px * 0.18), 0.6);
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

    /**
     * Sets the scene light for everything drawn after it: where it comes from, its color, and
     * how hard it is. Call it once at the start of a place or close-up, and drive it with states
     * (night falls, a volcano glows red from below).
     */
    light(options: LightOptions = {}) {
      const dir = options.dir ?? Math.PI * 0.75;
      // World y is up, screen y is down.
      light = {
        x: Math.cos(dir),
        y: -Math.sin(dir),
        color: options.color ?? '#FFFFFF',
        tint: options.color && options.color.toUpperCase() !== '#FFFFFF' ? 0.12 * (options.strength ?? 1) : 0,
        strength: Math.max(0, Math.min(1.6, options.strength ?? 1)),
        rim: options.rim ?? null,
      };
    },

    /** Fills the whole frame with a vertical gradient (sky, wall). Call first. */
    background(top: string, bottom = top) {
      haze = mixColor(top, bottom, 0.5);
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
      paint({ points: project(roundRectPoints(x, y, w, h, style.r ?? 0)), smooth: false }, color, style, unit());
    },

    circle(x: number, y: number, r: number, color: string, style: ShapeStyle = {}) {
      paint({ points: project(ellipsePoints(x, y, r, r)), smooth: false }, color, style, unit());
    },

    ellipse(x: number, y: number, rx: number, ry: number, color: string, style: ShapeStyle = {}) {
      paint({ points: project(ellipsePoints(x, y, rx, ry)), smooth: false }, color, style, unit());
    },

    /** Closed polygon through [[x, y], ...]; style.smooth turns it into a soft curved blob. */
    poly(points: Vec2[], color: string, style: ShapeStyle = {}) {
      paint({ points: project(points), smooth: !!style.smooth }, color, style, unit());
    },

    /** Thick segment with round ends from (x1, y1) to (x2, y2), w meters thick: handles, pipes, branches, limbs. */
    capsule(x1: number, y1: number, x2: number, y2: number, w: number, color: string, style: ShapeStyle = {}) {
      paint({ points: project(capsulePoints(x1, y1, x2, y2, w)), smooth: false }, color, style, unit());
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
      strokeTube(project(path.points), Math.max(1.5, w * unit()), color, options.wall, options.alpha ?? 1);
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
        drawParticle(kind, sx, sy, px, angle, options.colorTo ? mixColor(color, options.colorTo, particle.progress) : color);
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

    /**
     * Fine detail that appears as the camera comes close: fn fades in once something size
     * meters big covers about 6 to 14 pixels. Screws, fibers, small vessels, leaf veins, labels
     * on a chip: draw them inside s.detail so the wide shot stays clean and the close shot rich.
     */
    detail(size: number, fn: () => void) {
      const k = Math.max(0, Math.min(1, (size * unit() - 6) / 8));
      if (k > 0) s.fade(k, fn);
    },

    /**
     * A branching structure from (x, y): blood vessels, bronchi, roots, a tree, a river delta,
     * lightning, nerves. Each level splits in two, shorter and thinner. Returns the tip points
     * (for leaves, alveoli, or drops). Pure: the same seed draws the same shape.
     */
    branch(x: number, y: number, options: BranchOptions): Vec2[] {
      const depth = Math.max(1, Math.min(7, Math.round(options.depth ?? 4)));
      const spread = options.spread ?? 0.7;
      const ratio = options.ratio ?? 0.72;
      const taper = options.taper ?? 0.65;
      const seed = options.seed ?? 1;
      const segments: { a: Vec2; b: Vec2; w: number }[] = [];
      const tips: Vec2[] = [];
      const grow = (from: Vec2, angle: number, length: number, w: number, level: number, id: number) => {
        const sway = (options.sway ?? 0) * Math.sin((options.t ?? 0) * 1.3 + level * 0.9 + id * 0.37) * (level + 1) / depth;
        const bend = angle + sway + (hash(id, seed) - 0.5) * spread * 0.4;
        const to: Vec2 = [from[0] + Math.cos(bend) * length, from[1] + Math.sin(bend) * length];
        segments.push({ a: from, b: to, w });
        if (level + 1 >= depth) {
          tips.push(to);
          return;
        }
        const jitter = (hash(id, seed + 11) - 0.5) * 0.3;
        grow(to, bend + spread / 2 + jitter, length * ratio * (0.85 + 0.3 * hash(id * 2, seed)), w * taper, level + 1, id * 2);
        grow(to, bend - spread / 2 + jitter, length * ratio * (0.85 + 0.3 * hash(id * 2 + 1, seed)), w * taper, level + 1, id * 2 + 1);
      };
      grow([x, y], options.angle ?? Math.PI / 2, options.length, options.width, 0, 1);
      const color = parallax < 0.999 && haze ? mixColor(options.color, haze, Math.min(0.6, (1 - parallax) * 0.55)) : options.color;
      const u = unit();
      ctx.save();
      ctx.globalAlpha = groupAlpha * (options.alpha ?? 1);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pass = (style: string, extra: number) => {
        ctx.strokeStyle = style;
        for (const segment of segments) {
          const [ax, ay] = P(segment.a[0], segment.a[1]);
          const [bx, by] = P(segment.b[0], segment.b[1]);
          ctx.lineWidth = Math.max(1, segment.w * u) + extra;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      };
      if (options.line !== false) pass(options.line ?? lit(color, 0.55), Math.max(2, options.width * u * 0.12));
      pass(color, 0);
      ctx.restore();
      return tips;
    },

    /**
     * A serpentine coil between two points, w meters thick: condenser and evaporator coils,
     * heating elements, springs, a radiator pipe, intestines. turns full waves, amplitude meters to each side.
     */
    coil(x1: number, y1: number, x2: number, y2: number, options: { turns?: number; amplitude: number; w: number; color: string; wall?: string | false; alpha?: number }) {
      const turns = Math.max(1, Math.min(40, options.turns ?? 6));
      const length = Math.hypot(x2 - x1, y2 - y1) || 1;
      const nx = -(y2 - y1) / length;
      const ny = (x2 - x1) / length;
      const steps = Math.ceil(turns * 24);
      const points: Vec2[] = [];
      for (let i = 0; i <= steps; i += 1) {
        const k = i / steps;
        const wave = Math.sin(k * turns * Math.PI * 2) * options.amplitude;
        points.push([x1 + (x2 - x1) * k + nx * wave, y1 + (y2 - y1) * k + ny * wave]);
      }
      strokeTube(project(points), Math.max(1.5, options.w * unit()), options.color, options.wall, options.alpha ?? 1);
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
      // A faint vignette pulls the eye to the middle of the frame, like a finished illustration.
      const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.45, width / 2, height / 2, Math.hypot(width, height) * 0.6);
      vignette.addColorStop(0, 'rgba(20,16,40,0)');
      vignette.addColorStop(1, 'rgba(20,16,40,0.18)');
      ctx.save();
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
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
