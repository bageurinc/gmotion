import { NextRequest, NextResponse } from 'next/server';
import { generateStoryboard } from '@/lib/pipeline/director-agent';
import { canAccessProject, requireUser } from '@/lib/auth/project-access';
import { CREDITS_PER_VIDEO } from '@/lib/billing/credits';
import { saveProject, listProjects } from '@/lib/storage/project-store';
import { CreateProjectSchema } from '@/lib/security/project-input';
import { StudioProject } from '@/types/studio';

export async function GET() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const projects = listProjects().filter((project) => canAccessProject(auth.user, project));
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  // Drafting already spends model tokens, so it needs enough credit to finish a video.
  if (auth.user.credits < CREDITS_PER_VIDEO) {
    return NextResponse.json({ error: 'Kredit habis. Beli kredit dulu.', code: 'insufficient_credits' }, { status: 402 });
  }

  try {
    const input = CreateProjectSchema.safeParse(await req.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: 'Prompt tidak valid.' }, { status: 400 });
    }
    const { prompt, preset, aspectRatio, drawingModel } = input.data;

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    console.log(`[API /projects] Drafting project ${projectId}...`);

    const storyboard = await generateStoryboard(prompt, preset, aspectRatio, { strict: true });

    const project: StudioProject = {
      id: projectId,
      ownerId: auth.user.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userPrompt: prompt,
      storyboard,
      drawingModel,
      files: {},
      chatHistory: [],
      status: 'draft',
    };

    saveProject(project);

    return NextResponse.json({ project });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Gagal menyusun draf';
    console.error('[API /projects] Error drafting project:', err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
