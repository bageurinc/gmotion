import type { StylePreset } from '@/types/studio';
import { ASSET_REGISTRY } from './registry';
import type { AssetEntry } from './types';

export interface CatalogMatch {
  entry: AssetEntry;
  /** Variants named in the text. Empty means the asset matched but no variant was named. */
  variants: string[];
  matchedAliases: string[];
}

const normalize = (text: string) => ` ${text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
const mentions = (haystack: string, alias: string) => haystack.includes(normalize(alias));

/**
 * Finds registered assets a prompt or narration points at, by whole-word alias. A name match
 * only means the object exists; callers still check that its capabilities cover the topic.
 */
export function findAssets(text: string, style: StylePreset, registry: readonly AssetEntry[] = ASSET_REGISTRY): CatalogMatch[] {
  const haystack = normalize(text);
  const matches: CatalogMatch[] = [];
  for (const entry of registry) {
    if (entry.status === 'deprecated' || !entry.styles.includes(style)) continue;
    const variants = Object.entries(entry.variants)
      .filter(([, variant]) => variant.aliases.some((alias) => mentions(haystack, alias)))
      .map(([id]) => id);
    const matchedAliases = entry.aliases.filter((alias) => mentions(haystack, alias));
    // A variant word alone ("EV", "bensin") still points at its asset.
    if (matchedAliases.length || variants.length) matches.push({ entry, variants, matchedAliases });
  }
  return matches;
}

/** Compact metadata for the model prompt: only matched assets, with limitations kept. */
export function describeForPrompt(matches: readonly CatalogMatch[]) {
  return matches.map(({ entry, variants }) => {
    const shown = variants.length ? variants : Object.keys(entry.variants);
    return {
      assetId: entry.assetId,
      version: entry.version,
      label: entry.label,
      variants: Object.fromEntries(shown.map((id) => {
        const variant = entry.variants[id];
        return [id, {
          label: variant.label,
          capabilities: variant.capabilities,
          anchors: Object.keys(variant.anchors),
          limitations: variant.limitations,
        }];
      })),
      props: Object.fromEntries(Object.entries(entry.props)
        .filter(([, spec]) => !spec.variants || spec.variants.some((id) => shown.includes(id)))
        .map(([name, spec]) => [name, {
          type: spec.type,
          ...(spec.type === 'number' ? { min: spec.min, max: spec.max } : {}),
          ...(spec.type === 'enum' ? { values: spec.values } : {}),
          ...(spec.variants ? { variants: spec.variants } : {}),
          ...(spec.animatable ? { animatable: true } : {}),
        }])),
      limitations: entry.limitations,
    };
  });
}
