import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isElevenLabsConfigured, isElevenLabsVoiceId } from '@/lib/audio/elevenlabs';
import { requireProject } from '@/lib/auth/project-access';
import { chargeForVoiceChange, creditsForVoiceChange, refundVoiceChange } from '@/lib/billing/credits';
import { runWithUsage } from '@/lib/billing/usage';
import { reviseSceneCode } from '@/lib/pipeline/coder-agent';
import { hasFailedScene } from '@/lib/pipeline/draft';
import { isGenerationActive } from '@/lib/pipeline/generation-job';
import { revoiceScenes } from '@/lib/pipeline/scene-revision';
import { generateSceneAudio } from '@/lib/pipeline/tts-engine';
import { VOICE_OPTIONS } from '@/lib/pipeline/voices';
import { findSceneCrashes } from '@/lib/render/scene-check';
import { getProject, saveProject } from '@/lib/storage/project-store';
import { usesWorldEngine, type ProjectChatMessage } from '@/types/studio';

const inputSchema = z.object({
  voice: z.string().max(40),
  provider: z.enum(['gemini', 'elevenlabs']),
});
// Shared with chat revisions and text style changes: one change per project at a time.
const globalRevisions = globalThis as typeof globalThis & { __gmotionRevisions?: Set<string> };
const activeRevisions = (globalRevisions.__gmotionRevisions ??= new Set<string>());

/** The price of a voice change, so the studio can show it before the user confirms. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const access = await requireProject(projectId);
  if ('response' in access) return access.response;
  return NextResponse.json({
    gemini: creditsForVoiceChange('gemini'),
    elevenlabs: isElevenLabsConfigured() ? creditsForVoiceChange('elevenlabs') : null,
  });
}

/** Speaks every scene again with another narrator voice. Costs credits; a failed change is refunded. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const access = await requireProject(projectId);
  if ('response' in access) return access.response;
  const input = inputSchema.safeParse(await req.json().catch(() => null));
  const valid = input.success && (input.data.provider === 'elevenlabs'
    ? isElevenLabsVoiceId(input.data.voice)
    : VOICE_OPTIONS.some((option) => option.id === input.data.voice));
  if (!input.success || !valid) return NextResponse.json({ error: 'Suara tidak dikenal.' }, { status: 400 });
  const { voice, provider } = input.data;
  if (provider === 'elevenlabs' && !isElevenLabsConfigured()) {
    return NextResponse.json({ error: 'Suara ElevenLabs sedang tidak tersedia.' }, { status: 409 });
  }

  const project = getProject(projectId);
  if (!project) return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
  if (usesWorldEngine(project.storyboard.preset)) {
    return NextResponse.json({ error: 'Ganti suara belum tersedia untuk video 3D.' }, { status: 409 });
  }
  if (project.status === 'generating' || isGenerationActive(projectId) || project.storySvgReviewPending || hasFailedScene(project)) {
    return NextResponse.json({ error: 'Tunggu sampai semua adegan selesai dibuat.' }, { status: 409 });
  }
  if ((project.storyboard.voice ?? VOICE_OPTIONS[0].id) === voice && (project.storyboard.voiceProvider ?? 'gemini') === provider) {
    return NextResponse.json({ error: 'Video ini sudah memakai suara itu.' }, { status: 409 });
  }
  if (activeRevisions.has(projectId)) {
    return NextResponse.json({ error: 'Perubahan sebelumnya masih berjalan.' }, { status: 409 });
  }

  activeRevisions.add(projectId);
  const credits = creditsForVoiceChange(provider);
  let chargeRef: string | null = null;
  try {
    chargeRef = await chargeForVoiceChange(access.user.id, projectId, credits);
    if (!chargeRef) {
      return NextResponse.json({ error: `Kredit tidak cukup. Ganti suara butuh ${credits} kredit.`, code: 'insufficient_credits' }, { status: 402 });
    }
    const indexes = project.storyboard.scenes.map((_, index) => index);
    const svgOnly = project.storyboard.preset === 'story-svg';
    const result = await runWithUsage({ userId: access.user.id, projectId, preset: project.storyboard.preset, stage: 'revision' }, () =>
      revoiceScenes(project, indexes, { voice, provider }, {
        speak: generateSceneAudio,
        reviseCode: (code, scene, instruction) => reviseSceneCode(code, scene, instruction, project.storyboard.palette, { svgOnly }),
        check: {
          findCrashes: findSceneCrashes,
          repair: (current, crash) => reviseSceneCode(
            current.files[`Scene${crash.index + 1}.tsx`],
            current.storyboard.scenes[crash.index],
            `Fix this runtime crash and keep the same visual: ${crash.message}`,
            current.storyboard.palette,
            { svgOnly },
          ),
        },
      }));

    // Credits pay only for a complete change; a partial one is refunded and can be tried again.
    const complete = !result.failed.length;
    if (!complete) await refundVoiceChange(access.user.id, chargeRef, credits);
    chargeRef = null;
    const now = Date.now();
    const scenes = result.failed.map((index) => index + 1).join(', ');
    const content = complete
      ? `Suara diganti untuk semua adegan. ${credits} kredit terpakai. Subtitle dan timing mengikuti suara baru.`
      : result.changed.length
        ? `Suara baru gagal dipasang di adegan ${scenes}, jadi video kini mencampur dua suara. Kredit dikembalikan. Coba ganti suara lagi.`
        : 'Suara gagal diganti. Kredit dikembalikan. Coba lagi.';
    const message: ProjectChatMessage = { id: `msg_ai_${now}`, sender: 'assistant', content, timestamp: now };
    const updated = { ...result.project, chatHistory: [...project.chatHistory, message], exportVideoUrl: undefined, updatedAt: now };
    saveProject(updated);
    return NextResponse.json({ project: updated, complete, credits: complete ? credits : 0 });
  } catch (error) {
    console.error('[API /voice] Voice change failed:', error);
    return NextResponse.json({ error: 'Suara gagal diganti. Kredit dikembalikan. Coba lagi.' }, { status: 500 });
  } finally {
    if (chargeRef) await refundVoiceChange(access.user.id, chargeRef, credits).catch((error) => console.error('[API /voice] Refund failed:', error));
    activeRevisions.delete(projectId);
  }
}
