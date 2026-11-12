/**
 * Spike: house style and a worked example for the story canvas writer. The example is real,
 * runnable code (the test dry-runs it, the spike script can render it with --example), written
 * by hand to show the level of detail a scene needs. The model sees it as a reference.
 */

export const STORY_STYLE = `HOUSE STYLE (every scene in the video follows it, so all scenes look like one illustrator made them)
- Premium editorial illustration seen straight from the side, like a top science explainer channel: rich, layered, and specific, never clip art. The engine adds volume shading, highlight, outline, and haze on far layers; you choose good base colors and build real structure.
- Build every drawing in three levels of detail: (1) silhouette: the true outline and proportions; (2) components: every characteristic part in its real place (a heart has four chambers, valves, the aorta arch, the pulmonary trunk, the venae cavae, coronary vessels, fat in the grooves; a fridge has a cabinet, door seal, shelves, the compressor, condenser coil, capillary tube, evaporator); (3) fine detail: surface texture on every large shape (style.texture), small parts like screws, fibers, vents, small vessels, and leaf veins inside s.detail so they appear as the camera comes close.
- The camera zooms into parts, so a part the story visits must look rich at close range too: give it inner structure, texture, and its own small moving bits.
- Build every setting in three depths: (1) background: background() gradient, then a far layer (s.layer(0.4–0.7)) with far scenery (windows and shelves, hills and trees, the far sea and a volcano, tissue layers inside a body); (2) the main plane at depth 1: ground(), fixed parts, and the things the story is about; (3) optional foreground (s.layer(1.2–1.4)) at a frame edge.
- Everything is drawn at its real size in meters, whatever the scale: a heart about 0.12 m, a phone 0.15 m, a room 5 m, a volcano 2000 m. The camera zooms to it; detail density stays the same at every scale.
- Settings look real and full: a kitchen has a tiled wall, a counter with drawers and wood grain, a shelf with jars, a window; a field has far hills, a fence, plants in rows; a chest cutaway has the spine, ribs, lungs with bronchi, and a diaphragm around the heart; a coastline has the sea with waves, far islands, a sky.
- Repeated parts (tiles, planks, leaves, jars, rows of plants, waves, ribs, fins) come from a loop; branching things (vessels, bronchi, roots, trees, rivers, lightning) come from s.branch; coils and serpentine pipes from s.coil.
- Use gradients (style.fillTo) for liquids, metal, glass, skin, and organs; use 2–3 tones of each main color (base, a darker inner part, a pale rim) instead of one flat fill.
- Light: every place and close-up sets one light source with s.light that fits where the scene happens (sun through the window, a ceiling lamp, lava glowing from below, the soft light inside a body), and states change it (night, an eruption). Every part gets its real material (metal, glass, wet, glossy, matte) so it catches that light correctly, and parts that sit on top of others get lift so they cast a soft shadow. Light is what makes a drawing look deep and finished instead of pasted on.
- Things that stand on the ground line (y = 0) get s.shadow under them. People are never drawn by you; the engine adds them when the story has any.
- Colors: a warm, light palette by default (walls #F6E7D2-like, floors #D9B48A-like, skies #CDEBF7-like), 3–4 main colors plus one accent for the thing the story is about. Avoid pure white and pure black. Dark backgrounds only when the topic happens at night, in the dark, or inside a body.
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
  // State "malam" turns the evening in: the window sky darkens, the lamp glows, the room dims.
  const night = state.malam ?? 0;
  const wall = s.mixColor('#F6E7D2', '#9A8F86', night * 0.5), floor = '#D9B48A', wood = '#B9825A', drawer = '#C8916A', top = '#EFE6DA';
  // Daylight comes through the window on the left; at night the lamp above takes over, warmer and softer.
  s.light({ dir: Math.PI * (0.8 - 0.3 * night), color: s.mixColor('#FFF4E0', '#FFC978', night), strength: 1 - 0.2 * night });
  s.background(s.mixColor('#FBF1E4', '#A99F96', night * 0.5), wall);

  // Far layer: tiled backsplash, a window with a sky view and curtains, a shelf with jars.
  s.layer(0.6, () => {
    s.rect(-2, 0.92, 9, 0.6, '#EAF1EE', { shade: 0, line: false, texture: { kind: 'tiles', size: 0.15, alpha: 0.45 } });
    s.rect(0.4, 1.3, 0.92, 0.84, '#FBFBF8', { r: 0.03 });
    s.rect(0.45, 1.35, 0.82, 0.74, s.mixColor('#BFE3F2', '#22305A', night), { line: false, shade: 0, fillTo: s.mixColor('#E4F4FA', '#3A4A7A', night) });
    s.circle(1.1, 1.95, 0.08, s.mixColor('#FFF4C7', '#E8ECF5', night), { line: false, shade: 0 });
    for (let i = 0; i < 3; i += 1) s.ellipse(0.62 + i * 0.22, 1.5 + (i % 2) * 0.05, 0.12, 0.05, s.mixColor('#FFFFFF', '#6A7AA0', night), { line: false, shade: 0, alpha: 0.7 });
    s.rect(0.85, 1.35, 0.02, 0.74, '#FBFBF8', { line: false, shade: 0 });
    s.rect(0.45, 1.71, 0.82, 0.02, '#FBFBF8', { line: false, shade: 0 });
    s.rect(0.36, 1.27, 1.0, 0.04, '#E6DCCB', { r: 0.01 });
    // Curtains hang from a rod in soft vertical folds.
    s.capsule(0.28, 2.2, 1.44, 2.2, 0.025, '#8C6A55');
    s.poly([[0.3, 2.2], [0.5, 2.2], [0.47, 1.6], [0.42, 1.3], [0.31, 1.3]], '#E9A27B', { texture: { kind: 'stripes', size: 0.035, angle: Math.PI / 2, alpha: 0.25 } });
    s.poly([[1.22, 2.2], [1.42, 2.2], [1.41, 1.3], [1.3, 1.3], [1.25, 1.6]], '#E9A27B', { texture: { kind: 'stripes', size: 0.035, angle: Math.PI / 2, alpha: 0.25 } });
    s.rect(3.0, 1.62, 0.95, 0.05, '#A87452', { texture: { kind: 'grain', size: 0.012 } });
    s.capsule(3.1, 1.62, 3.1, 1.5, 0.02, '#8C6A55');
    s.capsule(3.85, 1.62, 3.85, 1.5, 0.02, '#8C6A55');
    const jars = ['#E9C46A', '#F4A261', '#9BC59D'];
    for (let i = 0; i < 3; i += 1) {
      s.rect(3.08 + i * 0.29, 1.67, 0.17, 0.23, '#EAF4F4', { r: 0.03, material: 'glass' });
      s.rect(3.1 + i * 0.29, 1.69, 0.13, 0.13, jars[i], { r: 0.02, line: false, texture: { kind: 'speckle', size: 0.01, alpha: 0.4 } });
      s.rect(3.07 + i * 0.29, 1.88, 0.19, 0.04, '#8C6A55', { r: 0.01 });
    }
  });

  s.ground(floor, 0, '#C99E73');
  s.rect(-2, -1, 9, 1, floor, { shade: 0, line: false, texture: { kind: 'tiles', size: 0.3, alpha: 0.3 } });
  s.band(0, 0.1, '#E7CFAF');

  // Hanging lamp: cord, shade, and a glow that grows at night.
  s.line([[2.0, 2.6], [2.0, 2.15]], 0.01, '#5A4A40');
  s.poly([[1.84, 2.0], [2.16, 2.0], [2.06, 2.16], [1.94, 2.16]], '#2F6F73', { fillTo: '#24585C', material: 'glossy' });
  s.glow(2.0, 1.95, 0.6 + 0.6 * night, '#FFE3A3', 0.18 + 0.35 * night);

  // Fixed counter from x = 2.5 to 4.2, 0.92 m tall, with drawers, handles, and a toe kick.
  s.shadow(3.35, 1.7);
  s.rect(2.55, 0, 1.6, 0.86, wood, { r: 0.02, texture: { kind: 'grain', size: 0.02 } });
  s.rect(2.6, 0, 1.5, 0.08, '#8E6244', { line: false });
  for (let i = 0; i < 4; i += 1) {
    s.rect(2.62 + i * 0.38, 0.12, 0.32, 0.64, drawer, { r: 0.02, texture: { kind: 'grain', size: 0.016, seed: i } });
    s.capsule(2.72 + i * 0.38, 0.66, 2.86 + i * 0.38, 0.66, 0.02, '#A9A49C', { material: 'metal', lift: 0.015 });
    s.detail(0.01, () => s.circle(2.72 + i * 0.38, 0.66, 0.006, '#C9B29A', { line: false }));
  }
  s.rect(2.5, 0.86, 1.7, 0.06, top, { r: 0.02, texture: { kind: 'speckle', size: 0.02, alpha: 0.3 } });

  // Foreground plant at the right edge: a pot and leaves that sway.
  s.layer(1.3, () => {
    s.rect(4.8, 0, 0.3, 0.32, '#D47A5A', { r: 0.03, fillTo: '#B9603F', material: 'glossy' });
    s.rect(4.78, 0.28, 0.34, 0.05, '#C86B4C', { r: 0.02 });
    const tips = s.branch(4.95, 0.32, { length: 0.16, width: 0.014, color: '#4E8A57', depth: 3, spread: 0.9, t, sway: 0.08 });
    tips.forEach(([x, y], i) => s.ellipse(x, y, 0.05, 0.09, i % 2 ? '#5FA36A' : '#6DB377', { shade: 0.6 }));
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
  const vein = '#2F4F8F', trunk = '#3B5DA8', artery = '#A3302A', muscle = '#C8463F', fat = '#F2D27A';

  // Great vessels behind the heart. Venae cavae bring blue blood into the right atrium.
  s.tube([[-0.05, 0.142], [-0.047, 0.118], [-0.036, 0.1]], 0.015, vein);
  s.tube([[-0.046, 0.012], [-0.047, 0.05], [-0.04, 0.072]], 0.013, vein);
  // Pulmonary veins bring red blood from the lungs into the left atrium.
  s.tube([[0.072, 0.104], [0.054, 0.098], [0.038, 0.094]], 0.008, artery);
  s.tube([[0.072, 0.084], [0.054, 0.086], [0.04, 0.086]], 0.008, artery);
  // Aortic arch with its three branches to the head and arms.
  [[0.016, 0.135], [0.028, 0.139], [0.04, 0.136]].forEach(([x, y], i) => s.tube([[x, y], [x - 0.006 + i * 0.006, y + 0.018]], 0.005, artery));
  s.tube([[0.006, 0.096], [0.008, 0.124], [0.026, 0.138], [0.046, 0.13], [0.052, 0.1], [0.054, 0.06]], 0.016, artery);
  // Pulmonary trunk splits toward both lungs.
  s.tube([[-0.006, 0.096], [-0.01, 0.116], [-0.028, 0.124], [-0.062, 0.122]], 0.013, trunk);
  s.tube([[-0.01, 0.116], [0.016, 0.114], [0.03, 0.11]], 0.008, trunk);

  s.scale(squeeze, squeeze, 0, 0.05, () => {
    // Muscle wall with fibers, a darker apex, and coronary vessels on its surface.
    s.poly([[0.004, 0.0], [-0.03, 0.022], [-0.052, 0.06], [-0.05, 0.096], [-0.03, 0.108], [0.0, 0.1], [0.03, 0.11], [0.052, 0.096], [0.054, 0.058], [0.034, 0.02]], muscle, { smooth: true, fillTo: '#9E302B', material: 'wet', texture: { kind: 'muscle', size: 0.0024, angle: -0.7, alpha: 0.28 } });
    s.detail(0.003, () => {
      s.branch(0.046, 0.07, { angle: -1.75, length: 0.014, width: 0.002, color: '#B8322C', depth: 3, spread: 0.5, seed: 3, line: false, alpha: 0.8 });
      s.branch(-0.046, 0.07, { angle: -1.4, length: 0.012, width: 0.0018, color: '#4A5FA0', depth: 3, spread: 0.5, seed: 8, line: false, alpha: 0.8 });
    });
    // Fat in the groove between the atria and the ventricles.
    s.poly([[-0.052, 0.076], [-0.02, 0.071], [0.02, 0.073], [0.054, 0.08], [0.052, 0.068], [0.02, 0.064], [-0.02, 0.063], [-0.052, 0.066]], fat, { smooth: true, shade: 0.5, line: false, texture: { kind: 'cells', size: 0.003, alpha: 0.3 } });
    // The four chambers, each with a pale inner lining; blue on the body side, red on the lung side.
    const lining = { smooth: true, shade: 0.4, line: '#F3C9C0', lineWidth: 4, material: 'wet' as const };
    s.poly([[-0.044, 0.086], [-0.036, 0.1], [-0.012, 0.1], [-0.008, 0.076], [-0.026, 0.07]], '#7D8FCB', { ...lining, fillTo: '#5E70B0' });
    s.poly([[-0.04, 0.066], [-0.006, 0.07], [-0.002, 0.03], [-0.016, 0.018], [-0.036, 0.036]], '#6577B8', { ...lining, fillTo: '#4B5C9E' });
    s.poly([[0.008, 0.078], [0.012, 0.1], [0.038, 0.102], [0.044, 0.084], [0.028, 0.074]], '#E7867B', { ...lining, fillTo: '#D46A5F' });
    s.poly([[0.004, 0.068], [0.042, 0.07], [0.046, 0.04], [0.026, 0.012], [0.006, 0.024]], '#DD6A5F', { ...lining, fillTo: '#C4504A' });
    // Ridged muscle inside the ventricles, seen up close.
    s.detail(0.002, () => {
      for (let i = 0; i < 5; i += 1) {
        s.capsule(-0.03 + i * 0.0045, 0.038 + (i % 2) * 0.003, -0.029 + i * 0.0045, 0.047, 0.0014, '#4B5C9E', { shade: 0, line: false });
        s.capsule(0.014 + i * 0.006, 0.03 + (i % 2) * 0.003, 0.015 + i * 0.006, 0.04, 0.0014, '#B9473F', { shade: 0, line: false });
      }
    });
    // The septum between the two sides, thicker below.
    s.poly([[-0.002, 0.1], [0.004, 0.1], [0.008, 0.03], [0.002, 0.016], [-0.006, 0.03]], '#B23E38', { smooth: true, texture: { kind: 'muscle', size: 0.002, angle: 1.5, alpha: 0.3 } });
    // Valves move with the beat: the inlet valves (tricuspid, mitral) close on the squeeze,
    // the outlet valves (pulmonary, aortic) open on it.
    const shut = beat.squeeze;
    const leaflet = (x: number, y: number, length: number, angle: number) => s.rotate(angle, x, y, () => s.capsule(x, y, x + length, y, 0.0028, '#F4E1D2', { shade: 0.3, lift: 0.0015 }));
    leaflet(-0.04, 0.07, 0.012, -0.9 * (1 - shut));
    leaflet(-0.012, 0.07, -0.012, 0.9 * (1 - shut));
    leaflet(0.01, 0.074, 0.013, -0.9 * (1 - shut));
    leaflet(0.042, 0.074, -0.013, 0.9 * (1 - shut));
    leaflet(-0.012, 0.096, 0.006, 1.1 * shut);
    leaflet(0.012, 0.096, -0.006, -1.1 * shut);
  });
  s.glow(0, 0.05, 0.07, '#FF8A7A', 0.12 * beat.squeeze);

  // Blood keeps flowing, faster on each squeeze and when the heart races.
  const speed = 0.02 + 0.04 * beat.squeeze + 0.03 * fast;
  s.flow(M.flows['darah-kotor'] as [number, number][], { kind: 'cells', t, speed, size: 0.0055, spacing: 0.009, width: 0.006, color: '#A9C3F0' });
  s.flow(M.flows['darah-bersih'] as [number, number][], { kind: 'cells', t, speed, size: 0.0055, spacing: 0.009, width: 0.006, color: '#FF7468' });
}`;

