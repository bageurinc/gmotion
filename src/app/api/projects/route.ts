import { runWithUsage } from '@/lib/billing/usage';
import { notifyProjectAfterResponse } from '@/lib/notifications/project-email';
import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { generateStoryboard } from '@/lib/pipeline/director-agent';
import { libraryDraftNote } from '@/lib/pipeline/library-video';
import { canAccessProject, requireUser } from '@/lib/auth/project-access';
import { CREDITS_PER_VIDEO } from '@/lib/billing/credits';
import {
  saveProject,
  listProjects,
  getProject,
} from '@/lib/storage/project-store';
import { CreateProjectSchema } from '@/lib/security/project-input';
import { presetAllowed, StudioProject, supportsArtStyle } from '@/types/studio';
import { isAdmin } from '@/lib/billing/costs';

type DraftJob = { signature: string; promise: Promise<StudioProject> };
const jobs = globalThis as typeof globalThis & {
  __gmotionDraftJobs?: Map<string, DraftJob>;
};
const activeDrafts = (jobs.__gmotionDraftJobs ??= new Map<string, DraftJob>());

export async function GET() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const projects = listProjects().filter((project) =>
    canAccessProject(auth.user, project),
  );
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  try {
    const input = CreateProjectSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!input.success) {
      return NextResponse.json(
        { error: 'Prompt tidak valid.' },
        { status: 400 },
      );
    }
    const { prompt, preset, aspectRatio, drawingModel, requestId } = input.data;
    if (!presetAllowed(preset, isAdmin(auth.user))) {
      return NextResponse.json({ error: 'Gaya video ini belum tersedia untuk akun kamu.' }, { status: 403 });
    }
    // Other presets do not draw with the image model, so a style choice would be silently ignored.
    const artStyle = supportsArtStyle(preset) ? input.data.artStyle : 'flat';

    const projectId = requestId
      ? `proj_${createHash('sha256').update(`${auth.user.id}:${requestId}`).digest('hex').slice(0, 40)}`
      : `proj_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const signature = JSON.stringify({
      prompt,
      preset,
      aspectRatio,
      drawingModel,
      artStyle,
    });
    const existing = requestId ? getProject(projectId) : null;
    if (existing) {
      if (
        existing.ownerId !== auth.user.id ||
        existing.userPrompt !== prompt ||
        existing.storyboard.preset !== preset ||
        existing.storyboard.aspectRatio !== aspectRatio ||
        existing.drawingModel !== drawingModel ||
        (existing.storyboard.artStyle ?? 'flat') !== artStyle
      ) {
        return NextResponse.json(
          { error: 'Permintaan ini sudah digunakan untuk ide lain.' },
          { status: 409 },
        );
      }
      return NextResponse.json({ project: existing });
    }
    const active = activeDrafts.get(projectId);
    if (active) {
      if (active.signature !== signature)
        return NextResponse.json(
          { error: 'Permintaan ini sedang digunakan untuk ide lain.' },
          { status: 409 },
        );
      return NextResponse.json({ project: await active.promise });
    }
    // A resumed request returns its saved draft even if the user has since used their credit.
    if (auth.user.credits < CREDITS_PER_VIDEO) {
      return NextResponse.json(
        {
          error: 'Kredit habis. Beli kredit dulu.',
          code: 'insufficient_credits',
        },
        { status: 402 },
      );
    }

    console.log(`[API /projects] Drafting project ${projectId}...`);

    const promise = (async (): Promise<StudioProject> => {
      const storyboard = await runWithUsage(
        { userId: auth.user.id, projectId, preset, stage: 'draft' },
        async () => generateStoryboard(prompt, preset, aspectRatio, {
          strict: true,
          // Library-first isometric drafts are written knowing which assets can draw them.
          libraryNote: preset === 'world' ? await libraryDraftNote(prompt).catch(() => undefined) : undefined,
        }),
      );
      const project: StudioProject = {
        id: projectId,
        ownerId: auth.user.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        userPrompt: prompt,
        storyboard: artStyle === 'flat' ? storyboard : { ...storyboard, artStyle },
        drawingModel,
        files: {},
        chatHistory: [],
        status: 'draft',
        ...(preset === 'world' ? { visualPolicy: 'library-first' as const } : {}),
      };

      saveProject(project);
      notifyProjectAfterResponse(auth.user, project, 'storyboard');
      return project;
    })();
    activeDrafts.set(projectId, { signature, promise });
    try {
      return NextResponse.json({ project: await promise });
    } finally {
      activeDrafts.delete(projectId);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Gagal menyusun draf';
    console.error('[API /projects] Error drafting project:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
