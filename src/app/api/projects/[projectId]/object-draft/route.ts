import { notifyProjectAfterResponse } from '@/lib/notifications/project-email';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProject } from '@/lib/auth/project-access';
import { runWithUsage } from '@/lib/billing/usage';
import { assetModel } from '@/lib/explainer/scene-generator';
import { generateStorySvgDraft, type DraftProgress } from '@/lib/explainer/story-svg-draft';
import { isGenerationActive, prepareGeneration, runGeneration } from '@/lib/pipeline/generation-job';
import { getProject, saveProject } from '@/lib/storage/project-store';
import type { StudioProject } from '@/types/studio';

const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), version: z.number() }),
  z.object({ action: z.literal('revise'), version: z.number(), instruction: z.string().trim().min(3).max(1000) }),
  z.object({ action: z.literal('auto'), enabled: z.boolean() }),
]);
const jobs = globalThis as typeof globalThis & { __gmotionObjectDraftRevisions?: Set<string> };
const revising = (jobs.__gmotionObjectDraftRevisions ??= new Set<string>());

function startGeneration(project: StudioProject, usage: Parameters<typeof runWithUsage>[0]) {
  void runWithUsage(usage, () => runGeneration(project)).catch((error) => {
    console.error('[ObjectDraft] Generation failed:', error);
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const access = await requireProject(projectId);
  if ('response' in access) return access.response;
  const input = inputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Instruksi draf objek tidak valid.' }, { status: 400 });

  const project = getProject(projectId);
  if (input.data.action === 'auto') {
    if (project?.storyboard.preset !== 'story-svg') return NextResponse.json({ error: 'Pilihan ini hanya untuk gaya Full SVG.' }, { status: 409 });
    const enabled = input.data.enabled;
    // A draft already waiting for review is approved at once, unless a correction is being drawn.
    if (enabled && project.storySvgReviewPending && project.storySvgDraft && !isGenerationActive(projectId) && !revising.has(projectId)) {
      const prepared = prepareGeneration({ ...project, storySvgReviewPending: undefined, autoApproveObjectDraft: true });
      saveProject(prepared);
      startGeneration(prepared, { userId: access.user.id, projectId, preset: 'story-svg', stage: 'generate' });
      return NextResponse.json({ project: prepared }, { status: 202 });
    }
    // Saved without a new updatedAt, so an open review form keeps a valid version.
    const updated = { ...project, autoApproveObjectDraft: enabled || undefined };
    saveProject(updated);
    return NextResponse.json({ project: updated });
  }
  if (project?.storyboard.preset !== 'story-svg' || !project.storySvgReviewPending || !project.storySvgDraft
    || project.updatedAt !== input.data.version || isGenerationActive(projectId) || revising.has(projectId)) {
    return NextResponse.json({ error: 'Draf berubah atau sedang diproses. Muat ulang sebelum melanjutkan.' }, { status: 409 });
  }
  const usage = { userId: access.user.id, projectId, preset: 'story-svg', stage: 'generate' } as const;
  if (input.data.action === 'approve') {
    const prepared = prepareGeneration({ ...project, storySvgReviewPending: undefined });
    saveProject(prepared);
    startGeneration(prepared, usage);
    return NextResponse.json({ project: prepared }, { status: 202 });
  }

  revising.add(projectId);
  const instruction = input.data.instruction;
  const draft = project.storySvgDraft;
  try {
    // Progress is saved without a new updatedAt, so it never invalidates the version the user is correcting.
    const saveProgress = (storySvgDraftProgress?: DraftProgress) => {
      const current = getProject(projectId);
      if (current?.updatedAt === project.updatedAt) saveProject({ ...current, storySvgDraftProgress });
    };
    const storySvgDraft = await runWithUsage(usage, () =>
      generateStorySvgDraft(assetModel(project.drawingModel), project.storyboard, { draft, instruction }, saveProgress)
    );
    const latest = getProject(projectId);
    if (!latest?.storySvgReviewPending || latest.updatedAt !== project.updatedAt) {
      return NextResponse.json({ error: 'Draf berubah. Muat ulang untuk melihat versi terbaru.' }, { status: 409 });
    }
    const updated = { ...latest, storySvgDraft, storySvgDraftProgress: undefined, updatedAt: Math.max(Date.now(), latest.updatedAt + 1) };
    saveProject(updated);
    notifyProjectAfterResponse(access.user, updated, 'story-svg');
    return NextResponse.json({ project: updated });
  } catch (error) {
    console.error('[ObjectDraft] Revision failed:', error);
    const current = getProject(projectId);
    if (current?.storySvgDraftProgress) saveProject({ ...current, storySvgDraftProgress: undefined });
    return NextResponse.json({ error: 'Koreksi draf gagal. Coba lagi.' }, { status: 502 });
  } finally {
    revising.delete(projectId);
  }
}