/** Chest cutaway around the heart: ribs, both lungs, the diaphragm, soft tissue. Width 0.3 m. */
export const EXAMPLE_CHEST = `export function placeDada(s: Story, t: number, state: Record<string, number>) {
  void state;
  const breathe = 1 + 0.02 * s.osc(t, 4);
  // Soft warm light from the front and above; the dark background gives every organ a rim edge.
  s.light({ dir: Math.PI * 0.6, color: '#FFE6DC', strength: 0.9 });
  s.background('#3A1F2B', '#24121B');
  // Far layer: soft tissue, the spine, and the ribs curving around the chest.
  s.layer(0.6, () => {
    s.rect(-0.3, -0.1, 0.9, 0.5, '#4A2633', { shade: 0, line: false, texture: { kind: 'cells', size: 0.012, alpha: 0.18 } });
    for (let i = 0; i < 9; i += 1) s.rect(0.132, 0.2 - i * 0.026, 0.036, 0.021, '#BFA39F', { r: 0.005, shade: 0.5 });
  });
  s.layer(0.75, () => {
    for (let i = 0; i < 7; i += 1) {
      const y = 0.17 - i * 0.026;
      s.poly([[-0.07, y], [0.0, y + 0.016], [0.12, y + 0.014], [0.12, y + 0.006], [0.0, y + 0.008], [-0.07, y - 0.008]], '#C9A9A6', { smooth: true, shade: 0.4, alpha: 0.7, texture: { kind: 'speckle', size: 0.002, alpha: 0.2 } });
      s.poly([[0.37, y], [0.3, y + 0.016], [0.18, y + 0.014], [0.18, y + 0.006], [0.3, y + 0.008], [0.37, y - 0.008]], '#C9A9A6', { smooth: true, shade: 0.4, alpha: 0.7, texture: { kind: 'speckle', size: 0.002, alpha: 0.2 } });
    }
    s.rect(0.142, -0.02, 0.016, 0.22, '#D8C3BE', { r: 0.006, alpha: 0.75 });
  });
  // Trachea with cartilage rings, splitting into the two main bronchi.
  s.tube([[0.15, 0.32], [0.15, 0.175]], 0.016, '#E5B9B4');
  s.detail(0.004, () => { for (let i = 0; i < 6; i += 1) s.line([[0.142, 0.3 - i * 0.022], [0.158, 0.3 - i * 0.022]], 0.003, '#C99590'); });
  s.tube([[0.15, 0.178], [0.11, 0.165], [0.07, 0.14]], 0.011, '#E5B9B4');
  s.tube([[0.15, 0.178], [0.19, 0.165], [0.23, 0.14]], 0.011, '#E5B9B4');
  // Lungs breathe: spongy tissue with bronchi branching inside.
  s.scale(breathe, breathe, 0.15, 0.06, () => {
    s.poly([[0.02, 0.0], [0.0, 0.08], [0.03, 0.15], [0.07, 0.16], [0.095, 0.1], [0.09, 0.02]], '#D9848F', { smooth: true, fillTo: '#C06672', material: 'wet', texture: { kind: 'dots', size: 0.004, alpha: 0.3 } });
    s.poly([[0.28, 0.0], [0.3, 0.08], [0.27, 0.15], [0.23, 0.16], [0.205, 0.1], [0.21, 0.02]], '#D9848F', { smooth: true, fillTo: '#C06672', material: 'wet', texture: { kind: 'dots', size: 0.004, alpha: 0.3 } });
    s.branch(0.07, 0.14, { angle: -1.9, length: 0.04, width: 0.006, color: '#EBC2BE', depth: 5, spread: 0.7, seed: 2, alpha: 0.85 });
    s.branch(0.23, 0.14, { angle: -1.25, length: 0.04, width: 0.006, color: '#EBC2BE', depth: 5, spread: 0.7, seed: 5, alpha: 0.85 });
  });
  // Diaphragm: a muscle dome under the lungs that rises and falls with the breath.
  s.ground('#5A2F3C', 0.0, '#3A1F2B');
  s.poly([[-0.1, 0.0], [0.15, 0.022 - 0.004 * s.osc(t, 4)], [0.4, 0.0], [0.4, -0.02], [-0.1, -0.02]], '#8E4A57', { smooth: true, texture: { kind: 'muscle', size: 0.003, alpha: 0.3 } });
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
  const steel = '#7A8794';
  // Tank stand with cross braces, then a ribbed plastic tank with a lid and a see-through water level.
  s.rect(-0.66, 0, 0.04, 0.6, steel, { fillTo: '#5E6A76', material: 'metal' });
  s.rect(-0.38, 0, 0.04, 0.6, steel, { fillTo: '#5E6A76', material: 'metal' });
  s.line([[-0.64, 0.05], [-0.36, 0.55]], 0.015, '#66727E');
  s.line([[-0.36, 0.05], [-0.64, 0.55]], 0.015, '#66727E');
  s.rect(-0.7, 0.58, 0.4, 0.04, '#5E6A76', { r: 0.01 });
  s.rect(-0.68, 0.62, 0.36, 0.48, '#2E86C1', { r: 0.05, fillTo: '#1F6699', material: 'glossy', texture: { kind: 'stripes', size: 0.05, alpha: 0.25 } });
  s.rect(-0.53, 0.66, 0.06, 0.4, '#BFE3F7', { r: 0.02, material: 'glass', lift: 0.01 });
  s.rect(-0.52, 0.67, 0.04, 0.25 + 0.01 * s.osc(t, 2.4), '#6EC6FF', { line: false, shade: 0 });
  s.ellipse(-0.5, 1.11, 0.13, 0.025, '#2471A3');
  // Pipe with joints at every bend, and the water moving through it: a trickle, a stream when the pump runs.
  s.tube(water, 0.05, '#AEB8C2');
  [1, 2, 4, 5, 6].forEach((i) => s.circle(water[i][0], water[i][1], 0.034, '#97A3AE', { material: 'metal', lift: 0.01 }));
  s.flow(water, { kind: 'drops', t, speed: 0.05 + 0.45 * on, size: 0.022, spacing: 0.05, width: 0.02, color: '#8FD3FF' });
  // Pump: motor with cooling fins, a housing with bolts, a rotor that spins with the flow, a power light.
  s.rect(-0.22, 0.0, 0.34, 0.03, '#4A5560', { r: 0.008 });
  s.rect(-0.2, 0.03, 0.12, 0.17, '#5B6773', { r: 0.02, material: 'metal', texture: { kind: 'stripes', size: 0.012, angle: Math.PI / 2, alpha: 0.35 } });
  s.rect(-0.17, 0.02, 0.24, 0.2, '#3E7CB1', { r: 0.03, fillTo: '#2E6491', material: 'glossy', lift: 0.02 });
  s.circle(-0.05, 0.12, 0.07, '#2B5D87', { fillTo: '#214B6E' });
  s.rotate(t * (1 + 14 * on), -0.05, 0.12, () => {
    for (let i = 0; i < 4; i += 1) s.rotate((i * Math.PI) / 2, -0.05, 0.12, () => s.capsule(-0.05, 0.12, -0.05, 0.18, 0.018, '#D6DEE6', { material: 'metal', lift: 0.006 }));
  });
  s.circle(-0.05, 0.12, 0.014, '#9AA8B5');
  s.detail(0.01, () => [[-0.15, 0.04], [0.05, 0.04], [-0.15, 0.2], [0.05, 0.2]].forEach(([x, y]) => s.circle(x, y, 0.007, '#C5CED6', { line: '#55606B', lineWidth: 1.5, material: 'metal' })));
  s.circle(0.05, 0.19, 0.012, on > 0.5 ? '#7CFC8A' : '#55606B', { line: false, shade: 0 });
  if (on > 0.5) s.glow(0.05, 0.19, 0.04, '#7CFC8A', 0.4);
  // Tap with a handle that turns open, and the drops that fall from it.
  s.rect(0.5, 0.58, 0.16, 0.06, '#B7C1CA', { r: 0.02, fillTo: '#8E99A4', material: 'metal' });
  s.rect(0.62, 0.52, 0.04, 0.08, '#8E99A4', { r: 0.01, material: 'metal' });
  s.rotate(-0.8 * on, 0.56, 0.64, () => s.capsule(0.56, 0.64, 0.56, 0.7, 0.014, '#C0392B'));
  s.emit(0.64, 0.51, { kind: 'drops', t, rate: 2 + 10 * on, life: 0.5, speed: 0.1, direction: -Math.PI / 2, spread: 0.1, gravity: -2, size: 0.02 });
}`;
