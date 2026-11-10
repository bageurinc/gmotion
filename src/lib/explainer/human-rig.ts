/**
 * Fixed skeleton for drafted characters. Joints only rotate, so limbs keep their length in
 * every pose, and walking is solved with two-bone IK so the stance foot stays planted.
 *
 * The rig is source text, not a module: drafted objects and the shared world block run with
 * no imports (in the draft VM and in scenes alike), so the block carries the rig inline.
 * Keep it free of imports, template literals, and anything validateSceneCode rejects.
 *
 * Conventions inside the rig:
 * - Origin (0, 0) is the ground point under the pelvis. y grows downward, the figure faces +x.
 * - Limb angles are in degrees and positive means forward (toward the facing direction).
 *   0 is straight down for arms and legs, straight up for torso, neck, and head.
 * - Foot angles (ftN, ftF) are global: 0 is flat on the ground, positive lifts the toes.
 */

export const HUMAN_RIG_NAMES = ['HUMAN_RIG', 'HumanRig'] as const;

export const HUMAN_RIG_POSES = ['stand', 'point', 'explain', 'hold', 'aim', 'raiseHand', 'crossArms', 'sit', 'lookUp'] as const;
export type HumanRigPose = (typeof HUMAN_RIG_POSES)[number];

export const HUMAN_RIG_SLOTS = ['head', 'neck', 'torso', 'pelvis', 'upperArm', 'foreArm', 'hand', 'thigh', 'shin', 'foot', 'coatTail'] as const;

/** What a scene's model needs to animate drafted characters. Sent with the draft API, not the rig's code. */
export const HUMAN_RIG_API = [
  '// HumanRig and HUMAN_RIG are built into the block. Every component marked "Character on HumanRig" is a person drawn on this skeleton, seen from the side.',
  '// Character props: pose (' + HUMAN_RIG_POSES.join(', ') + '), poseTo and poseMix 0..1 to blend smoothly into another pose, walkPhase and walkMix to walk, facing 1 (faces right) or -1 (faces left), plus its own costume props.',
  '// Place a character with <g transform={"translate(" + x + " " + groundY + ") scale(" + s + ")"}>. Its origin is the ground under its hips. Keep s fixed for the whole scene; never animate a character\'s scale or squash it.',
  '// Walking: const w = HUMAN_RIG.walk({ progress: actionProgress.someAction, fromX, toX, height: CHARACTER_HEIGHT, scale: s }); use w.x for x and pass walkPhase={w.walkPhase} walkMix={w.walkMix} facing={w.facing}. Never move a character along the ground any other way, or its feet slide.',
  '// Keep a walk about one stride (HUMAN_RIG.stride(CHARACTER_HEIGHT) * s units) per second the action lasts.',
  '// Gestures: drive poseMix from an actionProgress value, for example pose="stand" poseTo="point" poseMix={actionProgress.warn}. Never rotate, skew, or redraw a character\'s limbs yourself, and never draw a person with other shapes.',
].join('\n');

