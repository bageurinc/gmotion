/**
 * Generates a new AI version for an asset draft, the same work as "Buat dengan AI" on
 * /admin/assets/draft/[id], for testing without the browser.
 *
 *   npx tsx --env-file=.env scripts/assets/generate-draft.ts --asset draft.lampu-merah [--instruction "..."]
 */
import { getDb } from '../../src/lib/db/client';
import { addVersion, getDraft, getVersion } from '../../src/lib/assets/library-db';
import { generateDraft, reviseDraft } from '../../src/lib/assets/draft-ai';

const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

async function main() {
  const assetId = argument('asset');
  const instruction = argument('instruction');
  const row = await getDb().first<{ id: string }>('SELECT id FROM asset_drafts WHERE asset_id = ?', [assetId ?? '']);
  const draft = row && await getDraft(row.id);
  if (!draft) throw new Error(`Draft ${assetId} not found`);
  const startedAt = Date.now();
  const current = draft.currentVersion ? await getVersion(draft.id, draft.currentVersion) : null;
  const result = instruction && current
    ? await reviseDraft({ subject: draft.subject ?? draft.label, code: current.code, meta: current.metadata, instruction })
    : await generateDraft({ subject: draft.subject ?? draft.label, label: draft.label });
  const number = await addVersion(draft.id, {
    source: 'ai', instruction: instruction ?? '', model: result.model, code: result.code, metadata: result.meta,
    report: { ready: result.report.ready, checks: result.report.checks, previews: result.report.previews, notes: result.notes.length ? result.notes : undefined },
    createdBy: 'script',
  });
  console.log(`DRAFT ${assetId} v${number}: ${Math.round((Date.now() - startedAt) / 1000)}s, ${result.attempts} attempt(s), model ${result.model}`);
  for (const check of result.report.checks) console.log(`  ${check.ok ? 'ok  ' : 'FAIL'} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
  for (const note of result.notes) console.log(`  note: ${note.slice(0, 300)}`);
  console.log(`  previews: ${result.report.previews.map((preview) => preview.key + (preview.svg ? '' : ' (error)')).join(', ')}`);
}

main().catch((error) => { console.error('FAILED', error instanceof Error ? error.message : error); process.exitCode = 1; });
