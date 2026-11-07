import { NextRequest, NextResponse } from 'next/server';
import { firstSceneWithoutNarration } from '@/lib/pipeline/draft';
import {
  hasRetryableScenes,
  isGenerationActive,
  prepareGeneration,
  runGeneration,
} from '@/lib/pipeline/generation-job';
import { getProject, saveProject } from '@/lib/storage/project-store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (isGenerationActive(projectId)) {
    return NextResponse.json({ error: 'Video ini sedang dibuat.' }, { status: 409 });
  }
  if (project.status !== 'draft' && !hasRetryableScenes(project)) {
    return NextResponse.json({ error: 'Video ini sudah dibuat.' }, { status: 409 });
  }

  const missing = firstSceneWithoutNarration(project.storyboard.scenes);
  if (missing >= 0) {
    return NextResponse.json({ error: `Adegan ${missing + 1} belum punya narasi.` }, { status: 400 });
  }

  const prepared = prepareGeneration(project);
  saveProject(prepared);
  void runGeneration(prepared).catch((err) => {
    console.error('[API /generate] Generation job crashed:', err);
  });

  return NextResponse.json({ project: prepared }, { status: 202 });
}
