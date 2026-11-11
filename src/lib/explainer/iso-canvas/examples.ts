/**
 * House style and worked examples for the isometric canvas writers. The examples are real,
 * runnable code (tests dry-run them and the review script renders them), written by hand to
 * show the level of detail and structure a premium object needs. They are shown to the model
 * as a reference, not as shapes to copy.
 */

export const ISO_STYLE = `HOUSE STYLE (every drawing in the video follows it, so all scenes look like one illustrator made them)
- Build in three layers: (1) the silhouette from the right primitive: prism profiles for curved casings, cylinders for round parts, boxes only for boxy things; (2) the characteristic parts a viewer uses to recognize the object (a fan grille, a louver, a screen, wheels, a handle); (3) small details that make it premium: seams, screws, vents, feet, indicator lights, pipes.
- The front, the parts that move, and the parts the story points at face +y (left visible side) or +x (right visible side), never -x, -y, or the bottom, which the viewer cannot see.
- Surface details (vents, panels, screens, seams) are thin boxes or faces 0.003–0.01 m in front of the surface, drawn right after the body.
- Repeated parts (grille bars, fins, slats, spokes, blades, keys) come from a loop, never typed one by one.
- See-through parts (a fan's wire guard, a cage, a grille, a mesh, a basket) are a loop of thin bars or pipes with gaps, never a solid disc or panel: what is behind them, such as the blades, must stay visible.
- Light beams, air, heat, and glow are semi-transparent (alpha 0.15–0.35), soft, and stay close to the object; never a solid opaque cone or slab.
- Each object uses 2–3 material colors plus at most one accent. Real-world colors, slightly soft: white as #F1F5F9 to #E2E8F0, never pure white; dark as #2B3440, never pure black, so the shading stays visible.
- Moving parts turn inside iso.rotate around their real pivot (a fan hub, a hinge, an axle).
- A state changes the drawing in two ways at once: the part itself (a flap opens, blades spin, a light turns on) and a motion cue scaled by the state (air or flow streams, a glow), drawn with alpha = state so it fades in.
- Lights and screens that are on: flat: true with glow 1.3–1.8. Mix colors with iso.mixColor(off, on, state).
- Standing objects start with iso.shadow under their footprint. Wall-mounted or hanging objects have none.
- No text, digits, letters, or logos on any surface; a screen shows simple shapes or bars.`;

