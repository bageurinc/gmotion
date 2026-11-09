import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';

// Polyfill FileReader for Node.js environment
if (typeof globalThis.FileReader === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).FileReader = class FileReader {
    onloadend: (() => void) | null = null;
    result: ArrayBuffer | null = null;
    async readAsArrayBuffer(blob: Blob) {
      this.result = await blob.arrayBuffer();
      if (this.onloadend) this.onloadend();
    }
  };
}

import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

async function main() {
  const outputDir = path.resolve('storage/assets/three-car');
  await fs.mkdir(outputDir, { recursive: true });

  const root = new THREE.Group();
  root.name = 'Car_3D_Model';

  // 1. Aerodynamic Car Body Shape
  const shape = new THREE.Shape();
  shape.moveTo(-2.2, 0.32);
  shape.lineTo(-1.7, 0.32);
  shape.absarc(-1.3, 0.35, 0.52, Math.PI, 0, true);
  shape.lineTo(0.8, 0.32);
  shape.absarc(1.3, 0.35, 0.52, Math.PI, 0, true);
  shape.lineTo(2.2, 0.35);
  shape.quadraticCurveTo(2.35, 0.65, 2.15, 0.82);
  shape.quadraticCurveTo(1.6, 0.95, 1.05, 1.02);
  shape.quadraticCurveTo(0.65, 1.55, 0.35, 1.58);
  shape.quadraticCurveTo(-0.8, 1.62, -1.6, 1.52);
  shape.lineTo(-1.72, 1.54);
  shape.quadraticCurveTo(-1.85, 1.25, -2.1, 0.95);
  shape.quadraticCurveTo(-2.28, 0.75, -2.2, 0.32);

  const extrudeSettings = {
    depth: 1.84,
    bevelEnabled: true,
    bevelSegments: 6,
    steps: 2,
    bevelSize: 0.12,
    bevelThickness: 0.12,
  };
  const bodyGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: '#C91D24',
    roughness: 0.18,
    metalness: 0.68,
    clearcoat: 1.0,
    clearcoatRoughness: 0.12,
    name: 'CarPaint_CrimsonRed',
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.name = 'Body_Chassis';
  bodyMesh.position.set(0, 0, -0.92);
  root.add(bodyMesh);

  // 2. Translucent Glass Cabin
  const glassGeo = new THREE.BoxGeometry(1.9, 0.52, 1.62);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#2B4C5A',
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.82,
    transparent: true,
    opacity: 0.7,
    ior: 1.52,
    name: 'Glass_Canopy',
  });
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.name = 'Cabin_Windows';
  glassMesh.position.set(-0.35, 1.28, 0);
  root.add(glassMesh);

  // 3. Black Roof & Pillars
  const roofGeo = new THREE.BoxGeometry(1.82, 0.08, 1.68);
  const roofMat = new THREE.MeshStandardMaterial({
    color: '#11181C',
    roughness: 0.3,
    metalness: 0.5,
    name: 'Black_Pillars',
  });
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.name = 'Roof_Panel';
  roofMesh.position.set(-0.45, 1.56, 0);
  root.add(roofMesh);

  // 4. Chrome Grille
  const grilleGeo = new THREE.BoxGeometry(0.1, 0.32, 1.15);
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#E8F1F5',
    roughness: 0.1,
    metalness: 0.95,
    name: 'Chrome_Trim',
  });
  const grilleMesh = new THREE.Mesh(grilleGeo, chromeMat);
  grilleMesh.name = 'Front_Grille';
  grilleMesh.position.set(2.22, 0.62, 0);
  root.add(grilleMesh);

  // 5. LED Headlights
  const headlampMat = new THREE.MeshStandardMaterial({
    color: '#FFF8DC',
    emissive: '#FFF4B8',
    emissiveIntensity: 1.8,
    name: 'LED_Headlamps',
  });
  for (const z of [-0.68, 0.68]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.34), headlampMat);
    lamp.position.set(2.14, 0.74, z);
    lamp.name = `Headlamp_${z > 0 ? 'Right' : 'Left'}`;
    root.add(lamp);
  }

  // 6. LED Taillights
  const taillampMat = new THREE.MeshStandardMaterial({
    color: '#FF1E28',
    emissive: '#FF0D17',
    emissiveIntensity: 2.8,
    name: 'LED_Taillights',
  });
  for (const z of [-0.78, 0.78]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.28), taillampMat);
    lamp.position.set(-2.18, 0.88, z);
    lamp.name = `Taillight_${z > 0 ? 'Right' : 'Left'}`;
    root.add(lamp);
  }

  // 7. 4 Wheels with Rims and Tires
  const tireMat = new THREE.MeshStandardMaterial({ color: '#141A1E', roughness: 0.88, name: 'Rubber_Tire' });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#DDE8EC', roughness: 0.15, metalness: 0.92, name: 'Alloy_Rim' });
  const caliperMat = new THREE.MeshStandardMaterial({ color: '#DC2626', roughness: 0.3, metalness: 0.6, name: 'Brake_Caliper' });

  const wheelPositions = [
    { name: 'Wheel_Front_Right', pos: [1.3, 0.35, 1.0] as const },
    { name: 'Wheel_Front_Left', pos: [1.3, 0.35, -1.0] as const },
    { name: 'Wheel_Rear_Right', pos: [-1.3, 0.35, 1.0] as const },
    { name: 'Wheel_Rear_Left', pos: [-1.3, 0.35, -1.0] as const },
  ];

  for (const w of wheelPositions) {
    const wGroup = new THREE.Group();
    wGroup.name = w.name;
    wGroup.position.set(...w.pos);

    // Tire
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 24), tireMat);
    tire.rotation.x = Math.PI / 2;
    wGroup.add(tire);

    // Rim
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.29, 24), rimMat);
    rim.rotation.x = Math.PI / 2;
    wGroup.add(rim);

    // Caliper
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.14), caliperMat);
    caliper.position.y = 0.18;
    wGroup.add(caliper);

    root.add(wGroup);
  }

  // Export to .glb binary buffer
  const exporter = new GLTFExporter();
  const glbBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      root,
      (result) => resolve(result as ArrayBuffer),
      (error) => reject(error),
      { binary: true }
    );
  });

  const glbPath = path.join(outputDir, 'mobil-3d.glb');
  await fs.writeFile(glbPath, Buffer.from(glbBuffer));
  console.log(`GLB exported successfully to: ${glbPath} (${(glbBuffer.byteLength / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
