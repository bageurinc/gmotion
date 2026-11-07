import { NextRequest, NextResponse } from 'next/server';
import { generateProjectVirtualFiles } from '@/lib/pipeline/coder-agent';
import { firstSceneWithoutNarration, isGenerationStale, normalizeSceneOrder } from '@/lib/pipeline/draft';
import { syncStoryboardWithAudio } from '@/lib/pipeline/tts-engine';
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
  if (project.status === 'generating' && !isGenerationStale(project)) {
    return NextResponse.json({ error: 'Video ini sedang dibuat.' }, { status: 409 });
  }
  if (project.status !== 'draft' && project.status !== 'generating') {
    return NextResponse.json({ error: 'Video ini sudah dibuat.' }, { status: 409 });
  }

  const missing = firstSceneWithoutNarration(project.storyboard.scenes);
  if (missing >= 0) {
    return NextResponse.json({ error: `Adegan ${missing + 1} belum punya narasi.` }, { status: 400 });
  }

  saveProject({
    ...project,
    status: 'generating',
    generationStartedAt: Date.now(),
    generationError: undefined,
    updatedAt: Date.now(),
  });

  try {
    const storyboard = await syncStoryboardWithAudio(normalizeSceneOrder(project.storyboard), projectId);
    const files = await generateProjectVirtualFiles(storyboard);
    const ready = {
      ...project,
      storyboard,
      files,
      status: 'ready' as const,
      generationStartedAt: undefined,
      generationError: undefined,
      updatedAt: Date.now(),
    };
    saveProject(ready);
    return NextResponse.json({ project: ready });
  } catch (err: unknown) {
    console.error('[API /generate] Error generating project:', err);
    const generationError = err instanceof Error ? err.message : 'Video gagal dibuat. Coba lagi.';
    saveProject({
      ...project,
      status: 'draft',
      generationStartedAt: undefined,
      generationError,
      updatedAt: Date.now(),
    });
    return NextResponse.json({ error: generationError }, { status: 500 });
  }
}
