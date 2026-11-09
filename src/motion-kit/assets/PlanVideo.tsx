'use client';

import { placeAsset, variantRendererProps, type PublishedComponents } from './asset-renderers';
import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { useSafeInsets } from '@/motion-kit/core/SafeOverlay';
import { ASSET_REGISTRY, getAsset } from '@/lib/assets/registry';
import { propsAtTime, sceneStates, viewTransition, type InstanceProps, type SceneState } from '@/lib/assets/plan-state';
import type { AssetPlan, AssetPlanInstance } from '@/lib/assets/plan-schema';
import type { AssetEntry, AssetPoint } from '@/lib/assets/types';
import { IsoCar, IsoRoad, projectCarPoint, roadGeometry } from '@/motion-kit/isometric';

const FONT = '"Helvetica Neue", Arial, sans-serif';
const BACKGROUND = '#F3F5F2';
const INK = '#1F2A2E';
const ACCENT = '#E0663A';
const CAR_VIEW = { width: 760, height: 480 };
const COS_30 = Math.sqrt(3) / 2;

type Scene = AssetPlan['scenes'][number];
type Member = { instance: AssetPlanInstance; entry: AssetEntry; props: InstanceProps };
/** Where a car's 760x480 canvas sits on screen. */
type Placement = { x: number; y: number; scale: number };

export interface PlanVideoProps {
  plan: AssetPlan;
  /** Narration file per scene, relative to the public folder. */
  audio?: ReadonlyArray<string | null>;
  /** Catalog the plan was validated against, including assets published from the admin. */
  registry?: readonly AssetEntry[];
  /** Components of database-published assets, keyed by "assetId@version". */
  published?: PublishedComponents;
}

/** Renders a validated asset plan. Every visible object comes from a registered component. */
export const PlanVideo: React.FC<PlanVideoProps> = ({ plan, audio, registry = ASSET_REGISTRY, published }) => {
  const { fps } = useVideoConfig();
  const states = sceneStates(plan, registry);
  let from = 0;
  return (
    <AbsoluteFill style={{ background: BACKGROUND }}>
      {plan.scenes.map((scene, index) => {
        const duration = Math.max(1, Math.round(scene.durationSec * fps));
        const element = (
          <Sequence key={scene.id} from={from} durationInFrames={duration}>
            <PlanScene plan={plan} scene={scene} state={states[index]} registry={registry} published={published} />
            {audio?.[index] ? <Audio src={/^(?:\/|https?:)/.test(audio[index]!) ? audio[index]! : staticFile(audio[index]!)} /> : null}
          </Sequence>
        );
        from += duration;
        return element;
      })}
    </AbsoluteFill>
  );
};

export const planDurationInFrames = (plan: AssetPlan, fps: number) =>
  plan.scenes.reduce((total, scene) => total + Math.max(1, Math.round(scene.durationSec * fps)), 0);

const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const easeInOut = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

/**
 * Environments (plants, channels, shops) are wide diagrams with small parts, so their
 * close-ups zoom much further than a car's; side-by-side stays wide to keep both in frame.
 */
const ENVIRONMENT_CAMERA: Record<Scene['layout'], { lean: number; zoom: number; drift: number }> = {
  single: { lean: 0.4, zoom: 0.3, drift: 0.04 },
  'side-by-side': { lean: 0.15, zoom: 0.04, drift: 0.03 },
  road: { lean: 0, zoom: 0, drift: 0.07 },
  'close-up': { lean: 0.75, zoom: 0.95, drift: 0.04 },
};

/** How far the camera leans toward the focused parts, and how much it adds in zoom, per layout. */
const CAMERA: Record<Scene['layout'], { lean: number; zoom: number; drift: number }> = {
  single: { lean: 0.35, zoom: 0.12, drift: 0.05 },
  'side-by-side': { lean: 0.15, zoom: 0.04, drift: 0.04 },
  road: { lean: 0, zoom: 0, drift: 0.07 },
  'close-up': { lean: 0.6, zoom: 0.55, drift: 0.04 },
};

