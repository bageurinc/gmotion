import { runWithUsage } from '@/lib/billing/usage';
import { NextRequest, NextResponse } from 'next/server';
import { RevisionInputSchema } from '@/lib/security/project-input';
import { requireProject } from '@/lib/auth/project-access';
import { saveProject } from '@/lib/storage/project-store';
import { reviseSceneCode } from '@/lib/pipeline/coder-agent';
import { findSceneCrashes } from '@/lib/render/scene-check';
import { planSceneRevision, reviseScenes, type SceneRevisionOutcome } from '@/lib/pipeline/scene-revision';
import { generateSceneAudio } from '@/lib/pipeline/tts-engine';
import { releaseRevision, reserveRevision, revisionsLeft } from '@/lib/billing/credits';
import { ProjectChatMessage, StudioProject, usesWorldEngine } from '@/types/studio';

// One revision per project at a time; a second one would overwrite the first one's files.
const globalRevisions = globalThis as typeof globalThis & { __gmotionRevisions?: Set<string> };
const activeRevisions = (globalRevisions.__gmotionRevisions ??= new Set<string>());

function sceneReply(project: StudioProject, result: SceneRevisionOutcome): string {
  const scene = project.storyboard.scenes[result.index];
  const name = `Adegan ${result.index + 1} (${scene.title})`;
  const notes = [
    result.narrationChanged
      ? `Narasi diganti dan suaranya dibuat ulang, durasinya kini ${(scene.durationInFrames / (project.storyboard.fps || 30)).toFixed(1).replace(".", ",")} detik.`
      : '',
    result.headlineChanged ? `Judulnya menjadi "${scene.kineticHeadline}".` : '',
  ].filter(Boolean).join(' ');
  const status = {
    unchanged: `${name} tidak berubah.`,
    ok: `${name} sudah diubah dan lolos cek render.`,
    repaired: `${name} sempat error saat dirender, lalu diperbaiki otomatis dan lolos cek render. Periksa lagi hasilnya di pratinjau.`,
    reverted: `${name} error saat dirender dan gagal diperbaiki, jadi adegan dikembalikan ke versi sebelumnya.`,
    unchecked: `${name} sudah diubah, tetapi cek render tidak bisa dijalankan. Error, jika ada, akan terlihat saat export.`,
  }[result.outcome];
  return [status, notes].filter(Boolean).join(' ');
}

function revisionReply(project: StudioProject, results: SceneRevisionOutcome[], left: number): string {
  const touched = results.filter((result) => result.outcome !== 'unchanged');
  const lines = results.length === 1 || touched.length === 0
    ? results.map((result) => sceneReply(project, result))
    : touched.map((result) => sceneReply(project, result));
  if (touched.length === 0) {
    lines.splice(0, lines.length, results.length === 1
      ? `${sceneReply(project, results[0])} Coba tulis permintaannya dengan cara lain.`
      : 'Tidak ada adegan yang berubah. Coba tulis permintaannya dengan cara lain, atau pilih adegannya.');
  } else if (touched.length < results.length) {
    lines.push(`${results.length - touched.length} adegan lain tidak berubah.`);
  }
  lines.push(`Sisa revisi untuk video ini: ${left} adegan.`);
  return lines.join('\n\n');
}

