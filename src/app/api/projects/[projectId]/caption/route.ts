import { runWithUsage } from '@/lib/billing/usage';
import { NextRequest, NextResponse } from 'next/server';
import { requireProject } from '@/lib/auth/project-access';
import { saveProject } from '@/lib/storage/project-store';
import { MAX_CAPTION_GENERATIONS, writeCaption } from '@/lib/social/share';

// One caption request per project at a time, so a double click cannot pass the limit twice.
const globalCaptions = globalThis as typeof globalThis & { __gmotionCaptions?: Set<string> };
const activeCaptions = (globalCaptions.__gmotionCaptions ??= new Set<string>());

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const access = await requireProject(projectId);
  if ('response' in access) return access.response;
  const { project } = access;

  if (project.status !== 'ready') {
    return NextResponse.json({ error: 'Caption bisa dibuat setelah video selesai.' }, { status: 409 });
  }
  const count = project.socialCaption?.generatedCount ?? 0;
  if (count >= MAX_CAPTION_GENERATIONS) {
    return NextResponse.json({ error: 'Caption sudah dibuat ulang maksimal untuk video ini. Edit teksnya langsung.' }, { status: 429 });
  }
  if (activeCaptions.has(projectId)) {
    return NextResponse.json({ error: 'Caption sedang dibuat.' }, { status: 409 });
  }

  activeCaptions.add(projectId);
  try {
    const caption = await runWithUsage(
      { userId: access.user.id, projectId, preset: project.storyboard.preset, stage: 'caption' },
      () => writeCaption(project)
    );
    const socialCaption = {
      text: caption.text,
      hashtags: caption.hashtags,
      youtubeTitle: caption.youtubeTitle,
      youtubeTags: caption.youtubeTags,
      generatedCount: count + 1,
    };
    saveProject({ ...project, socialCaption, updatedAt: Date.now() });
    return NextResponse.json({ socialCaption, usedModel: caption.usedModel, generationsLeft: MAX_CAPTION_GENERATIONS - socialCaption.generatedCount });
  } finally {
    activeCaptions.delete(projectId);
  }
}
