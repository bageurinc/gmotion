import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { StylePresetSchema } from '@/types/studio';
import { CoverageGapSchema, type CoverageGap } from './plan-schema';

export const DraftStatusSchema = z.enum(['draft', 'review', 'published', 'rejected']);
export type DraftStatus = z.infer<typeof DraftStatusSchema>;

/** Lowercase and collapse spaces, so "Lampu Merah" and "lampu  merah" count as one request. */
export const normalizeSubject = (subject: string) => subject.toLowerCase().replace(/\s+/g, ' ').trim();

export const AssetRequestSchema = CoverageGapSchema;
export type AssetRequest = CoverageGap;

export const CreateDraftSchema = z.object({
  subject: z.string().transform(normalizeSubject).pipe(z.string().min(2).max(60)),
  preset: StylePresetSchema,
});

export interface RequestedAsset {
  preset: string;
  subject: string;
  kind: string;
  count: number;
  lastAt: number;
  sampleTopic: string | null;
  /** A draft that is not rejected already answers this request. */
  draftStatus: DraftStatus | null;
}

export interface AssetDraft {
  id: string;
  assetId: string;
  version: string;
  label: string;
  preset: string;
  status: DraftStatus;
  source: 'request' | 'manual';
  subject: string | null;
  notes: string;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Logs objects or actions the library could not show. Logging never fails the video:
 * a database problem is reported and the caller carries on.
 */
export async function recordAssetRequests(
  requests: readonly AssetRequest[],
  context: { preset: string; topic?: string; userId?: string; projectId?: string },
): Promise<number> {
  const unique = [...new Map(requests.map((request) => [`${request.kind}:${request.subject}`, request])).values()];
  let saved = 0;
  for (const request of unique) {
    try {
      await getDb().run(
        'INSERT INTO asset_requests (id, created_at, user_id, project_id, preset, subject, kind, topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [randomUUID(), Date.now(), context.userId ?? null, context.projectId ?? null, context.preset, request.subject, request.kind, context.topic?.slice(0, 200) ?? null],
      );
      saved += 1;
    } catch (error) {
      console.error('[assets] Failed to record asset request:', error instanceof Error ? error.message : error);
    }
  }
  return saved;
}

export async function listRequestedAssets(sinceMs = 0): Promise<RequestedAsset[]> {
  const rows = await getDb().all<{ preset: string; subject: string; kind: string; count: number; last_at: number; sample_topic: string | null; draft_status: DraftStatus | null }>(
    `SELECT r.preset, r.subject, MIN(r.kind) AS kind, COUNT(*) AS count, MAX(r.created_at) AS last_at, MAX(r.topic) AS sample_topic,
      (SELECT d.status FROM asset_drafts d WHERE d.subject = r.subject AND d.preset = r.preset AND d.status != 'rejected' ORDER BY d.updated_at DESC LIMIT 1) AS draft_status
     FROM asset_requests r WHERE r.created_at >= ?
     GROUP BY r.preset, r.subject ORDER BY count DESC, last_at DESC LIMIT 200`,
    [sinceMs],
  );
  return rows.map((row) => ({
    preset: row.preset, subject: row.subject, kind: row.kind, count: Number(row.count), lastAt: Number(row.last_at),
    sampleTopic: row.sample_topic, draftStatus: row.draft_status,
  }));
}

type DraftRow = { id: string; asset_id: string; version: string; label: string; preset: string; status: DraftStatus; source: 'request' | 'manual'; subject: string | null; notes: string; created_by: string | null; created_at: number; updated_at: number };
const toDraft = (row: DraftRow): AssetDraft => ({
  id: row.id, assetId: row.asset_id, version: row.version, label: row.label, preset: row.preset, status: row.status,
  source: row.source, subject: row.subject, notes: row.notes, createdBy: row.created_by, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
});

export async function listDrafts(): Promise<AssetDraft[]> {
  const rows = await getDb().all<DraftRow>("SELECT * FROM asset_drafts WHERE status != 'published' ORDER BY CASE status WHEN 'rejected' THEN 1 ELSE 0 END, updated_at DESC LIMIT 200");
  return rows.map(toDraft);
}

const slug = (text: string) => text.normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 40) || 'aset';

