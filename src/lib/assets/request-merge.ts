import { callChat } from '@/lib/explainer/asset-generator';
import { getDb } from '@/lib/db/client';
import { cosine, getEmbeddings } from './embeddings';
import type { CoverageGap } from './plan-schema';

/** Above this many known subjects, embeddings shortlist candidates before the model decides. */
const SHORTLIST_ABOVE = 40;
const SHORTLIST_SIZE = 15;

const SYSTEM = `You keep a list of visual assets that users asked for. For each new subject, decide whether an existing subject means the same thing to draw (a synonym or a more specific wording of the same object, place, or action), so the requests can be counted together.
Return one JSON object mapping every new subject to an existing subject copied exactly, or to null when it is something different. Nothing else.
Be strict: "orang" and "pejalan kaki" are the same drawing; "mobil" and "truk" are not; "kasir" and "meja kasir" are the same; "jantung" and "darah" are not.`;

/**
 * Maps new request subjects onto subjects already logged for the style, so "pejalan kaki"
 * counts toward "orang" instead of opening its own row. Single-word embeddings cannot tell
 * synonyms from unrelated words, so the model decides; embeddings only shortlist candidates
 * once the list is long. Any failure keeps the subjects as they were.
 */
export async function mergeRequestSubjects(gaps: readonly CoverageGap[], preset: string, model: string): Promise<CoverageGap[]> {
  if (!gaps.length) return [];
  try {
    const known = (await getDb().all<{ subject: string }>(
      'SELECT subject, COUNT(*) AS count FROM asset_requests WHERE preset = ? GROUP BY subject ORDER BY count DESC LIMIT 300', [preset],
    )).map((row) => row.subject);
    const knownSet = new Set(known);
    const fresh = [...new Set(gaps.map((gap) => gap.subject).filter((subject) => !knownSet.has(subject)))];
    if (!fresh.length || !known.length) return dedupe(gaps);

    let candidates = known;
    if (known.length > SHORTLIST_ABOVE) {
      const vectors = await getEmbeddings([...fresh, ...known]);
      const freshVectors = vectors.slice(0, fresh.length);
      const knownVectors = vectors.slice(fresh.length);
      const picked = new Set<string>();
      for (const vector of freshVectors) {
        known.map((subject, index) => ({ subject, score: cosine(vector, knownVectors[index]) }))
          .sort((a, b) => b.score - a.score).slice(0, SHORTLIST_SIZE).forEach((item) => picked.add(item.subject));
      }
      candidates = [...picked];
    }

    const { text } = await callChat({
      model,
      system: SYSTEM,
      content: `Existing subjects: ${JSON.stringify(candidates)}\nNew subjects: ${JSON.stringify(fresh)}`,
      maxTokens: 600,
    });
    const json = text.match(/\{[\s\S]*\}/);
    const mapping = json ? (JSON.parse(json[0]) as Record<string, unknown>) : {};
    const allowed = new Set(candidates);
    return dedupe(gaps.map((gap) => {
      const target = mapping[gap.subject];
      return typeof target === 'string' && allowed.has(target) ? { ...gap, subject: target } : gap;
    }));
  } catch (error) {
    console.error('[assets] Request merge failed, keeping subjects as written:', error instanceof Error ? error.message : error);
    return dedupe(gaps);
  }
}

const dedupe = (gaps: readonly CoverageGap[]) => [...new Map(gaps.map((gap) => [gap.subject, gap])).values()];
