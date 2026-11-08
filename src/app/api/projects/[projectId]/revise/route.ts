import { NextRequest, NextResponse } from 'next/server';
import { RevisionInputSchema } from '@/lib/security/project-input';
import { requireProject } from '@/lib/auth/project-access';
import { saveProject } from '@/lib/storage/project-store';
import { reviseSceneCode } from '@/lib/pipeline/coder-agent';
import { findSceneCrashes, type RevisionCheckOutcome } from '@/lib/render/scene-check';
import { planSceneRevision, reviseScene } from '@/lib/pipeline/scene-revision';
import { generateSceneAudio } from '@/lib/pipeline/tts-engine';
import { ProjectChatMessage, usesWorldEngine } from '@/types/studio';

function revisionReply(title: string, fileName: string, outcome: RevisionCheckOutcome | 'unchanged'): string {
  switch (outcome) {
    case 'unchanged':
      return `AI belum berhasil mengubah **${title}** (${fileName}). Kode tidak berubah, coba tulis permintaannya dengan cara lain.`;
    case 'ok':
      return `Perubahan pada **${title}** (${fileName}) sudah diterapkan dan lolos cek render.`;
    case 'repaired':
      return `Perubahan pada **${title}** (${fileName}) sempat membuat adegan error saat dirender, lalu diperbaiki otomatis dan lolos cek render. Periksa lagi hasilnya di pratinjau.`;
    case 'reverted':
      return `Perubahan pada **${title}** (${fileName}) membuat adegan error saat dirender dan gagal diperbaiki, jadi adegan dikembalikan ke versi sebelumnya. Coba permintaan yang lebih sederhana.`;
    case 'unchecked':
      return `Perubahan pada **${title}** (${fileName}) sudah diterapkan, tetapi cek render tidak bisa dijalankan. Error, jika ada, akan terlihat saat export.`;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const access = await requireProject(projectId);
    if ('response' in access) return access.response;
    const { project } = access;

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
    let targetSceneId = input.data.sceneId;

    // Infer target scene if not explicitly selected
    if (!targetSceneId) {
      if (/scene\s*1|adegan\s*1|hook|pembuka/i.test(userMessage)) {
        targetSceneId = project.storyboard.scenes[0]?.id;
      } else if (/scene\s*2|adegan\s*2|mekanisme|balas|chat/i.test(userMessage)) {
        targetSceneId = project.storyboard.scenes[1]?.id;
      } else if (/scene\s*3|adegan\s*3|grafik|omzet|proof|angka/i.test(userMessage)) {
        targetSceneId = project.storyboard.scenes[2]?.id;
      } else if (/scene\s*4|adegan\s*4|cta|tombol|penutup/i.test(userMessage)) {
        targetSceneId = project.storyboard.scenes[3]?.id;
      } else {
        // Default to scene 3 if metrics/colors mentioned, else scene 1
        targetSceneId = project.storyboard.scenes[2]?.id || project.storyboard.scenes[0]?.id;
      }
    }

    const index = Math.max(0, project.storyboard.scenes.findIndex((s) => s.id === targetSceneId));
    const sceneSpec = project.storyboard.scenes[index];
    const fileName = `Scene${index + 1}.tsx`;
    const svgOnly = project.storyboard.preset === 'story-svg';

    console.log(`[API /revise] Revising ${fileName} for project ${projectId}...`);

    const revision = await reviseScene(project, index, userMessage, {
      plan: planSceneRevision,
      speak: generateSceneAudio,
      reviseCode: (code, scene, instruction) =>
        reviseSceneCode(code, scene, instruction, project.storyboard.palette, { svgOnly }),
      check: {
        findCrashes: findSceneCrashes,
        repair: (current, crash) =>
          reviseSceneCode(
            current.files[fileName],
            current.storyboard.scenes[index],
            `Fix this runtime crash and keep the same visual: ${crash.message}`,
            current.storyboard.palette,
            { svgOnly }
          ),
      },
    });
    const { outcome } = revision;
    const revised = revision.project;
    const revisedScene = revised.storyboard.scenes[index];
    const notes = [
      revision.narrationChanged
        ? `Narasi diganti dan suaranya dibuat ulang, durasi adegan kini ${(revisedScene.durationInFrames / (revised.storyboard.fps || 30)).toFixed(1)} detik.`
        : '',
      revision.headlineChanged ? `Judul adegan menjadi "${revisedScene.kineticHeadline}".` : '',
    ].filter(Boolean).join(' ');

    // Append to chat history
    const userChat: ProjectChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      content: userMessage,
      timestamp: Date.now(),
      targetedSceneId: targetSceneId,
    };

    const assistantChat: ProjectChatMessage = {
      id: `msg_ai_${Date.now()}`,
      sender: 'assistant',
      content: [revisionReply(sceneSpec.title, fileName, outcome), notes].filter(Boolean).join(' '),
      timestamp: Date.now(),
      targetedSceneId: targetSceneId,
    };

    revised.chatHistory = [...project.chatHistory, userChat, assistantChat];
    revised.updatedAt = Date.now();

    saveProject(revised);

    return NextResponse.json({
      project: revised,
      updatedFileName: fileName,
      revisionOutcome: outcome,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to revise scene';
    console.error('[API /revise] Error revising scene:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
