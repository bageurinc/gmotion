import { ISO_HOME_AC_ANCHORS, ISO_HOME_AC_CUTAWAY_ANCHORS, ISO_HOME_COMPRESSOR_ANCHORS, ISO_HOME_COMPRESSOR_CUTAWAY_ANCHORS, ISO_HOME_INDOOR_ANCHORS, ISO_HOME_INDOOR_CUTAWAY_ANCHORS, ISO_HOME_OUTDOOR_ANCHORS, ISO_HOME_OUTDOOR_CUTAWAY_ANCHORS } from '@/motion-kit/isometric/IsoHomeAC';
import { ISO_HOME_AC_REMOTE_ANCHORS, ISO_HOME_AC_REMOTE_BUTTONS, ISO_HOME_AC_REMOTE_MODES } from '@/motion-kit/isometric/IsoHomeACRemote';
import type { AssetEntry } from './types';

const PREVIEW_SPEED = 180;

const COMMON = {
  version: '0.1.0',
  status: 'experimental',
  projection: 'isometric-30',
  styles: ['world'],
  bounds: { viewBox: [760, 480], groundOrigin: [380, 300] },
  protectedMaterials: [],
  provenance: { author: 'gmotion', license: 'proprietary', commercialUse: true },
} as const;

const casingOpacity = (variant: string): AssetEntry['props'][string] => ({
  type: 'number', min: 0, max: 1, default: 1, animatable: true, variants: [variant],
  description: 'Geser ke 0 untuk memudarkan casing dan memperlihatkan komponen di dalamnya.',
});

export const homeAcAsset: AssetEntry = {
  ...COMMON,
  assetId: 'building.home-ac',
  label: 'AC split rumah',
  renderer: 'IsoHomeAC',
  aliases: ['ac rumah', 'ac ruangan', 'ac split', 'pendingin ruangan', 'split air conditioner'],
  defaultVariant: 'split',
  variants: {
    split: {
      label: 'Unit indoor dan outdoor',
      aliases: ['unit indoor', 'unit outdoor'],
      capabilities: ['indoor-unit', 'outdoor-unit', 'refrigerant-lines', 'cool-airflow', 'heat-rejection', 'fan-rotation'],
      anchors: ISO_HOME_AC_ANCHORS,
      limitations: ['Skema isometrik. Panjang pipa dan jarak antarkomponen bersifat ilustratif.'],
    },
    cutaway: {
      label: 'Potongan unit indoor dan outdoor',
      aliases: ['bagian dalam ac rumah', 'potongan ac split', 'filter ac', 'blower ac rumah', 'pcb ac rumah', 'katup ekspansi ac rumah'],
      capabilities: [
        'cutaway', 'air-filter', 'evaporator-coil', 'crossflow-blower', 'blower-motor', 'drain-pan', 'indoor-control-board',
        'condenser-coil', 'outdoor-fan', 'compressor', 'electronic-expansion-valve', 'inverter-board', 'refrigerant-lines',
      ],
      anchors: ISO_HOME_AC_CUTAWAY_ANCHORS,
      limitations: ['Ilustrasi tata letak AC split inverter. Posisi dan ukuran komponen berbeda menurut model.'],
    },
  },
  props: {
    casingOpacity: casingOpacity('split'),
    running: { type: 'boolean', default: true, description: 'Menampilkan aliran udara sejuk dari unit indoor dan udara hangat dari unit outdoor, serta menggerakkan kipas outdoor dan blower pada tampilan potongan' },
    phase: { type: 'number', min: 0, max: 360, default: 0, previewSpeed: PREVIEW_SPEED, driven: { speed: PREVIEW_SPEED, activeWhen: 'running' }, description: 'Fase gerak kipas dan penanda arah udara' },
  },
  limitations: ['Arah udara ditampilkan secara ilustratif. Suhu dan tekanan tidak disimulasikan.'],
};

const UNIT_MOTION: AssetEntry['props'] = {
  casingOpacity: casingOpacity('exterior'),
  running: { type: 'boolean', default: true, description: 'Mengaktifkan gerak unit' },
  phase: { type: 'number', min: 0, max: 360, default: 0, previewSpeed: PREVIEW_SPEED, driven: { speed: PREVIEW_SPEED, activeWhen: 'running' }, description: 'Fase gerak unit' },
};

export const homeIndoorAsset: AssetEntry = {
  ...COMMON,
  assetId: 'building.home-ac-indoor',
  label: 'Unit indoor AC rumah',
  renderer: 'IsoHomeACIndoor',
  aliases: ['unit indoor ac rumah', 'unit indoor ac', 'ac indoor', 'indoor unit', 'evaporator ac rumah'],
  defaultVariant: 'exterior',
  variants: {
    exterior: {
      label: 'Casing dan kisi udara',
      aliases: ['casing indoor', 'kisi indoor'],
      capabilities: ['housing', 'louver', 'cool-airflow'],
      anchors: ISO_HOME_INDOOR_ANCHORS,
      limitations: [],
    },
    cutaway: {
      label: 'Potongan evaporator, filter, dan blower',
      aliases: ['potongan unit indoor', 'filter ac', 'blower ac rumah'],
      capabilities: ['cutaway', 'air-filter', 'evaporator-coil', 'crossflow-blower', 'blower-motor', 'drain-pan', 'indoor-control-board', 'cool-airflow'],
      anchors: ISO_HOME_INDOOR_CUTAWAY_ANCHORS,
      limitations: [],
    },
  },
  props: UNIT_MOTION,
  limitations: ['Tata letak unit indoor AC split bersifat ilustratif.'],
};

