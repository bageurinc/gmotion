import sharp from 'sharp';
import type { StoryWorldScene } from '@/motion-kit/story-canvas';
import { mapWithConcurrency } from '@/lib/pipeline/concurrency';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { AspectRatioDimensions, type StudioProject, type WordTiming } from '@/types/studio';
import { captionProblems, improve, isoQualityThreshold, panelProblems, titleProblems, type IsoCanvasReport, type IsoQualityItem } from '../iso-canvas/build';
import { isoTitleFrames, type FrameSize, type SceneTiming } from '../iso-canvas/assemble';
import { CAPTION_SYSTEM, captionRequest, PANEL_SYSTEM, panelRequest, TITLE_SYSTEM, titleRequest } from '../iso-canvas/prompts';
import { renderIsoSheet, withIsoBrowser, type IsoBrowser } from '../iso-canvas/render';
import {
  assembleStoryPlaces, assembleStoryProps, assembleStoryScenes, buildStoryScenes, castMembers, mapsByProp, placeFunctionName, propFunctionName, propMapName, storyCanvasMainVideo, storySceneTimings,
} from './assemble';
import { STORY_CAPTION_FILE, STORY_PANEL_FILE, STORY_TITLE_FILE } from './contract';
import { dryRunStoryCanvas, propMoves, readPropMaps, type PropMap } from './dry-run';
import { generateStoryCanvasPlan, type StoryCanvasBeat, type StoryCanvasDetail, type StoryCanvasPlace, type StoryCanvasPlan, type StoryCanvasProp } from './plan';
import { DETAIL_SYSTEM, detailRequest, PLACE_SYSTEM, placeRequest, PROP_SYSTEM, propRequest, storyCriticSystem } from './prompts';

