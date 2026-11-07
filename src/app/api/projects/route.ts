import { NextRequest, NextResponse } from 'next/server';
import { generateStoryboard } from '@/lib/pipeline/director-agent';
import { saveProject, listProjects } from '@/lib/storage/project-store';
import { StudioProject, StylePreset, AspectRatio } from '@/types/studio';

export async function GET() {
  const projects = listProjects();
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = body.prompt?.trim();
    const preset = (body.preset as StylePreset) || 'ads-ui';
    const aspectRatio = (body.aspectRatio as AspectRatio) || '9:16';

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

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
      chatHistory: [
        {
          id: `msg_${Date.now()}`,
          sender: 'assistant',
          content: `Proyek video berhasil dibuat dengan preset **${preset === 'ads-ui' ? 'High-Converting Ads UI' : '2D Illustrated Story'}** (${aspectRatio}). Anda dapat meninjau video di player kanan atau meminta revisi per-adegan di sini.`,
          timestamp: Date.now(),
        },
      ],
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
