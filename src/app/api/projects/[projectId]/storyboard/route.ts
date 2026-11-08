import { NextRequest, NextResponse } from 'next/server';
import { applyDraftUpdate, DraftUpdateSchema } from '@/lib/pipeline/draft';
import { requireProject } from '@/lib/auth/project-access';
import { saveProject } from '@/lib/storage/project-store';

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
    updatedAt: Date.now(),
  };
  saveProject(updated);
  return NextResponse.json({ project: updated });
}
