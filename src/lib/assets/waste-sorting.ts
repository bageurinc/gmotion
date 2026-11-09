import { ISO_WASTE_SORTING_ANCHORS } from '@/motion-kit/isometric/IsoWasteSorting';
import type { AssetEntry } from './types';

export const wasteSortingAsset: AssetEntry = {
  assetId: 'environment.waste-sorting', version: '0.1.0', status: 'experimental',
  label: 'Pemilahan sampah ilustratif', renderer: 'IsoWasteSorting', projection: 'isometric-30', styles: ['world'],
  aliases: ['pemilahan sampah', 'memilah sampah', 'tempat sampah', 'waste sorting', 'waste bins'],
  defaultVariant: 'three-stream',
  variants: {
    'three-stream': {
      label: 'Tiga wadah terpisah', aliases: [],
      capabilities: ['leaf-collection', 'paper-collection', 'bottle-collection', 'item-transfer'],
      anchors: ISO_WASTE_SORTING_ANCHORS,
      limitations: ['Illustrative categories, not a local collection standard; no hazardous waste or sorting machinery'],
    },
  },
  props: {
    item: { type: 'enum', values: ['leaf', 'paper', 'bottle'], default: 'leaf', description: 'Representative object; destination is fixed by its type' },
    progress: { type: 'number', min: 0, max: 1, default: 0, animatable: true, description: 'Move above the matching bin, then deposit; no automatic looping' },
    organicColor: { type: 'color', default: '#527A46', material: 'material.organic-bin', description: 'Leaf bin color; icon retains identity' },
    paperColor: { type: 'color', default: '#A37438', material: 'material.paper-bin', description: 'Paper bin color; icon retains identity' },
    plasticColor: { type: 'color', default: '#367E98', material: 'material.plastic-bin', description: 'Bottle bin color; icon retains identity' },
  },
  bounds: { viewBox: [760, 480], groundOrigin: [380, 300] }, protectedMaterials: [],
  limitations: ['Single fixed isometric view; no 2D asset', 'No river, water treatment, recycling process, quantities, or claims of recyclability', 'Bin colors are illustrative; labels and collection rules must come from scene content'],
  provenance: { author: 'gmotion', license: 'proprietary', commercialUse: true },
};
