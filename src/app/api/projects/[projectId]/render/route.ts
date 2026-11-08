import { NextRequest, NextResponse } from 'next/server';
import { requireProject } from '@/lib/auth/project-access';
import { getProject, saveProject } from '@/lib/storage/project-store';
import { hasFailedScene } from '@/lib/pipeline/draft';
import { renderProvider } from '@/lib/render/render-service';
import { EXPORT_STREAM_TYPE, exportStream } from '@/lib/render/export-stream';
import { SocialPlatformSchema } from '@/types/studio';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  try {
    const access = await requireProject(projectId);
    if ('response' in access) return access.response;
    const { project } = access;

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
    const stream = exportStream(async (report) => {
      const { outputUrl } = await renderProvider.renderProject(project, report);
      project.status = 'ready';
      project.exportVideoUrl = outputUrl;
      project.updatedAt = Date.now();
      saveProject(project);
      return { success: true, exportVideoUrl: outputUrl, project };
    }, (err) => {
      console.error('[API /render] Error rendering project to MP4:', err);
      const latest = getProject(projectId);
      if (latest?.status === 'rendering') saveProject({ ...latest, status: 'ready' });
      return err instanceof Error ? err.message : 'Failed to render MP4 video';
    });
    return new Response(stream, { headers: { 'Content-Type': EXPORT_STREAM_TYPE, 'Cache-Control': 'no-cache, no-transform' } });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to render MP4 video';
    console.error('[API /render] Error rendering project to MP4:', err);
    const project = getProject(projectId);
    if (project?.status === 'rendering') saveProject({ ...project, status: 'ready' });
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
