/**
 * Spike: the HumanRig skeleton (src/lib/explainer/human-rig.ts) as a typed module for the
 * story canvas engine. Same proportions, poses, IK walk, and solve(); only the SVG Rig
 * component is left out. rig.test.ts checks every pose against the original source, so the
 * two stay in step. Units follow the original: y grows downward, origin is the ground under
 * the pelvis, the figure faces +x, angles are degrees and positive means forward.
 */

export type RigPoint = [number, number];

const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const RATIO = {
  head: 0.13, neck: 0.04, spine: 0.29, thigh: 0.245, shin: 0.235, ankle: 0.045, foot: 0.15,
  upperArm: 0.18, foreArm: 0.15, hand: 0.1, shoulderDrop: 0.025, farShift: 0.02,
};
const KEYS = ['lean', 'neck', 'head', 'shN', 'elN', 'wrN', 'shF', 'elF', 'wrF', 'hipN', 'knN', 'ftN', 'hipF', 'knF', 'ftF'] as const;
type PoseKey = (typeof KEYS)[number];
export type RigPose = Record<PoseKey, number>;

const STAND: RigPose = { lean: 0, neck: 0, head: 0, shN: 4, elN: 10, wrN: 0, shF: -3, elF: 8, wrF: 0, hipN: 2, knN: -2, ftN: 0, hipF: -2, knF: -1, ftF: 0 };
export const RIG_POSES = {
  stand: STAND,
  point: { ...STAND, shN: 92, elN: 4, wrN: -6, head: -2 },
  explain: { ...STAND, shN: 28, elN: 72, wrN: -24, shF: 6, elF: 30 },
  hold: { ...STAND, shN: 24, elN: 78, wrN: -10, shF: 18, elF: 74, wrF: -8, neck: 8, head: 12 },
  aim: { ...STAND, lean: 4, shN: 48, elN: 88, wrN: -46, shF: 84, elF: 14, wrF: -8, neck: 6, head: 4, hipN: 10, knN: -6, hipF: -8, knF: -2 },
  raiseHand: { ...STAND, shN: 168, elN: 12, wrN: 0 },
  crossArms: { ...STAND, shN: 12, elN: 104, wrN: 0, shF: 14, elF: 100, wrF: 0 },
  sit: { ...STAND, lean: 6, shN: 12, elN: 58, shF: 10, elF: 54, hipN: 88, knN: -88, hipF: 84, knF: -84 },
  lookUp: { ...STAND, lean: -3, neck: -10, head: -16 },
  // Story-only poses below; the original HumanRig does not have them. Shoulder angles are
  // relative to the torso, so a forward lean is added back to keep arms hanging or reaching.
  /** Bent at the waist with soft knees, hands reaching toward the ground (planting, picking up). */
  bend: { ...STAND, lean: 72, neck: -24, head: -14, shN: 84, elN: 12, shF: 78, elF: 16, hipN: 12, knN: -18, hipF: 6, knF: -12 },
  /** Deep squat, forearms resting forward, looking ahead. */
  crouch: { ...STAND, lean: 24, neck: -16, head: -8, shN: 50, elN: 40, shF: 44, elF: 36, hipN: 96, knN: -132, hipF: 92, knF: -128 },
  /** On one knee: near foot planted, far knee on the ground. */
  kneel: { ...STAND, lean: 4, shN: 36, elN: 34, shF: 18, elF: 22, hipN: 86, knN: -86, hipF: 2, knF: -92, ftF: 0 },
  /** Both hands hold something in front of the face, head tilted down (a phone, a book). */
  phone: { ...STAND, neck: 12, head: 16, shN: 22, elN: 92, wrN: -20, shF: 20, elF: 88, wrF: -20 },
  /** Forearms level in front of the waist, looking down at the hands (washing, cooking, typing). */
  wash: { ...STAND, lean: 8, neck: 12, head: 14, shN: 32, elN: 58, wrN: -6, shF: 30, elF: 56, wrF: -6 },
  /** Near hand raised beside the head, elbow bent. */
  wave: { ...STAND, shN: 140, elN: 38, wrN: 0, head: -4 },
  /** Straight body with arms along the sides. person() turns it to lie on its back. */
  lie: { ...STAND, shN: 6, elN: 4, shF: 3, elF: 4, hipN: 1, knN: -3, hipF: -1, knF: -2, neck: -4, head: -6 },
} satisfies Record<string, RigPose>;
export type RigPoseName = keyof typeof RIG_POSES;

export type RigMetrics = Record<keyof typeof RATIO, number> & { height: number; legLength: number; hipHeight: number };

