import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db/client';
import { StylePresetSchema, type StylePreset } from '@/types/studio';
import { ASSET_REGISTRY } from './registry';
import { DraftMetaSchema, type DraftMeta } from './draft-contract';
import { checkDraft } from './draft-runtime';
import { getDraft, getVersion, type DraftReportSummary } from './library-db';
import { PUBLISHED_RENDERER, type AssetEntry } from './types';

export interface PublishedAsset {
  entry: AssetEntry;
  code: string;
  previews: DraftReportSummary['previews'];
  status: 'active' | 'deprecated';
}

type Row = { subject?: string | null; id: string; asset_id: string; version: string; draft_id: string; draft_version: number; preset: string; status: 'active' | 'deprecated'; code: string; metadata: string; previews: string; published_by: string | null; published_at: number };

/** Turns reviewed draft metadata into a registry entry the catalog, validator, and renderer accept. */
export function draftMetaToEntry(meta: DraftMeta, row: Pick<Row, 'id' | 'asset_id' | 'version' | 'draft_id' | 'draft_version' | 'preset' | 'status' | 'published_by' | 'published_at'>): AssetEntry {
  const preset: StylePreset = StylePresetSchema.catch('world').parse(row.preset);
  return {
    assetId: row.asset_id,
    version: row.version,
    status: row.status === 'deprecated' ? 'deprecated' : 'experimental',
    label: meta.label,
    renderer: PUBLISHED_RENDERER,
    projection: 'isometric-30',
    styles: [preset],
    aliases: meta.aliases,
    defaultVariant: meta.defaultVariant,
    variants: Object.fromEntries(Object.entries(meta.variants).map(([id, variant]) => [id, { ...variant, aliases: [] }])),
    props: meta.props as AssetEntry['props'],
    bounds: { viewBox: [760, 480], groundOrigin: [380, 300] },
    protectedMaterials: [],
    limitations: meta.limitations,
    provenance: { author: 'gmotion (draf AI, dikurasi admin)', license: 'proprietary', commercialUse: true },
    published: { id: row.id, draftId: row.draft_id, draftVersion: Number(row.draft_version), publishedAt: Number(row.published_at), publishedBy: row.published_by },
  };
}

function toPublished(row: Row): PublishedAsset | null {
  const meta = DraftMetaSchema.safeParse(JSON.parse(row.metadata));
  if (!meta.success) return null;
  // The subject users asked for ("lampu merah") always finds the asset, even when the
  // model chose other aliases. Added at read time, so published rows stay untouched.
  const subject = row.subject?.toLowerCase().trim();
  if (subject && !meta.data.aliases.includes(subject)) meta.data.aliases = [subject, ...meta.data.aliases];
  let previews: PublishedAsset['previews'] = [];
  try { previews = JSON.parse(row.previews); } catch { /* previews are only for display */ }
  return { entry: draftMetaToEntry(meta.data, row), code: row.code, previews, status: row.status };
}

export async function listPublishedAssets(options: { includeDeprecated?: boolean } = {}): Promise<PublishedAsset[]> {
  const rows = await getDb().all<Row>(
    `SELECT p.*, d.subject FROM published_assets p LEFT JOIN asset_drafts d ON d.id = p.draft_id ${options.includeDeprecated ? '' : "WHERE p.status = 'active'"} ORDER BY p.asset_id, p.published_at DESC`,
  );
  return rows.map(toPublished).filter((item): item is PublishedAsset => item !== null);
}

/** Exact asset versions, active or deprecated, so a project pinned to one keeps rendering. */
export async function getPublishedVersions(keys: ReadonlyArray<{ assetId: string; version: string }>): Promise<PublishedAsset[]> {
  const found: PublishedAsset[] = [];
  for (const key of keys) {
    const row = await getDb().first<Row>('SELECT p.*, d.subject FROM published_assets p LEFT JOIN asset_drafts d ON d.id = p.draft_id WHERE p.asset_id = ? AND p.version = ?', [key.assetId, key.version]);
    const item = row && toPublished(row);
    if (item) found.push(item);
  }
  return found;
}

/**
 * Code assets plus the latest active version of each published asset. New plans see this
 * catalog; older versions stay renderable through getPublishedVersions.
 */
