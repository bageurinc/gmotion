import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProject } from '@/lib/storage/project-store';
import { hasFailedScene } from '@/lib/pipeline/draft';
import { renderProvider } from '@/lib/render/render-service';
import { SocialPlatformSchema } from '@/types/studio';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const project = getProject(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status === 'generating' || hasFailedScene(project)) {
      return NextResponse.json({ error: 'Tunggu sampai semua adegan selesai dibuat.' }, { status: 409 });
    }

    const body = await req.text();
    if (body.trim()) {
      let input;
      try { input = JSON.parse(body); } catch {
        return NextResponse.json({ error: 'Invalid export settings' }, { status: 400 });
      }
      const platform = SocialPlatformSchema.safeParse(input?.safeAreaPlatform);
      if (!platform.success) return NextResponse.json({ error: 'Invalid safe area platform' }, { status: 400 });
      project.safeAreaPlatform = platform.data;
    }
    project.safeAreaPlatform ||= 'tiktok';
    project.status = 'rendering';
    saveProject(project);

    console.log(`[API /render] Starting MP4 export for project ${projectId}...`);
    const { outputUrl } = await renderProvider.renderProject(project, (progress) => {
      console.log(`[API /render] Render progress: ${progress}%`);
    });

    project.status = 'ready';
    project.exportVideoUrl = outputUrl;
    project.updatedAt = Date.now();
    saveProject(project);

    return NextResponse.json({
      success: true,
      exportVideoUrl: outputUrl,
      project,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to render MP4 video';
    console.error('[API /render] Error rendering project to MP4:', err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
