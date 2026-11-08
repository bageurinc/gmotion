import { ISO_CAR_ANCHORS } from '@/motion-kit/isometric/IsoCar';
import { ISO_ELECTRIC_CAR_ANCHORS } from '@/motion-kit/isometric/ElectricCarMechanics';
import type { AssetEntry } from './types';

const SHARED_CAR_ANCHORS = {
  front: ISO_CAR_ANCHORS.front,
  rear: ISO_CAR_ANCHORS.rear,
  frontWheel: ISO_CAR_ANCHORS.frontWheel,
  rearWheel: ISO_CAR_ANCHORS.rearWheel,
  frontWindow: ISO_CAR_ANCHORS.frontWindow,
  rearWindow: ISO_CAR_ANCHORS.rearWindow,
  cabin: ISO_CAR_ANCHORS.cabin,
  roof: ISO_CAR_ANCHORS.roof,
};

const PROVENANCE = { author: 'gmotion', license: 'proprietary', commercialUse: true } as const;

const vehicleCar: AssetEntry = {
  assetId: 'vehicle.car',
  version: '0.1.0',
  status: 'experimental',
  label: 'Mobil MPV/SUV generik',
  renderer: 'IsoCar',
  projection: 'isometric-30',
  styles: ['world'],
  aliases: ['mobil', 'kendaraan', 'car', 'vehicle', 'mpv', 'suv'],
  defaultVariant: 'petrol',
  variants: {
    petrol: {
      label: 'Mobil bensin',
      aliases: ['bensin', 'petrol', 'gasoline', 'bbm', 'mesin pembakaran', 'combustion'],
      capabilities: [
        'exterior', 'cutaway', 'chassis', 'wheel-spin', 'window-open', 'hood-open', 'accessory-pulleys',
        'engine-bay', 'fuel-tank', 'transmission', 'driveshaft', 'differential', 'exhaust', 'suspension', 'disc-brakes',
      ],
      anchors: {
        ...SHARED_CAR_ANCHORS,
        engine: ISO_CAR_ANCHORS.engine,
        radiator: ISO_CAR_ANCHORS.radiator,
        compressor: ISO_CAR_ANCHORS.compressor,
        battery: ISO_CAR_ANCHORS.battery,
        transmission: ISO_CAR_ANCHORS.transmission,
        driveshaft: ISO_CAR_ANCHORS.driveshaft,
        differential: ISO_CAR_ANCHORS.differential,
        fuelTank: ISO_CAR_ANCHORS.fuelTank,
        exhaust: ISO_CAR_ANCHORS.exhaust,
      },
      limitations: [
        'Front engine with rear-wheel drive, illustrative only',
        'No pistons, valves, crankshaft, or combustion cycle',
        'Accessory belt surface does not travel',
      ],
    },
    electric: {
      label: 'Mobil listrik',
      aliases: ['listrik', 'electric', 'ev', 'bev', 'baterai', 'battery electric'],
      capabilities: [
        'exterior', 'cutaway', 'chassis', 'wheel-spin', 'window-open', 'hood-open', 'traction-battery',
        'battery-modules', 'electric-motor', 'inverter', 'reduction-gear', 'onboard-charger', 'charge-port',
        'ev-cooling', 'energy-flow', 'suspension', 'disc-brakes',
      ],
      anchors: { ...SHARED_CAR_ANCHORS, ...ISO_ELECTRIC_CAR_ANCHORS },
      limitations: [
        'Front-wheel drive, illustrative only',
        'Ten battery modules are an illustration, not a capacity',
        'No rotor/stator internals, regenerative braking, or plugged-in charging cable',
      ],
    },
  },
  props: {
    color: { type: 'color', default: '#CF5A3C', material: 'material.body', description: 'Body paint; shades are derived' },
    view: { type: 'enum', values: ['exterior', 'cutaway', 'chassis'], default: 'exterior', description: 'exterior, see-through shell, or shell and floor removed' },
    windowOpen: { type: 'number', min: 0, max: 1, default: 0, animatable: true, description: 'Both side windows, closed 0 to lowered 1' },
    wheelRotation: { type: 'number', min: -1e6, max: 1e6, default: 0, animatable: true, description: 'Wheel angle in degrees' },
    bodyOpacity: { type: 'number', min: 0, max: 1, default: 1, animatable: true, description: 'Painted shell opacity' },
    hoodOpen: { type: 'number', min: 0, max: 1, default: 0, animatable: true, description: 'Hood closed 0 to raised 1' },
    wheelOpacity: { type: 'number', min: 0, max: 1, default: 1, animatable: true, description: 'Fade tires to expose brakes' },
    headlights: { type: 'boolean', default: false, description: 'Bright headlight lenses, no beam' },
    shadow: { type: 'boolean', default: true, description: 'Ground shadow' },
    engineRotation: { type: 'number', min: -1e6, max: 1e6, default: 0, animatable: true, variants: ['petrol'], description: 'Accessory pulley angle in degrees' },
    motorRotation: { type: 'number', min: -1e6, max: 1e6, default: 0, animatable: true, variants: ['electric'], description: 'Motor shaft detail angle in degrees' },
    batteryCoverOpacity: { type: 'number', min: 0, max: 1, default: 0.15, animatable: true, variants: ['electric'], description: 'Battery lid opacity; 0 exposes the modules' },
    chargePortOpen: { type: 'boolean', default: false, variants: ['electric'], description: 'Open the charging socket flap' },
    energyFlow: { type: 'boolean', default: false, variants: ['electric'], description: 'Illustrative battery to wheel energy route' },
    // Driven by the renderer from the frame while energyFlow is on, so the dots keep a readable speed.
    energyPhase: { type: 'number', min: -1e6, max: 1e6, default: 0, variants: ['electric'], description: 'Loop phase of the energy dots' },
  },
  bounds: { viewBox: [760, 480], groundOrigin: [380, 300] },
  protectedMaterials: ['cable.high-voltage', 'flow.energy'],
  limitations: ['Generic vehicle, not a particular manufacturer or model', 'Single fixed isometric view, no rotation'],
  provenance: PROVENANCE,
};

