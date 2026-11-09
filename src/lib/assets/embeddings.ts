import { createHash } from 'node:crypto';
import { getDb } from '@/lib/db/client';

export const embeddingModel = () => process.env.ASSET_EMBEDDING_MODEL || 'gemini/gemini-embedding-001';
const BATCH = 64;

const keyOf = (model: string, text: string) => createHash('sha256').update(`${model}\n${text}`).digest('hex');

export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0, left = 0, right = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    left += a[index] * a[index];
    right += b[index] * b[index];
  }
  return left && right ? dot / Math.sqrt(left * right) : 0;
}

async function requestEmbeddings(model: string, texts: readonly string[]): Promise<number[][]> {
  const base = (process.env.OPENAI_BASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!base || !apiKey) throw new Error('OPENAI_BASE_URL and OPENAI_API_KEY are required for embeddings');
  const response = await fetch(`${base}/embeddings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: texts }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Embedding request failed with HTTP ${response.status}`);
  const body = (await response.json()) as { data?: Array<{ index?: number; embedding?: number[] }> };
  const data = body.data ?? [];
  if (data.length !== texts.length) throw new Error('Embedding response does not match the input');
  return data
    .map((item, position) => ({ index: item.index ?? position, embedding: item.embedding }))
    .sort((a, b) => a.index - b.index)
    .map((item) => {
      if (!Array.isArray(item.embedding) || !item.embedding.length) throw new Error('Embedding response has an empty vector');
      return item.embedding;
    });
}

/**
 * Embeddings for each text, from the database cache when possible. Missing ones are fetched
 * in batches and stored, so an asset description is embedded once per model.
 */
export async function getEmbeddings(texts: readonly string[], model = embeddingModel()): Promise<number[][]> {
  const db = getDb();
  const keys = texts.map((text) => keyOf(model, text));
  const found = new Map<string, number[]>();
  for (const key of new Set(keys)) {
    const row = await db.first<{ vector: string }>('SELECT vector FROM asset_embeddings WHERE key = ?', [key]);
    if (row) found.set(key, JSON.parse(row.vector));
  }
  const missing = [...new Map(texts.map((text, index) => [keys[index], text])).entries()].filter(([key]) => !found.has(key));
  for (let start = 0; start < missing.length; start += BATCH) {
    const chunk = missing.slice(start, start + BATCH);
    const vectors = await requestEmbeddings(model, chunk.map(([, text]) => text));
    for (const [position, [key]] of chunk.entries()) {
      const vector = vectors[position];
      found.set(key, vector);
      await db.run('INSERT OR REPLACE INTO asset_embeddings (key, model, dims, vector, created_at) VALUES (?, ?, ?, ?, ?)',
        // Five decimals keep the ranking and roughly halve the stored size.
        [key, model, vector.length, JSON.stringify(vector.map((value) => Math.round(value * 1e5) / 1e5)), Date.now()]);
    }
  }
  return keys.map((key) => found.get(key)!);
}
