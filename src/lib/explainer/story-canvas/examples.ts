/**
 * Spike: house style and a worked example for the story canvas writer. The example is real,
 * runnable code (the test dry-runs it, the spike script can render it with --example), written
 * by hand to show the level of detail a scene needs. The model sees it as a reference.
 */

export const STORY_STYLE = `HOUSE STYLE (every scene in the video follows it, so all scenes look like one illustrator made them)
- Flat, friendly editorial illustration seen straight from the side. The engine adds shade, highlight, and outline to every shape; you only choose good base colors.
- Build every setting in three depths: (1) background: background() gradient, then a far layer (s.layer(0.4–0.7)) with far scenery (windows and shelves, hills and trees, the far sea and a volcano, tissue layers inside a body); (2) the main plane at depth 1: ground(), fixed parts, and the things the story is about; (3) optional foreground (s.layer(1.2–1.4)) at a frame edge.
- Everything is drawn at its real size in meters, whatever the scale: a heart about 0.12 m, a phone 0.15 m, a room 5 m, a volcano 2000 m. The camera zooms to it; detail density stays the same at every scale.
- Settings look real and full: a kitchen has a counter with drawers, a shelf with jars, a window; a field has far hills, a fence, plants in rows; a chest cutaway has ribs, lungs, and a diaphragm around the heart; a coastline has the sea, waves, far islands, a sky. 25–70 shape calls is normal.
- Characteristic objects get their recognizable parts: a phone has a screen, a camera dot, and a button; a heart has four chambers, valves, the aorta, and vessels; a tree has a trunk and a layered canopy; a car has wheels with hubs and windows.
- Repeated parts (tiles, planks, leaves, jars, rows of plants, waves, blood cells) come from a loop.
- Things that stand on the ground line (y = 0) get s.shadow under them. People are never drawn by you; the engine adds them when the story has any.
- Colors: a warm, light palette by default (walls #F6E7D2-like, floors #D9B48A-like, skies #CDEBF7-like), 3–4 main colors plus one accent for the thing the story is about. Avoid pure white and pure black. Dark backgrounds only when the topic happens at night or in the dark.
- Light, steam, air, heat, smell: s.glow or thin s.line with dash and flow, semi-transparent (alpha 0.2–0.5).
- No text, digits, or letters drawn as shapes; words belong in s.label only.`;