const PlanScene: React.FC<{ plan: AssetPlan; scene: Scene; state: SceneState; registry: readonly AssetEntry[]; published?: PublishedComponents }> = ({ plan, scene, state, registry, published }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const presentation = { captions: true, labels: true, names: true, ...plan.presentation, ...scene.presentation };
  const seconds = frame / fps;
  const sceneFrames = Math.round(scene.durationSec * fps);

  const members: Member[] = scene.instances.flatMap((id) => {
    const instance = plan.instances.find((item) => item.id === id);
    const entry = instance && getAsset(instance.assetId, instance.assetVersion, registry);
    if (!instance || !entry) return [];
    const actions = scene.actions.filter((action) => action.instanceId === id);
    const props = propsAtTime(state.start[id] ?? {}, actions, seconds);
    const animated = new Set(actions.map((action) => action.prop));
    if (entry.renderer === 'IsoCar') {
      const transition = viewTransition(state.entry[id]?.view, state.start[id]?.view, seconds);
      if (transition.view) props.view = transition.view;
      props.bodyOpacity = Number(props.bodyOpacity ?? 1) * transition.shellOpacity;
    }
    // Continuous motion the plan does not need to spell out, all derived from the frame.
    // The flow route is drawn over the body, so it only reads when the shell is open.
    if (entry.renderer === 'IsoCar' && props.view === 'exterior') props.energyFlow = false;
    // Looping phases are advanced here, whatever the plan said, so they never alias into stillness.
    for (const [name, spec] of Object.entries(entry.props)) {
      if (spec.type !== 'number' || !spec.driven) continue;
      const active = !spec.driven.activeWhen || Boolean(props[spec.driven.activeWhen]);
      props[name] = active ? seconds * spec.driven.speed : spec.default;
    }
    if (scene.layout === 'road' && entry.renderer === 'IsoRoad' && !animated.has('distance')) props.distance = Number(props.distance ?? 0) + seconds * 140;
    return [{ instance, entry, props }];
  });

  const road = members.find((member) => member.entry.renderer === 'IsoRoad');
  const cars = members.filter((member) => member.entry.renderer === 'IsoCar');
  const objects = members.filter((member) => member.entry.renderer !== 'IsoRoad');
  const environmental = objects.some((member) => member.entry.renderer !== 'IsoCar');
  if (road) {
    const distance = Number(road.props.distance ?? 0);
    for (const car of cars) {
      // On a road the wheels always roll with the lane marks, whatever the plan asked for.
      car.props.wheelRotation = -distance / 40 * 180 / Math.PI;
      if (car.instance.variant === 'petrol') car.props.engineRotation = Number(car.props.engineRotation ?? 0) - seconds * 300;
      if (car.instance.variant === 'electric') car.props.motorRotation = Number(car.props.motorRotation ?? 0) - seconds * 400;
    }
  }

  const fade = interpolate(frame, [0, 8, Math.max(9, sceneFrames - 8), Math.max(10, sceneFrames)], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // Text stays inside the platform's safe area; the stage sits between the top inset and the caption.
  const insets = useSafeInsets();
  const captionFont = width * CAPTION_SIZE;
  const captionReserve = presentation.captions ? captionFont * CAPTION_LINE * CAPTION_LINES + height * 0.015 : 0;
  const stageTop = height * Math.max(presentation.captions ? 0.1 : 0.08, insets.top);
  const stageHeight = height * (1 - insets.bottom) - captionReserve - stageTop;
  const safeArea = { left: width * Math.max(0.04, insets.left), right: width * (1 - Math.max(0.04, insets.right)), top: height * insets.top };
  const stageCenter = { x: width / 2, y: stageTop + stageHeight / 2 };

  const labels: Label[] = [];
  const anchorOf = (member: Member, anchor: string): AssetPoint | undefined => {
    const point = member.entry.variants[member.instance.variant]?.anchors[anchor];
    if (point && member.entry.renderer === 'IsoProduct') return [point[0], point[1], point[2] + Number(member.props.lift ?? 0)];
    return point;
  };
  const toScreen = (placement: Placement, point: AssetPoint) => {
    const p = projectCarPoint(point as [number, number, number]);
    return { x: placement.x + p.x * placement.scale, y: placement.y + p.y * placement.scale };
  };
  const collectLabels = (placements: Map<string, Placement>) => {
    for (const focus of scene.focus) {
      const member = members.find((item) => item.instance.id === focus.instanceId);
      const placement = placements.get(focus.instanceId);
      const anchor = member && anchorOf(member, focus.anchor);
      const repeatsName = presentation.names && scene.layout === 'side-by-side' && member && focus.label.toLowerCase() === member.entry.variants[member.instance.variant].label.toLowerCase();
      if (placement && anchor && !repeatsName) labels.push({ point: toScreen(placement, anchor), text: focus.label });
    }
  };

  let stage: React.ReactNode;
  if (road) {
    const geometry = roadGeometry({ lanes: road.props.lanes as 1, length: road.props.length as number, laneWidth: road.props.laneWidth as number });
    const roadWidth = width * 1.5;
    const scale = roadWidth / geometry.viewWidth;
    const roadHeight = geometry.viewHeight * scale;
    const roadX = (width - roadWidth) / 2;
    const roadY = stageTop + (stageHeight - roadHeight) / 2;
    const placements = new Map<string, Placement>();
    type RoadNode = { depth: number; node: React.ReactNode };
    const roadNodes: RoadNode[] = cars.map((car, index) => {
      const laneY = geometry.laneCenters[index % geometry.count];
      // Stagger neighbouring lanes so the near car does not hide the far one.
      const worldX = (index % 2 === 0 ? 150 : -150) - Math.floor(index / geometry.count) * 360;
      const offset = { x: (worldX - laneY) * COS_30, y: (worldX + laneY) / 2 };
      placements.set(car.instance.id, { x: roadX + (offset.x - geometry.minX) * scale, y: roadY + (offset.y - geometry.minY) * scale, scale });
      return { depth: worldX + laneY, node: <IsoCar key={car.instance.id} {...carProps(car)} x={offset.x} y={offset.y} width={CAR_VIEW.width} height={CAR_VIEW.height} style={{ width: CAR_VIEW.width, height: CAR_VIEW.height }} /> };
    });
    // Anything else in a road scene stands on the roadside, so it is drawn rather than
    // silently dropped.
    objects.filter((member) => member.entry.renderer !== 'IsoCar').forEach((member, index) => {
      // Near shoulder, just ahead of the cars: drawn after them, so the cars never hide it.
      // Screen x is (x - y)·cos30, so x a little above y keeps it inside a 9:16 frame.
      const worldY = geometry.width / 2 + 70;
      const worldX = worldY + 60 - index * 260;
      const offset = { x: (worldX - worldY) * COS_30, y: (worldX + worldY) / 2 };
      placements.set(member.instance.id, { x: roadX + (offset.x - geometry.minX) * scale, y: roadY + (offset.y - geometry.minY) * scale, scale });
      const props = { ...member.props, ...variantRendererProps(member.entry.renderer, member.instance.variant) };
      roadNodes.push({ depth: worldX + worldY, node: placeAsset(member.entry, published, props, { key: member.instance.id, x: offset.x, y: offset.y, width: CAR_VIEW.width, height: CAR_VIEW.height, overflow: true }) });
    });
    // Far first: smaller x + y sits further from the viewer in this projection.
    const carNodes = roadNodes.sort((a, b) => a.depth - b.depth).map((item) => item.node);
    collectLabels(placements);
    stage = (
      // The road's viewBox only reaches about 220 units above the asphalt; taller roadside
      // objects such as a traffic light must not be clipped by it.
      <IsoRoad {...(road.props as object)} x={roadX} y={roadY} width={roadWidth} height={roadHeight} style={{ width: roadWidth, height: roadHeight, overflow: 'visible' }}>
        {carNodes}
      </IsoRoad>
    );
  } else {
    const placements = new Map<string, Placement>();
    const stacked = scene.layout === 'side-by-side';
    const fit = environmental ? 0.8 : 0.9;
    const carWidth = Math.min(width * (environmental ? 0.8 : stacked ? 0.9 : 0.92), stageHeight / (stacked ? 2 : 1) * CAR_VIEW.width / CAR_VIEW.height * fit);
    const scale = carWidth / CAR_VIEW.width;
    const carHeight = CAR_VIEW.height * scale;
    // A car shown for the first time drives in along its own forward axis, wheels rolling.
    const entrance = new Map<string, number>();
    objects.forEach((car, index) => {
      const centerY = stacked ? stageTop + stageHeight * (index === 0 ? 0.27 : 0.75) : stageCenter.y;
      if (car.entry.renderer === 'IsoCar' && state.firstAppearance.has(car.instance.id)) {
        const remaining = 1 - easeOut((seconds - index * 0.25) / 1.1);
        entrance.set(car.instance.id, remaining * width * 1.1);
        car.props.wheelRotation = Number(car.props.wheelRotation ?? 0) + remaining * width * 1.1 / scale / 40 * 180 / Math.PI;
      }
      const back = entrance.get(car.instance.id) ?? 0;
      placements.set(car.instance.id, { x: (width - carWidth) / 2 - back * COS_30, y: centerY - carHeight / 2 - back * 0.5, scale });
    });
    collectLabels(placements);
    stage = (
      <g>
        {objects.map((car) => {
          const placement = placements.get(car.instance.id)!;
          const props = { ...car.props, ...variantRendererProps(car.entry.renderer, car.instance.variant) };
          return placeAsset(car.entry, published, props, { key: car.instance.id, x: placement.x, y: placement.y, width: carWidth, height: carHeight });
        })}
        {stacked && presentation.names ? objects.map((car) => {
          // Names stay at the resting position and appear once the car has arrived.
          const placement = placements.get(car.instance.id)!;
          const back = entrance.get(car.instance.id) ?? 0;
          const restingY = placement.y + back * 0.5;
          const opacity = 1 - Math.min(1, back / (width * 0.15));
          // Bottom right of each car: callouts sit above their anchors, so this corner stays free.
          const name = car.entry.variants[car.instance.variant].label;
          // Long environment names shrink to fit the safe width instead of running off screen.
          const nameSize = Math.min(width * 0.045, (safeArea.right - safeArea.left) / Math.max(1, name.length * 0.56));
          return <text key={`${car.instance.id}-name`} opacity={opacity} x={safeArea.right} y={restingY + carHeight * 1.02} textAnchor="end" fontFamily={FONT} fontSize={nameSize} fontWeight={800} fill={INK}>
            {name}
          </text>;
        }) : null}
      </g>
    );
  }

  // Camera: a slow push-in on every shot, then a lean toward the parts being explained.
  // The same mapping moves the labels, so leaders stay on their anchors.
  const settings = environmental ? ENVIRONMENT_CAMERA[scene.layout] : CAMERA[scene.layout];
  // With two focus points on one object, the camera travels from the first to the last over
  // the scene, which reads as a guided tour instead of a still diagram.
  const travels = labels.length >= 2 && (scene.layout === 'single' || scene.layout === 'close-up');
  const travel = travels ? easeInOut((seconds - 1.8) / Math.max(1, scene.durationSec - 2.6)) : 0;
  const focusPoint = travels
    ? { x: labels[0].point.x + (labels[labels.length - 1].point.x - labels[0].point.x) * travel, y: labels[0].point.y + (labels[labels.length - 1].point.y - labels[0].point.y) * travel }
    : labels.length
      ? { x: labels.reduce((sum, label) => sum + label.point.x, 0) / labels.length, y: labels.reduce((sum, label) => sum + label.point.y, 0) / labels.length }
      : stageCenter;
  const lean = easeInOut((seconds - 0.4) / 1.4);
  const zoom = 1 + settings.drift * (frame / Math.max(1, sceneFrames)) + settings.zoom * lean;
  const target = { x: stageCenter.x + (focusPoint.x - stageCenter.x) * settings.lean * lean, y: stageCenter.y + (focusPoint.y - stageCenter.y) * settings.lean * lean };
  const camera = (point: { x: number; y: number }) => ({ x: stageCenter.x + (point.x - target.x) * zoom, y: stageCenter.y + (point.y - target.y) * zoom });
  // A label whose part has left the frame during a close-up would point at nothing.
  const shownLabels = labels.map((label) => ({ ...label, point: camera(label.point) }))
    .filter((label) => label.point.x > width * 0.02 && label.point.x < width * 0.98 && label.point.y > stageTop * 0.5 && label.point.y < height * (1 - insets.bottom));

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
        <g transform={`translate(${stageCenter.x} ${stageCenter.y}) scale(${zoom}) translate(${-target.x} ${-target.y})`}>{stage}</g>
        {presentation.labels ? <Callouts labels={shownLabels} frame={frame} width={width} area={safeArea} /> : null}
      </svg>
      {presentation.captions ? <Caption text={scene.narration} width={width} height={height} insets={insets} /> : null}
    </AbsoluteFill>
  );
};