export function rigMetrics(height: number): RigMetrics {
  const out = { height } as RigMetrics;
  (Object.keys(RATIO) as (keyof typeof RATIO)[]).forEach((key) => {
    out[key] = RATIO[key] * height;
  });
  out.legLength = out.thigh + out.shin;
  out.hipHeight = out.legLength + out.ankle;
  return out;
}

/** Distance the body travels in one walk cycle (two steps). */
export const rigStride = (height: number) => 1.2 * rigMetrics(height).legLength;

function poseOf(value: RigPoseName | Partial<RigPose> | undefined): RigPose {
  if (value && typeof value === 'object') return { ...STAND, ...value };
  return (value && RIG_POSES[value]) || STAND;
}

function mixPose(a: RigPose, b: RigPose, t: number): RigPose {
  const out = {} as RigPose;
  KEYS.forEach((key) => {
    out[key] = a[key] + (b[key] - a[key]) * t;
  });
  return out;
}

function ik(tx: number, ty: number, upper: number, lower: number): [number, number] {
  const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, Math.hypot(tx, ty)));
  const toTarget = Math.atan2(tx, ty);
  const cosHip = (upper * upper + reach * reach - lower * lower) / (2 * upper * reach);
  const thigh = toTarget + Math.acos(Math.max(-1, Math.min(1, cosHip)));
  const kx = upper * Math.sin(thigh);
  const ky = upper * Math.cos(thigh);
  const shin = Math.atan2(tx - kx, ty - ky);
  return [thigh / RAD, (shin - thigh) / RAD];
}

const frac = (value: number) => value - Math.floor(value);
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