/** Outdoor unit of a split air conditioner: box casing, front fan behind a grille, valves on the side. */
export const EXAMPLE_AC_OUTDOOR = `export function drawAcOutdoor(iso: Iso, state: Record<string, number>, t: number) {
  const on = state.nyala ?? 0;
  const W = 0.86, D = 0.32, H = 0.6, FOOT = 0.06;
  const x0 = -W / 2, y0 = -D / 2, front = D / 2, right = W / 2;
  const casing = '#E8ECEF', trim = '#C9D1D9', dark = '#2B3440', metal = '#A7B1BC';

  iso.shadow(x0, y0, W, D);
  // Layer 1: feet rails and the casing with a lighter lid.
  iso.box(x0 + 0.06, y0 - 0.02, 0, 0.1, D + 0.04, FOOT, dark);
  iso.box(right - 0.16, y0 - 0.02, 0, 0.1, D + 0.04, FOOT, dark);
  iso.box(x0, y0, FOOT, W, D, H - FOOT, casing, { top: '#F4F6F8' });

  // Layer 3 on the right side (+x): vent slits, then service valves and insulated pipes.
  for (let i = 0; i < 7; i += 1) iso.box(right, y0 + 0.05, FOOT + 0.1 + i * 0.05, 0.004, D - 0.1, 0.012, trim);
  iso.cyl('x', right, y0 + 0.07, FOOT + 0.07, 0.022, 0.05, metal);
  iso.cyl('x', right, y0 + 0.15, FOOT + 0.07, 0.016, 0.05, metal);
  iso.pipe([[right + 0.05, y0 + 0.07, FOOT + 0.07], [right + 0.12, y0 + 0.07, FOOT + 0.07], [right + 0.12, y0 - 0.35, FOOT + 0.07]], 0.03, '#D6DCE2');
  iso.pipe([[right + 0.05, y0 + 0.15, FOOT + 0.07], [right + 0.18, y0 + 0.15, FOOT + 0.07], [right + 0.18, y0 - 0.35, FOOT + 0.07]], 0.024, '#C8794A');

  // Layer 2 on the front (+y): bezel, dark opening, spinning blades, hub, grille bars.
  const fx = x0 + 0.31, fz = FOOT + (H - FOOT) / 2, r = 0.2;
  iso.cyl('y', fx, front, fz, r + 0.025, 0.008, trim);
  iso.cyl('y', fx, front + 0.008, fz, r, 0.004, dark, { stroke: false });
  const spin = t * 16 * on;
  for (let i = 0; i < 3; i += 1) {
    iso.rotate('y', spin + (i * Math.PI * 2) / 3, [fx, front, fz], () => {
      iso.prism([[0.02, -0.025], [0.17, -0.06], [0.19, 0.0], [0.14, 0.045], [0.03, 0.022]], 'y', fx, front + 0.012, fz, 0.004, '#7B8794');
    });
  }
  iso.cyl('y', fx, front + 0.012, fz, 0.035, 0.012, metal);
  for (let k = -4; k <= 4; k += 1) {
    const dz = k * 0.042;
    const half = Math.sqrt(Math.max(0, r * r - dz * dz));
    iso.box(fx - half, front + 0.026, fz + dz - 0.004, half * 2, 0.006, 0.008, '#B8C2CC', { stroke: false });
  }
  iso.box(fx - 0.004, front + 0.026, fz - r, 0.008, 0.006, r * 2, '#B8C2CC', { stroke: false });

  // Layer 3 on the front: service cover with two screws.
  iso.box(right - 0.21, front, FOOT + 0.08, 0.17, 0.006, 0.36, trim);
  for (const sz of [FOOT + 0.12, FOOT + 0.4]) iso.cyl('y', right - 0.125, front + 0.006, sz, 0.008, 0.004, metal);

  // Motion cue: warm air pushed out of the grille, fading in with the state.
  if (on > 0.02) {
    for (let i = 0; i < 3; i += 1) {
      const phase = (((t * 0.9 + i / 3) % 1) + 1) % 1;
      const y = front + 0.04 + phase * 0.4;
      iso.arrow([fx - 0.1 + i * 0.1, y, fz], [fx - 0.1 + i * 0.1, y + 0.14, fz], '#FB923C', { width: 5, alpha: on * Math.sin(phase * Math.PI) * 0.85 });
    }
  }
}`;

/** Indoor wall unit of a split air conditioner: curved prism body, louver flap on a hinge, cold air. */
export const EXAMPLE_AC_INDOOR = `export function drawAcIndoor(iso: Iso, state: Record<string, number>, t: number) {
  const on = state.nyala ?? 0;
  const W = 0.9, x0 = -W / 2;
  const body = '#F1F4F7', seam = '#CBD3DB', dark = '#2B3440';

  // Layer 1: side profile (y, z) with a flat back against the wall and a rounded front, extruded along x.
  const profile: [number, number][] = [[-0.12, 0], [-0.12, 0.3], [0.07, 0.3], [0.1, 0.285], [0.118, 0.25], [0.125, 0.19], [0.122, 0.12], [0.11, 0.06], [0.085, 0.02], [0.05, 0]];
  iso.prism(profile, 'x', x0, 0, 0, W, body);

  // Layer 3: front panel seam and the small display with its indicator light.
  iso.box(x0 + 0.01, 0.121, 0.226, W - 0.02, 0.004, 0.006, seam, { stroke: false });
  iso.box(-x0 - 0.17, 0.126, 0.14, 0.1, 0.004, 0.04, dark);
  iso.box(-x0 - 0.135, 0.131, 0.152, 0.014, 0.003, 0.014, iso.mixColor('#64748B', '#22C55E', on), { flat: true, glow: 1 + 0.6 * on, stroke: false });

  // Layer 2: the air outlet and the louver flap, hinged at its top edge, swinging open with the state.
  iso.box(x0 + 0.05, 0.1, 0.03, W - 0.1, 0.004, 0.045, dark, { stroke: false });
  iso.rotate('x', 1.0 * on, [0, 0.116, 0.08], () => {
    iso.box(x0 + 0.04, 0.112, 0.025, W - 0.08, 0.008, 0.055, '#E6EBF0');
  });

  // Motion cue: cold air streams falling forward out of the outlet.
  if (on > 0.02) {
    for (let i = 0; i < 4; i += 1) {
      const x = x0 + 0.15 + i * 0.2;
      iso.pipe([[x, 0.17, 0.03], [x, 0.32, -0.08], [x, 0.44, -0.3]], 0.012, '#BAE6FD', { flow: t * 1.2 + i * 0.1, flowColor: '#FFFFFF', alpha: 0.6 * on });
    }
  }
}`;

