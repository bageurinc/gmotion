import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db/client';
import { cosine, getEmbeddings } from '@/lib/assets/embeddings';
import { assetDocument, searchAssets } from '@/lib/assets/semantic-search';
import { mergeRequestSubjects } from '@/lib/assets/request-merge';
import { recordAssetRequests } from '@/lib/assets/library-db';
import { ASSET_REGISTRY } from '@/lib/assets/registry';

const chat = vi.hoisted(() => vi.fn());
vi.mock('@/lib/explainer/asset-generator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/explainer/asset-generator')>()),
  callChat: chat,
}));

/** Fake embeddings: one axis per keyword, so similarity follows shared words. */
const AXES = ['mobil', 'kendaraan', 'sedan', 'jalan', 'sampah', 'air', 'toko', 'jantung'];
const embed = (text: string) => {
  const lower = text.toLowerCase();
  const vector = AXES.map((word) => (lower.includes(word) ? 1 : 0));
  // "sedan" and "kendaraan" mean a car, as a real model would say.
  if (lower.includes('sedan') || lower.includes('kendaraan')) vector[0] += 1;
  return [...vector, 0.4];
};

function stubEmbeddings() {
  const calls: string[][] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    const input = JSON.parse(init.body).input as string[];
    calls.push(input);
    return new Response(JSON.stringify({ data: input.map((text, index) => ({ index, embedding: embed(text) })) }), { status: 200 });
  }));
  return calls;
}

beforeEach(async () => {
  vi.stubEnv('OPENAI_BASE_URL', 'http://router.test/v1');
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  chat.mockReset();
  await getDb().run('DELETE FROM asset_embeddings');
  await getDb().run('DELETE FROM asset_requests');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('embedding cache', () => {
  it('embeds each text once per model and keeps input order', async () => {
    const calls = stubEmbeddings();
    const first = await getEmbeddings(['mobil', 'jalan', 'mobil']);
    expect(first[0]).toEqual(first[2]);
    expect(calls).toEqual([['mobil', 'jalan']]);
    await getEmbeddings(['jalan', 'sampah']);
    expect(calls[1]).toEqual(['sampah']);
    expect(cosine(first[0], first[1])).toBeLessThan(1);
  });
});

describe('semantic asset search', () => {
  it('finds assets by meaning when no alias matches, and keeps alias matches', async () => {
    stubEmbeddings();
    const byMeaning = await searchAssets('Kenapa sedan senyap?', 'world', ASSET_REGISTRY, { threshold: 0.5 });
    expect(byMeaning.some((match) => match.entry.assetId === 'vehicle.car' || match.entry.assetId === 'vehicle.lmpv')).toBe(true);
    expect(byMeaning[0].via).toBe('semantic');
    const byAlias = await searchAssets('mobil listrik di jalan', 'world', ASSET_REGISTRY, { threshold: 0.5 });
    expect(byAlias.find((match) => match.entry.assetId === 'vehicle.car')).toMatchObject({ via: 'both', variants: ['electric'] });
  });

  it('returns nothing for unrelated topics and falls back to aliases if embeddings fail', async () => {
    stubEmbeddings();
    expect(await searchAssets('jantung memompa', 'world', ASSET_REGISTRY, { threshold: 0.5 })).toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    const fallback = await searchAssets('mobil bensin', 'world', ASSET_REGISTRY);
    expect(fallback.map((match) => [match.entry.assetId, match.via])).toEqual([['vehicle.car', 'alias']]);
  });

  it('describes an asset with its label, aliases, variants, and capabilities', () => {
    const car = ASSET_REGISTRY.find((entry) => entry.assetId === 'vehicle.car')!;
    expect(assetDocument(car)).toMatch(/Mobil MPV\/SUV generik\. mobil, kendaraan.*Mobil listrik \(.*traction-battery/);
  });
});

describe('request merging', () => {
  it('maps synonyms onto logged subjects and keeps new things new', async () => {
    await recordAssetRequests([{ subject: 'orang', kind: 'object' }, { subject: 'meja kasir', kind: 'object' }], { preset: 'world' });
    chat.mockResolvedValueOnce({ text: '{"pejalan kaki":"orang","kasir":"meja kasir","truk":null,"tangga":"tidak ada"}', finishReason: 'stop', usage: {} });
    const merged = await mergeRequestSubjects([
      { subject: 'pejalan kaki', kind: 'object' }, { subject: 'kasir', kind: 'object' }, { subject: 'truk', kind: 'object' }, { subject: 'tangga', kind: 'object' }, { subject: 'orang', kind: 'object' },
    ], 'world', 'model');
    expect(merged.map((gap) => gap.subject)).toEqual(['orang', 'meja kasir', 'truk', 'tangga']);
    expect(chat.mock.calls[0][0].content).toContain('"pejalan kaki"');
    expect(chat.mock.calls[0][0].content).not.toContain('New subjects: ["pejalan kaki","kasir","truk","tangga","orang"]');
  });

  it('skips the model when nothing is logged yet or every subject is known, and survives failures', async () => {
    expect(await mergeRequestSubjects([{ subject: 'orang', kind: 'object' }], 'world', 'model')).toEqual([{ subject: 'orang', kind: 'object' }]);
    await recordAssetRequests([{ subject: 'orang', kind: 'object' }], { preset: 'world' });
    expect(await mergeRequestSubjects([{ subject: 'orang', kind: 'object' }], 'world', 'model')).toHaveLength(1);
    expect(chat).not.toHaveBeenCalled();
    chat.mockRejectedValueOnce(new Error('router down'));
    expect(await mergeRequestSubjects([{ subject: 'manusia', kind: 'object' }], 'world', 'model')).toEqual([{ subject: 'manusia', kind: 'object' }]);
  });
});