/** Kitchen: a baker explains why dough rises while it grows in the bowl and gas bubbles form. */
export const EXAMPLE_KITCHEN = `function draw(s, t) {
  const wall = '#F6E7D2', floor = '#D9B48A', wood = '#B9825A', drawer = '#C8916A', top = '#EFE6DA';
  const dough = '#F3D9A4', bowl = '#7FB3D5';
  const rise = s.ramp(t, 0.3, 2.6);

  // Camera: a slow push toward the bowl.
  s.camPath([{ at: 0, look: [0.35, 0.95], zoom: 470 }, { at: 3, look: [0.5, 1.0], zoom: 530 }], t);
  s.background('#FBF1E4', wall);

  // Far layer: window with a sky view, a shelf with jars.
  s.layer(0.6, () => {
    s.rect(-1.3, 1.3, 0.92, 0.84, '#FBFBF8', { r: 0.03 });
    s.rect(-1.25, 1.35, 0.82, 0.74, '#BFE3F2', { line: false, shade: 0 });
    s.circle(-0.6, 1.95, 0.08, '#FFF4C7', { line: false, shade: 0 });
    s.rect(-0.85, 1.35, 0.02, 0.74, '#FBFBF8', { line: false, shade: 0 });
    s.rect(-1.25, 1.71, 0.82, 0.02, '#FBFBF8', { line: false, shade: 0 });
    s.rect(1.05, 1.62, 0.95, 0.05, '#A87452');
    const jars = ['#E9C46A', '#F4A261', '#9BC59D'];
    for (let i = 0; i < 3; i += 1) {
      s.rect(1.13 + i * 0.29, 1.67, 0.17, 0.23, jars[i], { r: 0.03 });
      s.rect(1.12 + i * 0.29, 1.88, 0.19, 0.04, '#8C6A55', { r: 0.01 });
    }
  });

  s.ground(floor, 0, '#C99E73');
  s.band(0, 0.1, '#E7CFAF');

  // Counter with drawers and knobs.
  s.shadow(0.8, 1.4);
  s.rect(0.15, 0, 1.3, 0.86, wood, { r: 0.02 });
  for (let i = 0; i < 3; i += 1) {
    s.rect(0.22 + i * 0.42, 0.1, 0.36, 0.66, drawer, { r: 0.02 });
    s.circle(0.4 + i * 0.42, 0.62, 0.025, '#6E4A33');
  }
  s.rect(0.1, 0.86, 1.4, 0.06, top, { r: 0.02 });

  // Dough grows upward from the bowl rim; the bowl front is drawn after so it covers the base.
  s.scale(1 + 0.08 * rise, 1 + 1.4 * rise, 0.8, 1.1, () => {
    s.ellipse(0.8, 1.1, 0.25, 0.07, dough);
    // Gas bubbles appear inside the dough and grow with it.
    for (let i = 0; i < 6; i += 1) {
      const grow = s.ramp(t, 0.6 + i * 0.25, 1.2 + i * 0.25);
      s.ellipse(0.66 + (i % 3) * 0.14, 1.12 + Math.floor(i / 3) * 0.03, 0.012 + 0.012 * grow, 0.006 + 0.006 * grow, '#FBEFD2', { alpha: grow, line: '#D9B77A', lineWidth: 2, shade: 0 });
    }
  });
  s.rect(0.68, 0.92, 0.24, 0.04, '#6A9CC0', { r: 0.015 });
  s.poly([[0.5, 1.13], [1.1, 1.13], [1.06, 1.03], [0.96, 0.96], [0.64, 0.96], [0.54, 1.03]], bowl);
  s.rect(0.48, 1.11, 0.64, 0.035, '#9CC6E2', { r: 0.017 });

  // Baker: explains, then points at the dough.
  s.shadow(-0.2, 0.5);
  s.person(-0.2, 0, {
    height: 1.62, facing: 1, pose: 'explain', poseTo: 'point', poseMix: s.ramp(t, 1.2, 1.8),
    hairStyle: 'hijab', hair: '#C2556B', top: '#F4F1EA', sleeves: 'long', apron: '#E76F51', bottom: '#4A5568', face: 'smile',
  });

  // Foreground plant at the frame edge.
  s.layer(1.3, () => {
    s.rect(1.75, 0, 0.3, 0.32, '#D47A5A', { r: 0.03 });
    for (let i = 0; i < 5; i += 1) s.ellipse(1.8 + i * 0.05, 0.42 + (i % 2) * 0.12, 0.06, 0.16, '#5FA36A', { shade: 0.6 });
  });

  s.label(0.8, 1.16 + 0.12 * rise, 'Adonan mengembang', { dx: 120, dy: -170, alpha: s.ramp(t, 0.8, 1.2) });
  s.label(0.9, 1.17 + 0.06 * rise, 'Gelembung gas', { dx: 60, dy: -320, alpha: s.ramp(t, 1.8, 2.2) });
}`;

