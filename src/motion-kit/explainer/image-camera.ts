import { Easing, interpolate } from 'remotion';

export interface ImageBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageShot {
  from: number;
  pose: number;
  box: ImageBox | null;
  label: string | null;
}

export interface ImageCamera {
  x: number;
  y: number;
  scale: number;
}

const WHOLE_PICTURE: ImageCamera = { x: 0.5, y: 0.5, scale: 1 };
const TARGET_WIDTH = 0.62;
const TARGET_HEIGHT = 0.3;
const MIN_FOCUS_SCALE = 1.2;
const MAX_FOCUS_SCALE = 2.2;
const MOVE_FRAMES = 22;
const DRIFT_PER_SECOND = 0.006;
const EASE = Easing.bezier(0.6, 0, 0.15, 1);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function cameraForShot(shot: ImageShot): ImageCamera {
  if (!shot.box) return WHOLE_PICTURE;
  const { x, y, w, h } = shot.box;
  return {
    x: x + w / 2,
    y: y + h / 2,
    scale: clamp(Math.min(TARGET_WIDTH / w, TARGET_HEIGHT / h), MIN_FOCUS_SCALE, MAX_FOCUS_SCALE),
  };
}

export function activeShot(frame: number, shots: ImageShot[]): ImageShot {
  return shots.findLast((shot) => frame >= shot.from) ?? shots[0];
}

/** Eases between shots and keeps drifting, so even a held shot is never frozen. */
export function imageCameraAt(frame: number, shots: ImageShot[], fps: number): ImageCamera {
  let camera = cameraForShot(shots[0]);
  for (const shot of shots.slice(1)) {
    const progress = interpolate(frame, [shot.from, shot.from + MOVE_FRAMES], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASE,
    });
    const target = cameraForShot(shot);
    camera = {
      x: camera.x + (target.x - camera.x) * progress,
      y: camera.y + (target.y - camera.y) * progress,
      scale: camera.scale + (target.scale - camera.scale) * progress,
    };
  }
  return { ...camera, scale: camera.scale * (1 + DRIFT_PER_SECOND * (frame / fps)) };
}

/** Pixel offset that puts the camera target on screen without showing an image edge. */
export function imageOffset(camera: ImageCamera, width: number, height: number, centerY: number) {
  return {
    x: clamp(width * (0.5 - camera.x * camera.scale), width * (1 - camera.scale), 0),
    y: clamp(height * (centerY - camera.y * camera.scale), height * (1 - camera.scale), 0),
  };
}
