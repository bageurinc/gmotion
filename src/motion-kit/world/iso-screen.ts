/** Layout for a product screen. Pure drawing, so it holds no topic knowledge and no WebGL. */
import type { Vec3 } from './iso-geometry';

export type IsoScreenFace = 'top' | 'left' | 'right';

export interface IsoScreenItem {
  kind: 'stat' | 'row' | 'button';
  text: string;
  value?: string | null;
}

export interface IsoScreenState {
  /** First frame this state shows. */
  from: number;
  title: string;
  items: IsoScreenItem[];
}

export interface IsoScreen {
  face: IsoScreenFace;
  background: string;
  ink: string;
  accent: string;
  states: IsoScreenState[];
}

const CANVAS_LONG_SIDE = 1024;
const SURFACE_GAP = 0.012;
const BEZEL_SHARE = 0.05;
const MIN_BEZEL = 0.06;
const FONT = '"Helvetica Neue", Arial, sans-serif';
const ITEM_HEIGHT: Record<IsoScreenItem['kind'], number> = { stat: 2.5, row: 1.2, button: 1.5 };

/** Where the screen sits on its solid, measured from the center of the solid's base. */
export function screenPlacement(size: Vec3, face: IsoScreenFace) {
  const [width, height, depth] = size;
  const [faceWidth, faceHeight] = face === 'top' ? [width, depth] : face === 'left' ? [width, height] : [depth, height];
  const bezel = Math.max(Math.min(faceWidth, faceHeight) * BEZEL_SHARE, MIN_BEZEL);
  const placements: Record<IsoScreenFace, { position: Vec3; rotation: Vec3 }> = {
    top: { position: [0, height + SURFACE_GAP, 0], rotation: [-Math.PI / 2, 0, 0] },
    left: { position: [0, height / 2, depth / 2 + SURFACE_GAP], rotation: [0, 0, 0] },
    right: { position: [width / 2 + SURFACE_GAP, height / 2, 0], rotation: [0, Math.PI / 2, 0] },
  };
  return {
    ...placements[face],
    width: Math.max(faceWidth - bezel * 2, 0.05),
    height: Math.max(faceHeight - bezel * 2, 0.05),
  };
}

export function canvasSize(width: number, height: number) {
  const scale = CANVAS_LONG_SIDE / Math.max(width, height);
  return { width: Math.max(Math.round(width * scale), 64), height: Math.max(Math.round(height * scale), 64) };
}

/** The latest state that has started. The first one also covers the frames before it. */
export function screenStateAt(states: IsoScreenState[], frame: number): number {
  return states.reduce((active, state, index) => (state.from <= frame ? index : active), 0);
}

function fitFont(context: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number) {
  context.font = `${weight} ${size}px ${FONT}`;
  const measured = context.measureText(text).width;
  const fitted = measured > maxWidth ? (size * maxWidth) / measured : size;
  context.font = `${weight} ${fitted}px ${FONT}`;
}

/** Black or white, whichever reads on the given color. */
function readableOn(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const luminance = ((value >> 16) * 0.299 + ((value >> 8) & 255) * 0.587 + (value & 255) * 0.114) / 255;
  return luminance > 0.58 ? '#111111' : '#FFFFFF';
}

export function drawScreen(context: CanvasRenderingContext2D, screen: IsoScreen, state: IsoScreenState, width: number, height: number) {
  const pad = Math.min(width, height) * 0.08;
  const inner = width - pad * 2;
  context.fillStyle = screen.background;
  context.fillRect(0, 0, width, height);
  context.textBaseline = 'middle';

  const titleSize = Math.min(height * 0.08, width * 0.13);
  context.fillStyle = screen.ink;
  context.textAlign = 'left';
  fitFont(context, state.title, 800, titleSize, inner);
  context.fillText(state.title, pad, pad + titleSize / 2);

  const top = pad + titleSize * 1.7;
  const units = state.items.reduce((total, item) => total + ITEM_HEIGHT[item.kind], 0);
  const unit = Math.min(height * 0.15, width * 0.2, (height - top - pad) / Math.max(units, 1));
  let y = top;
  for (const item of state.items) {
    const rowHeight = ITEM_HEIGHT[item.kind] * unit;
    const middle = y + rowHeight / 2;
    if (item.kind === 'stat') {
      context.textAlign = 'left';
      context.fillStyle = screen.ink;
      fitFont(context, item.text, 600, unit * 0.62, inner);
      context.fillText(item.text, pad, y + unit * 0.5);
      context.fillStyle = screen.accent;
      const value = item.value ?? '';
      fitFont(context, value, 800, unit * 1.45, inner);
      context.fillText(value, pad, y + unit * 1.55);
    } else if (item.kind === 'button') {
      const buttonHeight = rowHeight * 0.76;
      context.fillStyle = screen.accent;
      context.beginPath();
      context.roundRect(pad, middle - buttonHeight / 2, inner, buttonHeight, buttonHeight * 0.3);
      context.fill();
      context.fillStyle = readableOn(screen.accent);
      context.textAlign = 'center';
      fitFont(context, item.text, 800, unit * 0.68, inner * 0.9);
      context.fillText(item.text, width / 2, middle);
    } else {
      const value = item.value ?? '';
      context.fillStyle = screen.ink;
      context.textAlign = 'right';
      fitFont(context, value, 800, unit * 0.62, inner * 0.45);
      const valueWidth = value ? context.measureText(value).width + pad * 0.5 : 0;
      context.fillText(value, width - pad, middle);
      context.textAlign = 'left';
      fitFont(context, item.text, 500, unit * 0.62, inner - valueWidth);
      context.fillText(item.text, pad, middle);
      context.globalAlpha = 0.18;
      context.fillRect(pad, y + rowHeight - 2, inner, 3);
      context.globalAlpha = 1;
    }
    y += rowHeight;
  }
}