/** A world around the indoor unit: room corner, window, rug, sofa, plant, objects placed back to front. */
export const EXAMPLE_WORLD = `export function drawWorld(iso: Iso, t: number, states: IsoStates) {
  // Surroundings are helpers inside drawWorld, simpler than the story objects.
  const sofa = () => {
    iso.shadow(-1, -0.45, 2, 0.9);
    iso.box(-1, -0.45, 0, 2, 0.9, 0.42, '#5B7A99');
    iso.box(-1, -0.45, 0.42, 2, 0.22, 0.45, '#56738F');
    for (const ax of [-1, 0.8]) iso.box(ax, -0.45, 0.42, 0.2, 0.9, 0.2, '#56738F');
    for (const cx of [-0.8, 0]) iso.box(cx, -0.22, 0.42, 0.78, 0.64, 0.1, '#6C8BAA');
  };
  const plant = () => {
    iso.shadow(-0.2, -0.2, 0.4, 0.4);
    iso.cyl('z', 0, 0, 0, 0.18, 0.4, '#C2703D');
    for (const [lx, ly, lz, lr] of [[0, 0, 0.75, 0.22], [-0.12, 0.08, 0.6, 0.17], [0.12, -0.05, 0.62, 0.16], [0.03, 0.12, 0.92, 0.14]]) iso.sphere(lx, ly, lz, lr, '#4F9D5B');
  };

  iso.background('#EAF0F6', '#DCE5EE');
  iso.ground('#D8C3A5');
  // Farthest first: the two back walls, then what hangs on them, then the floor items.
  iso.box(-3.2, -3.2, 0, 6.4, 0.2, 2.8, '#EDE7DF');
  iso.box(-3.2, -3.0, 0, 0.2, 6.2, 2.8, '#E4DDD3');
  iso.box(-3.0, -1.7, 1.0, 0.02, 1.4, 1.1, '#9CC7E8', { glow: 1.08 });
  iso.box(-2.98, -1.02, 1.0, 0.03, 0.04, 1.1, '#F8FAFC');
  iso.box(-1.5, -1.6, 0, 2.8, 1.9, 0.01, '#C7A27C', { stroke: false });
  iso.at(0, -2.88, 2.1, () => drawAcIndoor(iso, states['ac-indoor'] ?? {}, t));
  iso.at(-0.2, -2.45, 0, sofa);
  iso.at(1.7, -2.5, 0, plant);
}`;

/** How the examples are introduced to the model: as a bar for detail, not as shapes to reuse. */
export const objectExamples = () => `EXAMPLES: two finished objects in the house style, for the level of detail and structure expected. They are a different subject; do not copy their shapes unless your object really is an air conditioner.
\`\`\`ts
${EXAMPLE_AC_OUTDOOR}

${EXAMPLE_AC_INDOOR}
\`\`\``;

export const worldExample = () => `EXAMPLE: a finished world in the house style (its object drawAcIndoor stands for your objects). Do not copy its room unless your setting is one.
\`\`\`ts
${EXAMPLE_WORLD}
\`\`\``;