function carProps({ instance, props }: Member) {
  return { ...(props as object), powertrain: instance.variant as 'petrol' | 'electric', title: undefined };
}

export type Label = { point: { x: number; y: number }; text: string };

/**
 * Places labels at the screen edge on the side of the point they mark, so leaders never cross
 * the centre line. On one side, the point nearer the edge gets the lower row.
 */
export function layoutCallouts(labels: readonly Label[], width: number, area: { left: number; right: number; top: number } = { left: width * 0.04, right: width * 0.96, top: width * 0.03 }) {
  const fontSize = width * 0.036;
  const boxHeight = fontSize * 1.9;
  const items = labels.map((label, index) => {
    const boxWidth = label.text.length * fontSize * 0.58 + fontSize * 1.4;
    const left = label.point.x <= width / 2;
    return { ...label, index, boxWidth, boxHeight, fontSize, left, boxX: left ? area.left : area.right - boxWidth, boxY: 0 };
  });
  for (const left of [true, false]) {
    const side = items.filter((item) => item.left === left)
      .sort((a, b) => (left ? a.point.x - b.point.x : b.point.x - a.point.x));
    let ceiling = Infinity;
    for (const item of side) {
      item.boxY = Math.min(item.point.y - width * 0.14 - boxHeight / 2, ceiling);
      ceiling = item.boxY - boxHeight * 1.45;
    }
    const top = Math.min(...side.map((item) => item.boxY));
    const shift = Math.max(0, area.top - top);
    for (const item of side) item.boxY += shift;
  }
  return items.map((item) => {
    const centerY = item.boxY + item.boxHeight / 2;
    const underBox = item.point.x >= item.boxX && item.point.x <= item.boxX + item.boxWidth;
    const edgeX = item.left ? item.boxX + item.boxWidth : item.boxX;
    const leader = underBox
      ? [[item.point.x, item.point.y], [item.point.x, item.boxY + item.boxHeight]]
      : [[item.point.x, item.point.y], [item.point.x, centerY], [edgeX, centerY]];
    return { ...item, leader };
  });
}

