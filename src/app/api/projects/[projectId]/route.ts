import { NextRequest, NextResponse } from 'next/server';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { ProjectUpdateSchema } from '@/lib/security/project-input';
import { getProject, saveProject } from '@/lib/storage/project-store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = getProject(projectId);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const existing = getProject(projectId);

  if (!existing) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (existing.status === 'generating') {
    return NextResponse.json({ error: 'Tunggu sampai semua adegan selesai dibuat.' }, { status: 409 });
  }

  const input = ProjectUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: 'Perubahan project tidak valid.' }, { status: 400 });
  }

  const errors = Object.entries(input.data.files ?? {})
    .filter(([name, code]) => code !== existing.files[name])
    .flatMap(([name, code]) => validateSceneCode(code, name).errors);
  if (errors.length) {
    return NextResponse.json({ error: errors[0], errors }, { status: 400 });
  }

  const updated = {
    ...existing,
    ...input.data,
    files: { ...existing.files, ...input.data.files },
    updatedAt: Date.now(),
  };

  saveProject(updated);
  return NextResponse.json({ project: updated });
}
