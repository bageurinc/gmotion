import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { getAsset } from '@/lib/assets/registry';
import { propsAtTime, sceneStartStates, type InstanceProps } from '@/lib/assets/plan-state';
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
}

/** Renders a validated asset plan. Every visible object comes from a registered component. */
export const PlanVideo: React.FC<PlanVideoProps> = ({ plan, audio }) => {
  const { fps } = useVideoConfig();
  const starts = sceneStartStates(plan);
  let from = 0;
  return (
    <AbsoluteFill style={{ background: BACKGROUND }}>
      {plan.scenes.map((scene, index) => {
        const duration = Math.max(1, Math.round(scene.durationSec * fps));
        const element = (
          <Sequence key={scene.id} from={from} durationInFrames={duration}>
            <PlanScene plan={plan} scene={scene} start={starts[index]} />
            {audio?.[index] ? <Audio src={staticFile(audio[index]!)} /> : null}
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

const PlanScene: React.FC<{ plan: AssetPlan; scene: Scene; start: Record<string, InstanceProps> }> = ({ plan, scene, start }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const seconds = frame / fps;
  const sceneFrames = Math.round(scene.durationSec * fps);

  const members: Member[] = scene.instances.flatMap((id) => {
    const instance = plan.instances.find((item) => item.id === id);
    const entry = instance && getAsset(instance.assetId, instance.assetVersion);
    if (!instance || !entry) return [];
    const actions = scene.actions.filter((action) => action.instanceId === id);
    const props = propsAtTime(start[id] ?? {}, actions, seconds);
    const animated = new Set(actions.map((action) => action.prop));
    // Continuous motion the plan does not need to spell out, all derived from the frame.
    // The flow route is drawn over the body, so it only reads when the shell is open.
    if (props.view === 'exterior') props.energyFlow = false;
    if (props.energyFlow) props.energyPhase = seconds * 0.6;
    if (scene.layout === 'road' && entry.renderer === 'IsoRoad' && !animated.has('distance')) props.distance = Number(props.distance ?? 0) + seconds * 140;
    return [{ instance, entry, props }];
  });

  const road = members.find((member) => member.entry.renderer === 'IsoRoad');
  const cars = members.filter((member) => member.entry.renderer === 'IsoCar');
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
  const stageTop = height * 0.1;
  const stageHeight = height * 0.62;

  let content: React.ReactNode;
  const labels: Array<{ point: { x: number; y: number }; text: string }> = [];
  const anchorOf = (member: Member, anchor: string): AssetPoint | undefined => member.entry.variants[member.instance.variant]?.anchors[anchor];
  const toScreen = (placement: Placement, point: AssetPoint) => {
    const p = projectCarPoint(point as [number, number, number]);
    return { x: placement.x + p.x * placement.scale, y: placement.y + p.y * placement.scale };
  };
  const collectLabels = (placements: Map<string, Placement>) => {
    for (const focus of scene.focus) {
      const member = members.find((item) => item.instance.id === focus.instanceId);
      const placement = placements.get(focus.instanceId);
      const anchor = member && anchorOf(member, focus.anchor);
      const repeatsName = scene.layout === 'side-by-side' && member && focus.label.toLowerCase() === member.entry.variants[member.instance.variant].label.toLowerCase();
      if (placement && anchor && !repeatsName) labels.push({ point: toScreen(placement, anchor), text: focus.label });
    }
  };

  if (road) {
    const geometry = roadGeometry({ lanes: road.props.lanes as 1, length: road.props.length as number, laneWidth: road.props.laneWidth as number });
    const roadWidth = width * 1.5;
    const scale = roadWidth / geometry.viewWidth;
    const roadHeight = geometry.viewHeight * scale;
    const roadX = (width - roadWidth) / 2;
    const roadY = stageTop + (stageHeight - roadHeight) / 2;
    const placements = new Map<string, Placement>();
    const carNodes = cars.map((car, index) => {
      const laneY = geometry.laneCenters[index % geometry.count];
      // Stagger neighbouring lanes so the near car does not hide the far one.
      const worldX = (index % 2 === 0 ? 150 : -150) - Math.floor(index / geometry.count) * 360;
      const offset = { x: (worldX - laneY) * COS_30, y: (worldX + laneY) / 2 };
      placements.set(car.instance.id, { x: roadX + (offset.x - geometry.minX) * scale, y: roadY + (offset.y - geometry.minY) * scale, scale });
      return <IsoCar key={car.instance.id} {...carProps(car)} x={offset.x} y={offset.y} width={CAR_VIEW.width} height={CAR_VIEW.height} style={{ width: CAR_VIEW.width, height: CAR_VIEW.height }} />;
    });
    collectLabels(placements);
    content = (
      <IsoRoad {...(road.props as object)} x={roadX} y={roadY} width={roadWidth} height={roadHeight} style={{ width: roadWidth, height: roadHeight }}>
        {carNodes}
      </IsoRoad>
    );
  } else {
    const placements = new Map<string, Placement>();
    const stacked = scene.layout === 'side-by-side';
    const carWidth = width * (stacked ? 0.9 : 0.98);
    const scale = carWidth / CAR_VIEW.width;
    const carHeight = CAR_VIEW.height * scale;
    cars.forEach((car, index) => {
      const centerY = stacked ? stageTop + stageHeight * (index === 0 ? 0.27 : 0.75) : stageTop + stageHeight / 2;
      placements.set(car.instance.id, { x: (width - carWidth) / 2, y: centerY - carHeight / 2, scale });
    });
    collectLabels(placements);

    let transform: string | undefined;
    if (scene.layout === 'close-up') {
      const target = labels[0]?.point ?? { x: width / 2, y: stageTop + stageHeight / 2 };
      const progress = interpolate(frame, [0, fps * 1.2], [0, 1], { extrapolateRight: 'clamp' });
      const eased = 1 - (1 - progress) ** 3;
      const zoom = 1 + eased * 0.55;
      // Move only part of the way to centre, so the rest of the car stays in frame for context.
      const center = { x: target.x + (width / 2 - target.x) * eased * 0.6, y: target.y + (stageTop + stageHeight * 0.5 - target.y) * eased * 0.6 };
      transform = `translate(${center.x} ${center.y}) scale(${zoom}) translate(${-target.x} ${-target.y})`;
      for (const label of labels) {
        label.point = { x: center.x + (label.point.x - target.x) * zoom, y: center.y + (label.point.y - target.y) * zoom };
      }
    }

    content = (
      <g transform={transform}>
        {cars.map((car) => {
          const placement = placements.get(car.instance.id)!;
          return <IsoCar key={car.instance.id} {...carProps(car)} x={placement.x} y={placement.y} width={carWidth} height={carHeight} style={{ width: carWidth, height: carHeight }} />;
        })}
        {stacked ? cars.map((car) => {
          const placement = placements.get(car.instance.id)!;
          return <text key={`${car.instance.id}-name`} x={width * 0.07} y={placement.y + carHeight * 0.12} fontFamily={FONT} fontSize={width * 0.045} fontWeight={800} fill={INK}>
            {car.entry.variants[car.instance.variant].label}
          </text>;
        }) : null}
      </g>
    );
  }

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
        {content}
        <Callouts labels={labels} frame={frame} width={width} />
      </svg>
      <Caption text={scene.narration} width={width} height={height} />
    </AbsoluteFill>
  );
};

function carProps({ instance, props }: Member) {
  return { ...(props as object), powertrain: instance.variant as 'petrol' | 'electric', title: undefined };
}

type Label = { point: { x: number; y: number }; text: string };

/**
 * Places labels at the screen edge on the side of the point they mark, so leaders never cross
 * the centre line. On one side, the point nearer the edge gets the lower row.
 */
export function layoutCallouts(labels: readonly Label[], width: number) {
  const fontSize = width * 0.036;
  const boxHeight = fontSize * 1.9;
  const items = labels.map((label, index) => {
    const boxWidth = label.text.length * fontSize * 0.58 + fontSize * 1.4;
    const left = label.point.x <= width / 2;
    return { ...label, index, boxWidth, boxHeight, fontSize, left, boxX: left ? width * 0.04 : width * 0.96 - boxWidth, boxY: 0 };
  });
  for (const left of [true, false]) {
    const side = items.filter((item) => item.left === left)
      .sort((a, b) => (left ? a.point.x - b.point.x : b.point.x - a.point.x));
    let ceiling = Infinity;
    for (const item of side) {
      item.boxY = Math.min(item.point.y - width * 0.14 - boxHeight / 2, ceiling);
      ceiling = item.boxY - boxHeight * 1.45;
    }
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

const Callouts: React.FC<{ labels: readonly Label[]; frame: number; width: number }> = ({ labels, frame, width }) => {
  const items = layoutCallouts(labels, width);
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

const Caption: React.FC<{ text: string; width: number; height: number }> = ({ text, width, height }) => (
  <div style={{
    position: 'absolute', left: width * 0.07, right: width * 0.07, top: height * 0.76,
    fontFamily: FONT, fontSize: width * 0.05, fontWeight: 700, lineHeight: 1.3, color: INK, textAlign: 'center',
  }}>
    {text}
  </div>
);