function turn(x: number, y: number, degrees: number): RigPoint {
  const a = -degrees * RAD;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

function stepFoot(q: number, m: RigMetrics, distance: number) {
  const ball = 0.55 * m.foot;
  const heel = 0.22 * m.foot;
  let x: number;
  let lift = 0;
  let foot: number;
  if (q < 0.6) {
    x = 0.3 * distance - distance * q;
    foot = q < 0.05 ? 6 * (1 - q / 0.05) : q > 0.42 ? -30 * Math.pow((q - 0.42) / 0.18, 2) : 0;
  } else {
    const s = (q - 0.6) / 0.4;
    x = -0.3 * distance + distance * smooth(s) - 0.4 * distance * s;
    lift = 0.11 * m.legLength * Math.sin(Math.PI * s);
    foot = -30 + 36 * smooth(s / 0.75);
  }
  const pivot = foot > 0 ? [x - heel, -lift] : [x + ball, -lift];
  const offset = foot > 0 ? turn(heel, -m.ankle, foot) : turn(-ball, -m.ankle, foot);
  return { x: pivot[0] + offset[0], y: pivot[1] + offset[1], foot };
}

export function rigWalkPose(phase: number, height: number): RigPose {
  const m = rigMetrics(height);
  const distance = rigStride(height);
  const q = frac(phase);
  const pelvis = m.legLength * (0.955 + 0.03 * Math.cos(2 * TAU * (q - 0.3)));
  const hipY = -(m.ankle + pelvis);
  const legs = [frac(q), frac(q + 0.5)].map((legPhase, index) => {
    const ankle = stepFoot(legPhase, m, distance);
    const shift = index === 1 ? -m.farShift : 0;
    const angles = ik(ankle.x - shift, ankle.y - hipY, m.thigh, m.shin);
    return { hip: angles[0], knee: angles[1], foot: ankle.foot };
  });
  const swing = Math.cos(TAU * q);
  return {
    lean: 4, neck: -1, head: -2 + 1.5 * Math.cos(2 * TAU * (q - 0.3)),
    shN: 3 - 16 * swing, elN: 18 - 9 * swing, wrN: 0,
    shF: 3 + 16 * swing, elF: 18 + 9 * swing, wrF: 0,
    hipN: legs[0].hip, knN: legs[0].knee, ftN: legs[0].foot,
    hipF: legs[1].hip, knF: legs[1].knee, ftF: legs[1].foot,
  };
}

export interface RigOptions {
  pose?: RigPoseName | Partial<RigPose>;
  poseTo?: RigPoseName | Partial<RigPose>;
  poseMix?: number;
  walkPhase?: number;
  walkMix?: number;
}

export interface RigLimb { hip: RigPoint; knee: RigPoint; ankle: RigPoint; heel: RigPoint; toe: RigPoint; shoulder: RigPoint; elbow: RigPoint; wrist: RigPoint; fingers: RigPoint }

export interface RigSolved {
  pose: RigPose;
  pelvisY: number;
  metrics: RigMetrics;
  joints: { pelvis: RigPoint; neckBase: RigPoint; headBase: RigPoint; headTop: RigPoint; near: RigLimb; far: RigLimb };
}

/** Joint positions for a pose. The lowest point of either sole rests on y = 0. */
export function rigSolve(height: number, options: RigOptions = {}): RigSolved {
  const m = rigMetrics(height);
  let pose = mixPose(poseOf(options.pose), poseOf(options.poseTo === undefined ? options.pose : options.poseTo), options.poseMix || 0);
  if (typeof options.walkPhase === 'number') {
    pose = mixPose(pose, rigWalkPose(options.walkPhase, height), options.walkMix === undefined ? 1 : options.walkMix);
  }
  const add = (point: RigPoint, length: number, degrees: number): RigPoint => [point[0] + length * Math.sin(degrees * RAD), point[1] + length * Math.cos(degrees * RAD)];
  const leg = (side: 'N' | 'F', hip: number, knee: number, foot: number) => {
    const shift = side === 'F' ? -m.farShift : 0;
    const hipJoint: RigPoint = [shift, 0];
    const kneeJoint = add(hipJoint, m.thigh, hip);
    const ankleJoint = add(kneeJoint, m.shin, hip + knee);
    const heel = turn(-0.22 * m.foot, m.ankle, foot);
    const toe = turn(0.78 * m.foot, m.ankle, foot);
    return {
      hip: hipJoint, knee: kneeJoint, ankle: ankleJoint,
      heel: [ankleJoint[0] + heel[0], ankleJoint[1] + heel[1]] as RigPoint,
      toe: [ankleJoint[0] + toe[0], ankleJoint[1] + toe[1]] as RigPoint,
    };
  };
  const near = leg('N', pose.hipN, pose.knN, pose.ftN);
  const far = leg('F', pose.hipF, pose.knF, pose.ftF);
  const pelvisY = -Math.max(near.heel[1], near.toe[1], far.heel[1], far.toe[1]);
  const lift = <T extends Record<string, RigPoint>>(joints: T): T => {
    const out = {} as Record<string, RigPoint>;
    Object.keys(joints).forEach((key) => {
      out[key] = [joints[key][0], joints[key][1] + pelvisY];
    });
    return out as T;
  };
  const up = (point: RigPoint, length: number, degrees: number): RigPoint => [point[0] + length * Math.sin(degrees * RAD), point[1] - length * Math.cos(degrees * RAD)];
  const pelvis: RigPoint = [0, pelvisY];
  const neckBase = up(pelvis, m.spine, pose.lean);
  const headBase = up(neckBase, m.neck, pose.lean + pose.neck);
  const headTop = up(headBase, m.head, pose.lean + pose.neck + pose.head);
  const arm = (side: 'N' | 'F', shoulderAngle: number, elbowAngle: number, wristAngle: number) => {
    const shift = side === 'F' ? -m.farShift : 0;
    const local = turn(shift, m.shoulderDrop - m.spine, -pose.lean);
    const shoulder: RigPoint = [pelvis[0] + local[0], pelvis[1] + local[1]];
    const upper = shoulderAngle - pose.lean;
    const elbow = add(shoulder, m.upperArm, upper);
    const wrist = add(elbow, m.foreArm, upper + elbowAngle);
    const fingers = add(wrist, m.hand, upper + elbowAngle + wristAngle);
    return { shoulder, elbow, wrist, fingers };
  };
  return {
    pose,
    pelvisY,
    metrics: m,
    joints: {
      pelvis, neckBase, headBase, headTop,
      near: { ...lift(near), ...arm('N', pose.shN, pose.elN, pose.wrN) },
      far: { ...lift(far), ...arm('F', pose.shF, pose.elF, pose.wrF) },
    },
  };
}

/**
 * Walk from fromX to toX as progress runs 0..1. Legs advance with the distance covered, so feet
 * never slide whatever the easing. The figure stands still at progress 0 and 1.
 */
export function rigWalk(options: { progress: number; fromX: number; toX?: number; height?: number }) {
  const progress = Math.max(0, Math.min(1, options.progress || 0));
  const fromX = options.fromX || 0;
  const toX = options.toX === undefined ? fromX : options.toX;
  const eased = progress * progress * (3 - 2 * progress);
  const travelled = Math.abs(toX - fromX) * eased;
  const edge = Math.min(progress, 1 - progress);
  return {
    x: fromX + (toX - fromX) * eased,
    walkPhase: travelled / rigStride(options.height || 1.7),
    walkMix: toX === fromX ? 0 : Math.max(0, Math.min(1, edge / 0.06)),
    facing: toX < fromX ? -1 : 1,
  };
}