const environmentRoad: AssetEntry = {
  assetId: 'environment.road',
  version: '0.1.0',
  status: 'experimental',
  label: 'Jalan lurus',
  renderer: 'IsoRoad',
  projection: 'isometric-30',
  styles: ['world'],
  aliases: ['jalan', 'jalan raya', 'road', 'highway', 'tol', 'melaju', 'berkendara', 'driving'],
  defaultVariant: 'straight',
  variants: {
    straight: {
      label: 'Jalan lurus searah',
      aliases: [],
      capabilities: ['lanes-1-4', 'moving-lane-marks', 'shoulders'],
      anchors: { center: [0, 0, 0] },
      limitations: ['No curves, intersections, opposing traffic, signs, or traffic lights'],
    },
  },
  props: {
    lanes: { type: 'number', min: 1, max: 4, default: 2, integer: true, description: 'Same-direction lanes' },
    length: { type: 'number', min: 600, max: 2400, default: 1100, description: 'Road length in world units' },
    laneWidth: { type: 'number', min: 220, max: 360, default: 240, description: 'Lane width in world units' },
    distance: { type: 'number', min: -1e6, max: 1e6, default: 0, animatable: true, description: 'Travel distance; moves lane marks' },
    asphalt: { type: 'color', default: '#58676B', material: 'material.road', description: 'Asphalt color' },
    shoulderColor: { type: 'color', default: '#BEC7BB', material: 'material.shoulder', description: 'Shoulder color' },
  },
  bounds: { viewBox: [760, 480], groundOrigin: [380, 300] },
  protectedMaterials: [],
  limitations: ['Lane centre anchors depend on lane count and are not yet exposed'],
  provenance: PROVENANCE,
};

export const ASSET_REGISTRY: readonly AssetEntry[] = [vehicleCar, environmentRoad];

export function getAsset(assetId: string, version?: string, registry: readonly AssetEntry[] = ASSET_REGISTRY) {
  return registry.find((entry) => entry.assetId === assetId && (version === undefined || entry.version === version));
}

/** Pins each asset version a project was planned with, so later registry updates do not change it silently. */
export function registrySnapshot(registry: readonly AssetEntry[] = ASSET_REGISTRY): Record<string, string> {
  return Object.fromEntries(registry.filter((entry) => entry.status !== 'deprecated').map((entry) => [entry.assetId, entry.version]));
}
