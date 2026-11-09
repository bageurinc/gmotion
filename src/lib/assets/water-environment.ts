import { ISO_WATER_CHANNEL_ANCHORS } from '@/motion-kit/isometric/IsoWaterChannel';
import { ISO_WATER_TREATMENT_ANCHORS, ISO_WATER_TREATMENT_UNIT_ANCHORS as UNIT, ISO_WATER_FILTER_OUTLET } from '@/motion-kit/isometric/IsoWaterTreatment';
import type { AssetEntry } from './types';

const provenance = { author: 'gmotion', license: 'proprietary', commercialUse: true } as const;
const bounds = { viewBox: [760, 480], groundOrigin: [380, 300] } as const;
const flowProps = {
  // One unit is one loop; the renderer advances it, so markers always move at a readable pace.
  flowPhase: { type: 'number', min: 0, max: 1000, default: 0, driven: { speed: 0.8, activeWhen: 'flowing' }, description: 'Illustrative forward flow phase, not a flow rate' },
  flowing: { type: 'boolean', default: true, description: 'Show flow markers; the renderer moves them' },
  waterColor: { type: 'color', default: '#80B6C1', material: 'material.water', description: 'Illustrative water surface; color does not indicate safety or quality' },
} as const;

export const waterChannelAsset: AssetEntry = {
  assetId: 'environment.water-channel', version: '0.1.0', status: 'experimental',
  label: 'Sungai dan saluran terbuka', renderer: 'IsoWaterChannel', projection: 'isometric-30', styles: ['world'],
  aliases: ['sungai', 'saluran air', 'river', 'water channel', 'kanal', 'canal'], defaultVariant: 'river',
  variants: {
    river: { label: 'Sungai berkelok ringan', aliases: ['sungai', 'river'], capabilities: ['river-banks', 'forward-water-flow'], anchors: ISO_WATER_CHANNEL_ANCHORS, limitations: ['Fixed shallow bends; no floods, erosion, or pollution simulation'] },
    canal: { label: 'Saluran terbuka lurus', aliases: ['saluran air', 'kanal', 'canal'], capabilities: ['straight-open-channel', 'lined-banks', 'forward-water-flow'], anchors: ISO_WATER_CHANNEL_ANCHORS, limitations: ['No gates, pumps, sewer network, or changing water level'] },
  },
  props: {
    ...flowProps,
    bankColor: { type: 'color', default: '#8DA574', material: 'material.bank', description: 'Bank surface color' },
  }, bounds, protectedMaterials: [], provenance,
  limitations: ['Single isometric view, not a 2D asset', 'Illustrative direction and speed; no hydraulic or water-quality data', 'No automatic physical connection to separate assets'],
};

export const waterTreatmentAsset: AssetEntry = {
  assetId: 'environment.water-treatment', version: '0.1.0', status: 'experimental',
  label: 'Unit bak pengolahan air modular', renderer: 'IsoWaterTreatment', projection: 'isometric-30', styles: ['world'],
  aliases: ['pengolahan air', 'penjernihan air', 'water treatment', 'water treatment plant'], defaultVariant: 'coagulation',
  variants: {
    coagulation: { label: 'Bak pencampuran dan pembentukan flok', aliases: ['koagulasi', 'flokulasi', 'pencampuran'], capabilities: ['coagulation-flocculation-cutaway', 'rotating-mixer', 'disinfectant-dosing-symbol', 'forward-water-flow'], anchors: { inlet: UNIT.inlet, outlet: UNIT.outlet, coagulation: UNIT.coagulation, flocculation: UNIT.flocculation }, limitations: ['Coagulation and flocculation grouped in one illustrative basin'] },
    sedimentation: { label: 'Bak pengendapan', aliases: ['pengendapan', 'sedimentasi'], capabilities: ['settling-particles', 'sludge-bed', 'forward-water-flow'], anchors: { inlet: UNIT.inlet, outlet: UNIT.outlet, sedimentation: UNIT.sedimentation, sludge: UNIT.sludge }, limitations: ['Illustrative particle settling, not removal efficiency'] },
    filtration: { label: 'Bak filtrasi media', aliases: ['filtrasi', 'filter', 'penyaringan'], capabilities: ['filter-media-cutaway', 'downward-filtration', 'forward-water-flow'], anchors: { inlet: UNIT.inlet, outlet: ISO_WATER_FILTER_OUTLET, filtration: UNIT.filtration }, limitations: ['Fixed illustrative media layers; no backwashing'] },
    disinfection: { label: 'Bak disinfeksi', aliases: ['disinfeksi', 'desinfeksi'], capabilities: ['disinfectant-dosing-symbol', 'forward-water-flow'], anchors: { inlet: UNIT.inlet, outlet: UNIT.outlet, disinfection: UNIT.disinfection }, limitations: ['No chemical, dosage, contact time, or performance data'] },
    conventional: {
      label: 'Rangkaian empat bak (kompatibilitas video lama)', aliases: [],
      capabilities: ['coagulation-flocculation-cutaway', 'settling-particles', 'filter-media-cutaway', 'disinfectant-dosing-symbol', 'forward-water-flow'],
      anchors: ISO_WATER_TREATMENT_ANCHORS,
      limitations: ['Legacy fixed four-basin layout; use separate modular variants for new videos', 'Dosing symbols have no chemical, dosage, contact time, or performance data'],
    },
  },
  props: {
    ...flowProps,
    flocculation: { type: 'number', min: 0, max: 1, default: 0, animatable: true, variants: ['coagulation', 'conventional'], description: 'Particles aggregate into larger flocs; illustrative only' },
    dosing: { type: 'boolean', default: true, variants: ['coagulation', 'disinfection', 'conventional'], description: 'Show illustrative dosing into the basin' },
    settling: { type: 'number', min: 0, max: 1, default: 0, animatable: true, variants: ['sedimentation', 'conventional'], description: 'Floc settling illustration, not time or removal efficiency' },
    tankColor: { type: 'color', default: '#9AAEB2', material: 'material.tank', description: 'Cutaway tank material' },
  }, bounds, protectedMaterials: [], provenance,
  limitations: ['Not a complete plant design, wastewater process, or proof of potable water', 'No sludge handling, backwashing, pumps, hydraulic levels, or chemical simulation', 'Media layers and particle counts are illustrative; no capacity or quality values', 'Single isometric view; labels and narration supplied by scene content'],
};
