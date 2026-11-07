import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProject } from '@/lib/storage/project-store';
import { reviseSceneCode } from '@/lib/pipeline/coder-agent';
import { ProjectChatMessage } from '@/types/studio';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const project = getProject(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status === 'generating') {
      return NextResponse.json({ error: 'Tunggu sampai semua adegan selesai dibuat.' }, { status: 409 });
    }

    const body = await req.json();
    const userMessage = body.userMessage?.trim();
    let targetSceneId = body.sceneId;

    if (!userMessage) {
      return NextResponse.json({ error: 'userMessage is required' }, { status: 400 });
    }

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

    const sceneIndex = project.storyboard.scenes.findIndex((s) => s.id === targetSceneId);
    const sceneSpec = project.storyboard.scenes[sceneIndex >= 0 ? sceneIndex : 0];
    const fileName = `Scene${(sceneIndex >= 0 ? sceneIndex : 0) + 1}.tsx`;
    const currentCode = project.files[fileName] || '';

    console.log(`[API /revise] Revising ${fileName} for project ${projectId}... Instruction: "${userMessage}"`);

    const updatedCode = await reviseSceneCode(
      currentCode,
      sceneSpec,
      userMessage,
      project.storyboard.palette
    );

    // Update virtual files
    project.files[fileName] = updatedCode;

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
      content: `Perubahan pada **${sceneSpec.title}** (${fileName}) telah diterapkan! Kode telah diperbarui dan langsung tayang di Live Player.`,
      timestamp: Date.now(),
      targetedSceneId: targetSceneId,
    };

    project.chatHistory.push(userChat, assistantChat);
    project.updatedAt = Date.now();

    saveProject(project);

    return NextResponse.json({
      project,
      updatedFileName: fileName,
      message: `Scene ${fileName} revised successfully`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to revise scene';
    console.error('[API /revise] Error revising scene:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
