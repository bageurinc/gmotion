import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import * as THREE from 'three';

export interface ThreeCarProps {
  /** Car paint color (hex). Default: Metallic Cherry Red. */
  color?: string;
  /** Wheel spin speed multiplier. */
  wheelSpeed?: number;
  /** Whether the headlights and taillights emit glowing light. */
  lightsOn?: boolean;
  /** Whether to animate an orbit around the car. */
  orbit?: boolean;
}

/** 3D Wheel with Rubber Tire, Alloy Rim, Brake Disc, and Caliper */
const Wheel3D: React.FC<{ position: [number, number, number]; rotationZ: number }> = ({ position, rotationZ }) => {
  return (
    <group position={position}>
      {/* Brake caliper (static, does not spin with the rim) */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[0.22, 0.16, 0.14]} />
        <meshStandardMaterial color="#DC2626" roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Rotating wheel assembly (tire + rim + brake rotor) */}
      <group rotation={[0, 0, rotationZ]}>
        {/* Rubber Tire */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.28, 36]} />
          <meshStandardMaterial color="#141A1E" roughness={0.88} metalness={0.08} />
        </mesh>

        {/* Outer Rim Lip */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.29, 36]} />
          <meshStandardMaterial color="#DDE8EC" roughness={0.15} metalness={0.92} />
        </mesh>

        {/* 5-Spoke Alloy Rim Pattern */}
        {Array.from({ length: 5 }, (_, i) => {
          const angle = (i * Math.PI * 2) / 5;
          return (
            <mesh key={i} position={[Math.cos(angle) * 0.14, Math.sin(angle) * 0.14, 0.12]} rotation={[0, 0, angle]}>
              <boxGeometry args={[0.22, 0.045, 0.05]} />
              <meshStandardMaterial color="#F1F6F8" roughness={0.12} metalness={0.95} />
            </mesh>
          );
        })}

        {/* Center Hub & Emblem */}
        <mesh position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.04, 24]} />
          <meshStandardMaterial color="#1E282E" roughness={0.2} metalness={0.8} />
        </mesh>

        {/* Steel Brake Disc behind rim */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.06, 32]} />
          <meshStandardMaterial color="#738289" roughness={0.25} metalness={0.85} />
        </mesh>
      </group>
    </group>
  );
};

/**
 * Procedural 3D Modern Car with Physically-Based Rendering (PBR) Materials:
 * - Clearcoat metallic body paint
 * - Translucent glass cabin
 * - Emissive LED projector headlamps & rear LED light bar
 * - 4 spinning alloy wheels with disk brakes
 * - Directional sunlight casting soft contact shadows
 */
