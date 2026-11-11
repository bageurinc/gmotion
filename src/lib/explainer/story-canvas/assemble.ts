import type { CameraKey2D, StoryActor, StoryCastMember, StoryStates, StoryWorldScene } from '@/motion-kit/story-canvas';
import { rigSolve } from '@/motion-kit/story-canvas/rig';
import type { Storyboard, WordTiming } from '@/types/studio';
import { contrastRatio } from '@/lib/pipeline/anti-slop';
import type { FrameSize, SceneTiming } from '../iso-canvas/assemble';
import { objectFunctionName } from '../iso-canvas/prompts';
import type { StoryCanvasBeat, StoryCanvasPlan, StoryCanvasProp } from './plan';
import type { PropMap } from './dry-run';
import { pointAt, samplePath } from '@/motion-kit/story-canvas/motion';

const MOVE_SECONDS = 1.1;

/**
 * Where people and props may sit in the frame, as shares of its height. In a portrait frame the
 * top panel ends near 29% and the AI caption box starts near 62%, so whole people must fit in
 * between; the isometric band (down to 81%) put feet and beds under the captions.
 */
export function viewBand(frame: FrameSize): { center: number; height: number } {
  const ratio = frame.width / frame.height;
  if (ratio < 0.7) return { center: 0.465, height: 0.31 };
  // Landscape and 4:5: the panel ends near 25% and captions (at most 20% of the height) sit
  // above the bottom inset, so content stays roughly between 27% and 67%.
  if (ratio >= 1.2) return { center: 0.47, height: 0.38 };
  return { center: 0.47, height: 0.34 };
}
const PUSH = 1.1;

export const propFunctionName = objectFunctionName;
export const propMapName = (id: string) => `${objectFunctionName(id)}Map`;
export const placeFunctionName = (id: string) => `place${id.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('')}`;

/** The cast as the engine reads it: nulls from the plan become absent options. */
export function castMembers(plan: StoryCanvasPlan): Record<string, StoryCastMember> {
  return Object.fromEntries(plan.cast.map((member) => {
    const { id: _id, label: _label, ...look } = member;
    void _id;
    void _label;
    const clean = Object.fromEntries(Object.entries(look).filter(([, value]) => value !== null && value !== undefined));
    return [member.id, clean as unknown as StoryCastMember];
  }));
}

type Box = { x0: number; x1: number; y0: number; y1: number };
const grow = (box: Box | null, next: Box): Box => (box ? { x0: Math.min(box.x0, next.x0), x1: Math.max(box.x1, next.x1), y0: Math.min(box.y0, next.y0), y1: Math.max(box.y1, next.y1) } : next);

/** Hips height of a seated person, so a seat of height s puts the feet at s minus this. */
const seatedHips = (height: number) => -rigSolve(height, { pose: 'sit' }).pelvisY;

/**
 * Where an actor really stands: on a seat or bed the engine places the hips on its surface,
 * so a plan never has to know skeleton sizes.
 */
export function placeActor(actor: StoryCanvasBeat['actors'][number], member: StoryCastMember, props: Map<string, StoryCanvasProp>): { x: number; y: number } {
  const seat = actor.on ? props.get(actor.on) : undefined;
  if (!seat?.surface) return { x: actor.x, y: 0 };
  const lying = actor.pose === 'lie' || actor.poseTo === 'lie';
  if (lying) return { x: seat.at[0], y: seat.at[1] + seat.surface };
  return { x: seat.at[0] - actor.facing * 0.1 * member.height, y: seat.at[1] + seat.surface - seatedHips(member.height) };
}

/** The world box a person covers in a pose, for framing. */
function actorBox(actor: StoryActor, member: StoryCastMember): Box {
  const h = member.height;
  const xs = [actor.x, actor.walkTo ?? actor.x];
  const lying = actor.pose === 'lie' || actor.poseTo === 'lie';
  const reach = lying ? 0.55 * h : actor.pose === 'bend' || actor.poseTo === 'bend' ? 0.45 * h : 0.22 * h;
  return { x0: Math.min(...xs) - reach, x1: Math.max(...xs) + reach, y0: actor.y, y1: actor.y + (lying ? 0.3 * h : h) };
}

