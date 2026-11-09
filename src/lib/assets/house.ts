import { ISO_HOUSE_ANCHORS, ISO_SINK_ANCHORS } from '@/motion-kit/isometric/IsoHouse';
import type { AssetEntry } from './types';

const provenance = { author: 'gmotion', license: 'proprietary', commercialUse: true } as const;
const bounds = { viewBox: [760, 480], groundOrigin: [380, 300] } as const;

export const houseAsset: AssetEntry = {
  assetId: 'building.house',
  version: '0.1.0',
  status: 'experimental',
  label: 'Rumah tinggal keluarga dengan dapur dan kamar mandi',
  renderer: 'IsoHouse',
  projection: 'isometric-30',
  styles: ['world'],
  aliases: [
    'rumah', 'hunian', 'house', 'home', 'residence', 'ruangan', 'kamar', 'room', 'interior',
    'dapur', 'kamar mandi', 'kitchen', 'bathroom',
    'rumah mewah', 'luxury house', 'villa', 'mansion', 'modern house', 'modern villa', 'rumah 2 lantai', 'hunian mewah',
  ],
  defaultVariant: 'residential',
  variants: {
    residential: {
      label: 'Rumah tinggal keluarga',
      aliases: ['rumah', 'house', 'home', 'residential', 'tempat tinggal'],
      capabilities: [
        'exterior', 'cutaway', 'hinged-door', 'window-lights', 'pitched-roof', 'chimney',
        'kitchen', 'kitchen-sink', 'kitchen-faucet',
        'bathroom', 'bathroom-sink', 'bathroom-faucet', 'shower',
        'running-water', 'furnished-interior',
        'garden', 'carport',
      ],
      anchors: ISO_HOUSE_ANCHORS,
      limitations: ['Single-story gable house design, illustrative only', 'No structural engineering calculations or blueprint schematics'],
    },
    luxury: {
      label: 'Rumah mewah modern 2 lantai dengan kolam renang, garasi mobil, dan taman',
      aliases: [
        'rumah mewah', 'luxury house', 'villa', 'mansion', 'modern house',
        'modern villa', 'rumah 2 lantai', 'hunian mewah', 'luxury',
      ],
      capabilities: [
        'exterior', 'cutaway', 'hinged-door', 'window-lights',
        'swimming-pool', 'pool-deck', 'balcony', 'two-story',
        'garage', 'carport', 'garden',
        'kitchen-island', 'kitchen-sink', 'kitchen-faucet',
        'bathroom', 'double-vanity', 'freestanding-tub', 'running-water',
        'furnished-interior',
      ],
      anchors: ISO_HOUSE_ANCHORS,
      limitations: ['Two-story modern villa illustration, not an architectural engineering blueprint'],
    },
    room: {
      label: 'Ruangan interior potongan',
      aliases: ['ruangan', 'kamar', 'room', 'interior', 'diorama'],
      capabilities: [
        'cutaway', 'window-lights',
        'kitchen', 'kitchen-sink', 'kitchen-faucet',
        'bathroom', 'bathroom-sink', 'bathroom-faucet', 'shower',
        'running-water', 'furnished-interior',
      ],
      anchors: ISO_HOUSE_ANCHORS,
      limitations: ['Interior diorama only, no exterior roof or facade'],
    },
  },
  props: {
    view: { type: 'enum', values: ['exterior', 'cutaway'], default: 'exterior', variants: ['residential', 'luxury'], description: 'exterior facade or cutaway interior view' },
    doorOpen: { type: 'number', min: 0, max: 1, default: 0, animatable: true, description: 'Hinged front door, 0 closed to 1 open' },
    windowLit: { type: 'boolean', default: false, description: 'Window and interior lighting on or off' },
    waterRunning: { type: 'boolean', default: false, description: 'Flow water from kitchen and bathroom faucets into sinks' },
    flowPhase: { type: 'number', min: 0, max: 1000, default: 0, driven: { speed: 0.8, activeWhen: 'waterRunning' }, description: 'Moving faucet streams and supply-pipe water' },
    plumbingVisible: { type: 'boolean', default: false, description: 'Expose the kitchen supply pipe in the cutaway view' },
    carInGarage: { type: 'boolean', default: false, variants: ['residential', 'luxury'], description: 'Park a car inside the carport/garage' },
    carColor: { type: 'color', default: '#243342', material: 'material.body', variants: ['residential', 'luxury'], description: 'Parked car color' },
    garden: { type: 'boolean', default: true, variants: ['residential', 'luxury'], description: 'Lush green garden with grass lawn, stepping stones, and ornamental shrubs' },
    poolColor: { type: 'color', default: '#38B2C6', material: 'material.water', variants: ['luxury'], description: 'Swimming pool water color' },
    wallColor: { type: 'color', default: '#E3DDCF', material: 'material.wall', description: 'Wall surface paint color' },
    roofColor: { type: 'color', default: '#9C4B3E', material: 'material.roof', variants: ['residential', 'luxury'], description: 'Roof color' },
    floorColor: { type: 'color', default: '#C4A882', material: 'material.floor', description: 'Interior floor parquet color' },
    doorColor: { type: 'color', default: '#5D4037', material: 'material.door', description: 'Door wood color' },
  },
  bounds,
  protectedMaterials: [],
  limitations: [
    'Single fixed isometric projection',
    'Illustrative architecture, not an architectural engineering model',
    'Plumbing and piping are illustrative representations',
  ],
  provenance,
};

export const sinkAsset: AssetEntry = {
  assetId: 'building.sink',
  version: '0.1.0',
  status: 'experimental',
  label: 'Wastafel dan keran air',
  renderer: 'IsoSink',
  projection: 'isometric-30',
  styles: ['world'],
  aliases: [
    'wastafel', 'keran', 'keran air', 'sink', 'faucet', 'tap',
    'cuci piring', 'cuci tangan', 'bak cuci', 'water tap',
  ],
  defaultVariant: 'kitchen',
  variants: {
    kitchen: {
      label: 'Wastafel cuci piring dapur dengan keran leher angsa',
      aliases: ['wastafel dapur', 'kitchen sink', 'cuci piring'],
      capabilities: ['kitchen-sink', 'gooseneck-faucet', 'running-water', 'drain', 'countertop'],
      anchors: ISO_SINK_ANCHORS,
      limitations: ['Illustrative plumbing sink unit, no pipe pressure or flow rate physics'],
    },
    bathroom: {
      label: 'Wastafel cuci tangan kamar mandi',
      aliases: ['wastafel kamar mandi', 'bathroom sink', 'cuci tangan', 'vanity'],
      capabilities: ['bathroom-sink', 'mixer-faucet', 'running-water', 'drain', 'vanity'],
      anchors: ISO_SINK_ANCHORS,
      limitations: ['Illustrative bathroom vanity sink unit'],
    },
  },
  props: {
    waterRunning: { type: 'boolean', default: false, description: 'Stream water from the faucet into the basin' },
    counterColor: { type: 'color', default: '#3F5251', material: 'material.counter', description: 'Countertop material color' },
    basinColor: { type: 'color', default: '#B8C7C8', material: 'material.sink', description: 'Sink basin finish color' },
  },
  bounds,
  protectedMaterials: [],
  limitations: ['Single fixed isometric projection', 'Illustrative plumbing without real flow rate or pressure calculations'],
  provenance,
};
