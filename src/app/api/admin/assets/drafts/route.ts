import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { isAdmin } from '@/lib/billing/costs';
import { createDraftFromRequest, CreateDraftSchema, DraftStatusSchema, setDraftStatus } from '@/lib/assets/library-db';

/**
 * Admin form actions for asset drafts: open a draft from a requested subject, or reject
 * and restore one. Non-admins get 404 so the route stays hidden.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const back = new URL('/admin/assets', req.url);
  const action = form?.get('action');

  if (action === 'create') {
    const input = CreateDraftSchema.safeParse({ subject: form?.get('subject'), preset: form?.get('preset') });
    back.searchParams.set('tab', 'draf');
    if (!input.success) {
      back.searchParams.set('pesan', 'Permintaan tidak valid. Nama objek harus 2–60 karakter dan gaya harus dikenal.');
      return NextResponse.redirect(back, 303);
    }
    const { created, draft } = await createDraftFromRequest(input.data, user?.email ?? null);
    back.searchParams.set('pesan', created ? `Draf "${draft.label}" dibuat.` : `Draf untuk "${draft.label}" sudah ada.`);
    return NextResponse.redirect(back, 303);
  }

  const status = DraftStatusSchema.extract(['draft', 'rejected']).safeParse(form?.get('status'));
  const id = form?.get('id');
  if (action === 'status' && status.success && typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id)) {
    const changed = await setDraftStatus(id, status.data);
    back.searchParams.set('tab', 'draf');
    back.searchParams.set('pesan', changed ? (status.data === 'rejected' ? 'Draf ditolak.' : 'Draf dipulihkan.') : 'Draf tidak ditemukan atau sudah terbit.');
    return NextResponse.redirect(back, 303);
  }

  back.searchParams.set('pesan', 'Aksi tidak dikenal.');
  return NextResponse.redirect(back, 303);
}
