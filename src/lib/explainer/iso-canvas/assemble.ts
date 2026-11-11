import type { CameraKey, IsoStates, IsoWorldScene } from '@/motion-kit/iso-canvas';
import type { IsoVec3 } from '@/motion-kit/iso-canvas';
import type { Storyboard } from '@/types/studio';
import { contrastRatio } from '@/lib/pipeline/anti-slop';
import type { IsoCanvasObject, IsoCanvasPlan } from './plan';

const COS30 = Math.sqrt(3) / 2;
/**
 * The free band between the headline panel and the caption pill, as shares of the frame
 * height: where the camera target sits and how tall a focused object may be. In a portrait
 * frame the panel covers about the top 30% and the world may continue under the caption; in
 * a landscape frame the panel is thinner but the caption covers the lower fifth.
 */
export function viewBand(frame: FrameSize): { center: number; height: number } {
  const ratio = frame.width / frame.height;
  if (ratio >= 1.2) return { center: 0.5, height: 0.5 };
  if (ratio >= 0.7) return { center: 0.55, height: 0.42 };
  return { center: 0.58, height: 0.46 };
}
const MOVE_SECONDS = 1.1;
const PUSH = 1.08;

export interface FrameSize {
  width: number;
  height: number;
}

/** Centre of an object's bounding box in world units. */
export const objectCenter = (object: IsoCanvasObject): IsoVec3 => [object.at[0], object.at[1], object.at[2] + object.size[2] / 2];

/**
 * Zoom that fits a world box (size w, d, h) into the share of the frame left free by the panel
 * and captions. The projected width of a box is (w + d)·cos30 and its height (w + d)/2 + h.
 */
export function fitZoom(size: IsoVec3, frame: FrameSize, fill = 0.7): number {
  const [w, d, h] = size;
  const byWidth = (frame.width * fill) / Math.max(0.1, (w + d) * COS30);
  const byHeight = (frame.height * viewBand(frame).height * fill) / Math.max(0.1, (w + d) / 2 + h);
  return Math.max(4, Math.min(byWidth, byHeight));
}

/** Bounding box of every object, for wide shots. */
export function worldBox(objects: IsoCanvasObject[]): { center: IsoVec3; size: IsoVec3 } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const object of objects) {
    const low = [object.at[0] - object.size[0] / 2, object.at[1] - object.size[1] / 2, object.at[2]];
    const high = [object.at[0] + object.size[0] / 2, object.at[1] + object.size[1] / 2, object.at[2] + object.size[2]];
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], low[axis]);
      max[axis] = Math.max(max[axis], high[axis]);
    }
  }
  return {
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  };
}

export interface SceneTiming {
  start: number;
  duration: number;
}

/** Scene start and length in seconds, taken from the audio-timed storyboard. */
export function sceneTimings(storyboard: Storyboard): SceneTiming[] {
  let from = 0;
  return storyboard.scenes.map((scene) => {
    const timing = { start: from / storyboard.fps, duration: scene.durationInFrames / storyboard.fps };
    from += scene.durationInFrames;
    return timing;
  });
}

type Shot = { look: IsoVec3; zoom: number };

/**
 * World scenes as data: the camera arrives from where the previous shot ended, holds with a
 * slow push, object states carry over between scenes, and labels sit above the focus.
 * Detail beats return null and get their own drawing.
 */
export function buildWorldScenes(plan: IsoCanvasPlan, timings: SceneTiming[], frame: FrameSize): Array<IsoWorldScene | null> {
  const objects = new Map(plan.objects.map((object) => [object.id, object]));
  const details = new Set(plan.details.map((detail) => detail.id));
  const wide = worldBox(plan.objects);
  const wideShot: Shot = { look: wide.center, zoom: fitZoom(wide.size, frame, 0.85) };
  const shotFor = (focus: string | null): Shot => {
    const object = focus ? objects.get(focus) : undefined;
    return object ? { look: objectCenter(object), zoom: fitZoom(object.size, frame, 0.72) } : wideShot;
  };

  const states: IsoStates = Object.fromEntries(plan.objects.map((object) => [object.id, Object.fromEntries(object.states.map((state) => [state.key, 0]))]));
  let previous: Shot = wideShot;
  return plan.beats.map((beat, index) => {
    const timing = timings[index];
    if (beat.focus && details.has(beat.focus)) {
      // States still change during a close-up, so the world is right when the camera returns.
      for (const change of beat.set) states[change.object][change.key] = change.value;
      return null;
    }
    const fitted = shotFor(beat.focus);
    const target = { look: fitted.look, zoom: fitted.zoom * (beat.zoomScale ?? 1) };
    const arrive = Math.min(MOVE_SECONDS, timing.duration * 0.4);
    const camera: CameraKey[] = [
      { at: 0, look: previous.look, zoom: previous.zoom },
      { at: arrive, look: target.look, zoom: target.zoom },
      { at: timing.duration, look: target.look, zoom: target.zoom * PUSH },
    ];
    const startStates: IsoStates = Object.fromEntries(Object.entries(states).map(([id, values]) => [id, { ...values }]));
    const changeFrom = Math.min(arrive, timing.duration * 0.3);
    const changes = beat.set.map((change) => {
      // Revisions may time a change on its own (a walk, then the alarm when the walker arrives).
      const from = Math.min(Math.max(0, change.at ?? changeFrom), Math.max(0, timing.duration - 0.1));
      return { object: change.object, key: change.key, to: change.value, from, until: Math.min(timing.duration, from + (change.over ?? 1.2)) };
    });
    for (const change of beat.set) states[change.object][change.key] = change.value;
    const focus = beat.focus ? objects.get(beat.focus) : undefined;
    const labels = beat.label && focus
      ? [{ at: [focus.at[0], focus.at[1], focus.at[2] + focus.size[2]] as IsoVec3, text: beat.label, from: Math.min(arrive, timing.duration * 0.5), to: timing.duration, color: plan.palette.accent }]
      : [];
    previous = { look: target.look, zoom: target.zoom * PUSH };
    return { kind: 'world', start: timing.start, duration: timing.duration, camera, anchorY: viewBand(frame).center, states: startStates, changes, labels };
  });
}

