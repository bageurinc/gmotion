import { NextRequest } from 'next/server';
import { isGenerationActive } from '@/lib/pipeline/generation-job';
import { requireProject } from '@/lib/auth/project-access';
import { getProject } from '@/lib/storage/project-store';

const POLL_INTERVAL_MS = 1000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const access = await requireProject(projectId);
  if ('response' in access) return access.response;

  // ?draft=1 watches a draft correction, which runs while the project is not generating.
  // The client closes that stream when its correction request returns.
  const watchDraft = req.nextUrl.searchParams.get('draft') === '1';
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastUpdate = 0;
  let lastProgress = '';

  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // The client has already disconnected.
        }
      };

      const tick = () => {
        const project = getProject(projectId);
        if (!project) return close();

        const interrupted = project.status === 'generating' && !isGenerationActive(projectId);
        // A draft correction runs outside the job and saves progress without a new updatedAt.
        const finished = watchDraft
          ? !project.storySvgReviewPending
          : project.status !== 'generating';
        const progress = JSON.stringify(project.storySvgDraftProgress ?? null);
        if (project.updatedAt !== lastUpdate || progress !== lastProgress || interrupted) {
          lastUpdate = project.updatedAt;
          lastProgress = progress;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ project, interrupted })}\n\n`));
        } else {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        }
        if (finished || interrupted) close();
      };

      timer = setInterval(tick, POLL_INTERVAL_MS);
      req.signal.addEventListener('abort', close);
      tick();
    },
    cancel() {
      clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
