import { ISO_LMPV_ANCHORS } from '@/motion-kit/isometric/IsoLmpv';
import type { AssetEntry } from './types';

const PROVENANCE = { author: 'gmotion', license: 'proprietary', commercialUse: true } as const;

export const lmpvAsset: AssetEntry = {
  assetId: 'vehicle.lmpv',
  version: '0.1.0',
  status: 'experimental',
  label: 'Mobil LMPV 7-seater keluarga',
  renderer: 'IsoLmpv',
  projection: 'isometric-30',
  styles: ['world'],
  aliases: [
    'lmpv', 'ertiga', 'mobil 7 seater', 'mobil keluarga', 'family car',
    '7 seater', 'minivan', 'mobil ertiga', 'mobil 3 baris',
  ],
  defaultVariant: 'family-7seater',
  variants: {
    'family-7seater': {
      label: 'Mobil LMPV 7-seater 3-baris FWD',
      aliases: ['7 seater', '7-seater', 'keluarga', 'family', 'lmpv', 'ertiga', '3 baris', '3-row'],
      capabilities: [
        'exterior', 'cutaway', 'chassis', '7-seater', '3-row-seats', 'double-blower-ac',
        'transverse-fwd-engine', 'macpherson-strut', 'torsion-beam', 'hood-open', 'tailgate-open',
        'door-open', 'window-open', 'wheel-spin', 'headlights', 'projector-led', 'shark-fin-antenna',
        'disc-brakes', 'fuel-tank', 'exhaust-system', 'center-touchscreen',
      ],
      anchors: ISO_LMPV_ANCHORS,
      limitations: [
        'Stylized 7-seater LMPV family car inspired by modern compact MPVs, unbranded for commercial safety',
        'Single fixed isometric view (30-degree)',
        'Illustrative mechanical and interior components',
      ],
    },
  },
  props: {
    color: { type: 'color', default: '#4A5560', material: 'material.body', description: 'Body paint color' },
    view: { type: 'enum', values: ['exterior', 'cutaway', 'chassis'], default: 'exterior', description: 'exterior body, cutaway 3-row interior & FWD engine, or chassis underbody' },
    hoodOpen: { type: 'number', min: 0, max: 1, default: 0, animatable: true, description: 'Engine hood open angle (0 closed to 1 raised)' },
    tailgateOpen: { type: 'number', min: 0, max: 1, default: 0, animatable: true, description: 'Rear tailgate/hatchback open angle (0 closed to 1 raised)' },
    doorOpen: { type: 'number', min: 0, max: 1, default: 0, animatable: true, description: 'Front driver door open angle (0 closed to 1 swung open)' },
    windowOpen: { type: 'number', min: 0, max: 1, default: 0, animatable: true, description: 'Side passenger windows lowered (0 closed to 1 lowered)' },
    wheelRotation: { type: 'number', min: -1e6, max: 1e6, default: 0, animatable: true, subtle: true, description: 'Alloy wheel rotation in degrees' },
    engineRotation: { type: 'number', min: -1e6, max: 1e6, default: 0, animatable: true, subtle: true, description: 'Engine accessory serpentine belt pulley rotation' },
    bodyOpacity: { type: 'number', min: 0, max: 1, default: 1, animatable: true, description: 'Exterior body shell opacity' },
    wheelOpacity: { type: 'number', min: 0, max: 1, default: 1, animatable: true, description: 'Wheel assembly opacity' },
    headlights: { type: 'boolean', default: false, description: 'LED projector headlamps and DRL eyebrow lights' },
    shadow: { type: 'boolean', default: true, description: 'Ground shadow underneath vehicle' },
  },
  bounds: { viewBox: [760, 480], groundOrigin: [380, 300] },
  protectedMaterials: [],
  limitations: [
    'Stylized 7-seater LMPV family car inspired by modern compact MPVs, unbranded for commercial safety',
    'Single fixed isometric view, no rotation',
  ],
  provenance: PROVENANCE,
};
