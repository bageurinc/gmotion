import { runWithUsage } from '@/lib/billing/usage';
import { NextRequest, NextResponse } from 'next/server';
import { applyDraftUpdate, DraftUpdateSchema } from '@/lib/pipeline/draft';
import { requireProject } from '@/lib/auth/project-access';
import { getProject, saveProject } from '@/lib/storage/project-store';
import { DraftRevisionInputSchema } from '@/lib/security/project-input';
import { MAX_DRAFT_REVISIONS, reviseDraft } from '@/lib/pipeline/draft-revision';

// One AI draft revision per project at a time, so the limit and the saved draft stay consistent.
const globalDraftRevisions = globalThis as typeof globalThis & { __gmotionDraftRevisions?: Set<string> };
const activeDraftRevisions = (globalDraftRevisions.__gmotionDraftRevisions ??= new Set<string>());

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const access = await requireProject(projectId);
  if ('response' in access) return access.response;
  const { project } = access;
  if (project.status !== 'draft') {
    return NextResponse.json({ error: 'Draf ini sudah diproses dan tidak bisa diubah lagi.' }, { status: 409 });
  }

  const input = DraftUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: 'Isi draf tidak valid.' }, { status: 400 });
  }

  const updated = {
    ...project,
    storyboard: applyDraftUpdate(project.storyboard, input.data),
    // A manual edit after an AI revision would be lost by undoing it, so undo ends here.
    draftBeforeRevision: undefined,
    updatedAt: Date.now(),
  };
  saveProject(updated);
  return NextResponse.json({ project: updated });
}

/** Rewrites the draft from a plain instruction, such as "buat lebih santai" or "tambah adegan soal harga". */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const access = await requireProject(projectId);
  if ('response' in access) return access.response;
  const { project } = access;
  if (project.status !== 'draft') {
    return NextResponse.json({ error: 'Draf ini sudah diproses dan tidak bisa diubah lagi.' }, { status: 409 });
  }
  const input = DraftRevisionInputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: 'Tulis instruksi perubahan minimal beberapa kata.' }, { status: 400 });
  }
  if ('undo' in input.data) {
    if (!project.draftBeforeRevision) {
      return NextResponse.json({ error: 'Tidak ada perubahan AI yang bisa dikembalikan.' }, { status: 409 });
    }
    const restored = { ...project, storyboard: project.draftBeforeRevision, draftBeforeRevision: undefined, updatedAt: Date.now() };
    saveProject(restored);
    return NextResponse.json({ project: restored, revisionsLeft: MAX_DRAFT_REVISIONS - (project.draftRevisionCount ?? 0) });
  }

  const { instruction } = input.data;
  const used = project.draftRevisionCount ?? 0;
  if (used >= MAX_DRAFT_REVISIONS) {
    return NextResponse.json(
      { error: 'Jatah ubah draf dengan AI sudah habis. Kamu masih bisa mengedit draf secara manual.', revisionsLeft: 0 },
      { status: 429 }
    );
  }
  if (activeDraftRevisions.has(projectId)) {
    return NextResponse.json({ error: 'Perubahan sebelumnya masih diproses.' }, { status: 409 });
  }

  activeDraftRevisions.add(projectId);
  try {
    const result = await runWithUsage(
      { userId: access.user.id, projectId, preset: project.storyboard.preset, stage: 'draft-revision' },
      () => reviseDraft(project.storyboard, instruction, project.userPrompt)
    );
    // The model call takes a while; generation may have started meanwhile.
    const latest = getProject(projectId);
    if (latest?.status !== 'draft') {
      return NextResponse.json({ error: 'Draf ini sudah diproses dan tidak bisa diubah lagi.' }, { status: 409 });
    }
    const updated = {
      ...latest,
      storyboard: result.storyboard,
      draftBeforeRevision: latest.storyboard,
      draftRevisionCount: used + 1,
      updatedAt: Date.now(),
    };
    saveProject(updated);
    return NextResponse.json({ project: updated, summary: result.summary, revisionsLeft: MAX_DRAFT_REVISIONS - used - 1 });
  } catch (error) {
    console.error('[API /storyboard POST] Draft revision failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Draf gagal diubah. Coba lagi.' }, { status: 500 });
  } finally {
    activeDraftRevisions.delete(projectId);
  }
}