export const Callouts: React.FC<{ labels: readonly Label[]; frame: number; width: number; area: { left: number; right: number; top: number } }> = ({ labels, frame, width, area }) => {
  const items = layoutCallouts(labels, width, area);
  const appear = (index: number) => interpolate(frame, [10 + index * 8, 22 + index * 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <g>
      {/* Lines first, so no leader is drawn over another label's text. */}
      {items.map((item) => (
        <polyline key={`line-${item.index}`} opacity={appear(item.index)} points={item.leader.map((point) => point.join(',')).join(' ')}
          fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      ))}
      {items.map((item) => (
        <g key={`box-${item.index}`} opacity={appear(item.index)}>
          <circle cx={item.point.x} cy={item.point.y} r={width * 0.011} fill={ACCENT} stroke="#FFFFFF" strokeWidth={4} />
          <rect x={item.boxX} y={item.boxY} width={item.boxWidth} height={item.boxHeight} rx={item.boxHeight / 2} fill={INK} />
          <text x={item.boxX + item.boxWidth / 2} y={item.boxY + item.boxHeight * 0.66} textAnchor="middle" fontFamily={FONT}
            fontSize={item.fontSize} fontWeight={700} fill="#FFFFFF">{item.text}</text>
        </g>
      ))}
    </g>
  );
};

export const CAPTION_SIZE = 0.045;
export const CAPTION_LINE = 1.3;
export const CAPTION_LINES = 3;

/** Anchored to the bottom inset, so platform buttons and captions never cover it. */
export const Caption: React.FC<{ text: string; width: number; height: number; insets: { left: number; right: number; bottom: number }; backdrop?: boolean }> = ({ text, width, height, insets, backdrop = false }) => (
  <div style={{
    position: 'absolute', left: width * Math.max(0.07, insets.left), right: width * Math.max(0.07, insets.right), bottom: height * insets.bottom,
    fontFamily: FONT, fontSize: width * CAPTION_SIZE, fontWeight: 700, lineHeight: CAPTION_LINE, color: INK, textAlign: 'center',
    ...(backdrop ? { background: 'rgba(255,255,255,0.94)', padding: width * 0.02, borderRadius: width * 0.012 } : {}),
  }}>
    {text}
  </div>
);
