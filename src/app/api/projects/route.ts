import { NextRequest, NextResponse } from 'next/server';
import { generateStoryboard } from '@/lib/pipeline/director-agent';
import { saveProject, listProjects } from '@/lib/storage/project-store';
import { CreateProjectSchema } from '@/lib/security/project-input';
import { StudioProject } from '@/types/studio';

export async function GET() {
  const projects = listProjects();
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  try {
    const input = CreateProjectSchema.safeParse(await req.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: 'Prompt tidak valid.' }, { status: 400 });
    }
    const { prompt, preset, aspectRatio } = input.data;

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    console.log(`[API /projects] Drafting project ${projectId}...`);

    const storyboard = await generateStoryboard(prompt, preset, aspectRatio, { strict: true });

    const project: StudioProject = {
      id: projectId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userPrompt: prompt,
      storyboard,
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
