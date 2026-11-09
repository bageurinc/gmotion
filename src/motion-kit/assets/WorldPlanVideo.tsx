'use client';

import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { useSafeInsets } from '@/motion-kit/core/SafeOverlay';
import { ASSET_REGISTRY, getAsset } from '@/lib/assets/registry';
import { propsAtTime, sceneStates, viewTransition, type InstanceProps } from '@/lib/assets/plan-state';
import type { AssetPlan } from '@/lib/assets/plan-schema';
import type { AssetEntry } from '@/lib/assets/types';
import { IsoRoad, projectCarPoint } from '@/motion-kit/isometric';
import { placeAsset, variantRendererProps } from './asset-renderers';
import { CAPTION_LINE, CAPTION_LINES, CAPTION_SIZE, Callouts, Caption, type Label, type PlanVideoProps } from './PlanVideo';
import { layoutWorld, type WorldLayout, type Point } from './world-layout';

export { layoutWorld, type WorldLayout };

const BACKGROUND = '#F3F5F2';
const CANVAS = { width: 760, height: 480 };
const TRAVEL_SECONDS = 1.1;
const OPENING_SECONDS = 1.6;

type Scene = AssetPlan['scenes'][number];
type Box = { x: number; y: number; width: number; height: number };
type Camera = { center: Point; zoom: number };

const easeInOut = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The frame a scene wants: its objects, then its focus points for close-ups and tours. */
function sceneCamera(scene: Scene, seconds: number, boxes: Map<string, Box>, focusPoints: Point[], stage: { width: number; height: number }): Camera {
  const members = scene.instances.map((id) => boxes.get(id)).filter((box): box is Box => Boolean(box));
  const left = Math.min(...members.map((box) => box.x));
  const top = Math.min(...members.map((box) => box.y));
  const right = Math.max(...members.map((box) => box.x + box.width));
  const bottom = Math.max(...members.map((box) => box.y + box.height));
  const fit = Math.min(3, stage.width * 0.95 / Math.max(1, right - left), stage.height * 0.92 / Math.max(1, bottom - top));
  const middle = { x: (left + right) / 2, y: (top + bottom) / 2 };
  const drift = 1 + 0.035 * Math.min(1, seconds / Math.max(1, scene.durationSec));
  if (!focusPoints.length) return { center: middle, zoom: fit * drift };
  if (scene.camera) {
    const progress = easeInOut(seconds / Math.min(3, scene.durationSec * 0.7));
    const target = focusPoints[focusPoints.length - 1];
    return {
      center: { x: lerp(middle.x, target.x, progress), y: lerp(middle.y, target.y, progress) },
      zoom: Math.exp(lerp(Math.log(fit), Math.log(scene.camera.zoom), progress)),
    };
  }


  if (scene.layout === 'close-up' || (scene.layout === 'single' && focusPoints.length >= 2)) {
    // A tour: start on the first focus, travel to the last while the narration runs.
    const travel = focusPoints.length >= 2 ? easeInOut((seconds - TRAVEL_SECONDS - 0.4) / Math.max(1, scene.durationSec - TRAVEL_SECONDS - 1)) : 0;
    const first = focusPoints[0];
    const last = focusPoints[focusPoints.length - 1];
    const target = { x: lerp(first.x, last.x, travel), y: lerp(first.y, last.y, travel) };
    const closeness = scene.layout === 'close-up' ? 0.85 : 0.45;
    return { center: { x: lerp(middle.x, target.x, closeness), y: lerp(middle.y, target.y, closeness) }, zoom: Math.min(4, fit * (scene.layout === 'close-up' ? 1.9 : 1.3)) * drift };
  }
  const centroid = { x: focusPoints.reduce((sum, p) => sum + p.x, 0) / focusPoints.length, y: focusPoints.reduce((sum, p) => sum + p.y, 0) / focusPoints.length };
  return { center: { x: lerp(middle.x, centroid.x, 0.3), y: lerp(middle.y, centroid.y, 0.3) }, zoom: fit * 1.08 * drift };
}

/**
 * Isometric library video as one continuous world: every object stays in place, and each
 * scene is a camera move to the parts it explains. No cuts or fades between scenes.
 */
export const WorldPlanVideo: React.FC<PlanVideoProps & { environment?: React.ReactNode }> = ({ plan, audio, registry = ASSET_REGISTRY, published, environment }) => {
  const { fps } = useVideoConfig();
  let from = 0;
  return (
    <AbsoluteFill style={{ background: BACKGROUND }}>
      <WorldStage plan={plan} registry={registry} published={published} environment={environment} />
      {plan.scenes.map((scene, index) => {
        const duration = Math.max(1, Math.round(scene.durationSec * fps));
        const element = audio?.[index]
          ? <Sequence key={scene.id} from={from} durationInFrames={duration}><Audio src={/^(?:\/|https?:)/.test(audio[index]!) ? audio[index]! : staticFile(audio[index]!)} /></Sequence>
          : null;
        from += duration;
        return element;
      })}
    </AbsoluteFill>
  );
};