/** Indents a block of model code so the assembled file stays readable in the code tab. */
const indent = (code: string, spaces: number) => code.split('\n').map((line) => (line.trim() ? ' '.repeat(spaces) + line : line)).join('\n');

/** IsoObjects.ts from one exported function per object. */
export function assembleObjects(functions: string[]): string {
  return `import type { Iso } from '@/motion-kit';\n\n${functions.map((code) => code.trim()).join('\n\n')}\n`;
}

/**
 * IsoScenes.ts: world scenes as JSON data, detail scenes as arrow functions written by the
 * model. Detail code is the body of `(iso, t) => { ... }` and may call object functions.
 */
export function assembleScenes(worldScenes: Array<IsoWorldScene | null>, details: Array<{ start: number; duration: number; body: string } | null>, objectNames: string[]): string {
  const items = worldScenes.map((scene, index) => {
    if (scene) return indent(JSON.stringify(scene, null, 2), 2);
    const detail = details[index];
    if (!detail) throw new Error(`Scene ${index + 1} has neither world data nor a detail drawing`);
    return `  {\n    kind: 'detail',\n    start: ${detail.start},\n    duration: ${detail.duration},\n    draw: (iso: Iso, t: number) => {\n${indent(detail.body.trim(), 6)}\n    },\n  }`;
  });
  const imports = objectNames.length ? `import { ${objectNames.join(', ')} } from './IsoObjects';\n` : '';
  return `import type { Iso, IsoSceneSpec } from '@/motion-kit';\n${imports}\nexport const scenes: IsoSceneSpec[] = [\n${items.join(',\n')},\n];\n`;
}

/** Beats for the shared overlay: panel, captions, audio, sound effects, and call to action. */
export function overlayBeats(storyboard: Storyboard, plan: IsoCanvasPlan) {
  let from = 0;
  return storyboard.scenes.map((scene, index) => {
    const start = from;
    from += scene.durationInFrames;
    // `set` and `zoomScale` only drive the canvas; the overlay reads the panel fields.
    const { set: _set, zoomScale: _zoomScale, ...beat } = plan.beats[index];
    void _set;
    void _zoomScale;
    return {
      ...beat,
      text: scene.voiceoverText,
      view: 'main',
      zoom: 1,
      from: start,
      duration: scene.durationInFrames,
      audio: scene.audioUrl ?? '',
      wordTimings: scene.wordTimings,
      sfx: scene.sfxCue,
      ...(scene.role === 'cta' && scene.kineticHeadline.trim()
        ? { cta: { text: scene.kineticHeadline.trim(), color: contrastRatio('#FFFFFF', plan.palette.accent) >= 4.5 ? '#FFFFFF' : plan.palette.ink } }
        : {}),
    };
  });
}

/** The composition both the preview and the export run. */
export function isoCanvasMainVideo(storyboard: Storyboard, plan: IsoCanvasPlan): string {
  const script = { unit: plan.unit, palette: plan.palette, music: storyboard.bgmTrack, beats: overlayBeats(storyboard, plan) };
  return `import React from 'react';
import { IsoCanvasVideo } from '@/motion-kit';
import { drawWorld } from './IsoWorld';
import { scenes } from './IsoScenes';

const script = ${JSON.stringify(script)};

export const MainVideo: React.FC = () => <IsoCanvasVideo scenes={scenes} drawWorld={drawWorld} script={script as never} />;

export default MainVideo;
`;
}
