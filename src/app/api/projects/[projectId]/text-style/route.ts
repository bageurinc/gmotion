import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProject } from '@/lib/auth/project-access';
import { isGenerationActive } from '@/lib/pipeline/generation-job';
import { applyTextStyle } from '@/lib/pipeline/text-style-change';
import { getProject, saveProject } from '@/lib/storage/project-store';
import { TextStyleSchema, usesWorldEngine } from '@/types/studio';

const inputSchema = z.object({ textStyle: TextStyleSchema });
const revisions = globalThis as typeof globalThis & { __gmotionRevisions?: Set<string> };

/** Changes the video's title and subtitle fonts. No model call, so it costs no credits. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const access = await requireProject(projectId);
  if ('response' in access) return access.response;
  const input = inputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Gaya teks tidak dikenal.' }, { status: 400 });

  const project = getProject(projectId);
  if (!project) return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
  if (usesWorldEngine(project.storyboard.preset)) {
    return NextResponse.json({ error: 'Gaya Isometrik belum mendukung pilihan gaya teks.' }, { status: 409 });
  }
  if (project.status === 'generating' || isGenerationActive(projectId) || revisions.__gmotionRevisions?.has(projectId)) {
    return NextResponse.json({ error: 'Tunggu sampai proses yang sedang berjalan selesai.' }, { status: 409 });
  }

  const updated = { ...applyTextStyle(project, input.data.textStyle), updatedAt: Date.now() };
  saveProject(updated);
  return NextResponse.json({ project: updated });
}