export async function loadAssetCatalog(): Promise<AssetEntry[]> {
  const latest = new Map<string, AssetEntry>();
  for (const item of await listPublishedAssets()) if (!latest.has(item.entry.assetId)) latest.set(item.entry.assetId, item.entry);
  const codeIds = new Set(ASSET_REGISTRY.map((entry) => entry.assetId));
  return [...ASSET_REGISTRY, ...[...latest.values()].filter((entry) => !codeIds.has(entry.assetId))];
}

const slug = (text: string) => text.normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 40) || 'aset';

function nextVersion(previous: string | undefined): string {
  if (!previous) return '0.1.0';
  const [major, minor] = previous.split('.').map(Number);
  return `${major}.${minor + 1}.0`;
}

export type PublishResult =
  | { ok: true; assetId: string; version: string }
  | { ok: false; reason: string };

/**
 * Publishes the draft's active version. The checks run again on the stored code, so a
 * version saved before a rule changed cannot slip through on an old report.
 */
export async function publishDraft(draftId: string, publishedBy: string | null): Promise<PublishResult> {
  const draft = await getDraft(draftId);
  if (!draft) return { ok: false, reason: 'Draf tidak ditemukan.' };
  if (draft.status === 'published') return { ok: false, reason: 'Draf ini sudah terbit. Buka lagi untuk membuat versi baru.' };
  if (draft.status === 'rejected') return { ok: false, reason: 'Draf yang ditolak tidak bisa diterbitkan.' };
  const version = draft.currentVersion ? await getVersion(draftId, draft.currentVersion) : null;
  if (!version) return { ok: false, reason: 'Belum ada versi untuk diterbitkan.' };
  const report = checkDraft(version.code, version.metadata);
  if (!report.ready) {
    const failed = report.checks.filter((check) => !check.ok).map((check) => check.label).join(', ');
    return { ok: false, reason: `Pemeriksaan belum lolos: ${failed}.` };
  }
  const meta = DraftMetaSchema.parse(version.metadata);

  const db = getDb();
  // A draft keeps its published asset id across versions; a new draft gets a free one.
  const earlier = await db.first<{ asset_id: string; version: string }>('SELECT asset_id, version FROM published_assets WHERE draft_id = ? ORDER BY published_at DESC LIMIT 1', [draftId]);
  let assetId = earlier?.asset_id;
  if (!assetId) {
    const base = `custom.${slug(draft.subject ?? draft.label)}`;
    const taken = new Set([
      ...ASSET_REGISTRY.map((entry) => entry.assetId),
      ...(await db.all<{ asset_id: string }>('SELECT DISTINCT asset_id FROM published_assets WHERE asset_id = ? OR asset_id LIKE ?', [base, `${base}-%`])).map((row) => row.asset_id),
    ]);
    assetId = base;
    for (let index = 2; taken.has(assetId); index += 1) assetId = `${base}-${index}`;
  }
  const latest = await db.first<{ version: string }>('SELECT version FROM published_assets WHERE asset_id = ? ORDER BY published_at DESC LIMIT 1', [assetId]);
  const nextNumber = nextVersion(latest?.version);
  const now = Date.now();
  await db.run(
    'INSERT INTO published_assets (id, asset_id, version, draft_id, draft_version, preset, status, code, metadata, previews, published_by, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [randomUUID(), assetId, nextNumber, draftId, version.number, draft.preset, 'active', version.code, JSON.stringify(meta), JSON.stringify(report.previews), publishedBy, now],
  );
  await db.run("UPDATE asset_drafts SET status = 'published', updated_at = ? WHERE id = ?", [now, draftId]);
  return { ok: true, assetId, version: nextNumber };
}

/** Lets a published draft be revised again; the next publish becomes a new version. */
export async function reopenDraft(draftId: string): Promise<boolean> {
  return (await getDb().run("UPDATE asset_drafts SET status = 'review', updated_at = ? WHERE id = ? AND status = 'published'", [Date.now(), draftId])) > 0;
}

/** Withdraws an asset from new plans. Projects pinned to it keep rendering. */
export async function setPublishedStatus(assetId: string, status: 'active' | 'deprecated'): Promise<number> {
  return getDb().run('UPDATE published_assets SET status = ? WHERE asset_id = ?', [status, assetId]);
}