export const ThreeCarScene: React.FC<ThreeCarProps> = ({
  color = '#C91D24', // Metallic Crimson Red
  wheelSpeed = 1,
  lightsOn = true,
  orbit = true,
}) => {
  const frame = useCurrentFrame();

  // Smooth cinematic camera orbit around vehicle
  const cameraAngle = orbit ? (frame * 0.02) : 0.8;
  const cameraDistance = 6.2;
  const cameraX = Math.sin(cameraAngle) * cameraDistance;
  const cameraZ = Math.cos(cameraAngle) * cameraDistance;
  const cameraY = 2.4 + Math.sin(frame * 0.015) * 0.3;

  // Continuous wheel spin
  const wheelRotationZ = -frame * 0.15 * wheelSpeed;

  // Extruded curved aerodynamic side body shape
  const bodyShape = useMemo(() => {
    const shape = new THREE.Shape();
    // Start at bottom rear bumper
    shape.moveTo(-2.2, 0.32);
    // Lower sill curve between wheels
    shape.lineTo(-1.7, 0.32);
    // Rear wheel arch cutout curve
    shape.absarc(-1.3, 0.35, 0.52, Math.PI, 0, true);
    shape.lineTo(0.8, 0.32);
    // Front wheel arch cutout curve
    shape.absarc(1.3, 0.35, 0.52, Math.PI, 0, true);
    // Front bumper lower chin
    shape.lineTo(2.2, 0.35);
    // Front nose curve up to grille
    shape.quadraticCurveTo(2.35, 0.65, 2.15, 0.82);
    // Hood slope back to windshield base
    shape.quadraticCurveTo(1.6, 0.95, 1.05, 1.02);
    // Windshield slope up to roof header
    shape.quadraticCurveTo(0.65, 1.55, 0.35, 1.58);
    // Roofline arching gently back to spoiler
    shape.quadraticCurveTo(-0.8, 1.62, -1.6, 1.52);
    // Rear spoiler overhang & rear windshield slope down
    shape.lineTo(-1.72, 1.54);
    shape.quadraticCurveTo(-1.85, 1.25, -2.1, 0.95);
    // Tailgate vertical shelf and rear bumper
    shape.quadraticCurveTo(-2.28, 0.75, -2.2, 0.32);
    return shape;
  }, []);

  return (
    <>
      {/* Three.js Camera synced to frame */}
      <perspectiveCamera
        makeDefault
        position={[cameraX, cameraY, cameraZ]}
        fov={38}
        onUpdate={(self) => self.lookAt(0, 0.7, 0)}
      />

      {/* Lighting Setup */}
      <ambientLight intensity={0.65} />
      {/* Sky to Ground Ambient Gradient */}
      <hemisphereLight args={['#F0F8FF', '#1A242B', 0.85]} />

      {/* Main Directional Sun Light with Shadows */}
      <directionalLight
        position={[8, 12, 6]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0005}
      />

      {/* Rim light from behind for silhouette highlights */}
      <directionalLight position={[-8, 6, -6]} intensity={0.9} color="#90CDF4" />

      {/* ========================================================================= */}
      {/* CAR 3D ROOT GROUP */}
      {/* ========================================================================= */}
      <group position={[0, 0, 0]}>
        {/* Main Extruded Sculpted Body Shell with PBR Paint */}
        <mesh position={[0, 0, -0.92]} castShadow receiveShadow>
          <extrudeGeometry
            args={[
              bodyShape,
              {
                depth: 1.84,
                bevelEnabled: true,
                bevelSegments: 8,
                steps: 2,
                bevelSize: 0.12,
                bevelThickness: 0.12,
              },
            ]}
          />
          <meshPhysicalMaterial
            color={color}
            roughness={0.18}
            metalness={0.68}
            clearcoat={1.0}
            clearcoatRoughness={0.12}
            reflectivity={0.95}
          />
        </mesh>

        {/* Cabin Glass Greenhouse (Translucent Automotive Glass) */}
        <mesh position={[-0.35, 1.28, 0]} castShadow>
          <boxGeometry args={[1.9, 0.52, 1.62]} />
          <meshPhysicalMaterial
            color="#2B4C5A"
            roughness={0.05}
            metalness={0.1}
            transmission={0.82}
            transparent={true}
            opacity={0.7}
            ior={1.52}
          />
        </mesh>

        {/* Black Roof & Pillars (Pillar Appliques) */}
        <mesh position={[-0.45, 1.56, 0]} castShadow>
          <boxGeometry args={[1.82, 0.08, 1.68]} />
          <meshStandardMaterial color="#11181C" roughness={0.3} metalness={0.5} />
        </mesh>

        {/* Front Hexagonal Chrome Grille */}
        <mesh position={[2.22, 0.62, 0]} rotation={[0, 0, -0.1]} castShadow>
          <boxGeometry args={[0.1, 0.32, 1.15]} />
          <meshStandardMaterial color="#E8F1F5" roughness={0.1} metalness={0.95} />
        </mesh>

        {/* Front Lower Air Dam */}
        <mesh position={[2.22, 0.38, 0]}>
          <boxGeometry args={[0.08, 0.18, 1.35]} />
          <meshStandardMaterial color="#0F1418" roughness={0.9} />
        </mesh>

        {/* Projector LED Headlights (Left & Right) */}
        {[-0.68, 0.68].map((z, i) => (
          <group key={i} position={[2.14, 0.74, z]} rotation={[0, z > 0 ? 0.2 : -0.2, 0]}>
            {/* Outer Clear Casing */}
            <mesh>
              <boxGeometry args={[0.22, 0.16, 0.34]} />
              <meshStandardMaterial
                color={lightsOn ? '#FFF8DC' : '#CCDADC'}
                emissive={lightsOn ? '#FFF4B8' : '#000000'}
                emissiveIntensity={lightsOn ? 1.8 : 0}
                roughness={0.1}
                metalness={0.3}
              />
            </mesh>
            {/* Crystal Projector Bulb Lens */}
            <mesh position={[0.06, 0, 0]}>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial
                color="#FFFFFF"
                emissive={lightsOn ? '#FFFFFF' : '#334155'}
                emissiveIntensity={lightsOn ? 2.5 : 0}
              />
            </mesh>
          </group>
        ))}

        {/* Rear Wrap-Around LED Taillights (Left & Right) */}
        {[-0.78, 0.78].map((z, i) => (
          <mesh key={i} position={[-2.18, 0.88, z]} rotation={[0, z > 0 ? -0.15 : 0.15, 0]}>
            <boxGeometry args={[0.14, 0.24, 0.28]} />
            <meshStandardMaterial
              color={lightsOn ? '#FF1E28' : '#8B1419'}
              emissive={lightsOn ? '#FF0D17' : '#000000'}
              emissiveIntensity={lightsOn ? 2.8 : 0}
              roughness={0.2}
            />
          </mesh>
        ))}

        {/* Side Mirrors (Left & Right) */}
        {[-1.02, 1.02].map((z, i) => (
          <group key={i} position={[0.85, 1.15, z]}>
            {/* Mirror Stalk */}
            <mesh position={[0, -0.06, z > 0 ? -0.06 : 0.06]}>
              <boxGeometry args={[0.06, 0.08, 0.12]} />
              <meshStandardMaterial color="#11181C" roughness={0.4} />
            </mesh>
            {/* Mirror Housing */}
            <mesh>
              <boxGeometry args={[0.18, 0.12, 0.22]} />
              <meshPhysicalMaterial color={color} roughness={0.2} metalness={0.6} clearcoat={1.0} />
            </mesh>
            {/* Mirror Reflective Face */}
            <mesh position={[-0.09, 0, 0]}>
              <planeGeometry args={[0.11, 0.18]} />
              <meshStandardMaterial color="#E2E8F0" roughness={0.05} metalness={0.98} />
            </mesh>
          </group>
        ))}

        {/* 4 Wheels (Front Left/Right, Rear Left/Right) */}
        <Wheel3D position={[1.3, 0.35, 1.0]} rotationZ={wheelRotationZ} />
        <Wheel3D position={[1.3, 0.35, -1.0]} rotationZ={wheelRotationZ} />
        <Wheel3D position={[-1.3, 0.35, 1.0]} rotationZ={wheelRotationZ} />
        <Wheel3D position={[-1.3, 0.35, -1.0]} rotationZ={wheelRotationZ} />
      </group>

      {/* Studio Shadow Receiving Floor Plane */}
      <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.7} metalness={0.1} />
      </mesh>
    </>
  );
};
