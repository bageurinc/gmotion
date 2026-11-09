import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { isAdmin } from '@/lib/billing/costs';
import { runWithUsage } from '@/lib/billing/usage';
import { addVersion, getDraft, getVersion, type DraftReportSummary } from '@/lib/assets/library-db';
import { generateDraft, reviseDraft, type DraftResult } from '@/lib/assets/draft-ai';
import { checkDraft } from '@/lib/assets/draft-runtime';
import { DRAFT_CODE_LIMIT } from '@/lib/assets/draft-contract';
import { publishDraft, reopenDraft } from '@/lib/assets/published';

// Generating a draft can take a few model attempts.
export const maxDuration = 300;

const ID = /^[0-9a-f-]{36}$/;
const InstructionSchema = z.string().trim().min(3).max(1000);
const CodeSchema = z.string().min(20).max(DRAFT_CODE_LIMIT);
const MetaTextSchema = z.string().min(2).max(20_000);

const summary = (result: Pick<DraftResult, 'report'> & { notes?: string[] }): DraftReportSummary => ({
  ready: result.report.ready, checks: result.report.checks, previews: result.report.previews, notes: result.notes?.length ? result.notes : undefined,
});

/** Admin actions on one draft: AI generate or revise, manual save, and restore. Non-admins get 404. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { id } = await params;
  const draft = ID.test(id) ? await getDraft(id) : null;
  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const action = form?.get('action');
  const back = (message: string, version?: number) => {
    const url = new URL(`/admin/assets/draft/${id}`, req.url);
    if (version) url.searchParams.set('v', String(version));
    url.searchParams.set('pesan', message);
    return NextResponse.redirect(url, 303);
  };
  if (action === 'reopen') {
    return back(await reopenDraft(id) ? 'Draf dibuka lagi. Terbitkan ulang untuk membuat versi aset baru.' : 'Hanya draf yang sudah terbit yang bisa dibuka lagi.');
  }
  if (draft.status === 'published' || draft.status === 'rejected') return back('Draf yang sudah terbit atau ditolak tidak bisa diubah. Buka lagi jika sudah terbit, atau pulihkan jika ditolak.');
  if (action === 'publish') {
    if (form?.get('confirm') !== 'yes') return back('Centang konfirmasi sebelum menerbitkan.');
    const result = await publishDraft(id, user?.email ?? null);
    return back(result.ok ? `Diterbitkan sebagai ${result.assetId}@${result.version}. Aset ini sekarang ada di katalog video.` : `Belum bisa terbit. ${result.reason}`);
  }
  const createdBy = user?.email ?? null;
  const subject = draft.subject ?? draft.label;

  try {
    if (action === 'generate' || action === 'revise') {
      const current = draft.currentVersion ? await getVersion(id, draft.currentVersion) : null;
      let result: DraftResult;
      let instruction = '';
      if (action === 'revise') {
        const parsed = InstructionSchema.safeParse(form?.get('instruction'));
        if (!parsed.success) return back('Instruksi harus 3–1000 karakter.');
        if (!current) return back('Belum ada versi untuk direvisi. Buat dengan AI dulu.');
        instruction = parsed.data;
        result = await runWithUsage({ userId: user?.id, stage: 'other' }, () => reviseDraft({ subject, code: current.code, meta: current.metadata, instruction }));
      } else {
        result = await runWithUsage({ userId: user?.id, stage: 'other' }, () => generateDraft({ subject, label: draft.label, notes: draft.notes || undefined }));
      }
      const number = await addVersion(id, { source: 'ai', instruction, model: result.model, code: result.code, metadata: result.meta, report: summary(result), createdBy });
      const failed = result.report.checks.filter((check) => !check.ok).length;
      return back(`Versi ${number} dibuat oleh AI dalam ${result.attempts} percobaan${failed ? `, ${failed} pemeriksaan belum lolos` : ', semua pemeriksaan lolos'}.`, number);
    }

    if (action === 'save') {
      const code = CodeSchema.safeParse(form?.get('code'));
      const metaText = MetaTextSchema.safeParse(form?.get('metadata'));
      if (!code.success || !metaText.success) return back('Kode atau metadata kosong atau terlalu panjang.');
      let meta: unknown;
      try { meta = JSON.parse(metaText.data); } catch { return back('Metadata bukan JSON yang valid.'); }
      const report = checkDraft(code.data, meta);
      const number = await addVersion(id, { source: 'manual', code: code.data, metadata: meta, report: summary({ report }), createdBy });
      return back(`Versi ${number} disimpan${report.ready ? ', semua pemeriksaan lolos' : ', ada pemeriksaan yang belum lolos'}.`, number);
    }

    if (action === 'restore') {
      const number = Number(form?.get('version'));
      const source = Number.isInteger(number) ? await getVersion(id, number) : null;
      if (!source) return back('Versi tidak ditemukan.');
      const report = checkDraft(source.code, source.metadata);
      const created = await addVersion(id, { source: 'restore', instruction: `Dari versi ${number}`, model: source.model, code: source.code, metadata: source.metadata, report: summary({ report }), createdBy });
      return back(`Versi ${number} dipulihkan sebagai versi ${created}.`, created);
    }
  } catch (error) {
    console.error('[assets] Draft action failed:', error instanceof Error ? error.message : error);
    return back(`Gagal: ${error instanceof Error ? error.message.slice(0, 200) : 'kesalahan tidak dikenal'}`);
  }

  return back('Aksi tidak dikenal.');
}
