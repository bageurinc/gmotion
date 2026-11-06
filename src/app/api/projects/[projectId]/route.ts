import { NextRequest, NextResponse } from 'next/server';
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

  const body = await req.json();
  const updated = {
    ...existing,
    ...body,
    id: projectId,
    updatedAt: Date.now(),
  };

  saveProject(updated);
  return NextResponse.json({ project: updated });
}
