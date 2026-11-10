import { ISO_AC_COMPRESSOR_ANCHORS, ISO_AC_COMPRESSOR_CUTAWAY_ANCHORS, ISO_VEHICLE_AC_ANCHORS } from '@/motion-kit/isometric/IsoVehicleAC';
import type { AssetEntry } from './types';

const COMMON = {
  version: '0.1.0',
  status: 'experimental',
  projection: 'isometric-30',
  styles: ['world'],
  bounds: { viewBox: [760, 480], groundOrigin: [380, 300] },
  protectedMaterials: [],
  provenance: { author: 'gmotion', license: 'proprietary', commercialUse: true },
} as const;

export const vehicleAcAsset: AssetEntry = {
  ...COMMON,
  assetId: 'vehicle.ac',
  label: 'Sirkuit AC kendaraan',
  renderer: 'IsoVehicleAC',
  aliases: ['ac mobil', 'ac kendaraan', 'automotive air conditioning', 'sirkuit ac'],
  defaultVariant: 'refrigerant-loop',
  variants: {
    'refrigerant-loop': {
      label: 'Sirkuit refrigeran AC mobil',
      aliases: ['siklus refrigeran', 'kondensor ac mobil', 'evaporator ac mobil'],
      capabilities: ['refrigerant-flow', 'compressor', 'condenser', 'expansion-valve', 'evaporator', 'condenser-fan', 'cabin-blower'],
      anchors: ISO_VEHICLE_AC_ANCHORS,
      limitations: ['Skema isometrik yang memperlihatkan urutan komponen. Posisi komponen berbeda dari pemasangan di mobil.'],
    },
  },
  props: {
    running: { type: 'boolean', default: false, description: 'Menggerakkan kipas dan penanda arah aliran refrigeran' },
    phase: { type: 'number', min: 0, max: 360, default: 0, driven: { speed: 180, activeWhen: 'running' }, description: 'Fase putaran kipas dan penanda aliran' },
  },
  limitations: ['Warna menunjukkan bagian sirkuit secara ilustratif. Suhu dan tekanan tidak disimulasikan.'],
};

export const acCompressorAsset: AssetEntry = {
  ...COMMON,
  assetId: 'vehicle.ac-compressor',
  label: 'Kompresor AC kendaraan',
  renderer: 'IsoACCompressor',
  aliases: ['kompresor ac', 'kompresor ac mobil', 'ac compressor', 'swash plate'],
  defaultVariant: 'exterior',
  variants: {
    exterior: {
      label: 'Casing, puli, dan sambungan refrigeran',
      aliases: ['puli kompresor', 'casing kompresor'],
      capabilities: ['housing', 'pulley-rotation', 'suction-port', 'discharge-port'],
      anchors: ISO_AC_COMPRESSOR_ANCHORS,
      limitations: [],
    },
    cutaway: {
      label: 'Potongan poros, swash plate, dan piston',
      aliases: ['piston kompresor', 'poros kompresor', 'cutaway kompresor'],
      capabilities: ['cutaway', 'pulley-rotation', 'shaft', 'swash-plate', 'piston-stroke'],
      anchors: ISO_AC_COMPRESSOR_CUTAWAY_ANCHORS,
      limitations: ['Dua piston ditampilkan untuk menjelaskan gerak bolak-balik.'],
    },
  },
  props: {
    rotation: { type: 'number', min: -3600, max: 3600, default: 0, animatable: true, description: 'Sudut puli dalam derajat. Pada potongan, sudut ini juga menggerakkan piston.' },
  },
  limitations: ['Model ilustratif kompresor mekanis tipe swash plate dalam satu sudut isometrik.'],
};