const CONCURRENCY = 4;
const LABEL_FORBIDDEN = 'Do not call s.label here: labels are added by the scenes, timed to the narration.';
const callsLabel = (code: string) => /\bs\s*\.\s*label\s*\(/.test(code);

export interface StoryCanvasBuild {
  files: Record<string, string>;
  plan: StoryCanvasPlan;
  /** Where each prop's parts and flows are, by prop id, so shots can be rebuilt without redrawing. */
  maps: Record<string, PropMap>;
  report: IsoCanvasReport;
}

/** A plain stand-in when the model never wrote a runnable prop: honest, labelled in the report. */
export function fallbackProp(prop: StoryCanvasProp): string {
  const [w, h] = prop.size;
  return `export function ${propFunctionName(prop.id)}(s: Story, state: Record<string, number>, t: number) {
  void state;
  void t;
  s.rect(${-w / 2}, 0, ${w}, ${h}, '#94A3B8', { r: ${Math.min(w, h) * 0.12} });
}`;
}

export function fallbackPlace(plan: StoryCanvasPlan, place: StoryCanvasPlace): string {
  const wall = plan.look === 'dark' ? "'#2A3346', '#1E2535'" : "'#F6EFE6', '#EFE3D3'";
  return `export function ${placeFunctionName(place.id)}(s: Story, t: number, state: Record<string, number>) {
  void t;
  void state;
  s.background(${wall});
  s.ground('${plan.palette.ground}');
}`;
}

/** A beat with no people that frames one prop, or the place when focus is null. */
const probeBeat = (place: string, focus: string | null): StoryCanvasBeat => ({
  text: '', headline: '', accent: '', value: null, status: '', clock: null, sticker: null, place, focus, label: null, actors: [], set: [],
});

/** StoryScenes.ts for a probe: the given plan subset and one or more scenes. */
function probeFiles(plan: StoryCanvasPlan, props: string[], places: string[], scenes: StoryWorldScene[], details: Array<{ start: number; duration: number; body: string } | null> = []) {
  const items = scenes.length ? scenes : [null];
  return {
    'StoryProps.ts': assembleStoryProps(props),
    'StoryPlaces.ts': assembleStoryPlaces(places),
    'StoryScenes.ts': assembleStoryScenes(plan, items, details),
  };
}

function propProbe(plan: StoryCanvasPlan, prop: StoryCanvasProp, code: string, frame: FrameSize) {
  const place = plan.places.find((item) => item.id === prop.place) ?? plan.places[0];
  const subset: StoryCanvasPlan = { ...plan, props: [prop], places: [place], details: [], beats: [probeBeat(place.id, prop.id)] };
  const scenes = buildStoryScenes(subset, [{ start: 0, duration: 2 }], frame).filter((scene): scene is StoryWorldScene => Boolean(scene));
  return probeFiles(subset, [code], [fallbackPlace(plan, place)], scenes);
}

export function propProblems(plan: StoryCanvasPlan, prop: StoryCanvasProp, code: string, frame: FrameSize): string[] {
  const name = propFunctionName(prop.id);
  if (!new RegExp(`export\\s+function\\s+${name}\\s*\\(`).test(code)) return [`Export exactly: export function ${name}(s: Story, state: Record<string, number>, t: number).`];
  if (/^\s*import\s/m.test(code)) return ['Do not write imports; return only the function.'];
  if (callsLabel(code)) return [LABEL_FORBIDDEN];
  const runtime = dryRunStoryCanvas(propProbe(plan, prop, code, frame)).problems;
  if (runtime.length) return runtime;
  const map = mapProblems(prop, code);
  if (map.length) return map;
  return motionProblems(prop, code);
}

/** A prop that is alive, working, or carries flows must keep moving with its state held still. */
export function motionProblems(prop: StoryCanvasProp, code: string): string[] {
  if (!prop.moves && !prop.flows?.length) return [];
  const file = assembleStoryProps([code]);
  const name = propFunctionName(prop.id);
  const full = Object.fromEntries(prop.states.map((state) => [state.key, 1]));
  try {
    if (propMoves(file, name, {}) && propMoves(file, name, full)) return [];
  } catch (error) {
    return [`${name} threw while checking motion: ${String(error instanceof Error ? error.message : error).slice(0, 200)}`];
  }
  return [`${prop.label} must keep moving on its own: drawn at two moments with the same state, ${name} draws the same picture. Drive its idle motion and flows from t (s.beat, s.osc, s.flow speed above 0) in every state, including when all states are 0.`];
}

const finite = (values: unknown[]) => values.every((value) => typeof value === 'number' && Number.isFinite(value));

/**
 * The parts and flows the plan names must be exported where the drawing shows them, inside the
 * prop's box (with a quarter of slack for parts that stick out), so the camera can aim at them.
 */
export function mapProblems(prop: StoryCanvasProp, code: string): string[] {
  const parts = prop.parts ?? [];
  const flows = prop.flows ?? [];
  if (!parts.length && !flows.length) return [];
  const name = propMapName(prop.id);
  let map: PropMap | undefined;
  try {
    map = readPropMaps(assembleStoryProps([code]))[name];
  } catch (error) {
    return [`Reading ${name} failed: ${String(error instanceof Error ? error.message : error).slice(0, 200)}`];
  }
  const shape = `export const ${name} = { parts: { 'part-id': { at: [x, y], size: [w, h] } }, flows: { 'flow-id': [[x, y], [x, y], ...] } }`;
  if (!map) return [`Export the map of parts and flows after the function: ${shape}, in the prop's own coordinates (meters, base centre at 0, 0, y up).`];
  const [w, h] = prop.size;
  const inside = (x: number, y: number) => x >= -w * 0.75 && x <= w * 0.75 && y >= -h * 0.25 && y <= h * 1.25;
  const problems: string[] = [];
  for (const part of parts) {
    const found = map.parts?.[part.id];
    if (!found || !finite([...(found.at ?? []), ...(found.size ?? [])]) || found.at.length !== 2 || found.size.length !== 2) problems.push(`${name}.parts['${part.id}'] (${part.label}) is missing or not { at: [x, y], size: [w, h] } with numbers.`);
    else if (found.size[0] <= 0 || found.size[1] <= 0 || !inside(found.at[0], found.at[1])) problems.push(`${name}.parts['${part.id}'] must sit inside the prop (x within ±${(w / 2).toFixed(3)}, y within 0..${h.toFixed(3)}) with a positive size, where the drawing shows ${part.label}.`);
  }
  for (const flow of flows) {
    const path = map.flows?.[flow.id];
    if (!Array.isArray(path) || path.length < 2 || !path.every((point) => Array.isArray(point) && point.length === 2 && finite(point))) problems.push(`${name}.flows['${flow.id}'] (${flow.label}) is missing or not a list of at least two [x, y] points.`);
    else if (!path.every(([x, y]) => inside(x, y))) problems.push(`${name}.flows['${flow.id}'] must stay inside the prop, along the path the drawing shows for ${flow.label}.`);
  }
  return problems;
}

/** Preview.tsx for a prop sheet: state 0 at the start, every state at 1 later, as time runs. */
export function propPreview(prop: StoryCanvasProp, frame: FrameSize): string {
  const name = propFunctionName(prop.id);
  const [w, h] = prop.size;
  const zoom = Math.min((frame.width * 0.7) / Math.max(0.05, w), (frame.height * 0.4) / Math.max(0.05, h));
  const keys = JSON.stringify(prop.states.map((state) => state.key));
  return `import React from 'react';
import { StoryCanvasScene } from '@/motion-kit';
import { ${name} } from './StoryProps';

const keys: string[] = ${keys};
const levels = [0, 1, 1, 0.5];

export default function Preview() {
  return (
    <StoryCanvasScene
      draw={(s, t) => {
        const step = Math.min(3, Math.floor(t + 0.001));
        const state: Record<string, number> = {};
        keys.forEach((key) => { state[key] = levels[step]; });
        s.look(0, ${h / 2}, ${zoom}, s.width / 2, s.height * 0.55);
        s.background('#F1F5F9', '#E2E8F0');
        s.ground('#E2E8F0');
        ${name}(s, state, t);
      }}
    />
  );
}
`;
}

/** What every drawing task of one video shares. */
export interface StoryTaskContext {
  model: string;
  plan: StoryCanvasPlan;
  frame: FrameSize;
  topic: string;
  browser: IsoBrowser;
}

type ImproveOptions = Parameters<typeof improve>[0];

export function propTask(ctx: StoryTaskContext, prop: StoryCanvasProp, request = propRequest(ctx.plan, prop)): ImproveOptions {
  return {
    model: ctx.model,
    kind: 'prop',
    id: prop.id,
    label: prop.label,
    system: PROP_SYSTEM,
    criticSystem: storyCriticSystem('prop'),
    request,
    check: (code) => propProblems(ctx.plan, prop, code, ctx.frame),
    // Frames 3 and 4 are 0.2 s apart in the same state, so the critic can see whether the prop moves.
    render: (code) => renderIsoSheet(ctx.browser, { 'StoryProps.ts': assembleStoryProps([code]), 'Preview.tsx': propPreview(prop, ctx.frame) }, [0.2, 1.2, 2.2, 2.4, 3.2], ctx.frame),
    criticContext: `${ctx.topic}\nProp: ${prop.label}. ${prop.look}\nFrames go from state 0 to every state at 1: ${prop.states.map((state) => state.meaning).join('; ') || 'no states'}.${prop.moves || prop.flows?.length ? `\nThis prop moves on its own${prop.flows?.length ? ` and carries flows (${prop.flows.map((flow) => flow.label).join(', ')})` : ''}.` : '\nThis prop is a still object.'}`,
  };
}

/** Preview.tsx for a place: the sampled shots, each held near its end, with the real props and cast. */
export function placePreview(plan: StoryCanvasPlan, scenes: StoryWorldScene[], placeIds: string[]): string {
  const propNames = plan.props.map((prop) => propFunctionName(prop.id));
  const placeNames = placeIds.map(placeFunctionName);
  return `import React from 'react';
import { StoryCanvasScene, paintStoryScene } from '@/motion-kit';
import type { StorySceneSpec, StoryWorld } from '@/motion-kit';
import { ${propNames.join(', ')} } from './StoryProps';
import { ${placeNames.join(', ')} } from './StoryPlaces';

const world: StoryWorld = {
  places: { ${placeIds.map((id) => `${JSON.stringify(id)}: ${placeFunctionName(id)}`).join(', ')} },
  props: { ${plan.props.map((prop) => `${JSON.stringify(prop.id)}: ${propFunctionName(prop.id)}`).join(', ')} },
  cast: ${JSON.stringify(castMembers(plan))},
};
const scenes: StorySceneSpec[] = ${JSON.stringify(scenes)};

export default function Preview() {
  return (
    <StoryCanvasScene
      labelTop={0.31}
      draw={(s, t) => {
        const scene = scenes[Math.min(scenes.length - 1, Math.floor(t + 0.001))];
        paintStoryScene(s, scene, scene.duration * 0.75, world);
      }}
    />
  );
}
`;
}

/** Up to three shots of a place for its check and critic: first, middle, last. */
export function placeSamples(plan: StoryCanvasPlan, place: StoryCanvasPlace, worldScenes: Array<StoryWorldScene | null>, frame: FrameSize): StoryWorldScene[] {
  const own = worldScenes.filter((scene): scene is StoryWorldScene => Boolean(scene) && scene?.place === place.id);
  const picked = own.length <= 3 ? own : [own[0], own[Math.floor(own.length / 2)], own[own.length - 1]];
  if (picked.length) return picked.map((scene, index) => ({ ...scene, start: index }));
  const subset: StoryCanvasPlan = { ...plan, beats: [probeBeat(place.id, null)] };
  return buildStoryScenes(subset, [{ start: 0, duration: 2 }], frame).filter((scene): scene is StoryWorldScene => Boolean(scene));
}

export function placeProblems(plan: StoryCanvasPlan, place: StoryCanvasPlace, propsFile: string, sampled: StoryWorldScene[], code: string): string[] {
  const name = placeFunctionName(place.id);
  if (!new RegExp(`export\\s+function\\s+${name}\\s*\\(`).test(code)) return [`Export exactly: export function ${name}(s: Story, t: number, state: Record<string, number>).`];
  if (/^\s*import\s/m.test(code)) return ['Do not write imports; return only the function.'];
  if (callsLabel(code)) return [LABEL_FORBIDDEN];
  const subset: StoryCanvasPlan = { ...plan, places: [place] };
  const scenes = sampled.map((scene, index) => ({ ...scene, start: index === 0 ? 0 : sampled.slice(0, index).reduce((sum, item) => sum + item.duration, 0) }));
  return dryRunStoryCanvas({ 'StoryProps.ts': propsFile, 'StoryPlaces.ts': assembleStoryPlaces([code]), 'StoryScenes.ts': assembleStoryScenes(subset, scenes, []) }).problems;
}

export function placeTask(ctx: StoryTaskContext, place: StoryCanvasPlace, propsFile: string, sampled: StoryWorldScene[], request = placeRequest(ctx.plan, place)): ImproveOptions {
  const { plan } = ctx;
  return {
    model: ctx.model,
    kind: 'place',
    id: place.id,
    label: place.label,
    system: PLACE_SYSTEM,
    criticSystem: storyCriticSystem('place'),
    request,
    check: (code) => placeProblems(plan, place, propsFile, sampled, code),
    render: (code) => renderIsoSheet(ctx.browser, { 'StoryProps.ts': propsFile, 'StoryPlaces.ts': assembleStoryPlaces([code]), 'Preview.tsx': placePreview(plan, sampled, [place.id]) }, sampled.map((_, index) => index + 0.5), ctx.frame),
    criticContext: `${ctx.topic}\nPlace: ${place.label}. ${place.look}\nPeople: ${plan.cast.map((member) => member.label).join(', ') || 'none'}. Props here: ${plan.props.filter((prop) => prop.place === place.id).map((prop) => prop.label).join(', ') || 'none'}.`,
  };
}

export function missingPropCalls(detail: StoryCanvasDetail, body: string): string[] {
  const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return detail.props
    .map(propFunctionName)
    .filter((name) => !new RegExp(`\\b${name}\\s*\\(`).test(code))
    .map((name) => `Call ${name}(s, state, t) to draw that prop instead of redrawing it from shapes, so it matches the other scenes.`);
}

export function detailProblems(plan: StoryCanvasPlan, propsFile: string, detail: StoryCanvasDetail, duration: number, body: string): string[] {
  if (/^\s*(?:import|export)\s/m.test(body)) return ['Return only the function body: statements, no imports or exports.'];
  if (/\bs\s*\.\s*person\s*\(/.test(body)) return ['Close-ups show no people; remove s.person.'];
  const missing = missingPropCalls(detail, body);
  if (missing.length) return missing;
  try {
    return dryRunStoryCanvas({
      'StoryProps.ts': propsFile,
      'StoryPlaces.ts': assembleStoryPlaces(plan.places.map((place) => fallbackPlace(plan, place))),
      'StoryScenes.ts': assembleStoryScenes(plan, [null], [{ start: 0, duration, body }]),
    }).problems;
  } catch (error) {
    return [String(error instanceof Error ? error.message : error)];
  }
}

export function detailPreview(body: string, propNames: string[]): string {
  return `import React from 'react';
import { StoryCanvasScene } from '@/motion-kit';
import type { Story } from '@/motion-kit';
${propNames.length ? `import { ${propNames.join(', ')} } from './StoryProps';\n` : ''}
const draw = (s: Story, t: number) => {
${body}
};

export default function Preview() {
  return <StoryCanvasScene labelTop={0.31} draw={draw} />;
}
`;
}

export function detailTask(ctx: StoryTaskContext, propsFile: string, detail: StoryCanvasDetail, index: number, timing: SceneTiming): ImproveOptions {
  const { plan } = ctx;
  const beat = plan.beats[index];
  return {
    model: ctx.model,
    kind: 'detail',
    id: `${detail.id}-${index + 1}`,
    label: detail.label,
    system: DETAIL_SYSTEM,
    criticSystem: storyCriticSystem('detail'),
    request: detailRequest(plan, detail, beat.text, timing.duration),
    check: (body) => detailProblems(plan, propsFile, detail, timing.duration, body),
    render: (body) => renderIsoSheet(ctx.browser, { 'StoryProps.ts': propsFile, 'Preview.tsx': detailPreview(body, detail.props.map(propFunctionName)) }, [0.3, timing.duration / 2, Math.max(0.4, timing.duration - 0.3)], ctx.frame),
    criticContext: `${ctx.topic}\nClose-up: ${detail.label}. ${detail.draw}\nSpoken line: "${beat.text}"`,
  };
}

export function fallbackDetail(plan: StoryCanvasPlan, detail: StoryCanvasDetail): string {
  const shown = detail.props.map((id) => plan.props.find((prop) => prop.id === id)).filter((prop): prop is StoryCanvasProp => Boolean(prop));
  const step = Math.max(0.01, ...shown.map((prop) => prop.size[0])) * 1.2;
  const tall = Math.max(0.01, ...shown.map((prop) => prop.size[1]));
  const zoom = Math.min(700 / (step * Math.max(1, shown.length)), 520 / tall);
  const calls = shown.map((prop, index) => `s.at(${(index - (shown.length - 1) / 2) * step}, 0, () => ${propFunctionName(prop.id)}(s, {}, t));`).join('\n');
  return `s.background('#F1F5F9', '#E2E8F0');\ns.look(0, ${tall / 2}, ${zoom});\ns.ground('${plan.palette.ground}');\n${calls}`;
}

/** Shown when a design throws in a probe render, so the job can tell a crash from a design. */
const CRASH_COLOR = '#FF00FF';

async function isCrashFrame(frame: Buffer): Promise<boolean> {
  const { channels } = await sharp(frame).stats();
  const [red, green, blue] = channels.map((channel) => channel.mean);
  return red > 200 && green < 60 && blue > 200;
}

/** Plain props and places, so title, caption, and panel previews show a scene without waiting for the drawings. */
function standIn(plan: StoryCanvasPlan) {
  return {
    'StoryProps.ts': assembleStoryProps(plan.props.map(fallbackProp)),
    'StoryPlaces.ts': assembleStoryPlaces(plan.places.map((place) => fallbackPlace(plan, place))),
  };
}

/** The first beat's shot, as the overlay designs are judged over it. */
function openingScene(plan: StoryCanvasPlan, frame: FrameSize, duration: number): StoryWorldScene {
  const first = plan.beats.find((beat) => !plan.details.some((detail) => detail.id === beat.focus)) ?? probeBeat(plan.places[0].id, null);
  const scene = buildStoryScenes({ ...plan, beats: [first] }, [{ start: 0, duration }], frame)[0];
  return scene ?? (buildStoryScenes({ ...plan, beats: [probeBeat(plan.places[0].id, null)] }, [{ start: 0, duration }], frame)[0] as StoryWorldScene);
}

const worldBlock = (plan: StoryCanvasPlan) => `const world: StoryWorld = {
  places: { ${plan.places.map((place) => `${JSON.stringify(place.id)}: ${placeFunctionName(place.id)}`).join(', ')} },
  props: { ${plan.props.map((prop) => `${JSON.stringify(prop.id)}: ${propFunctionName(prop.id)}`).join(', ')} },
  cast: ${JSON.stringify(castMembers(plan))},
};`;

const overlayImports = (plan: StoryCanvasPlan) => `import { ${plan.props.map((prop) => propFunctionName(prop.id)).join(', ')} } from './StoryProps';
import { ${plan.places.map((place) => placeFunctionName(place.id)).join(', ')} } from './StoryPlaces';`;

export function titlePreview(plan: StoryCanvasPlan, scene: StoryWorldScene, frames: number): string {
  return `import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { StoryCanvasScene, paintStoryScene, TitleBoundary } from '@/motion-kit';
import type { StoryWorld } from '@/motion-kit';
${overlayImports(plan)}
import { TitleCard } from './${STORY_TITLE_FILE.replace('.tsx', '')}';

${worldBlock(plan)}
const scene = ${JSON.stringify(scene)};

export default function Preview() {
  return (
    <AbsoluteFill>
      <StoryCanvasScene labelTop={0.31} draw={(s, t) => paintStoryScene(s, scene as never, t, world)} />
      <Sequence from={0} durationInFrames={${frames}} layout="none">
        <TitleBoundary fallback={<AbsoluteFill style={{ background: '${CRASH_COLOR}' }} />}>
          <TitleCard duration={${frames}} />
        </TitleBoundary>
      </Sequence>
    </AbsoluteFill>
  );
}
`;
}

export function captionPreview(plan: StoryCanvasPlan, scene: StoryWorldScene, wordTimings: WordTiming[]): string {
  return `import React from 'react';
import { AbsoluteFill } from 'remotion';
import { StoryCanvasScene, CaptionTrack, paintStoryScene, TitleBoundary } from '@/motion-kit';
import type { CaptionProps, StoryWorld } from '@/motion-kit';
${overlayImports(plan)}
import { CaptionCard } from './${STORY_CAPTION_FILE.replace('.tsx', '')}';

${worldBlock(plan)}
const scene = ${JSON.stringify(scene)};
const wordTimings = ${JSON.stringify(wordTimings)};
const Probe: React.FC<CaptionProps> = (props) => (
  <TitleBoundary fallback={<div style={{ position: 'fixed', inset: 0, background: '${CRASH_COLOR}' }} />}>
    <CaptionCard {...props} />
  </TitleBoundary>
);

export default function Preview() {
  return (
    <AbsoluteFill>
      <StoryCanvasScene labelTop={0.31} draw={(s, t) => paintStoryScene(s, scene as never, t, world)} />
      <CaptionTrack beat={{ from: 0, wordTimings }} palette={${JSON.stringify({ ink: plan.palette.ink })}} Caption={Probe} />
    </AbsoluteFill>
  );
}
`;
}

const PANEL_PROBE_SECONDS = 2.2;

export function panelPreview(plan: StoryCanvasPlan, scene: StoryWorldScene, fps: number): string {
  const step = Math.round(PANEL_PROBE_SECONDS * fps);
  const beats = plan.beats.slice(0, 3).map((beat, index) => ({
    headline: beat.headline, accent: beat.accent, status: beat.status, clock: beat.clock, value: beat.value, from: index * step, duration: step,
  }));
  return `import React from 'react';
import { AbsoluteFill } from 'remotion';
import { StoryCanvasScene, PanelTrack, paintStoryScene, TitleBoundary } from '@/motion-kit';
import type { PanelProps, StoryWorld } from '@/motion-kit';
${overlayImports(plan)}
import { PanelCard } from './${STORY_PANEL_FILE.replace('.tsx', '')}';

${worldBlock(plan)}
const scene = ${JSON.stringify(scene)};
const beats = ${JSON.stringify(beats)};
const Probe: React.FC<PanelProps> = (props) => (
  <TitleBoundary fallback={<div style={{ position: 'fixed', inset: 0, background: '${CRASH_COLOR}' }} />}>
    <PanelCard {...props} />
  </TitleBoundary>
);

export default function Preview() {
  return (
    <AbsoluteFill>
      <StoryCanvasScene labelTop={0.31} draw={(s, t) => paintStoryScene(s, scene as never, t, world)} />
      <PanelTrack beats={beats} unit=${JSON.stringify(plan.unit)} palette={${JSON.stringify({ hud: plan.palette.hud, hudText: plan.palette.hudText, accent: plan.palette.accent })}} Panel={Probe} />
    </AbsoluteFill>
  );
}
`;
}

const panelMoments = (beatCount: number) => Array.from({ length: Math.min(3, beatCount) }, (_, index) => {
  const start = index * PANEL_PROBE_SECONDS;
  return index < 2 ? [start + 0.2, start + 1.3] : [start + 1.3];
}).flat();

const captionMoments = (wordTimings: WordTiming[]) => {
  const moments = [0, 2, 4, 5, 7].filter((index) => index < wordTimings.length).map((index) => {
    const word = wordTimings[index];
    return (word.startMs + Math.min(word.endMs - word.startMs, 400) * 0.6) / 1000 + 0.05;
  });
  return moments.length ? moments : [0.5];
};

/** The plan's colors as the isometric design prompts expect them; story videos have no background pair. */
const designColors = (plan: StoryCanvasPlan) => ({
  palette: plan.palette,
  background: plan.look === 'dark' ? { top: '#2A3346', bottom: '#1E2535' } : { top: '#F6EFE6', bottom: '#EFE3D3' },
});

async function renderDesign(ctx: StoryTaskContext, files: Record<string, string>, moments: number[], what: string) {
  const result = await renderIsoSheet(ctx.browser, files, moments, ctx.frame);
  if ((await Promise.all(result.frames.map(isCrashFrame))).some(Boolean)) throw new Error(`The ${what} threw while rendering.`);
  return result;
}

export function titleTask(ctx: StoryTaskContext, input: { topic: string; title: string; narration: string[]; frames: number; fps: number }): ImproveOptions {
  const { plan } = ctx;
  const seconds = input.frames / input.fps;
  const scene = openingScene(plan, ctx.frame, seconds);
  const moments = [0.3, 0.8, 1.5, Math.max(1.6, seconds * 0.7), Math.max(1.7, seconds - 0.12)];
  return {
    model: ctx.model,
    kind: 'title',
    id: 'title',
    label: 'Judul pembuka',
    system: TITLE_SYSTEM,
    request: titleRequest({ topic: input.topic, title: input.title, narration: input.narration, seconds, ...designColors(plan) }),
    check: (code) => titleProblems(code, [input.topic, input.title, ...input.narration].join('\n')),
    render: (code) => renderDesign(ctx, { ...standIn(plan), [STORY_TITLE_FILE]: code, 'Preview.tsx': titlePreview(plan, scene, input.frames) }, moments, 'title card'),
    criticContext: `${input.topic}\nVideo title: "${input.title}"\nNarration: ${input.narration.join(' ')}`,
  };
}

export function captionTask(ctx: StoryTaskContext, input: { topic: string; title: string; wordTimings: WordTiming[]; sample: string; titleCode: string | null }): ImproveOptions {
  const { plan } = ctx;
  const scene = openingScene(plan, ctx.frame, 8);
  return {
    model: ctx.model,
    kind: 'caption',
    id: 'caption',
    label: 'Subtitle',
    system: CAPTION_SYSTEM,
    request: captionRequest({ topic: input.topic, title: input.title, sample: input.sample, titleCode: input.titleCode, ...designColors(plan) }),
    check: captionProblems,
    render: (code) => renderDesign(ctx, { ...standIn(plan), [STORY_CAPTION_FILE]: code, 'Preview.tsx': captionPreview(plan, scene, input.wordTimings) }, captionMoments(input.wordTimings), 'caption design'),
    criticContext: `${input.topic}\nVideo title: "${input.title}"\nThe captions show this narration word by word: "${input.sample}"${input.titleCode ? '\nThe video opens with a designed title card; captions should feel like the same design.' : ''}`,
  };
}

export function panelTask(ctx: StoryTaskContext, input: { topic: string; title: string; titleCode: string | null; fps: number }): ImproveOptions {
  const { plan } = ctx;
  const scene = openingScene(plan, ctx.frame, 8);
  const headlines = plan.beats.map((beat) => beat.headline);
  return {
    model: ctx.model,
    kind: 'panel',
    id: 'panel',
    label: 'Panel judul adegan',
    system: PANEL_SYSTEM,
    request: panelRequest({ topic: input.topic, title: input.title, headlines, hasNumbers: plan.beats.some((beat) => beat.value !== null), titleCode: input.titleCode, ...designColors(plan) }),
    check: panelProblems,
    render: (code) => renderDesign(ctx, { ...standIn(plan), [STORY_PANEL_FILE]: code, 'Preview.tsx': panelPreview(plan, scene, input.fps) }, panelMoments(plan.beats.length), 'panel design'),
    criticContext: `${input.topic}\nVideo title: "${input.title}"\nScene headlines: ${headlines.slice(0, 3).join(' | ')}${input.titleCode ? '\nThe video opens with a designed title card; the panel should feel like the same design.' : ''}`,
  };
}

const optional = async <T,>(label: string, job: () => Promise<T>): Promise<T | null> => {
  try {
    return await job();
  } catch (error) {
    console.warn(`[StoryCanvas] ${label} failed:`, error);
    return null;
  }
};

/** A design is kept only when it rendered, got scored, and still passes the validator. */
function keepDesign(result: { code: string | null; item: IsoQualityItem } | null, file: string, items: IsoQualityItem[]): string | null {
  if (!result) return null;
  items.push(result.item);
  const ok = result.code && result.item.score !== null && validateSceneCode(result.code, file, { allowedImports: ['react', 'remotion', '@/motion-kit'] }).valid;
  if (!ok) result.item.fallback = true;
  return ok ? result.code : null;
}

/**
 * Writes a story canvas video for a project whose narration and audio are ready: plan, props
 * (in parallel), places and close-ups, then the assembled files. The title, captions, and panel
 * are designed alongside. Every drawing goes through the quality loop; anything below the
 * threshold or replaced by a stand-in is listed in the report.
 */
export async function buildStoryCanvasFiles(model: string, project: StudioProject): Promise<StoryCanvasBuild> {
  const storyboard = project.storyboard;
  const frame = AspectRatioDimensions[storyboard.aspectRatio];
  const story = storyboard.scenes.map((scene) => scene.voiceoverText);
  const { plan } = await generateStoryCanvasPlan(model, project.userPrompt, story);
  const timings = storySceneTimings(storyboard);
  // Shots before the props exist (no part geometry yet): enough to know which beats are close-ups.
  const draftScenes = buildStoryScenes(plan, timings, frame);
  const topic = `Topic: "${project.userPrompt}". Places: ${plan.places.map((place) => `${place.label} (${place.look})`).join('; ')}`;

  return withIsoBrowser(async (browser) => {
    const items: IsoQualityItem[] = [];
    const ctx: StoryTaskContext = { model, plan, frame, topic, browser };
    const titleFrames = isoTitleFrames(storyboard);
    const titleJob = titleFrames > 0
      ? optional('Title', () => improve(titleTask(ctx, { topic: project.userPrompt, title: storyboard.title, narration: story, frames: titleFrames, fps: storyboard.fps })))
      : Promise.resolve(null);
    const titleCode = titleJob.then((title) => (title?.code && title.item.score !== null ? title.code : null));
    const panelJob = titleCode.then((code) => optional('Panel design', () => improve(panelTask(ctx, { topic: project.userPrompt, title: storyboard.title, titleCode: code, fps: storyboard.fps }))));
    const captionScene = storyboard.scenes.reduce((best, scene) => (scene.wordTimings.length > best.wordTimings.length ? scene : best), storyboard.scenes[0]);
    const captionJob = titleCode.then((code) => (captionScene?.wordTimings.length
      ? optional('Caption design', () => improve(captionTask(ctx, { topic: project.userPrompt, title: storyboard.title, wordTimings: captionScene.wordTimings, sample: captionScene.voiceoverText, titleCode: code })))
      : null));

    const props = await mapWithConcurrency(plan.props, CONCURRENCY, async (prop) => {
      const result = await improve(propTask(ctx, prop));
      items.push(result.item);
      return result.code ?? fallbackProp(prop);
    });
    const propsFile = assembleStoryProps(props);
    // The camera aims at parts and rides flows, so shots are built from the maps the props exported.
    let maps: Record<string, PropMap> = {};
    try {
      maps = mapsByProp(plan, readPropMaps(propsFile));
    } catch (error) {
      console.warn('[StoryCanvas] Reading prop maps failed; shots frame whole props.', error);
    }
    const words = storyboard.scenes.map((scene) => scene.wordTimings);
    const worldScenes = buildStoryScenes(plan, timings, frame, maps, words);
    // Places and close-ups only need the props, so they are written at the same time.
    const placesJob = mapWithConcurrency(plan.places, CONCURRENCY, async (place) => {
      const result = await improve(placeTask(ctx, place, propsFile, placeSamples(plan, place, worldScenes, frame)));
      items.push(result.item);
      return result.code ?? fallbackPlace(plan, place);
    });
    const detailsJob = mapWithConcurrency(plan.beats.map((beat, index) => ({ beat, index })), CONCURRENCY, async ({ beat, index }) => {
      if (worldScenes[index] || draftScenes[index]) return null;
      const detail = plan.details.find((item) => item.id === beat.focus);
      if (!detail) return null;
      const timing = timings[index];
      const result = await improve(detailTask(ctx, propsFile, detail, index, timing));
      items.push(result.item);
      return { start: timing.start, duration: timing.duration, body: result.code ?? fallbackDetail(plan, detail) };
    });
    const [places, details] = await Promise.all([placesJob, detailsJob]);

    const files = {
      'StoryProps.ts': propsFile,
      'StoryPlaces.ts': assembleStoryPlaces(places),
      'StoryScenes.ts': assembleStoryScenes(plan, worldScenes, details),
    };
    const final = dryRunStoryCanvas(files, { width: frame.width, height: frame.height });
    if (!final.ok) throw new Error(`Video Story Canvas tidak lolos pemeriksaan: ${final.problems.slice(0, 3).join('; ')}`);
    // Framing is the engine's job, so a person cut by the frame is logged, never a reason to throw the video away.
    const framing = dryRunStoryCanvas(files, { width: frame.width, height: frame.height, framing: true });
    if (!framing.ok) console.warn('[StoryCanvas] Framing:', framing.problems.slice(0, 3).join('; '));

    const title = keepDesign(await titleJob, STORY_TITLE_FILE, items);
    const panel = keepDesign(await panelJob, STORY_PANEL_FILE, items);
    const caption = keepDesign(await captionJob, STORY_CAPTION_FILE, items);
    const main = storyCanvasMainVideo(storyboard, plan, titleFrames, { title: Boolean(title), caption: Boolean(caption), panel: Boolean(panel) });
    const mainCheck = validateSceneCode(main, 'MainVideo.tsx');
    if (!mainCheck.valid) throw new Error(`MainVideo tidak valid: ${mainCheck.errors.join('; ')}`);
    return {
      files: {
        ...files,
        ...(title ? { [STORY_TITLE_FILE]: title } : {}),
        ...(caption ? { [STORY_CAPTION_FILE]: caption } : {}),
        ...(panel ? { [STORY_PANEL_FILE]: panel } : {}),
        'MainVideo.tsx': main,
      },
      plan,
      maps,
      report: { threshold: isoQualityThreshold(), items },
    };
  });
}