/** Zoom that fits a box into the free band between the panel and the captions. */
export function fitStoryZoom(box: Box, frame: FrameSize): number {
  const band = viewBand(frame);
  // Margins scale with the subject, because a heart and a volcano share this framing.
  const size = Math.max(box.x1 - box.x0, box.y1 - box.y0, 1e-4);
  const width = box.x1 - box.x0 + size * 0.15;
  const height = box.y1 - box.y0 + size * 0.12;
  return Math.max(1e-4, Math.min(1e7, (frame.width * 0.92) / width, (frame.height * band.height) / height));
}

/** Scene start and length in seconds, taken from the audio-timed storyboard. */
export function storySceneTimings(storyboard: Storyboard): SceneTiming[] {
  let from = 0;
  return storyboard.scenes.map((scene) => {
    const timing = { start: from / storyboard.fps, duration: scene.durationInFrames / storyboard.fps };
    from += scene.durationInFrames;
    return timing;
  });
}

type Shot = { look: [number, number]; zoom: number; place: string };

/**
 * Shots as data: the camera frames the people of the beat together with the focused prop,
 * arrives from the previous shot within the same place (a new place is a cut), and holds
 * with a slow push. Prop states carry over between scenes. Detail beats return null.
 */
/** Maps keyed by export name (drawJantungMap) turned into maps keyed by prop id. */
export function mapsByProp(plan: StoryCanvasPlan, maps: Record<string, PropMap>): Record<string, PropMap> {
  return Object.fromEntries(plan.props.flatMap((prop) => (maps[propMapName(prop.id)] ? [[prop.id, maps[propMapName(prop.id)]]] : [])));
}

