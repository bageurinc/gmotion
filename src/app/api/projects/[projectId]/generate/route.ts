import { runWithUsage } from '@/lib/billing/usage';
import { NextRequest, NextResponse } from 'next/server';
import { firstSceneWithoutNarration } from '@/lib/pipeline/draft';
import {
  hasRetryableScenes,
  isGenerationActive,
  prepareGeneration,
  runGeneration,
} from '@/lib/pipeline/generation-job';
import { requireProject } from '@/lib/auth/project-access';
import { chargeForVideo, creditsForVideo } from '@/lib/billing/credits';
import { isElevenLabsConfigured } from '@/lib/audio/elevenlabs';
import { saveProject } from '@/lib/storage/project-store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const access = await requireProject(projectId);
  if ('response' in access) return access.response;
  const { project, user } = access;
  if (isGenerationActive(projectId)) {
    return NextResponse.json({ error: 'Video ini sedang dibuat.' }, { status: 409 });
  }
  // A job that died mid-run (e.g. dev server restart during the final checks) leaves the
  // project stuck in 'generating' with every scene ready; resuming must still be allowed.
  const interrupted = project.status === 'generating';
  if (project.status !== 'draft' && !interrupted && !hasRetryableScenes(project)) {
    return NextResponse.json({ error: 'Video ini sudah dibuat.' }, { status: 409 });
  }

  const missing = firstSceneWithoutNarration(project.storyboard.scenes);
  if (missing >= 0) {
    return NextResponse.json({ error: `Adegan ${missing + 1} belum punya narasi.` }, { status: 400 });
  }

  if (project.storyboard.voiceProvider === 'elevenlabs' && !isElevenLabsConfigured()) {
    return NextResponse.json({ error: 'Suara ElevenLabs sedang tidak tersedia. Pilih suara Gemini di draf.' }, { status: 409 });
  }
  const charge = await chargeForVideo(user.id, projectId, creditsForVideo(project.storyboard));
  if (charge === 'insufficient') {
    return NextResponse.json({ error: 'Kredit habis. Beli kredit dulu.', code: 'insufficient_credits' }, { status: 402 });
  }
  // Charging awaits the database, so a parallel request may have started the job.
  if (isGenerationActive(projectId)) {
    return NextResponse.json({ error: 'Video ini sedang dibuat.' }, { status: 409 });
  }

  const prepared = prepareGeneration(project);
  saveProject(prepared);
  // The job outlives this request; the usage context follows it into every AI call it makes.
  void runWithUsage({ userId: user.id, projectId, preset: prepared.storyboard.preset, stage: 'generate' }, () =>
    runGeneration(prepared)
  ).catch((err) => {
    console.error('[API /generate] Generation job crashed:', err);
  });

  return NextResponse.json({ project: prepared }, { status: 202 });
}
