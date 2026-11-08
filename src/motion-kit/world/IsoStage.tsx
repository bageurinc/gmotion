import React, { useLayoutEffect, useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import {
  addVec, blobMesh, BlobLobe, ghostAt, ISO_DIRECTION, ISO_UP, isoCameraAt, IsoCameraKey, IsoMove, offsetAt,
  pointAlong, polylineLength, projectIso, pulseAt, shadeForNormal, Vec3,
} from './iso-math';
import { canvasSize, drawScreen, IsoScreen, screenPlacement, screenStateAt } from './iso-screen';

export interface IsoSolid {
  id: string;
  shape: 'box' | 'cylinder' | 'cone' | 'wedge' | 'plate' | 'tube' | 'blob';
  /** Center of the base. Ignored for tubes. */
  at?: Vec3;
  /** Width (x), height (y), depth (z). */
  size?: Vec3;
  color: string;
  /** Long axis of cylinders and cones. Defaults to upright. */
  axis?: 'x' | 'y' | 'z';
  /** Corner radius for boxes and plates. Tube radius for tubes. */
  radius?: number;
  /** Wall thickness. Turns a box or plate into an open tray. */
  wall?: number;
  /** Tube center line. */
  points?: Vec3[];
  /** Soft masses of a blob, stretched to fill `size`. */
  lobes?: BlobLobe[];
  /** Product interface drawn on one face. */
  screen?: IsoScreen;
  moves?: IsoMove[];
}

export interface IsoFlow {
  points: Vec3[];
  from: number;
  to: number;
  radius?: number;
}

export interface IsoHighlight {
  id: string;
  /** Tints one region of a blob instead of outlining the whole solid. */
  lobe?: number;
  from: number;
  to: number;
}

/** Fades a solid while something behind it is in focus. */
export interface IsoGhost {
  id: string;
  from: number;
  to: number;
}

export interface IsoLabel {
  text: string;
  at: Vec3;
  from: number;
  to: number;
}

export interface IsoWorld {
  background: string;
  accent: string;
  ink: string;
  /** Screen height fraction the camera target sits on. Defaults to the middle. */
  viewCenter?: number;
  solids: IsoSolid[];
  camera: IsoCameraKey[];
  flows?: IsoFlow[];
  highlights?: IsoHighlight[];
  ghosts?: IsoGhost[];
  labels?: IsoLabel[];
  /** "lit" adds lights, soft shadows, rounded boxes, and thin outlines. Older worlds stay flat. */
  look?: 'flat' | 'lit';
  /** World bounds the shadow camera must cover, as half the largest span. */
  reach?: number;
}

const DEFAULT_VIEW_CENTER = 0.5;
const LABEL_MIN_Y = 0.42;
const CAMERA_DISTANCE = 200;
const OUTLINE_PX = 2.5;
const HIGHLIGHT_PX = 9;
/** Depth bias in clip space, so a highlight outline clears the surface its solid rests on. */
const HIGHLIGHT_DEPTH_BIAS = 0.004;
const LABEL_LIFT = 0.075;
const CREASE_ANGLE = 35;
const FLOW_DOT_SPACING = 1.3;
const MIN_FLOW_DOTS = 3;
const MAX_FLOW_DOTS = 30;
const FLOW_DOT_SCALE = 1.35;
const GHOST_OPACITY = 0.14;
const REGION_TINT = 0.62;
/** Below this linear luminance a darker outline would disappear, so it goes lighter instead. */
const DARK_SOLID_LUMINANCE = 0.03;
const DEFAULT_FLOW_RADIUS = 0.14;
const FONT = '"Helvetica Neue", Arial, sans-serif';
const LIT_OUTLINE_PX = 1.4;
const LIT_EDGE_DARKEN = 0.45;
const LIT_ROUNDING = 0.12;
const LIT_MAX_ROUNDING = 0.18;
const SHADOW_MAP = 2048;
const DEFAULT_REACH = 20;

function roundedRect(path: THREE.Shape | THREE.Path, width: number, depth: number, radius: number) {
  const x = -width / 2;
  const y = -depth / 2;
  const r = Math.min(radius, width / 2, depth / 2);
  path.moveTo(x + r, y);
  path.lineTo(x + width - r, y);
  path.absarc(x + width - r, y + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x + width, y + depth - r);
  path.absarc(x + width - r, y + depth - r, r, 0, Math.PI / 2, false);
  path.lineTo(x + r, y + depth);
  path.absarc(x + r, y + depth - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x, y + r);
  path.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
}

function blobGeometry(solid: IsoSolid): THREE.BufferGeometry {
  const lobes = solid.lobes ?? [];
  const mesh = blobMesh(lobes, solid.size ?? [1, 1, 1]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeVertexNormals();
  const palette = lobes.map((lobe) => new THREE.Color(lobe.color ?? solid.color));
  const count = mesh.positions.length / 3;
  const regions = new Float32Array(count * 3);
  for (let vertex = 0; vertex < count; vertex += 1) {
    palette.forEach((color, lobe) => {
      const share = mesh.weights[vertex * mesh.lobeCount + lobe];
      regions[vertex * 3] += color.r * share;
      regions[vertex * 3 + 1] += color.g * share;
      regions[vertex * 3 + 2] += color.b * share;
    });
  }
  geometry.setAttribute('region', new THREE.BufferAttribute(regions, 3));
  geometry.userData.weights = mesh.weights;
  geometry.userData.lobeCount = mesh.lobeCount;
  return geometry;
}

function solidGeometry(solid: IsoSolid, lit = false): THREE.BufferGeometry {
  const [width, height, depth] = solid.size ?? [1, 1, 1];
  if (solid.shape === 'blob') return blobGeometry(solid);
  if (solid.shape === 'tube') {
    const curve = new THREE.CatmullRomCurve3((solid.points ?? []).map((point) => new THREE.Vector3(...point)));
    return new THREE.TubeGeometry(curve, 160, solid.radius ?? 0.1, 12, false);
  }
  if (solid.shape === 'cylinder' || solid.shape === 'cone') {
    const axis = solid.axis ?? 'y';
    const length = axis === 'x' ? width : axis === 'z' ? depth : height;
    const diameter = axis === 'x' ? Math.min(height, depth) : axis === 'z' ? Math.min(width, height) : Math.min(width, depth);
    const top = solid.shape === 'cone' ? 0 : diameter / 2;
    const round = new THREE.CylinderGeometry(top, diameter / 2, length, 64);
    if (axis === 'x') round.rotateZ(-Math.PI / 2);
    if (axis === 'z') round.rotateX(Math.PI / 2);
    return round.translate(0, height / 2, 0);
  }
  if (solid.shape === 'wedge') {
    const profile = new THREE.Shape();
    profile.moveTo(-width / 2, 0);
    profile.lineTo(width / 2, 0);
    profile.lineTo(0, height);
    profile.closePath();
    return new THREE.ExtrudeGeometry(profile, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
  }
  const radius = solid.radius ?? (solid.shape === 'plate' ? Math.min(width, depth) * 0.08 : 0);
  if (radius === 0 && !solid.wall && lit && solid.id !== 'world-base') {
    // Real objects never have razor edges; a small bevel catches light and reads as manufactured.
    const bevel = Math.min(Math.min(width, height, depth) * LIT_ROUNDING, LIT_MAX_ROUNDING);
    return new RoundedBoxGeometry(width, height, depth, 3, bevel).translate(0, height / 2, 0);
  }
  if (radius === 0 && !solid.wall) {
    return new THREE.BoxGeometry(width, height, depth).translate(0, height / 2, 0);
  }
  const outline = new THREE.Shape();
  roundedRect(outline, width, depth, radius);
  if (solid.wall) {
    const hole = new THREE.Path();
    roundedRect(hole, width - solid.wall * 2, depth - solid.wall * 2, Math.max(radius - solid.wall, 0.01));
    outline.holes.push(hole);
  }
  return new THREE.ExtrudeGeometry(outline, { depth: height, bevelEnabled: false, curveSegments: 12 }).rotateX(-Math.PI / 2);
}

function applyShading(geometry: THREE.BufferGeometry, hex: string, lit = false) {
  const base = new THREE.Color(hex);
  const normals = geometry.getAttribute('normal');
  const regions = geometry.getAttribute('region');
  const colors = new Float32Array(normals.count * 3);
  const shades = new Float32Array(normals.count);
  for (let index = 0; index < normals.count; index += 1) {
    // Shades are perceptual values, and vertex colors are linear.
    // Lit worlds leave shading to the lights, so vertex colors carry only the material.
    const shade = lit ? 1 : shadeForNormal([normals.getX(index), normals.getY(index), normals.getZ(index)]) ** 2.2;
    shades[index] = shade;
    const [red, green, blue] = regions ? [regions.getX(index), regions.getY(index), regions.getZ(index)] : [base.r, base.g, base.b];
    colors.set([red * shade, green * shade, blue * shade], index * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.userData.plain = colors.slice();
  geometry.userData.shades = shades;
}

/** Paints one lobe toward the accent, keeping its shading so the form stays readable. */
function tintLobe(geometry: THREE.BufferGeometry, lobe: number | undefined, accent: string) {
  if (geometry.userData.tinted === lobe) return;
  geometry.userData.tinted = lobe;
  const { plain, shades, weights, lobeCount } = geometry.userData as { plain: Float32Array; shades: Float32Array; weights?: Float32Array; lobeCount: number };
  if (!weights) return;
  const color = new THREE.Color(accent);
  const attribute = geometry.getAttribute('color') as THREE.BufferAttribute;
  const colors = attribute.array as Float32Array;
  colors.set(plain);
  if (lobe !== undefined) {
    // A buried lobe has small shares everywhere, so shares are read against its own peak.
    let peak = 1e-6;
    for (let index = 0; index < shades.length; index += 1) peak = Math.max(peak, weights[index * lobeCount + lobe]);
    for (let index = 0; index < shades.length; index += 1) {
      const amount = REGION_TINT * Math.min(1, weights[index * lobeCount + lobe] / peak);
      [color.r, color.g, color.b].forEach((channel, axis) => {
        colors[index * 3 + axis] = THREE.MathUtils.lerp(plain[index * 3 + axis], channel * shades[index], amount);
      });
    }
  }
  attribute.needsUpdate = true;
}

/** Position-only copy with shared vertices, so the hull does not split at hard corners. */
function hullGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const positionOnly = new THREE.BufferGeometry();
  positionOnly.setAttribute('position', geometry.getAttribute('position'));
  if (geometry.index) positionOnly.setIndex(geometry.index);
  const merged = mergeVertices(positionOnly, 1e-3);
  merged.computeVertexNormals();
  return merged;
}

/** Back faces pushed outward by a fixed pixel width. This draws the silhouette of curved solids. */
function hullMaterial(width: number, height: number) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      px: { value: OUTLINE_PX },
      depthBias: { value: 0 },
      tint: { value: new THREE.Color('#000000') },
      resolution: { value: new THREE.Vector2(width, height) },
    },
    vertexShader: `
      uniform float px;
      uniform float depthBias;
      uniform vec2 resolution;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 facing = normalize(normalMatrix * normal);
        clip.xy += normalize(facing.xy + vec2(1e-5)) * px * 2.0 / resolution * clip.w;
        clip.z -= depthBias * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: `
      uniform vec3 tint;
      void main() {
        gl_FragColor = vec4(tint, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

const ScreenFace: React.FC<{ screen: IsoScreen; size: Vec3; opacity: number }> = ({ screen, size, opacity }) => {
  const frame = useCurrentFrame();
  const placement = useMemo(() => screenPlacement(size, screen.face), [size, screen.face]);
  const textures = useMemo(() => screen.states.map((state) => {
    const canvas = document.createElement('canvas');
    Object.assign(canvas, canvasSize(placement.width, placement.height));
    drawScreen(canvas.getContext('2d') as CanvasRenderingContext2D, screen, state, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }), [screen, placement]);
  return (
    <mesh position={placement.position} rotation={placement.rotation} renderOrder={3}>
      <planeGeometry args={[placement.width, placement.height]} />
      <meshBasicMaterial map={textures[screenStateAt(screen.states, frame)]} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} />
    </mesh>
  );
};

const Solid: React.FC<{ solid: IsoSolid; accent: string; highlighted: boolean; lobe?: number; litFrom?: number; ghost: number; lit: boolean }> = ({ solid, accent, highlighted, lobe, litFrom, ghost, lit }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const built = useMemo(() => {
    const geometry = solidGeometry(solid, lit);
    applyShading(geometry, solid.color, lit);
    const base = new THREE.Color(solid.color);
    const luminance = base.r * 0.2126 + base.g * 0.7152 + base.b * 0.0722;
    const edgeColor = luminance < DARK_SOLID_LUMINANCE
      ? base.clone().lerp(new THREE.Color('#FFFFFF'), 0.32)
      : base.clone().multiplyScalar(lit ? LIT_EDGE_DARKEN : 0.12);
    const outline = lit ? LIT_OUTLINE_PX : OUTLINE_PX;

    const crease = new LineSegmentsGeometry();
    crease.setPositions(new THREE.EdgesGeometry(geometry, CREASE_ANGLE).getAttribute('position').array as Float32Array);
    const lineMaterial = new LineMaterial({ color: edgeColor, linewidth: outline });
    lineMaterial.resolution.set(width, height);

    return {
      geometry,
      edgeColor,
      hull: hullGeometry(geometry),
      hullMaterial: hullMaterial(width, height),
      lines: new LineSegments2(crease, lineMaterial),
      outline,
      material: lit
        ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
        : new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    };
  }, [solid, width, height, lit]);

  tintLobe(built.geometry, lobe, accent);
  built.hullMaterial.uniforms.px.value = highlighted ? HIGHLIGHT_PX : built.outline;
  built.hullMaterial.uniforms.depthBias.value = highlighted ? HIGHLIGHT_DEPTH_BIAS : 0;
  built.hullMaterial.depthWrite = !highlighted;
  // A highlighted hull draws over the scene, then its own solid paints over the hull's inside.
  built.lines.renderOrder = highlighted ? 2 : 0;
  (built.hullMaterial.uniforms.tint.value as THREE.Color).set(highlighted ? accent : built.edgeColor);

  const opacity = 1 - (1 - GHOST_OPACITY) * ghost;
  built.material.transparent = ghost > 0;
  built.material.opacity = opacity;
  built.material.depthWrite = ghost === 0;
  const lineMaterial = built.lines.material as LineMaterial;
  lineMaterial.transparent = ghost > 0;
  lineMaterial.opacity = opacity;

  const position = addVec(solid.at ?? [0, 0, 0], offsetAt(frame, solid.moves));
  const scale = solid.shape === 'blob' && litFrom !== undefined ? pulseAt(frame, litFrom, fps) : 1;
  return (
    <group position={position} scale={scale}>
      <mesh geometry={built.geometry} material={built.material} renderOrder={highlighted ? 2 : 0} castShadow={lit && ghost === 0 && solid.id !== 'world-base'} receiveShadow={lit} />
      <mesh geometry={built.hull} material={built.hullMaterial} renderOrder={highlighted ? 1 : 0} visible={ghost === 0} />
      <primitive object={built.lines} />
      {solid.screen && solid.size ? <ScreenFace screen={solid.screen} size={solid.size} opacity={opacity} /> : null}
    </group>
  );
};

const Flow: React.FC<{ flow: IsoFlow; color: string }> = ({ flow, color }) => {
  const frame = useCurrentFrame();
  const length = useMemo(() => polylineLength(flow.points), [flow.points]);
  if (frame < flow.from || frame > flow.to) return null;
  const dots = Math.min(MAX_FLOW_DOTS, Math.max(MIN_FLOW_DOTS, Math.round(length / FLOW_DOT_SPACING)));
  return (
    <>
      {Array.from({ length: dots }, (_, index) => (
        <mesh key={index} position={pointAlong(flow.points, (frame * 0.12 + (index * length) / dots) % length)}>
          <sphereGeometry args={[(flow.radius ?? DEFAULT_FLOW_RADIUS) * FLOW_DOT_SCALE, 16, 12]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </>
  );
};

/** Soft sky fill plus one key light from the back left, so shadows fall toward the camera and stay visible. */
const Lights: React.FC<{ reach: number }> = ({ reach }) => (
  <>
    {/* Physical lights divide by pi, so sky plus key sum to about pi: top faces land near full color without clipping. */}
    <hemisphereLight args={['#FFFFFF', '#8C7B66', 1.7]} />
    <directionalLight
      position={[-reach * 0.5, reach * 2, -reach * 0.15]}
      intensity={1.5}
      castShadow
      shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      shadow-radius={6}
      shadow-camera-left={-reach * 1.5}
      shadow-camera-right={reach * 1.5}
      shadow-camera-top={reach * 1.5}
      shadow-camera-bottom={-reach * 1.5}
      shadow-camera-near={0.5}
      shadow-camera-far={reach * 5}
    />
  </>
);

const CameraRig: React.FC<{ keys: IsoCameraKey[]; centerY: number }> = ({ keys, centerY }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera;

  // Runs before ThreeCanvas advances the frame, because child effects run first.
  useLayoutEffect(() => {
    const { target, zoom } = isoCameraAt(frame, keys);
    const look = addVec(target, ISO_UP, ((centerY - 0.5) * height) / zoom);
    camera.up.set(0, 1, 0);
    camera.position.set(...addVec(look, ISO_DIRECTION, CAMERA_DISTANCE));
    camera.lookAt(...look);
    camera.zoom = zoom;
    camera.near = 1;
    camera.far = CAMERA_DISTANCE * 2;
    camera.updateProjectionMatrix();
  }, [frame, keys, camera, height, centerY]);
  return null;
};

export const IsoStage: React.FC<{ world: IsoWorld }> = ({ world }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const shining = (world.highlights ?? []).filter((item) => frame >= item.from && frame <= item.to);
  const active = new Set(shining.filter((item) => item.lobe === undefined).map((item) => item.id));
  const camera = isoCameraAt(frame, world.camera);
  const centerY = world.viewCenter ?? DEFAULT_VIEW_CENTER;
  const isLit = world.look === 'lit';
  const ghostWindows = new Map<string, IsoGhost[]>();
  for (const ghost of world.ghosts ?? []) ghostWindows.set(ghost.id, [...(ghostWindows.get(ghost.id) ?? []), ghost]);

  return (
    <AbsoluteFill style={{ background: world.background }}>
      <ThreeCanvas width={width} height={height} orthographic flat linear={false} dpr={1} shadows={isLit ? 'soft' : false}>
        <CameraRig keys={world.camera} centerY={centerY} />
        {isLit ? <Lights reach={world.reach ?? DEFAULT_REACH} /> : null}
        {world.solids.map((solid) => (
          <Solid
            key={solid.id}
            solid={solid}
            accent={world.accent}
            highlighted={active.has(solid.id)}
            lobe={shining.find((item) => item.id === solid.id)?.lobe}
            litFrom={shining.find((item) => item.id === solid.id)?.from}
            ghost={ghostAt(frame, ghostWindows.get(solid.id))}
            lit={isLit}
          />
        ))}
        {(world.flows ?? []).map((flow, index) => <Flow key={index} flow={flow} color={world.accent} />)}
      </ThreeCanvas>
      {(world.labels ?? []).filter((label) => frame >= label.from && frame <= label.to).map((label) => {
        const point = projectIso(label.at, camera, { width, height, centerY });
        const labelX = Math.min(width * 0.78, Math.max(width * 0.22, point.x));
        const labelY = Math.max(point.y - height * LABEL_LIFT, height * LABEL_MIN_Y);
        return (
          <React.Fragment key={label.text}>
            <div style={{ position: 'absolute', left: labelX - 2, top: labelY, width: 4, height: Math.max(point.y - labelY, 0), background: world.ink }} />
            <div style={{ position: 'absolute', left: labelX, top: labelY, transform: 'translate(-50%, -100%)', background: world.ink, color: '#FFFFFF', boxShadow: '0 0 0 3px #FFFFFF', borderRadius: 999, padding: '10px 24px', fontFamily: FONT, fontSize: width * 0.032, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {label.text}
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