const centerOf = (box: Box): [number, number] => [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
const scaleBox = (box: Box, k: number): Box => {
  const [cx, cy] = centerOf(box);
  const w = ((box.x1 - box.x0) / 2) * k;
  const h = ((box.y1 - box.y0) / 2) * k;
  return { x0: cx - w, x1: cx + w, y0: cy - h, y1: cy + h };
};
const propBox = (prop: StoryCanvasProp): Box => ({ x0: prop.at[0] - prop.size[0] / 2, x1: prop.at[0] + prop.size[0] / 2, y0: prop.at[1], y1: prop.at[1] + prop.size[1] });

/**
 * Shots as data. The camera frames the beat's people with its focus: a whole prop, one of its
 * parts (from the map the prop's writer exported), or a ride along one of its flows. It travels
 * from the previous shot within a place, cuts between places and after close-ups, and pushes
 * into the focus just before a close-up so the cut feels like zooming in.
 */
const plainWord = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Seconds into the scene when a word of the line is spoken, from the TTS word timings. Matches
 * the first word of the cue, allowing affixes ("pompa" finds "memompa"), or null when absent.
 */
export function wordTime(cue: string | null | undefined, words: WordTiming[] | undefined): number | null {
  if (!cue || !words?.length) return null;
  const token = plainWord(cue.split(/\s+/)[0] ?? '');
  if (token.length < 2) return null;
  const spoken = words.map((word) => plainWord(word.word));
  let index = spoken.findIndex((word) => word === token);
  if (index < 0) index = spoken.findIndex((word) => token.length >= 4 && (word.includes(token) || (word.length >= 4 && token.includes(word))));
  // Indonesian prefixes swallow the first consonant: pompa → memompa, tarik → menarik, sedot → menyedot.
  if (index < 0 && token.length >= 5 && /^[ptks]/.test(token)) index = spoken.findIndex((word) => /^(me|pe)/.test(word) && word.includes(token.slice(1)));
  return index < 0 ? null : words[index].startMs / 1000;
}

export function buildStoryScenes(plan: StoryCanvasPlan, timings: SceneTiming[], frame: FrameSize, maps: Record<string, PropMap> = {}, words: WordTiming[][] = []): Array<StoryWorldScene | null> {
  const props = new Map(plan.props.map((prop) => [prop.id, prop]));
  const places = new Map(plan.places.map((place) => [place.id, place]));
  const details = new Set(plan.details.map((detail) => detail.id));
  const cast = castMembers(plan);
  const band = viewBand(frame);
  const states: StoryStates = Object.fromEntries([...plan.props, ...plan.places].map((item) => [item.id, Object.fromEntries((item.states ?? []).map((state) => [state.key, 0]))]));
  let previous: Shot | null = null;

  return plan.beats.map((beat, index) => {
    const timing = timings[index];
    if (beat.focus && details.has(beat.focus)) {
      for (const change of beat.set) states[change.prop][change.key] = change.value;
      // Coming back from a close-up is a cut, not a pan from the old shot.
      previous = null;
      return null;
    }
    const d = timing.duration;
    // The camera arrives on the cue word when the plan names one the narrator really says.
    const cueAt = wordTime(beat.cue, words[index]);
    const arrive = cueAt !== null ? Math.min(Math.max(0.35, cueAt), Math.max(0.35, d - 0.4)) : Math.min(MOVE_SECONDS, d * 0.4);
    const poseFrom = Math.min(arrive, d * 0.3);
    const actors: StoryActor[] = beat.actors.flatMap((actor) => {
      const member = cast[actor.cast];
      if (!member) return [];
      const at = placeActor(actor, member, props);
      const walkFrom = Math.min(0.25, d * 0.1);
      return [{
        cast: actor.cast,
        x: at.x,
        y: at.y,
        facing: actor.facing,
        pose: actor.pose,
        ...(actor.poseTo && actor.poseTo !== actor.pose ? { poseTo: actor.poseTo } : {}),
        poseFrom,
        poseUntil: poseFrom + Math.min(0.9, d * 0.4),
        ...(typeof actor.walkTo === 'number' && !actor.on ? { walkTo: actor.walkTo } : {}),
        walkFrom,
        walkUntil: Math.max(walkFrom + 0.6, d * 0.8),
        ...(actor.face ? { face: actor.face } : {}),
        ...(actor.hold ? { hold: actor.hold } : {}),
      }];
    });

    let box: Box | null = null;
    actors.forEach((actor) => {
      box = grow(box, actorBox(actor, cast[actor.cast]));
    });
    const focusProp = beat.focus ? props.get(beat.focus) : undefined;
    const map = focusProp ? maps[focusProp.id] : undefined;
    const rawPart = beat.part && map?.parts?.[beat.part];
    const partBox: Box | null = focusProp && rawPart
      ? { x0: focusProp.at[0] + rawPart.at[0] - rawPart.size[0] / 2, x1: focusProp.at[0] + rawPart.at[0] + rawPart.size[0] / 2, y0: focusProp.at[1] + rawPart.at[1] - rawPart.size[1] / 2, y1: focusProp.at[1] + rawPart.at[1] + rawPart.size[1] / 2 }
      : null;
    const rawFlow = beat.flow && map?.flows?.[beat.flow];
    const flowPath = focusProp && rawFlow && rawFlow.length >= 2 ? samplePath(rawFlow.map(([x, y]) => [focusProp.at[0] + x, focusProp.at[1] + y] as [number, number])) : null;
    const shot = beat.shot ?? (partBox ? 'close' : 'wide');
    const wholeBox: Box | null = focusProp ? (box ? grow(box, propBox(focusProp)) : propBox(focusProp)) : box;
    // People are framed whole unless the shot moves in on a part of a prop (a phone in a hand).
    const keepPeople = !focusProp || shot === 'wide';
    if (focusProp) {
      // A part shot frames the part (close) or the part with its surroundings (medium); people stay in when they are close by.
      const core = partBox ?? propBox(focusProp);
      // Close keeps a ring of context so the part reads in place; medium shows its neighbours.
      if (shot === 'close') box = partBox ? scaleBox(partBox, 1.7) : scaleBox(propBox(focusProp), 0.75);
      else if (shot === 'medium') {
        // Medium sits between close and wide: never wider than most of the prop itself.
        const whole = propBox(focusProp);
        const limit = Math.max(whole.x1 - whole.x0, whole.y1 - whole.y0) * 0.8;
        let near = scaleBox(core, partBox ? 2.2 : 1);
        const size = Math.max(near.x1 - near.x0, near.y1 - near.y0);
        if (partBox && size > limit) near = scaleBox(near, limit / size);
        box = box ? grow(near, box) : near;
      }
      else box = wholeBox;
    }
    const place = places.get(beat.place);
    if (!box) {
      // A wide shot: every prop of the place, or the place itself when it has none.
      plan.props.filter((prop) => prop.place === beat.place).forEach((prop) => {
        box = grow(box, { x0: prop.at[0] - prop.size[0] / 2, x1: prop.at[0] + prop.size[0] / 2, y0: prop.at[1], y1: prop.at[1] + prop.size[1] });
      });
    }
    if (!box) {
      const width = place?.width ?? 4;
      box = { x0: 0, x1: width, y0: 0, y1: width * 0.5 };
    }
    const framed = box as Box;
    const target: Shot = { look: centerOf(framed), zoom: fitStoryZoom(framed, frame), place: beat.place };
    const move = beat.move ?? 'push';
    const next = plan.beats[index + 1];
    const intoCloseUp = Boolean(next?.focus && details.has(next.focus) && d > 1.2);
    const from = move !== 'cut' && previous && previous.place === beat.place ? previous : null;
    let camera: CameraKey2D[];
    if (move === 'follow' && flowPath && flowPath.total > 0) {
      // Ride the flow at an even speed: glide keys sampled along the path, framed around the part or a slice of the path.
      // Wide enough to keep the prop readable around the ride: most of the path's extent, at
      // least half the prop, never tighter than a close shot of the part.
      const xs = flowPath.points.map(([x]) => x);
      const ys = flowPath.points.map(([, y]) => y);
      const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      const propSize = focusProp ? Math.max(focusProp.size[0], focusProp.size[1]) : 0;
      const partSize = partBox ? Math.max(partBox.x1 - partBox.x0, partBox.y1 - partBox.y0) : 0;
      const span = Math.max(extent * 0.75, propSize * 0.55, partSize * 2.2, 1e-4);
      const zoom = fitStoryZoom({ x0: 0, x1: span, y0: 0, y1: span }, frame);
      const start = pointAt(flowPath, 0);
      const begin = Math.min(arrive, d * 0.25);
      // The ride finishes before the push into a following close-up starts.
      const end = Math.max(begin + 0.3, intoCloseUp ? d - 0.65 : d * 0.92);
      const steps = 8;
      camera = [{ at: 0, look: from ? from.look : [start.x, start.y], zoom: from ? from.zoom : zoom }, { at: from ? begin : 0.01, look: [start.x, start.y], zoom }];
      for (let i = 1; i <= steps; i += 1) {
        const point = pointAt(flowPath, (flowPath.total * i) / steps);
        camera.push({ at: begin + ((end - begin) * i) / steps, look: [point.x, point.y], zoom, glide: true });
      }
      const last = camera[camera.length - 1];
      camera.push({ at: d, look: last.look, zoom: zoom * 1.02 });
    } else if (move === 'pull') {
      const near = partBox ?? scaleBox(focusProp ? propBox(focusProp) : framed, 0.5);
      const wide = wholeBox ?? framed;
      camera = [
        { at: 0, look: centerOf(near), zoom: fitStoryZoom(near, frame) },
        { at: Math.min(0.4, d * 0.15), look: centerOf(near), zoom: fitStoryZoom(near, frame) },
        { at: d * 0.85, look: centerOf(wide), zoom: fitStoryZoom(wide, frame) },
        { at: d, look: centerOf(wide), zoom: fitStoryZoom(wide, frame) * 1.02 },
      ];
    } else {
      camera = [
        { at: 0, look: from ? from.look : target.look, zoom: from ? from.zoom : target.zoom },
        // A late cue holds the old shot, then travels in the usual time to land on the word.
        ...(from && arrive > MOVE_SECONDS + 0.05 ? [{ at: arrive - MOVE_SECONDS, look: from.look, zoom: from.zoom }] : []),
        { at: from ? arrive : 0.01, look: target.look, zoom: target.zoom },
        { at: d, look: target.look, zoom: target.zoom * PUSH },
      ];
    }
    // Before a close-up, push into the focus so the cut reads as zooming in.
    if (intoCloseUp) {
      const last = camera[camera.length - 1];
      const aim = partBox ? centerOf(partBox) : last.look;
      camera = camera.filter((key) => key.at < d - 0.6);
      camera.push({ at: d - 0.6, look: last.look, zoom: last.zoom }, { at: d, look: aim, zoom: last.zoom * 1.8 });
    }
    const end = camera[camera.length - 1];
    previous = { look: end.look, zoom: end.zoom, place: beat.place };

    const startStates: StoryStates = Object.fromEntries(Object.entries(states).map(([id, values]) => [id, { ...values }]));
    const changeFrom = Math.min(arrive, d * 0.3);
    const changes = beat.set.map((change) => {
      // A change named by a word starts as the word is spoken and settles quickly.
      const spoken = wordTime(change.word, words[index]);
      const from = spoken !== null ? Math.min(Math.max(0, spoken - 0.05), Math.max(0, d - 0.3)) : changeFrom;
      return { prop: change.prop, key: change.key, to: change.value, from, until: Math.min(d, from + (spoken !== null ? 0.9 : 1.2)) };
    });
    for (const change of beat.set) states[change.prop][change.key] = change.value;

    const focusActor = beat.focus ? actors.find((actor) => actor.cast === beat.focus) : undefined;
    const anchor: [number, number] | null = partBox
      ? [centerOf(partBox)[0], partBox.y1]
      : flowPath ? (() => {
        const middle = pointAt(flowPath, flowPath.total / 2);
        return [middle.x, middle.y] as [number, number];
      })()
      : focusProp
      ? [focusProp.at[0], focusProp.at[1] + focusProp.size[1]]
      : focusActor ? [focusActor.x, focusActor.y + cast[focusActor.cast].height * (focusActor.pose === 'lie' ? 0.3 : 1)] : null;
    // On a follow the label rides the flow with the camera; otherwise it sits on the focus.
    const riding = move === 'follow' && flowPath && focusProp && rawFlow ? rawFlow.map(([x, y]) => [focusProp.at[0] + x, focusProp.at[1] + y] as [number, number]) : null;
    const rideFrom = Math.min(arrive, d * 0.25);
    const rideTo = Math.max(rideFrom + 0.3, intoCloseUp ? d - 0.65 : d * 0.92);
    const labels = beat.label && anchor
      ? [{ at: anchor, text: beat.label, from: riding ? rideFrom : cueAt !== null ? arrive : Math.min(arrive, d * 0.5), to: d, color: plan.palette.accent, ...(riding ? { along: riding, travel: [rideFrom, rideTo] as [number, number] } : {}) }]
      : [];
    return {
      kind: 'world',
      start: timing.start,
      duration: d,
      place: beat.place,
      camera,
      anchorY: band.center,
      states: startStates,
      changes,
      props: plan.props.filter((prop) => prop.place === beat.place).map((prop) => ({ id: prop.id, x: prop.at[0], y: prop.at[1], ...(prop.front ? { front: true } : {}) })),
      actors,
      labels,
      ...(keepPeople && actors.length ? { keep: actors.map((actor) => actor.cast) } : {}),
    };
  });
}

const indent = (code: string, spaces: number) => code.split('\n').map((line) => (line.trim() ? ' '.repeat(spaces) + line : line)).join('\n');

export function assembleStoryProps(functions: string[]): string {
  return `import type { Story } from '@/motion-kit';\n\n${functions.map((code) => code.trim()).join('\n\n')}\n`;
}

export function assembleStoryPlaces(functions: string[]): string {
  return `import type { Story } from '@/motion-kit';\n\n${functions.map((code) => code.trim()).join('\n\n')}\n`;
}

/** StoryScenes.ts: the world registry, shots as JSON data, and close-ups as model-written arrow functions. */
export function assembleStoryScenes(plan: StoryCanvasPlan, worldScenes: Array<StoryWorldScene | null>, details: Array<{ start: number; duration: number; body: string } | null>): string {
  const propNames = plan.props.map((prop) => propFunctionName(prop.id));
  const placeNames = plan.places.map((place) => placeFunctionName(place.id));
  const items = worldScenes.map((scene, index) => {
    if (scene) return indent(JSON.stringify(scene, null, 2), 2);
    const detail = details[index];
    if (!detail) throw new Error(`Scene ${index + 1} has neither shot data nor a close-up drawing`);
    return `  {\n    kind: 'detail',\n    start: ${detail.start},\n    duration: ${detail.duration},\n    draw: (s: Story, t: number) => {\n${indent(detail.body.trim(), 6)}\n    },\n  }`;
  });
  const placesMap = plan.places.map((place) => `    ${JSON.stringify(place.id)}: ${placeFunctionName(place.id)},`).join('\n');
  const propsMap = plan.props.map((prop) => `    ${JSON.stringify(prop.id)}: ${propFunctionName(prop.id)},`).join('\n');
  return `import type { Story, StorySceneSpec, StoryWorld } from '@/motion-kit';
import { ${propNames.join(', ')} } from './StoryProps';
import { ${placeNames.join(', ')} } from './StoryPlaces';

export const world: StoryWorld = {
  places: {
${placesMap}
  },
  props: {
${propsMap}
  },
  cast: ${indent(JSON.stringify(castMembers(plan), null, 2), 2).trim()},
};

export const scenes: StorySceneSpec[] = [
${items.join(',\n')},
];
`;
}

/** Beats for the shared overlay: panel, captions, audio, sound effects, and call to action. */
export function storyOverlayBeats(storyboard: Storyboard, plan: StoryCanvasPlan) {
  let from = 0;
  return storyboard.scenes.map((scene, index) => {
    const start = from;
    from += scene.durationInFrames;
    const beat = plan.beats[index];
    return {
      text: scene.voiceoverText,
      headline: beat.headline,
      accent: beat.accent,
      value: beat.value,
      status: beat.status,
      clock: beat.clock,
      focus: null,
      label: null,
      sticker: beat.sticker,
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

/** The composition both the preview and the export run; designs says which optional files exist. */
export function storyCanvasMainVideo(storyboard: Storyboard, plan: StoryCanvasPlan, titleFrames: number, designs: { title?: boolean; caption?: boolean; panel?: boolean } = {}): string {
  const script = { unit: plan.unit, palette: plan.palette, music: storyboard.bgmTrack, beats: storyOverlayBeats(storyboard, plan) };
  const title = Boolean(designs.title) && titleFrames > 0;
  const caption = Boolean(designs.caption);
  const panel = Boolean(designs.panel);
  return `import React from 'react';
import { StoryCanvasVideo } from '@/motion-kit';
import { scenes, world } from './StoryScenes';
${title ? "import { TitleCard } from './StoryTitle';\n" : ''}${caption ? "import { CaptionCard } from './StoryCaption';\n" : ''}${panel ? "import { PanelCard } from './StoryPanel';\n" : ''}
const script = ${JSON.stringify(script)};

export const MainVideo: React.FC = () => <StoryCanvasVideo scenes={scenes} world={world} script={script as never}${title ? ` title={TitleCard} titleFrames={${titleFrames}}` : ''}${caption ? ' caption={CaptionCard}' : ''}${panel ? ' panel={PanelCard}' : ''} />;

export default MainVideo;
`;
}