/** A chosen scene wins; otherwise a message that names one scene number targets it, else every scene. */
function targetIndexes(project: StudioProject, sceneId: string | undefined, message: string): number[] {
  const scenes = project.storyboard.scenes;
  const ready = scenes.flatMap((scene, index) =>
    !project.sceneProgress || project.sceneProgress[scene.id]?.stage === 'ready' ? [index] : []);
  if (sceneId) {
    const index = scenes.findIndex((scene) => scene.id === sceneId);
    return ready.includes(index) ? [index] : [];
  }
  const named = [...new Set([...message.matchAll(/\b(?:adegan|scene)\s*(\d{1,2})\b/gi)].map((match) => Number(match[1]) - 1))];
  if (named.length === 1 && ready.includes(named[0])) return named;
  return ready;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const access = await requireProject(projectId);
  if ('response' in access) return access.response;
  const { project, user } = access;

  if (project.status === 'generating') {
    return NextResponse.json({ error: 'Tunggu sampai semua adegan selesai dibuat.' }, { status: 409 });
  }
  if (usesWorldEngine(project.storyboard.preset)) {
    return NextResponse.json({ error: 'Revisi lewat chat belum tersedia untuk video 3D.' }, { status: 409 });
  }

  const input = RevisionInputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: 'Pesan revisi tidak valid.' }, { status: 400 });
  }
  const { userMessage } = input.data;
  const indexes = targetIndexes(project, input.data.sceneId, userMessage);
  if (!indexes.length) {
    return NextResponse.json({ error: 'Adegan itu belum selesai dibuat, jadi belum bisa direvisi.' }, { status: 409 });
  }
  if (activeRevisions.has(projectId)) {
    return NextResponse.json({ error: 'Revisi sebelumnya masih berjalan.' }, { status: 409 });
  }

  activeRevisions.add(projectId);
  let reservationId: string | null = null;
  try {
    const reservation = await reserveRevision(user.id, projectId, indexes.length);
    if (!reservation.id) {
      const needed = indexes.length > 1 ? ` Permintaan ini butuh ${indexes.length} adegan; pilih satu adegan saja.` : '';
      return NextResponse.json(
        { error: `Jatah revisi video ini tinggal ${reservation.left} adegan.${needed}`, code: 'revision_limit', revisionsLeft: reservation.left },
        { status: 402 }
      );
    }
    reservationId = reservation.id;

    const svgOnly = project.storyboard.preset === 'story-svg';
    console.log(`[API /revise] Revising scenes ${indexes.map((i) => i + 1).join(', ')} for project ${projectId}...`);
    const revision = await runWithUsage({ userId: user.id, projectId, preset: project.storyboard.preset, stage: 'revision' }, () => reviseScenes(project, indexes, userMessage, {
      plan: planSceneRevision,
      speak: generateSceneAudio,
      reviseCode: (code, scene, instruction) =>
        reviseSceneCode(code, scene, instruction, project.storyboard.palette, { svgOnly }),
      check: {
        findCrashes: findSceneCrashes,
        repair: (current, crash) =>
          reviseSceneCode(
            current.files[`Scene${crash.index + 1}.tsx`],
            current.storyboard.scenes[crash.index],
            `Fix this runtime crash and keep the same visual: ${crash.message}`,
            current.storyboard.palette,
            { svgOnly }
          ),
      },
    }));
    reservationId = null;
    const revised = revision.project;
    const left = reservation.left;
    const targetedSceneId = indexes.length === 1 ? project.storyboard.scenes[indexes[0]].id : undefined;
    const now = Date.now();
    const userChat: ProjectChatMessage = { id: `msg_user_${now}`, sender: 'user', content: userMessage, timestamp: now, targetedSceneId };
    const assistantChat: ProjectChatMessage = {
      id: `msg_ai_${now}`,
      sender: 'assistant',
      content: revisionReply(revised, revision.scenes, left),
      timestamp: now,
      targetedSceneId,
    };
    revised.chatHistory = [...project.chatHistory, userChat, assistantChat];
    revised.updatedAt = now;
    saveProject(revised);

    return NextResponse.json({
      project: revised,
      scenes: revision.scenes,
      revisionOutcome: revision.scenes.length === 1 ? revision.scenes[0].outcome : undefined,
      revisionsLeft: left,
    });
  } catch (err: unknown) {
    console.error('[API /revise] Error revising scene:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Revisi gagal. Coba lagi.' }, { status: 500 });
  } finally {
    // Nothing was produced, so the reserved allowance goes back.
    if (reservationId) await releaseRevision(reservationId).catch(() => undefined);
    activeRevisions.delete(projectId);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const access = await requireProject(projectId);
  if ('response' in access) return access.response;
  return NextResponse.json({ revisionsLeft: await revisionsLeft(projectId) });
}
