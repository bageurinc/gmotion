import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { hasVerifiedEmail, type User } from '@/lib/auth/session';

/**
 * Admins are listed by email in ADMIN_EMAILS, comma separated. Nobody is an admin by default.
 * Only Google sign-in proves the email, so password accounts never count, except under
 * `next dev`: a local machine without Google OAuth configured has no other way to reach the
 * admin-only presets. Builds and tests run with another NODE_ENV and keep the strict rule.
 */
export function isAdmin(user: Pick<User, 'email' | 'google_sub'> | null): boolean {
  if (!user) return false;
  if (!hasVerifiedEmail(user) && process.env.NODE_ENV !== 'development') return false;
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}

export const ModelRateSchema = z.object({
  model: z.string().trim().min(1).max(120),
  idrPerMillionInput: z.coerce.number().min(0).max(1e9).default(0),
  idrPerMillionOutput: z.coerce.number().min(0).max(1e9).default(0),
  idrPerImage: z.coerce.number().min(0).max(1e7).default(0),
  idrPerMillionCharacters: z.coerce.number().min(0).max(1e9).default(0),
});
export type ModelRateInput = z.infer<typeof ModelRateSchema>;

/** A new rate applies from now on; usage before it keeps the rate that was in force. */
export async function addModelRate(input: ModelRateInput, now = Date.now()): Promise<void> {
  await getDb().run(
    `INSERT INTO model_rates (id, model, idr_per_million_input, idr_per_million_output, idr_per_image,
       idr_per_million_characters, effective_from, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), input.model, input.idrPerMillionInput, input.idrPerMillionOutput, input.idrPerImage,
      input.idrPerMillionCharacters, now, now]
  );
}

// Each usage row priced with the newest rate for its model that started before the request.
// idr stays NULL when the model has no rate yet, so unknown cost is never shown as zero.
const PRICED = `
  WITH priced AS (
    SELECT u.*, (
      SELECT u.input_tokens * r.idr_per_million_input / 1000000.0
           + u.output_tokens * r.idr_per_million_output / 1000000.0
           + u.images * r.idr_per_image
           + u.characters * r.idr_per_million_characters / 1000000.0
      FROM model_rates r
      WHERE r.model = u.model AND r.effective_from <= u.created_at
      ORDER BY r.effective_from DESC
      LIMIT 1
    ) AS idr
    FROM ai_usage u
    WHERE u.created_at >= ?
  )`;

export interface UsageTotals {
  requests: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  images: number;
  characters: number;
  idr: number;
  unpriced: number;
}

const TOTAL_COLUMNS = `
  COUNT(*) AS requests,
  SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS failed,
  SUM(input_tokens) AS inputTokens,
  SUM(output_tokens) AS outputTokens,
  SUM(images) AS images,
  SUM(characters) AS characters,
  COALESCE(SUM(idr), 0) AS idr,
  SUM(CASE WHEN idr IS NULL THEN 1 ELSE 0 END) AS unpriced`;

type Row = Record<string, string | number | null>;
const num = (value: unknown) => Number(value ?? 0);
const totals = (row: Row | undefined): UsageTotals => ({
  requests: num(row?.requests),
  failed: num(row?.failed),
  inputTokens: num(row?.inputTokens),
  outputTokens: num(row?.outputTokens),
  images: num(row?.images),
  characters: num(row?.characters),
  idr: num(row?.idr),
  unpriced: num(row?.unpriced),
});

export interface CostSummary {
  since: number;
  total: UsageTotals;
  byStage: Array<UsageTotals & { stage: string }>;
  byModel: Array<UsageTotals & { model: string; hasRate: boolean }>;
  byPreset: Array<{ preset: string; videos: number; averageIdr: number; maxIdr: number }>;
  topProjects: Array<{ projectId: string; preset: string | null; email: string | null; idr: number; requests: number; unpriced: number }>;
  revenueIdr: number;
  videosCharged: number;
  rates: RateView[];
  upcoming: RateView[];
}

export interface RateView {
  model: string;
  idrPerMillionInput: number;
  idrPerMillionOutput: number;
  idrPerImage: number;
  idrPerMillionCharacters: number;
  effectiveFrom: number;
}

const rateView = (row: Row): RateView => ({
  model: String(row.model),
  idrPerMillionInput: num(row.idrPerMillionInput),
  idrPerMillionOutput: num(row.idrPerMillionOutput),
  idrPerImage: num(row.idrPerImage),
  idrPerMillionCharacters: num(row.idrPerMillionCharacters),
  effectiveFrom: num(row.effectiveFrom),
});

export async function costSummary(since: number): Promise<CostSummary> {
  const db = getDb();
  const [total] = await db.all<Row>(`${PRICED} SELECT ${TOTAL_COLUMNS} FROM priced`, [since]);
  const byStage = await db.all<Row>(`${PRICED} SELECT stage, ${TOTAL_COLUMNS} FROM priced GROUP BY stage ORDER BY idr DESC, requests DESC`, [since]);
  const byModel = await db.all<Row>(
    `${PRICED} SELECT model, ${TOTAL_COLUMNS}, EXISTS (SELECT 1 FROM model_rates r WHERE r.model = priced.model) AS hasRate
     FROM priced GROUP BY model ORDER BY idr DESC, requests DESC`,
    [since]
  );
  // A video's cost is everything spent on its project, including draft, revisions, and captions.
  const byPreset = await db.all<Row>(
    `${PRICED}, per_project AS (
       SELECT project_id, MAX(preset) AS preset, COALESCE(SUM(idr), 0) AS idr
       FROM priced WHERE project_id IS NOT NULL GROUP BY project_id
       HAVING SUM(CASE WHEN stage = 'generate' THEN 1 ELSE 0 END) > 0
     )
     SELECT COALESCE(preset, 'tidak diketahui') AS preset, COUNT(*) AS videos, AVG(idr) AS averageIdr, MAX(idr) AS maxIdr
     FROM per_project GROUP BY preset ORDER BY averageIdr DESC`,
    [since]
  );
  const topProjects = await db.all<Row>(
    `${PRICED} SELECT p.project_id AS projectId, MAX(p.preset) AS preset, MAX(users.email) AS email,
       COALESCE(SUM(p.idr), 0) AS idr, COUNT(*) AS requests, SUM(CASE WHEN p.idr IS NULL THEN 1 ELSE 0 END) AS unpriced
     FROM priced p LEFT JOIN users ON users.id = p.user_id
     WHERE p.project_id IS NOT NULL GROUP BY p.project_id ORDER BY idr DESC, requests DESC LIMIT 20`,
    [since]
  );
  const revenue = await db.first<Row>(`SELECT COALESCE(SUM(amount), 0) AS idr FROM payments WHERE status = 'paid' AND paid_at >= ?`, [since]);
  const charged = await db.first<Row>(`SELECT COUNT(*) AS videos FROM credit_ledger WHERE reason = 'generate' AND created_at >= ?`, [since]);
  const rates = await db.all<Row>(
    `SELECT model, idr_per_million_input AS idrPerMillionInput, idr_per_million_output AS idrPerMillionOutput,
       idr_per_image AS idrPerImage, idr_per_million_characters AS idrPerMillionCharacters, effective_from AS effectiveFrom
     FROM model_rates r
     WHERE effective_from = (SELECT MAX(effective_from) FROM model_rates WHERE model = r.model AND effective_from <= ?)
     ORDER BY model`,
    [Date.now()]
  );
  // Scheduled price changes, such as a provider's announced increase, shown so they are not a surprise.
  const upcoming = await db.all<Row>(
    `SELECT model, idr_per_million_input AS idrPerMillionInput, idr_per_million_output AS idrPerMillionOutput,
       idr_per_image AS idrPerImage, idr_per_million_characters AS idrPerMillionCharacters, effective_from AS effectiveFrom
     FROM model_rates WHERE effective_from > ? ORDER BY effective_from, model`,
    [Date.now()]
  );

  return {
    since,
    total: totals(total),
    byStage: byStage.map((row) => ({ ...totals(row), stage: String(row.stage) })),
    byModel: byModel.map((row) => ({ ...totals(row), model: String(row.model), hasRate: num(row.hasRate) === 1 })),
    byPreset: byPreset.map((row) => ({ preset: String(row.preset), videos: num(row.videos), averageIdr: num(row.averageIdr), maxIdr: num(row.maxIdr) })),
    topProjects: topProjects.map((row) => ({
      projectId: String(row.projectId),
      preset: row.preset === null ? null : String(row.preset),
      email: row.email === null ? null : String(row.email),
      idr: num(row.idr),
      requests: num(row.requests),
      unpriced: num(row.unpriced),
    })),
    revenueIdr: num(revenue?.idr),
    videosCharged: num(charged?.videos),
    rates: rates.map(rateView),
    upcoming: upcoming.map(rateView),
  };
}