/** Place example: the kitchen without its props. Furniture that people use would be props instead. */
export const EXAMPLE_PLACE = `export function placeDapur(s: Story, t: number, state: Record<string, number>) {
  void t;
  // State "malam" turns the evening in: the window sky darkens and the room dims.
  const night = state.malam ?? 0;
  const wall = s.mixColor('#F6E7D2', '#9A8F86', night * 0.5), floor = '#D9B48A', wood = '#B9825A', drawer = '#C8916A', top = '#EFE6DA';
  s.background(s.mixColor('#FBF1E4', '#A99F96', night * 0.5), wall);

  // Far layer: a window with a sky view and a shelf with jars.
  s.layer(0.6, () => {
    s.rect(0.4, 1.3, 0.92, 0.84, '#FBFBF8', { r: 0.03 });
    s.rect(0.45, 1.35, 0.82, 0.74, s.mixColor('#BFE3F2', '#22305A', night), { line: false, shade: 0 });
    s.circle(1.1, 1.95, 0.08, s.mixColor('#FFF4C7', '#E8ECF5', night), { line: false, shade: 0 });
    s.rect(0.85, 1.35, 0.02, 0.74, '#FBFBF8', { line: false, shade: 0 });
    s.rect(0.45, 1.71, 0.82, 0.02, '#FBFBF8', { line: false, shade: 0 });
    s.rect(3.0, 1.62, 0.95, 0.05, '#A87452');
    const jars = ['#E9C46A', '#F4A261', '#9BC59D'];
    for (let i = 0; i < 3; i += 1) {
      s.rect(3.08 + i * 0.29, 1.67, 0.17, 0.23, jars[i], { r: 0.03 });
      s.rect(3.07 + i * 0.29, 1.88, 0.19, 0.04, '#8C6A55', { r: 0.01 });
    }
  });

  s.ground(floor, 0, '#C99E73');
  s.band(0, 0.1, '#E7CFAF');

  // Fixed counter from x = 2.5 to 4.2, 0.92 m tall, with drawers.
  s.shadow(3.35, 1.7);
  s.rect(2.55, 0, 1.6, 0.86, wood, { r: 0.02 });
  for (let i = 0; i < 4; i += 1) {
    s.rect(2.62 + i * 0.38, 0.1, 0.32, 0.66, drawer, { r: 0.02 });
    s.circle(2.78 + i * 0.38, 0.62, 0.022, '#6E4A33');
  }
  s.rect(2.5, 0.86, 1.7, 0.06, top, { r: 0.02 });

  // Foreground plant at the right edge.
  s.layer(1.3, () => {
    s.rect(4.8, 0, 0.3, 0.32, '#D47A5A', { r: 0.03 });
    for (let i = 0; i < 5; i += 1) s.ellipse(4.85 + i * 0.05, 0.42 + (i % 2) * 0.12, 0.06, 0.16, '#5FA36A', { shade: 0.6 });
  });
}`;

/** Prop example: a bowl of dough whose state "naik" makes it rise, with gas bubbles inside. */
export const EXAMPLE_PROP = `export function drawAdonan(s: Story, state: Record<string, number>, t: number) {
  void t;
  const rise = state.naik ?? 0;
  const dough = '#F3D9A4', bowl = '#7FB3D5';
  // The dough grows upward from the rim; the bowl is drawn after so it covers the dough's base.
  s.scale(1 + 0.08 * rise, 1 + 1.4 * rise, 0, 0.18, () => {
    s.ellipse(0, 0.18, 0.25, 0.07, dough);
    for (let i = 0; i < 6; i += 1) {
      const k = Math.min(1, Math.max(0, rise * 1.6 - i * 0.12));
      s.ellipse(-0.14 + (i % 3) * 0.14, 0.2 + Math.floor(i / 3) * 0.03, 0.012 + 0.012 * k, 0.006 + 0.006 * k, '#FBEFD2', { alpha: k, line: '#D9B77A', lineWidth: 2, shade: 0 });
    }
  });
  s.rect(-0.12, 0, 0.24, 0.04, '#6A9CC0', { r: 0.015 });
  s.poly([[-0.3, 0.21], [0.3, 0.21], [0.26, 0.11], [0.16, 0.04], [-0.16, 0.04], [-0.26, 0.11]], bowl);
  s.rect(-0.32, 0.19, 0.64, 0.035, '#9CC6E2', { r: 0.017 });
}`;

/**
 * Heart example with parts and flows: the map is exported first and the drawing reuses its
 * paths, so the camera (which reads the map) and the picture always agree. Seen from the front
 * as a cutaway: the right side of the heart is on the viewer's left. Size [0.12, 0.13].
 */