export const homeOutdoorAsset: AssetEntry = {
  ...COMMON,
  assetId: 'building.home-ac-outdoor',
  label: 'Unit outdoor AC rumah',
  renderer: 'IsoHomeACOutdoor',
  aliases: ['unit outdoor ac rumah', 'unit outdoor ac', 'ac outdoor', 'outdoor unit', 'kondensor ac rumah'],
  defaultVariant: 'exterior',
  variants: {
    exterior: {
      label: 'Casing, kisi kondensor, dan kipas',
      aliases: ['casing outdoor', 'kipas outdoor'],
      capabilities: ['housing', 'condenser-grille', 'fan-rotation'],
      anchors: ISO_HOME_OUTDOOR_ANCHORS,
      limitations: [],
    },
    cutaway: {
      label: 'Potongan kondensor, kompresor, dan inverter',
      aliases: ['potongan unit outdoor', 'inverter ac rumah', 'katup ekspansi ac rumah'],
      capabilities: ['cutaway', 'condenser-coil', 'fan-rotation', 'compressor', 'electronic-expansion-valve', 'inverter-board'],
      anchors: ISO_HOME_OUTDOOR_CUTAWAY_ANCHORS,
      limitations: [],
    },
  },
  props: UNIT_MOTION,
  limitations: ['Tata letak unit outdoor AC split inverter bersifat ilustratif.'],
};

export const homeCompressorAsset: AssetEntry = {
  ...COMMON,
  assetId: 'building.home-ac-compressor',
  label: 'Kompresor rotary AC rumah',
  renderer: 'IsoHomeCompressor',
  aliases: ['kompresor ac rumah', 'kompresor ac split', 'kompresor rotary', 'rotary compressor', 'rolling piston compressor'],
  defaultVariant: 'exterior',
  variants: {
    exterior: {
      label: 'Casing hermetik dan pipa refrigeran',
      aliases: ['casing hermetik', 'kompresor hermetik'],
      capabilities: ['sealed-shell', 'suction-port', 'discharge-port', 'electrical-terminals'],
      anchors: ISO_HOME_COMPRESSOR_ANCHORS,
      limitations: [],
    },
    cutaway: {
      label: 'Potongan stator, rotor, dan ruang kompresi rotary',
      aliases: ['potongan kompresor rotary', 'rolling piston', 'roller eksentrik'],
      capabilities: ['cutaway', 'motor', 'stator-windings', 'rotor', 'eccentric-roller', 'sliding-vane', 'shaft-rotation', 'discharge-reed', 'oil-sump'],
      anchors: ISO_HOME_COMPRESSOR_CUTAWAY_ANCHORS,
      limitations: ['Ruang kompresi ditampilkan terbuka agar gerak roller dan vane terlihat.'],
    },
  },
  props: {
    casingOpacity: casingOpacity('exterior'),
    rotation: { type: 'number', min: -3600, max: 3600, default: 0, animatable: true, previewSpeed: PREVIEW_SPEED, variants: ['cutaway'], description: 'Sudut poros dalam derajat, menggerakkan roller eksentrik dan vane' },
  },
  limitations: ['Kompresor rotary tipe rolling piston dalam satu sudut isometrik.'],
};

export const homeAcRemoteAsset: AssetEntry = {
  ...COMMON,
  assetId: 'building.home-ac-remote',
  label: 'Remote AC rumah',
  renderer: 'IsoHomeACRemote',
  aliases: ['remote ac', 'remote ac rumah', 'remot ac', 'remote control ac', 'air conditioner remote'],
  defaultVariant: 'handheld',
  variants: {
    handheld: {
      label: 'Remote genggam inframerah',
      aliases: ['remote inframerah', 'pengendali ac'],
      capabilities: ['temperature-display', 'mode-display', 'button-press', 'infrared-signal'],
      anchors: ISO_HOME_AC_REMOTE_ANCHORS,
      limitations: ['Penekanan tombol dan sinyal inframerah divisualisasikan. Suhu, mode, dan layar diatur melalui kontrol terpisah.'],
    },
  },
  props: {
    temperature: { type: 'number', min: 16, max: 30, default: 24, integer: true, description: 'Suhu yang tampil pada layar dalam °C' },
    mode: { type: 'enum', values: ISO_HOME_AC_REMOTE_MODES, default: 'cool', description: 'Mode yang tampil pada layar' },
    displayOn: { type: 'boolean', default: true, description: 'Menyalakan atau mematikan layar remote' },
    button: { type: 'enum', values: ISO_HOME_AC_REMOTE_BUTTONS, default: 'power', description: 'Tombol yang akan ditekan' },
    press: { type: 'number', min: 0, max: 1, default: 0, animatable: true, description: 'Geser ke 1 untuk menekan tombol dan menampilkan sinyal inframerah' },
  },
  limitations: [],
};