/** Opens a draft for a requested subject. A second call for the same subject and style reuses it. */
export async function createDraftFromRequest(input: z.infer<typeof CreateDraftSchema>, createdBy: string | null): Promise<{ created: boolean; draft: AssetDraft }> {
  const db = getDb();
  const existing = await db.first<DraftRow>("SELECT * FROM asset_drafts WHERE subject = ? AND preset = ? AND status != 'rejected' ORDER BY updated_at DESC LIMIT 1", [input.subject, input.preset]);
  if (existing) return { created: false, draft: toDraft(existing) };
  const now = Date.now();
  const base = `draft.${slug(input.subject)}`;
  // A rejected draft keeps its asset id, so a new attempt gets the next free suffix.
  const taken = new Set((await db.all<{ asset_id: string }>('SELECT asset_id FROM asset_drafts WHERE asset_id = ? OR asset_id LIKE ?', [base, `${base}-%`])).map((row) => row.asset_id));
  let assetId = base;
  for (let index = 2; taken.has(assetId); index += 1) assetId = `${base}-${index}`;
  const row: DraftRow = {
    id: randomUUID(), asset_id: assetId, version: '0.0.1', label: input.subject.charAt(0).toUpperCase() + input.subject.slice(1),
    preset: input.preset, status: 'draft', source: 'request', subject: input.subject, notes: '', created_by: createdBy, created_at: now, updated_at: now,
  };
  await db.run(
    'INSERT INTO asset_drafts (id, asset_id, version, label, preset, status, source, subject, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [row.id, row.asset_id, row.version, row.label, row.preset, row.status, row.source, row.subject, row.notes, row.created_by, row.created_at, row.updated_at],
  );
  return { created: true, draft: toDraft(row) };
}

/** Rejecting or restoring a draft. Publishing needs a reviewed asset and is not done here. */
export async function setDraftStatus(id: string, status: Extract<DraftStatus, 'draft' | 'rejected'>): Promise<boolean> {
  return (await getDb().run("UPDATE asset_drafts SET status = ?, updated_at = ? WHERE id = ? AND status != 'published'", [status, Date.now(), id])) > 0;
}

export interface DraftVersion {
  id: string;
  draftId: string;
  number: number;
  source: 'ai' | 'manual' | 'restore';
  instruction: string;
  model: string | null;
  code: string;
  metadata: unknown;
  report: DraftReportSummary;
  createdBy: string | null;
  createdAt: number;
}

/** Stored with each version; previews are SVG markup rendered on the server. */
export interface DraftReportSummary {
  ready: boolean;
  checks: Array<{ id: string; label: string; ok: boolean; detail?: string }>;
  previews: Array<{ key: string; label: string; variant: string; svg: string | null; error: string | null }>;
  /** Validator or model errors when the version could not be produced cleanly. */
  notes?: string[];
}

type VersionRow = { id: string; draft_id: string; number: number; source: DraftVersion['source']; instruction: string; model: string | null; code: string; metadata: string; report: string; created_by: string | null; created_at: number };
const parseJson = (text: string): unknown => { try { return JSON.parse(text); } catch { return null; } };
const toVersion = (row: VersionRow): DraftVersion => ({
  id: row.id, draftId: row.draft_id, number: Number(row.number), source: row.source, instruction: row.instruction, model: row.model,
  code: row.code, metadata: parseJson(row.metadata), report: (parseJson(row.report) as DraftReportSummary) ?? { ready: false, checks: [], previews: [] },
  createdBy: row.created_by, createdAt: Number(row.created_at),
});

export async function getDraft(id: string): Promise<(AssetDraft & { currentVersion: number }) | null> {
  const row = await getDb().first<DraftRow & { current_version: number }>('SELECT * FROM asset_drafts WHERE id = ?', [id]);
  return row ? { ...toDraft(row), currentVersion: Number(row.current_version ?? 0) } : null;
}

export async function listVersions(draftId: string): Promise<DraftVersion[]> {
  return (await getDb().all<VersionRow>('SELECT * FROM asset_draft_versions WHERE draft_id = ? ORDER BY number DESC LIMIT 50', [draftId])).map(toVersion);
}

export async function getVersion(draftId: string, number: number): Promise<DraftVersion | null> {
  const row = await getDb().first<VersionRow>('SELECT * FROM asset_draft_versions WHERE draft_id = ? AND number = ?', [draftId, number]);
  return row ? toVersion(row) : null;
}

/** Saves a new version and makes it current. A draft with a version waits for review. */
export async function addVersion(draftId: string, input: { source: DraftVersion['source']; instruction?: string; model?: string | null; code: string; metadata: unknown; report: DraftReportSummary; createdBy: string | null }): Promise<number> {
  const db = getDb();
  const last = await db.first<{ number: number }>('SELECT MAX(number) AS number FROM asset_draft_versions WHERE draft_id = ?', [draftId]);
  const number = Number(last?.number ?? 0) + 1;
  const now = Date.now();
  await db.run(
    'INSERT INTO asset_draft_versions (id, draft_id, number, source, instruction, model, code, metadata, report, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [randomUUID(), draftId, number, input.source, (input.instruction ?? '').slice(0, 1000), input.model ?? null, input.code, JSON.stringify(input.metadata ?? null), JSON.stringify(input.report), input.createdBy, now],
  );
  await db.run("UPDATE asset_drafts SET current_version = ?, updated_at = ?, status = CASE WHEN status = 'draft' THEN 'review' ELSE status END WHERE id = ?", [number, now, draftId]);
  return number;
}