export const EXAMPLE_HEART = `export const drawJantungMap = {
  parts: {
    'serambi-kanan': { at: [-0.026, 0.086], size: [0.036, 0.03] },
    'bilik-kanan': { at: [-0.022, 0.046], size: [0.04, 0.046] },
    'serambi-kiri': { at: [0.026, 0.088], size: [0.034, 0.028] },
    'bilik-kiri': { at: [0.02, 0.042], size: [0.044, 0.05] },
  },
  flows: {
    'darah-kotor': [[-0.056, 0.128], [-0.036, 0.104], [-0.026, 0.084], [-0.024, 0.052], [-0.012, 0.03], [-0.004, 0.07], [-0.008, 0.108], [-0.04, 0.124]],
    'darah-bersih': [[0.058, 0.112], [0.036, 0.096], [0.026, 0.074], [0.022, 0.036], [0.01, 0.026], [0.006, 0.08], [0.012, 0.118], [0.03, 0.13]],
  },
};

export function drawJantung(s: Story, state: Record<string, number>, t: number) {
  const fast = state.cepat ?? 0;
  const beat = s.beat(t, 68 + 40 * fast);
  const squeeze = 1 - 0.05 * beat.squeeze;
  const M = drawJantungMap;
  const vein = '#2F4F8F', artery = '#9E2B25', muscle = '#C8463F';

  // Great vessels behind the heart: vena cava (blue, top left), pulmonary artery (blue), aorta (red arch).
  s.tube([[-0.056, 0.135], [-0.04, 0.112], [-0.032, 0.098]], 0.014, vein);
  s.tube([[-0.006, 0.098], [-0.01, 0.116], [-0.042, 0.126]], 0.012, vein);
  s.tube([[0.008, 0.096], [0.012, 0.122], [0.03, 0.132], [0.05, 0.124]], 0.014, artery);
  s.tube([[0.06, 0.114], [0.04, 0.1]], 0.01, artery);

  s.scale(squeeze, squeeze, 0, 0.05, () => {
    // Muscle wall, then the four chambers inside it.
    s.poly([[0.004, 0.0], [-0.03, 0.022], [-0.052, 0.06], [-0.05, 0.096], [-0.03, 0.108], [0.0, 0.1], [0.03, 0.11], [0.052, 0.096], [0.054, 0.058], [0.034, 0.02]], muscle, { smooth: true });
    s.poly([[-0.044, 0.086], [-0.036, 0.1], [-0.012, 0.1], [-0.008, 0.076], [-0.026, 0.07]], '#7D8FCB', { smooth: true, shade: 0.4 });
    s.poly([[-0.04, 0.066], [-0.006, 0.07], [-0.002, 0.03], [-0.016, 0.018], [-0.036, 0.036]], '#6577B8', { smooth: true, shade: 0.4 });
    s.poly([[0.008, 0.078], [0.012, 0.1], [0.038, 0.102], [0.044, 0.084], [0.028, 0.074]], '#E7867B', { smooth: true, shade: 0.4 });
    s.poly([[0.004, 0.068], [0.042, 0.07], [0.046, 0.04], [0.026, 0.012], [0.006, 0.024]], '#DD6A5F', { smooth: true, shade: 0.4 });
    s.line([[0.001, 0.1], [0.002, 0.02]], 0.004, '#8E2F2A');
    // Valves open on the squeeze.
    const open = 0.004 + 0.004 * beat.squeeze;
    s.capsule(-0.03, 0.071, -0.03 + open * 2, 0.069, 0.003, '#F4E1D2');
    s.capsule(0.03, 0.073, 0.03 - open * 2, 0.071, 0.003, '#F4E1D2');
  });

  // Blood keeps flowing, faster on each squeeze and when the heart races.
  const speed = 0.02 + 0.04 * beat.squeeze + 0.03 * fast;
  s.flow(M.flows['darah-kotor'] as [number, number][], { kind: 'cells', t, speed, size: 0.0055, spacing: 0.009, width: 0.006, color: '#A9C3F0' });
  s.flow(M.flows['darah-bersih'] as [number, number][], { kind: 'cells', t, speed, size: 0.0055, spacing: 0.009, width: 0.006, color: '#FF7468' });
}`;