const WorldStage: React.FC<Pick<PlanVideoProps, 'plan' | 'published'> & { registry: readonly AssetEntry[]; environment?: React.ReactNode }> = ({ plan, registry, published, environment }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const insets = useSafeInsets();
  const presentation = { captions: true, labels: true, ...plan.presentation };

  // Which scene is playing, and how far into it.
  const starts: number[] = [];
  let cursor = 0;
  for (const scene of plan.scenes) { starts.push(cursor); cursor += Math.max(1, Math.round(scene.durationSec * fps)); }
  let index = starts.findIndex((start, position) => frame < (starts[position + 1] ?? Infinity) && frame >= start);
  if (index < 0) index = plan.scenes.length - 1;
  const scene = plan.scenes[index];
  const seconds = (frame - starts[index]) / fps;
  const states = sceneStates(plan, registry);
  const state = states[index];

  const captionReserve = presentation.captions ? width * CAPTION_SIZE * CAPTION_LINE * CAPTION_LINES + height * 0.015 : 0;
  const stageTop = height * Math.max(0.1, insets.top);
  const stageHeight = height * (1 - insets.bottom) - captionReserve - stageTop;
  const stageCenter = { x: width / 2, y: stageTop + stageHeight / 2 };
  const safeArea = { left: width * Math.max(0.04, insets.left), right: width * (1 - Math.max(0.04, insets.right)), top: height * insets.top };

  const layout = layoutWorld(plan, registry);
  const boxes = new Map<string, Box>([...layout.origins].map(([id, origin]) => [id, { x: origin.x + 60, y: origin.y + 40, width: CANVAS.width - 120, height: CANVAS.height - 60 }]));
  if (layout.road) boxes.set(layout.road.id, { x: layout.road.origin.x + 60, y: layout.road.origin.y + 120, width: CANVAS.width - 120, height: 260 });

  // Props at this frame. Objects outside the scene keep the state the story left them in.
  let roadDistance = 0;
  const members = plan.instances.flatMap((instance) => {
    const entry = getAsset(instance.assetId, instance.assetVersion, registry);
    if (!entry) return [];
    const inScene = scene.instances.includes(instance.id);
    const actions = inScene ? scene.actions.filter((action) => action.instanceId === instance.id) : [];
    const props: InstanceProps = propsAtTime(state.start[instance.id] ?? {}, actions, seconds);
    if (entry.renderer === 'IsoCar' && inScene) {
      const transition = viewTransition(state.entry[instance.id]?.view, state.start[instance.id]?.view, seconds);
      if (transition.view) props.view = transition.view;
      props.bodyOpacity = Number(props.bodyOpacity ?? 1) * transition.shellOpacity;
    }
    if (entry.renderer === 'IsoCar' && props.view === 'exterior') props.energyFlow = false;
    for (const [name, spec] of Object.entries(entry.props)) {
      if (spec.type !== 'number' || !spec.driven) continue;
      const active = !spec.driven.activeWhen || Boolean(props[spec.driven.activeWhen]);
      props[name] = active ? (frame / fps) * spec.driven.speed : spec.default;
    }
    if (entry.renderer === 'IsoRoad') {
      // Lane marks move only while a road scene plays, so cars read as driving then stopping.
      const animated = actions.some((action) => action.prop === 'distance');
      if (inScene && scene.layout === 'road' && !animated) props.distance = Number(props.distance ?? 0) + seconds * 140;
      roadDistance = Number(props.distance ?? 0);
    }
    return [{ instance, entry, props }];
  });
  for (const member of members) {
    if (member.entry.renderer !== 'IsoCar' || !layout.road) continue;
    member.props.wheelRotation = -roadDistance / 40 * 180 / Math.PI;
  }

  // Focus points of the playing scene, in world-canvas pixels.
  const focusOf = (target: Scene): Array<Label> => target.focus.flatMap((focus) => {
    const member = members.find((item) => item.instance.id === focus.instanceId);
    const origin = layout.origins.get(focus.instanceId);
    const anchor = member?.entry.variants[member.instance.variant]?.anchors[focus.anchor];
    if (!member || !origin || !anchor) return [];
    const p = projectCarPoint([anchor[0], anchor[1], anchor[2] + (member.entry.renderer === 'IsoProduct' ? Number(member.props.lift ?? 0) : 0)]);
    return [{ point: { x: origin.x + p.x, y: origin.y + p.y }, text: focus.label }];
  });
  const stageSize = { width: width, height: stageHeight };
  const cameraFor = (position: number, at: number): Camera => sceneCamera(plan.scenes[position], at, boxes, focusOf(plan.scenes[position]).map((label) => label.point), stageSize);

  // Travel from where the previous scene ended; the first scene opens on the whole world.
  let camera = cameraFor(index, seconds);
  const blend = easeInOut(seconds / (index === 0 ? OPENING_SECONDS : TRAVEL_SECONDS));
  if (blend < 1) {
    const before = index === 0
      ? sceneCamera({ ...scene, instances: plan.instances.map((item) => item.id), focus: [], layout: 'side-by-side' }, 0, boxes, [], stageSize)
      : cameraFor(index - 1, plan.scenes[index - 1].durationSec);
    camera = {
      center: { x: lerp(before.center.x, camera.center.x, blend), y: lerp(before.center.y, camera.center.y, blend) },
      zoom: Math.exp(lerp(Math.log(before.zoom), Math.log(camera.zoom), blend)),
    };
  }
  const toScreen = (point: Point) => ({ x: stageCenter.x + (point.x - camera.center.x) * camera.zoom, y: stageCenter.y + (point.y - camera.center.y) * camera.zoom });
  // Labels appear once the camera has arrived, and only for parts that are in frame.
  const labels = blend < 1 ? [] : focusOf(scene).map((label) => ({ ...label, point: toScreen(label.point) }))
    .filter((label) => label.point.x > width * 0.02 && label.point.x < width * 0.98 && label.point.y > stageTop * 0.5 && label.point.y < height * (1 - insets.bottom));
  const labelFrame = Math.max(0, Math.round((seconds - (index === 0 ? OPENING_SECONDS : TRAVEL_SECONDS)) * fps));

  const nodes = members
    .filter((member) => member.entry.renderer !== 'IsoRoad')
    .map((member) => ({ member, origin: layout.origins.get(member.instance.id)! }))
    .filter((item) => item.origin)
    .sort((a, b) => a.origin.depth - b.origin.depth)
    .map(({ member, origin }) => placeAsset(member.entry, published, { ...member.props, ...(member.entry.renderer === 'IsoWaterChannel' ? { continuous: true } : {}), ...variantRendererProps(member.entry.renderer, member.instance.variant) },
      { key: member.instance.id, x: origin.x, y: origin.y, width: CANVAS.width, height: CANVAS.height, overflow: true }));
  const connectionPoint = (endpoint: { instanceId: string; anchor: string }): Point | undefined => {
    const member = members.find((item) => item.instance.id === endpoint.instanceId);
    const origin = layout.origins.get(endpoint.instanceId);
    const anchor = member?.entry.variants[member.instance.variant]?.anchors[endpoint.anchor];
    if (!origin || !anchor) return undefined;
    const p = projectCarPoint(anchor);
    return { x: origin.x + p.x, y: origin.y + p.y };
  };
  const connections = (plan.connections ?? []).map((connection, i) => {
    const a = connectionPoint(connection.from), b = connectionPoint(connection.to);
    if (!a || !b) return null;
    const along = ((b.x - a.x) + (b.y - a.y) / Math.tan(Math.PI / 6)) / 2;
    const bend = { x: a.x + along, y: a.y + along * Math.tan(Math.PI / 6) };
    const path = `M ${a.x} ${a.y} L ${bend.x} ${bend.y} L ${b.x} ${b.y}`;
    return <g key={i} data-part="world-water-connection" fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d={path} stroke="#365564" strokeWidth={16} />
      <path d={path} stroke="#6B9CAD" strokeWidth={12} />
      <path d={path} stroke="#5BD8ED" strokeWidth={6} strokeDasharray="15 22" strokeDashoffset={-frame / fps * 45} />
    </g>;
  });
  const road = layout.road && members.find((member) => member.instance.id === layout.road!.id);

  const fade = interpolate(frame, [0, 10, durationInFrames - 12, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const captionIn = interpolate(frame - starts[index], [0, 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
        <g transform={`translate(${stageCenter.x} ${stageCenter.y}) scale(${camera.zoom}) translate(${-camera.center.x} ${-camera.center.y})`}>
          {environment}
          {road && layout.road ? (
            <IsoRoad {...(road.props as object)} length={2400} x={layout.road.origin.x + layout.road.geometry.minX} y={layout.road.origin.y + layout.road.geometry.minY}
              width={layout.road.geometry.viewWidth} height={layout.road.geometry.viewHeight}
              style={{ width: layout.road.geometry.viewWidth, height: layout.road.geometry.viewHeight, overflow: 'visible' }} />
          ) : null}
          {connections}
          {nodes}
        </g>
        {presentation.labels ? <Callouts labels={labels} frame={labelFrame} width={width} area={safeArea} /> : null}
      </svg>
      {presentation.captions ? <div style={{ opacity: captionIn }}><Caption backdrop={Boolean(environment)} text={scene.narration} width={width} height={height} insets={insets} /></div> : null}
    </AbsoluteFill>
  );
};