export const HUMAN_RIG_SOURCE = String.raw`const HUMAN_RIG = (() => {
  const RAD = Math.PI / 180;
  const TAU = Math.PI * 2;
  // Body proportions as fractions of the total height (about 7.5 heads).
  const RATIO = {
    head: 0.13, neck: 0.04, spine: 0.29, thigh: 0.245, shin: 0.235, ankle: 0.045, foot: 0.15,
    upperArm: 0.18, foreArm: 0.15, hand: 0.1, shoulderDrop: 0.025, farShift: 0.02,
  };
  const KEYS = ['lean', 'neck', 'head', 'shN', 'elN', 'wrN', 'shF', 'elF', 'wrF', 'hipN', 'knN', 'ftN', 'hipF', 'knF', 'ftF'];
  const STAND = { lean: 0, neck: 0, head: 0, shN: 4, elN: 10, wrN: 0, shF: -3, elF: 8, wrF: 0, hipN: 2, knN: -2, ftN: 0, hipF: -2, knF: -1, ftF: 0 };
  const POSES = {
    stand: STAND,
    point: { ...STAND, shN: 92, elN: 4, wrN: -6, head: -2 },
    explain: { ...STAND, shN: 28, elN: 72, wrN: -24, shF: 6, elF: 30 },
    hold: { ...STAND, shN: 24, elN: 78, wrN: -10, shF: 18, elF: 74, wrF: -8, neck: 8, head: 12 },
    aim: { ...STAND, lean: 4, shN: 48, elN: 88, wrN: -46, shF: 84, elF: 14, wrF: -8, neck: 6, head: 4, hipN: 10, knN: -6, hipF: -8, knF: -2 },
    raiseHand: { ...STAND, shN: 168, elN: 12, wrN: 0 },
    crossArms: { ...STAND, shN: 12, elN: 104, wrN: 0, shF: 14, elF: 100, wrF: 0 },
    sit: { ...STAND, lean: 6, shN: 12, elN: 58, shF: 10, elF: 54, hipN: 88, knN: -88, hipF: 84, knF: -84 },
    lookUp: { ...STAND, lean: -3, neck: -10, head: -16 },
  };

  function metrics(height) {
    const out = { height };
    Object.keys(RATIO).forEach((key) => { out[key] = RATIO[key] * height; });
    out.legLength = out.thigh + out.shin;
    out.hipHeight = out.legLength + out.ankle;
    return out;
  }

  /** Distance the body travels in one walk cycle (two steps). */
  function stride(height) {
    const m = metrics(height);
    return 1.2 * m.legLength;
  }

  function poseOf(value) {
    if (value && typeof value === 'object') return { ...STAND, ...value };
    return POSES[value] || STAND;
  }

  function mixPose(a, b, t) {
    const out = {};
    KEYS.forEach((key) => { out[key] = a[key] + (b[key] - a[key]) * t; });
    return out;
  }

  /** Two-bone IK. Target (tx, ty) is relative to the hip, y down. The knee bends forward. */
  function ik(tx, ty, upper, lower) {
    const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, Math.hypot(tx, ty)));
    const toTarget = Math.atan2(tx, ty);
    const cosHip = (upper * upper + reach * reach - lower * lower) / (2 * upper * reach);
    const thigh = toTarget + Math.acos(Math.max(-1, Math.min(1, cosHip)));
    const kx = upper * Math.sin(thigh);
    const ky = upper * Math.cos(thigh);
    const shin = Math.atan2(tx - kx, ty - ky);
    return [thigh / RAD, (shin - thigh) / RAD];
  }

  const frac = (value) => value - Math.floor(value);
  const smooth = (value) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

  /** Rotates (x, y) by a forward-positive angle in degrees, in y-down space. */
  function turn(x, y, degrees) {
    const a = -degrees * RAD;
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  }

  /** Ankle position and foot angle for one leg at its own phase q, relative to the ground under the pelvis. */
  function stepFoot(q, m, distance) {
    const ball = 0.55 * m.foot;
    const heel = 0.22 * m.foot;
    let x;
    let lift = 0;
    let foot;
    if (q < 0.6) {
      x = 0.3 * distance - distance * q;
      foot = q < 0.05 ? 6 * (1 - q / 0.05) : q > 0.42 ? -30 * Math.pow((q - 0.42) / 0.18, 2) : 0;
    } else {
      const s = (q - 0.6) / 0.4;
      x = -0.3 * distance + distance * smooth(s) - 0.4 * distance * s;
      lift = 0.11 * m.legLength * Math.sin(Math.PI * s);
      foot = -30 + 36 * smooth(s / 0.75);
    }
    // Toes up pivot on the heel, toes down pivot on the ball, so the sole never sinks.
    const pivot = foot > 0 ? [x - heel, -lift] : [x + ball, -lift];
    const offset = foot > 0 ? turn(heel, -m.ankle, foot) : turn(-ball, -m.ankle, foot);
    return { x: pivot[0] + offset[0], y: pivot[1] + offset[1], foot };
  }

  function walkPose(phase, height) {
    const m = metrics(height);
    const distance = stride(height);
    const q = frac(phase);
    // Lowest at double support (legs spread), nearly straight-legged at mid-stance.
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

  /** Global joint positions for a pose. The lowest point of either sole rests on y = 0. */
  function solve(height, options) {
    const m = metrics(height);
    const opts = options || {};
    let pose = mixPose(poseOf(opts.pose), poseOf(opts.poseTo === undefined ? opts.pose : opts.poseTo), opts.poseMix || 0);
    if (typeof opts.walkPhase === 'number') {
      pose = mixPose(pose, walkPose(opts.walkPhase, height), opts.walkMix === undefined ? 1 : opts.walkMix);
    }
    const add = (point, length, degrees) => [point[0] + length * Math.sin(degrees * RAD), point[1] + length * Math.cos(degrees * RAD)];
    const leg = (side, hip, knee, foot) => {
      const shift = side === 'F' ? -m.farShift : 0;
      const hipJoint = [shift, 0];
      const kneeJoint = add(hipJoint, m.thigh, hip);
      const ankleJoint = add(kneeJoint, m.shin, hip + knee);
      const heel = turn(-0.22 * m.foot, m.ankle, foot);
      const toe = turn(0.78 * m.foot, m.ankle, foot);
      return {
        hip: hipJoint, knee: kneeJoint, ankle: ankleJoint,
        heel: [ankleJoint[0] + heel[0], ankleJoint[1] + heel[1]],
        toe: [ankleJoint[0] + toe[0], ankleJoint[1] + toe[1]],
      };
    };
    const near = leg('N', pose.hipN, pose.knN, pose.ftN);
    const far = leg('F', pose.hipF, pose.knF, pose.ftF);
    const pelvisY = -Math.max(near.heel[1], near.toe[1], far.heel[1], far.toe[1]);
    const lift = (joints) => {
      const out = {};
      Object.keys(joints).forEach((key) => { out[key] = [joints[key][0], joints[key][1] + pelvisY]; });
      return out;
    };
    const up = (point, length, degrees) => [point[0] + length * Math.sin(degrees * RAD), point[1] - length * Math.cos(degrees * RAD)];
    const pelvis = [0, pelvisY];
    const neckBase = up(pelvis, m.spine, pose.lean);
    const headBase = up(neckBase, m.neck, pose.lean + pose.neck);
    const headTop = up(headBase, m.head, pose.lean + pose.neck + pose.head);
    const arm = (side, shoulderAngle, elbowAngle, wristAngle) => {
      const shift = side === 'F' ? -m.farShift : 0;
      const local = turn(shift, m.shoulderDrop - m.spine, -pose.lean);
      const shoulder = [pelvis[0] + local[0], pelvis[1] + local[1]];
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

  function slot(parts, name, side) {
    const value = parts ? parts[name] : null;
    return typeof value === 'function' ? value(side) : value || null;
  }

  function Rig(props) {
    const height = props.height || 780;
    const parts = props.parts || {};
    const solved = solve(height, props);
    const m = solved.metrics;
    const p = solved.pose;
    const y = solved.pelvisY;
    const holding = props.holding || null;
    const shade = props.farShade === undefined ? 0.72 : props.farShade;

    const leg = (side) => {
      const s = side === 'far' ? 'F' : 'N';
      const hip = p['hip' + s];
      const knee = p['kn' + s];
      const ankle = p['ft' + s] - hip - knee;
      const shift = side === 'far' ? -m.farShift : 0;
      return (
        <g transform={'translate(' + shift + ' ' + y + ') rotate(' + -hip + ')'}>
          {slot(parts, 'thigh', side)}
          <g transform={'translate(0 ' + m.thigh + ') rotate(' + -knee + ')'}>
            {slot(parts, 'shin', side)}
            <g transform={'translate(0 ' + m.shin + ') rotate(' + -ankle + ')'}>
              {slot(parts, 'foot', side)}
            </g>
          </g>
        </g>
      );
    };

    const arm = (side) => {
      const s = side === 'far' ? 'F' : 'N';
      const shift = side === 'far' ? -m.farShift : 0;
      const item = holding && (holding.hand || 'near') === side ? holding.item : null;
      return (
        <g transform={'translate(' + shift + ' ' + (m.shoulderDrop - m.spine) + ') rotate(' + -p['sh' + s] + ')'}>
          {slot(parts, 'upperArm', side)}
          <g transform={'translate(0 ' + m.upperArm + ') rotate(' + -p['el' + s] + ')'}>
            {slot(parts, 'foreArm', side)}
            <g transform={'translate(0 ' + m.foreArm + ') rotate(' + -p['wr' + s] + ')'}>
              {item ? <g transform={'translate(0 ' + m.hand * 0.45 + ') rotate(' + -(holding.angle || 0) + ')'}>{item}</g> : null}
              {slot(parts, 'hand', side)}
            </g>
          </g>
        </g>
      );
    };

    const torsoTransform = 'translate(0 ' + y + ') rotate(' + p.lean + ')';
    const farTint = 'url(#asset-world-humanrig-far)';
    const coatSwing = -(p.hipN + p.hipF) * 0.35;
    const debug = props.debugBones ? solved.joints : null;
    const bone = (a, b, key) => <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#ff2d55" strokeWidth={height * 0.006} strokeLinecap="round" />;

    return (
      <g transform={'scale(' + (props.facing === -1 ? -1 : 1) + ' 1)'}>
        <defs>
          <filter id="asset-world-humanrig-far" x="-20%" y="-20%" width="140%" height="140%">
            <feComponentTransfer>
              <feFuncR type="linear" slope={shade} />
              <feFuncG type="linear" slope={shade} />
              <feFuncB type="linear" slope={shade} />
            </feComponentTransfer>
          </filter>
        </defs>
        <g filter={farTint}>
          <g transform={torsoTransform}>{arm('far')}</g>
          {leg('far')}
        </g>
        {leg('near')}
        <g transform={'translate(0 ' + y + ') rotate(' + p.lean * 0.4 + ')'}>
          {slot(parts, 'pelvis', 'near')}
          <g transform={'rotate(' + coatSwing + ')'}>{slot(parts, 'coatTail', 'near')}</g>
        </g>
        <g transform={torsoTransform}>
          {slot(parts, 'torso', 'near')}
          <g transform={'translate(0 ' + -m.spine + ') rotate(' + p.neck + ')'}>
            {slot(parts, 'neck', 'near')}
            <g transform={'translate(0 ' + -m.neck + ') rotate(' + p.head + ')'}>
              {slot(parts, 'head', 'near')}
            </g>
          </g>
          {arm('near')}
        </g>
        {debug ? (
          <g>
            {bone(debug.pelvis, debug.neckBase, 'spine')}
            {bone(debug.neckBase, debug.headTop, 'head')}
            {['near', 'far'].map((side) => (
              <g key={side} opacity={side === 'far' ? 0.5 : 1}>
                {bone(debug[side].hip, debug[side].knee, 'thigh')}
                {bone(debug[side].knee, debug[side].ankle, 'shin')}
                {bone(debug[side].heel, debug[side].toe, 'foot')}
                {bone(debug[side].shoulder, debug[side].elbow, 'upper')}
                {bone(debug[side].elbow, debug[side].wrist, 'fore')}
                {bone(debug[side].wrist, debug[side].fingers, 'hand')}
              </g>
            ))}
          </g>
        ) : null}
      </g>
    );
  }

  /**
   * Walk from fromX to toX as progress runs 0..1. Legs advance with the distance covered, so feet
   * never slide whatever the easing. The figure stands still at progress 0 and 1.
   * scale is the factor the character group is drawn at.
   */
  function walk(options) {
    const progress = Math.max(0, Math.min(1, options.progress || 0));
    const fromX = options.fromX || 0;
    const toX = options.toX === undefined ? fromX : options.toX;
    const scale = options.scale || 1;
    const eased = progress * progress * (3 - 2 * progress);
    const travelled = Math.abs(toX - fromX) * eased;
    const edge = Math.min(progress, 1 - progress);
    return {
      x: fromX + (toX - fromX) * eased,
      walkPhase: travelled / (stride(options.height || 780) * scale),
      walkMix: toX === fromX ? 0 : Math.max(0, Math.min(1, edge / 0.06)),
      facing: toX < fromX ? -1 : 1,
    };
  }

  return { metrics, stride, solve, walkPose, walk, poses: Object.keys(POSES), Rig };
})();

/**
 * HumanRig: fixed skeleton for drafted characters. Origin (0, 0) is the ground under the pelvis; faces +x.
 * Props: height (units), pose and poseTo (name or angle object), poseMix 0..1, walkPhase (cycles, optional),
 * walkMix 0..1, facing 1 or -1, parts (skin slots drawn in bone-local space), holding {item, hand, angle}.
 * Poses: stand, point, explain, hold, aim, raiseHand, crossArms, sit, lookUp.
 * One walk cycle (walkPhase + 1) moves the body HUMAN_RIG.stride(height) units; advance x by exactly that.
 * HUMAN_RIG.walk({ progress, fromX, toX, height, scale }) returns { x, walkPhase, walkMix, facing } for a walk.
 */
function HumanRig(props) {
  return HUMAN_RIG.Rig(props);
}`;