/** Chest cutaway around the heart: ribs, both lungs, the diaphragm, soft tissue. Width 0.3 m. */
export const EXAMPLE_CHEST = `export function placeDada(s: Story, t: number, state: Record<string, number>) {
  void state;
  const breathe = 1 + 0.02 * s.osc(t, 4);
  s.background('#3A1F2B', '#2A1620');
  s.layer(0.7, () => {
    for (let i = 0; i < 7; i += 1) {
      const y = 0.17 - i * 0.026;
      s.capsule(-0.06, y, 0.12, y + 0.012, 0.007, '#C9A9A6', { shade: 0.3, alpha: 0.55 });
      s.capsule(0.18, y + 0.012, 0.36, y, 0.007, '#C9A9A6', { shade: 0.3, alpha: 0.55 });
    }
    s.rect(0.142, -0.02, 0.016, 0.2, '#D8C3BE', { r: 0.006, alpha: 0.7 });
  });
  s.scale(breathe, breathe, 0.15, 0.06, () => {
    s.poly([[0.02, 0.0], [0.0, 0.08], [0.03, 0.15], [0.07, 0.16], [0.095, 0.1], [0.09, 0.02]], '#D9848F', { smooth: true });
    s.poly([[0.28, 0.0], [0.3, 0.08], [0.27, 0.15], [0.23, 0.16], [0.205, 0.1], [0.21, 0.02]], '#D9848F', { smooth: true });
    for (let i = 0; i < 5; i += 1) {
      s.line([[0.06, 0.13 - i * 0.02], [0.04 + (i % 2) * 0.01, 0.1 - i * 0.02]], 0.0015, '#B9606D', { alpha: 0.7 });
      s.line([[0.24, 0.13 - i * 0.02], [0.26 - (i % 2) * 0.01, 0.1 - i * 0.02]], 0.0015, '#B9606D', { alpha: 0.7 });
    }
  });
  s.ground('#5A2F3C', 0.0, '#3A1F2B');
  s.poly([[-0.1, 0.0], [0.15, 0.022], [0.4, 0.0], [0.4, -0.02], [-0.1, -0.02]], '#8E4A57', { smooth: true });
}`;

/**
 * Water system example: tank, pump, pipe, and tap, with the water path exported and drawn from
 * the same map. The pump rotor spins with the flow; drops fall from the tap. Size [1.4, 1.2].
 */
export const EXAMPLE_WATER = `export const drawPompaAirMap = {
  parts: {
    tandon: { at: [-0.5, 0.85], size: [0.36, 0.5] },
    pompa: { at: [-0.05, 0.12], size: [0.24, 0.2] },
    keran: { at: [0.58, 0.62], size: [0.14, 0.12] },
  },
  flows: {
    air: [[-0.5, 0.62], [-0.5, 0.3], [-0.3, 0.12], [-0.05, 0.12], [0.2, 0.12], [0.45, 0.25], [0.5, 0.62], [0.58, 0.64]],
  },
};

export function drawPompaAir(s: Story, state: Record<string, number>, t: number) {
  const on = state.nyala ?? 0;
  const M = drawPompaAirMap;
  const water = M.flows.air as [number, number][];
  // Tank on a stand, water level with a gentle slosh.
  s.rect(-0.66, 0, 0.04, 0.6, '#7A8794');
  s.rect(-0.38, 0, 0.04, 0.6, '#7A8794');
  s.rect(-0.68, 0.6, 0.36, 0.5, '#9FB4C7', { r: 0.04 });
  s.rect(-0.66, 0.62, 0.32, 0.3 + 0.01 * s.osc(t, 2.4), '#4FA3E0', { line: false, shade: 0.3 });
  // Pipe and the water moving through it: always a trickle, a stream when the pump runs.
  s.tube(water, 0.05, '#AEB8C2');
  s.flow(water, { kind: 'drops', t, speed: 0.05 + 0.45 * on, size: 0.022, spacing: 0.05, width: 0.02, color: '#8FD3FF' });
  // Pump housing with a rotor that spins with the flow.
  s.rect(-0.17, 0.02, 0.24, 0.2, '#3E7CB1', { r: 0.03 });
  s.circle(-0.05, 0.12, 0.07, '#2B5D87');
  s.rotate(t * (1 + 14 * on), -0.05, 0.12, () => {
    for (let i = 0; i < 4; i += 1) s.rotate((i * Math.PI) / 2, -0.05, 0.12, () => s.capsule(-0.05, 0.12, -0.05, 0.18, 0.018, '#D6DEE6', { shade: 0.3 }));
  });
  s.circle(0.05, 0.19, 0.012, on > 0.5 ? '#7CFC8A' : '#55606B', { line: false, shade: 0 });
  // Tap and the drops that fall from it.
  s.rect(0.5, 0.58, 0.16, 0.06, '#8E99A4', { r: 0.02 });
  s.rect(0.62, 0.52, 0.04, 0.08, '#8E99A4', { r: 0.01 });
  s.emit(0.64, 0.51, { kind: 'drops', t, rate: 2 + 10 * on, life: 0.5, speed: 0.1, direction: -Math.PI / 2, spread: 0.1, gravity: -2, size: 0.02 });
}`;
