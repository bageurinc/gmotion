import type { StylePreset } from '@/types/studio';
import { findAssets, type CatalogMatch } from './catalog';
import { cosine, getEmbeddings } from './embeddings';
import type { AssetEntry } from './types';

/**
 * Calibrated on gemini-embedding-001 (8 November 2026): relevant assets scored 0.63–0.75,
 * topics with no asset at most 0.57. A match needs the floor and must sit within the margin
 * of the best score, which drops near-misses such as a shop for a traffic-light topic.
 */
export const SEMANTIC_THRESHOLD = Number(process.env.ASSET_SEMANTIC_THRESHOLD) || 0.6;
export const SEMANTIC_MARGIN = 0.1;
const TOP_K = 6;

/** The text an asset is embedded as: everything a prompt might call it or ask it to show. */
export function assetDocument(entry: AssetEntry): string {
  const variants = Object.values(entry.variants).map((variant) => `${variant.label} (${variant.capabilities.join(', ')})`);
  return [entry.label, entry.aliases.join(', '), ...variants].join('. ');
}

export interface ScoredMatch extends CatalogMatch {
  score: number;
  via: 'alias' | 'semantic' | 'both';
}

/**
 * Alias matches plus the assets whose description is closest in meaning to the text, so
 * "sedan listrik" finds the car even without that alias. Falls back to aliases alone if
 * embeddings are unavailable, because search must never block a video.
 */
export async function searchAssets(text: string, style: StylePreset, catalog: readonly AssetEntry[], options: { topK?: number; threshold?: number } = {}): Promise<ScoredMatch[]> {
  const alias = findAssets(text, style, catalog);
  const candidates = catalog.filter((entry) => entry.status !== 'deprecated' && entry.styles.includes(style));
  let scores = new Map<string, number>();
  try {
    const [query, ...documents] = await getEmbeddings([text.slice(0, 6000), ...candidates.map(assetDocument)]);
    scores = new Map(candidates.map((entry, index) => [entry.assetId, cosine(query, documents[index])]));
  } catch (error) {
    console.error('[assets] Semantic search unavailable, using aliases only:', error instanceof Error ? error.message : error);
  }
  const threshold = options.threshold ?? SEMANTIC_THRESHOLD;
  const best = Math.max(0, ...scores.values());
  const semantic = [...scores.entries()]
    .filter(([, score]) => score >= threshold && score >= best - (options.threshold === 0 ? 1 : SEMANTIC_MARGIN))
    .sort((a, b) => b[1] - a[1])
    .slice(0, options.topK ?? TOP_K);

  const result = new Map<string, ScoredMatch>();
  for (const match of alias) result.set(match.entry.assetId, { ...match, score: scores.get(match.entry.assetId) ?? 1, via: 'alias' });
  for (const [assetId, score] of semantic) {
    const existing = result.get(assetId);
    if (existing) existing.via = 'both';
    else result.set(assetId, { entry: candidates.find((entry) => entry.assetId === assetId)!, variants: [], matchedAliases: [], score, via: 'semantic' });
  }
  return [...result.values()].sort((a, b) => b.score - a.score);
}
