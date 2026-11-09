'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SharePanel } from './SharePanel';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { hasFailedScene, readyScenes } from '@/lib/pipeline/draft';
import { ART_STYLE_LABELS, DRAWING_MODEL_LABELS, PRESET_LABELS, StudioProject, TextStyleId, usesWorldEngine } from '@/types/studio';
import { TextStylePicker } from './TextStylePicker';
import { readExportStream } from '@/lib/render/export-stream';
import { DraftProgressBar, GenerationProgress } from './GenerationProgress';

const StorySvgDraftPreview = dynamic(
  () => import('./StorySvgDraftPreview').then((mod) => mod.StorySvgDraftPreview),
  { ssr: false },
);
const RemotionPreviewPlayer = dynamic(
  () => import('./RemotionPreviewPlayer').then((mod) => mod.RemotionPreviewPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 text-xs">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        <span>Memuat Live Remotion Player...</span>
      </div>
    ),
  }
);
import {
  MessageSquare,
  Film,
  Download,
  Share2,
  ArrowLeft,
  Send,
  CheckCircle2,
  RefreshCw,
  Clock,
  X,
} from 'lucide-react';

interface StudioWorkspaceClientProps {
  initialProject: StudioProject;
}

export const StudioWorkspaceClient: React.FC<StudioWorkspaceClientProps> = ({
  initialProject,
}) => {
  const [project, setProject] = useState<StudioProject>(initialProject);
  const [showObjectDraft, setShowObjectDraft] = useState(false);
  const [objectCorrection, setObjectCorrection] = useState('');
  const [objectDraftAction, setObjectDraftAction] = useState<'revise' | 'approve' | null>(null);
  const [objectDraftError, setObjectDraftError] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'storyboard'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [targetSceneId, setTargetSceneId] = useState<string>('all');
  const [isRevising, setIsRevising] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [revisionsLeft, setRevisionsLeft] = useState<number | null>(null);
  // Shown in the chat while the server works; the saved history replaces it when the reply arrives.
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(
    initialProject.exportVideoUrl || null
  );
  const [showExportModal, setShowExportModal] = useState(false);
  const exportDialogRef = useRef<HTMLDialogElement>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (showExportModal && !exportDialogRef.current?.open) exportDialogRef.current?.showModal();
  }, [showExportModal]);

  const [interrupted, setInterrupted] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const isGenerating = project.status === 'generating';
  const previewScenes = readyScenes(project);
  const showProgress = isGenerating || hasFailedScene(project) || project.storySvgReviewPending;
  const isBusy = showProgress;
  const waitingForObjects = isGenerating && project.storyboard.preset === 'story-svg' && !project.storySvgDraft
    && project.storyboard.scenes.every(({ id }) => project.sceneProgress?.[id]?.stage === 'queued');
  let previewStatus = 'Adegan pertama sedang dibuat. Pratinjaunya muncul di sini begitu selesai.';
  if (interrupted) {
    previewStatus = 'Pembuatan video terhenti. Pilih Lanjutkan untuk meneruskan.';
  } else if (!isGenerating && hasFailedScene(project)) {
    previewStatus = Object.values(project.sceneProgress ?? {}).find((scene) => scene.error)?.error
      ?? 'Adegan gagal dibuat. Pilih Coba lagi.';
  } else if (waitingForObjects) {
    previewStatus = 'Menyiapkan draf objek SVG untuk kamu periksa sebelum animasi.';
  }
  let objectDraftStatus = 'Objek ini dipakai dalam video. Pilih Lihat video untuk kembali ke pratinjau adegan.';
  if (interrupted || hasFailedScene(project) && !isGenerating) {
    objectDraftStatus = previewStatus;
  } else if (project.checkingScenes) {
    objectDraftStatus = 'Adegan sudah dibuat. Studio sedang memeriksa hasilnya.';
  } else if (isGenerating) {
    objectDraftStatus = previewScenes.length
      ? 'Studio sedang melanjutkan animasi secara otomatis. Pilih Lihat video untuk menonton adegan yang sudah siap.'
      : 'Studio lanjut membuat animasi secara otomatis. Pratinjau video muncul begitu adegan pertama siap.';
  }
  if (project.storySvgReviewPending) {
    objectDraftStatus = 'Periksa objek di bawah. Kamu bisa memberi koreksi. Animasi baru dimulai setelah kamu menyetujui draf ini.';
  }

  // A draft correction is a plain request, so its progress is watched until that request returns.
  const watchingDraft = objectDraftAction === 'revise';
  useEffect(() => {
    if ((!isGenerating && !watchingDraft) || interrupted) return;
    const source = new EventSource(`/api/projects/${project.id}/events${watchingDraft ? '?draft=1' : ''}`);
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { project: StudioProject; interrupted: boolean };
      if (watchingDraft) {
        setProject((current) => ({ ...current, storySvgDraftProgress: data.project.storySvgDraftProgress }));
        return;
      }
      setProject(data.project);
      setInterrupted(data.interrupted);
      if (data.interrupted || data.project.status !== 'generating') source.close();
    };
    return () => source.close();
  }, [project.id, isGenerating, interrupted, watchingDraft]);

  const handleRetryGeneration = async () => {
    setIsRetrying(true);
    const res = await fetch(`/api/projects/${project.id}/generate`, { method: 'POST' }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (data?.project) {
      setInterrupted(false);
      setProject(data.project);
    }
    setIsRetrying(false);
  };

  const [savingTextStyle, setSavingTextStyle] = useState(false);
  const [textStyleError, setTextStyleError] = useState('');
  const handleTextStyle = async (textStyle: TextStyleId) => {
    if (savingTextStyle || textStyle === project.storyboard.textStyle) return;
    setSavingTextStyle(true);
    setTextStyleError('');
    try {
      const response = await fetch(`/api/projects/${project.id}/text-style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textStyle }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gaya teks gagal diganti.');
      setProject(data.project);
      setExportUrl(null);
    } catch (error) {
      setTextStyleError(error instanceof Error ? error.message : 'Gaya teks gagal diganti.');
    } finally {
      setSavingTextStyle(false);
    }
  };

  const handleObjectDraft = async (action: 'revise' | 'approve') => {
    if (objectDraftAction) return;
    setObjectDraftAction(action);
    setObjectDraftError('');
    try {
      const response = await fetch(`/api/projects/${project.id}/object-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, version: project.updatedAt, instruction: objectCorrection }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Draf objek gagal diproses.');
      setProject({ ...data.project, storySvgDraftProgress: undefined });
      setObjectCorrection('');
      setInterrupted(false);
    } catch (error) {
      setObjectDraftError(error instanceof Error ? error.message : 'Draf objek gagal diproses.');
    } finally {
      setObjectDraftAction(null);
    }
  };

  const totalFrames = previewScenes.reduce(
    (acc, s) => acc + (s.durationInFrames || 120),
    0
  );
  const totalSeconds = (totalFrames / (project.storyboard.fps || 30)).toFixed(1);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${project.id}/revise`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && typeof data?.revisionsLeft === 'number') setRevisionsLeft(data.revisionsLeft);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => {
    const box = chatScrollRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [project.chatHistory.length, pendingMessage, revisionError, activeTab]);

  // Handle chat revision
  const handleSendRevision = async (promptText?: string) => {
    const textToSend = promptText || chatInput;
    if (!textToSend.trim() || isRevising) return;

    setIsRevising(true);
    setRevisionError(null);
    setChatInput('');
    setPendingMessage(textToSend);

    try {
      const res = await fetch(`/api/projects/${project.id}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: textToSend,
          sceneId: targetSceneId === 'all' ? undefined : targetSceneId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (typeof data?.revisionsLeft === 'number') setRevisionsLeft(data.revisionsLeft);
      if (!res.ok || !data?.project) {
        // The message was not applied, so it goes back into the box for another try.
        setChatInput(textToSend);
        setRevisionError(data?.error ?? 'Revisi gagal. Coba lagi.');
        return;
      }
      setProject(data.project);
    } catch (err) {
      console.error('Revision failed:', err);
      setChatInput(textToSend);
      setRevisionError('Revisi gagal karena koneksi terputus. Coba lagi.');
    } finally {
      setPendingMessage(null);
      setIsRevising(false);
    }
  };

  // Handle export MP4
  const handleStartExport = async () => {
    setActionError('');
    setIsExporting(true);
    setShowExportModal(true);
    setExportProgress(0);

    try {
      const res = await fetch(`/api/projects/${project.id}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safeAreaPlatform: project.safeAreaPlatform || 'tiktok' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Export gagal');
      }
      // 100 is reserved for a finished file, because the last frames still need encoding.
      const result = await readExportStream(res, (progress) => setExportProgress(Math.min(progress, 99)));
      const exportVideoUrl = result.exportVideoUrl as string;
      setExportProgress(100);
      setExportUrl(exportVideoUrl);
      setProject((prev) => ({ ...prev, exportVideoUrl }));
    } catch (err) {
      console.error('Export error:', err);
      setShowExportModal(false);
      setActionError(err instanceof Error ? err.message : 'Gagal mengekspor video');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col md:h-[100dvh] w-full bg-slate-950 text-slate-100 md:overflow-hidden font-sans">
      {/* Top Studio Navbar */}
      <header className="min-h-16 border-b border-slate-800 bg-slate-900 px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/"
            aria-label="Dashboard"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden md:inline">gmotion</span>
          </Link>
          <div className="hidden md:block h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-semibold text-white text-sm truncate min-w-0 max-w-[280px]">
              {project.storyboard.title}
            </h1>
            <span className="hidden lg:inline text-xs text-slate-300">
              {PRESET_LABELS[project.storyboard.preset]}
              {project.storyboard.artStyle === 'pixel' && ` · ${ART_STYLE_LABELS.pixel}`}
            </span>
            <span className="hidden lg:inline text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {project.storyboard.aspectRatio}
            </span>
            <span className="hidden xl:inline text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {DRAWING_MODEL_LABELS[project.drawingModel ?? 'gemini']}
            </span>
            <span className="hidden sm:flex shrink-0 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 items-center gap-1">
              <Clock className="w-3 h-3" />
              {totalSeconds}s ({totalFrames}f)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {exportUrl && !isExporting && (
            <button
              onClick={() => {
                setExportProgress(100);
                setShowExportModal(true);
              }}
              aria-label="Bagikan"
              className="p-2 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg flex items-center gap-2 transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bagikan</span>
            </button>
          )}
          <button
            onClick={() => isExporting ? setShowExportModal(true) : handleStartExport()}
            disabled={isBusy}
            className="px-3 sm:px-4 py-2 bg-emerald-300 hover:bg-emerald-200 text-slate-950 font-semibold text-sm rounded-md flex items-center gap-2 transition disabled:opacity-50"
          >
            {isExporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isExporting ? `${exportProgress}%` : 'Ekspor MP4'}</span>
          </button>
        </div>
      </header>
      {actionError && <p role="alert" className="border-b border-red-500/30 bg-slate-900 px-4 py-3 text-sm text-red-300">{actionError}</p>}

      {/* Main Studio 2-Column Split Workspace */}
      {/* On phones the player sits on top and the controls fill the rest of the screen. */}
      <main className="flex-1 flex flex-col-reverse md:flex-row md:overflow-hidden min-h-0">
        {/* Left Panel: Co-Director Controls */}
        <div className="w-full md:w-[42%] md:max-w-[520px] flex-1 md:flex-none min-h-[60dvh] md:min-h-0 border-t md:border-t-0 md:border-r border-slate-800 bg-slate-900 flex flex-col md:shrink-0">
          {showProgress && (
            <GenerationProgress
              project={project}
              interrupted={interrupted}
              isRetrying={isRetrying}
              onRetry={handleRetryGeneration}
            />
          )}

          {/* Tab Selector */}
          <div className="flex border-b border-slate-800 bg-slate-900/90 p-1 gap-1 shrink-0">
            <button
              aria-pressed={activeTab === 'chat'}
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                activeTab === 'chat'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                <span className="sm:hidden">Chat</span>
                <span className="hidden sm:inline">Revisi</span>
              </span>
            </button>
            <button
              aria-pressed={activeTab === 'storyboard'}
              onClick={() => setActiveTab('storyboard')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                activeTab === 'storyboard'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-slate-300" />
              <span>Storyboard ({project.storyboard.scenes.length})</span>
            </button>
          </div>

          {/* Tab Content 1: AI Chat Revision */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chat Message Scroll */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {project.chatHistory.length === 0 && <div className="py-6"><h2 className="text-lg font-semibold">Apa yang ingin diubah?</h2><p className="mt-2 text-sm leading-6 text-slate-300">Pilih adegan, lalu tulis perubahan pada narasi, tampilan, atau gerakannya.</p></div>}
                {project.chatHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[92%] rounded-lg p-3.5 text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-slate-700 text-white rounded-tr-none'
                          : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-tl-none'
                      }`}
                    >
                      {msg.sender === 'assistant' && (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1.5 text-[11px]">
                          <span>Catatan revisi</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {pendingMessage && (
                  <div className="flex flex-col items-end">
                    <div className="max-w-[92%] rounded-lg rounded-tr-none p-3.5 text-sm leading-relaxed bg-slate-700 text-white">
                      <p className="whitespace-pre-wrap">{pendingMessage}</p>
                    </div>
                  </div>
                )}

                {isRevising && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs italic bg-slate-800/40 p-3 rounded-xl border border-slate-700/40 w-fit">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>
                      {targetSceneId === 'all'
                        ? 'Merevisi dan memeriksa semua adegan. Proses ini bisa memerlukan beberapa menit…'
                        : 'Merevisi dan memeriksa adegan…'}
                    </span>
                  </div>
                )}
              </div>

              {usesWorldEngine(project.storyboard.preset) ? (
                <p className="p-4 border-t border-slate-800 bg-slate-900 text-xs text-slate-300 shrink-0">
                  Revisi lewat chat belum tersedia untuk video 3D.
                </p>
              ) : (
                <>
                {/* Quick Prompt Suggestions */}
                <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-900/60 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] text-[11px] shrink-0">
                  <span className="text-slate-500 font-semibold whitespace-nowrap">Saran:</span>
                  {['Perbesar judul', 'Pendekkan narasi', 'Buat warna lebih hangat'].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSendRevision(suggestion)}
                      disabled={isRevising || isBusy}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 whitespace-nowrap transition disabled:opacity-40"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {/* Revision Input Box */}
                <div className="p-3 border-t border-slate-800 bg-slate-900 shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <label htmlFor="revision-scene" className="text-xs text-slate-300 font-semibold">Adegan:</label>
                    <select
                      id="revision-scene"
                      value={targetSceneId}
                      onChange={(e) => setTargetSceneId(e.target.value)}
                      className="min-w-0 flex-1 bg-slate-800 text-slate-200 text-xs rounded-md px-2 py-1 border border-slate-700 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="all">Semua adegan</option>
                      {project.storyboard.scenes.map((s, i) => (
                        <option key={s.id} value={s.id}>
                          Adegan {i + 1}: {s.title}
                        </option>
                      ))}
                    </select>
                    {revisionsLeft !== null && (
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">Sisa revisi: {revisionsLeft}</span>
                    )}
                  </div>
                  {revisionError && (
                    <p role="alert" className="mb-2 text-[11px] text-red-300">
                      {revisionError}
                    </p>
                  )}

                  <label htmlFor="revision-message" className="mb-2 block text-sm text-slate-300">Instruksi revisi</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="revision-message"
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendRevision()}
                      placeholder="Ketik revisi, misalnya: ganti narasi adegan 2 jadi lebih singkat"
                      className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-slate-400"
                    />
                    <button
                      aria-label="Kirim revisi"
                      onClick={() => handleSendRevision()}
                      disabled={!chatInput.trim() || isRevising || isBusy}
                      className="p-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold transition disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                </>
              )}
            </div>
          )}

          {/* Tab Content 2: Storyboard & Narasi */}
          {activeTab === 'storyboard' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!usesWorldEngine(project.storyboard.preset) && (
                <section aria-labelledby="text-style-heading" className="space-y-2">
                  <h2 id="text-style-heading" className="text-sm font-semibold text-slate-100">Gaya teks judul dan subtitle</h2>
                  <p className="text-xs text-slate-400">Berlaku untuk semua adegan. Gratis, tanpa menggambar ulang.</p>
                  <TextStylePicker
                    value={project.storyboard.textStyle}
                    suggested={project.storyboard.textStyleSuggested ?? project.storyboard.textStyle}
                    sample={project.storyboard.scenes[0]?.kineticHeadline ?? project.storyboard.title}
                    disabled={isBusy || savingTextStyle}
                    onChange={(style) => void handleTextStyle(style)}
                  />
                  {textStyleError && <p role="alert" className="text-xs text-red-300">{textStyleError}</p>}
                </section>
              )}
              {project.storyboard.scenes.map((scene, idx) => (
                <div
                  key={scene.id}
                  className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-xs text-white">{scene.title}</span>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-700/70 text-slate-300">
                      {scene.role}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-300 block mb-1">
                      Teks di layar
                    </p>
                    <div className="text-xs font-semibold text-emerald-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      {scene.kineticHeadline}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-300 block mb-1">
                      Narasi
                    </p>
                    <div className="text-xs text-slate-200 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                      {scene.voiceoverText}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/40">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {scene.durationInFrames} frames ({(scene.durationInFrames / 30).toFixed(1)}s)
                    </span>
                    <span className="text-slate-400 capitalize">
                      Cam: {scene.cameraAction}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Right Panel: Interactive Remotion Canvas & Studio Timeline */}
        <div className="studio-canvas h-[75dvh] min-h-[540px] md:min-h-0 md:h-auto shrink-0 md:shrink md:flex-1 flex flex-col overflow-auto">
          {project.storySvgDraft && previewScenes.length > 0 && (
            <button type="button" aria-pressed={showObjectDraft} onClick={() => setShowObjectDraft((shown) => !shown)}
              className="m-3 self-end rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
              {showObjectDraft ? 'Lihat video' : 'Lihat draf objek'}
            </button>
          )}
          <div className="flex-1 w-full min-h-0 flex flex-col items-center justify-center overflow-hidden">
            {(showObjectDraft || previewScenes.length === 0) && project.storySvgDraft ? (
              <StorySvgDraftPreview draft={project.storySvgDraft} background={project.storyboard.palette.surface}
                aspectRatio={project.storyboard.aspectRatio} status={objectDraftStatus}>
                {project.storySvgReviewPending && (
                  <form className="mt-5 space-y-3 border-t border-slate-700 pt-4"
                    onSubmit={(event) => { event.preventDefault(); void handleObjectDraft('revise'); }}>
                    <label htmlFor="object-correction" className="block text-sm font-medium text-slate-100">Koreksi objek</label>
                    <textarea id="object-correction" rows={3} maxLength={1000} value={objectCorrection}
                      onChange={(event) => setObjectCorrection(event.target.value)} disabled={Boolean(objectDraftAction)}
                      placeholder="Contoh: buat canting lebih ramping dan pertahankan motif kain."
                      className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100" />
                    {objectDraftError && <p role="alert" className="text-sm text-red-300">{objectDraftError}</p>}
                    {watchingDraft && (
                      <DraftProgressBar progress={project.storySvgDraftProgress}
                        note="Hanya gambar yang terkena koreksi yang digambar ulang." />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" disabled={Boolean(objectDraftAction) || objectCorrection.trim().length < 3}
                        className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-100 disabled:opacity-50">
                        {objectDraftAction === 'revise' ? 'Menerapkan koreksi…' : 'Terapkan koreksi'}
                      </button>
                      <button type="button" disabled={Boolean(objectDraftAction) || Boolean(objectCorrection.trim())}
                        onClick={() => void handleObjectDraft('approve')}
                        className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
                        {objectDraftAction === 'approve' ? 'Memulai animasi…' : 'Setujui & lanjutkan animasi'}
                      </button>
                    </div>
                  </form>
                )}
              </StorySvgDraftPreview>
            ) : previewScenes.length === 0 && waitingForObjects && !interrupted ? (
              <div className="flex flex-col items-center gap-3 p-4 text-center">
                <p className="max-w-xs text-sm text-slate-300">{previewStatus}</p>
                <DraftProgressBar progress={project.storySvgDraftProgress}
                  note="Biasanya 5–8 menit. Halaman ini boleh ditutup, prosesnya tetap berjalan." />
              </div>
            ) : previewScenes.length === 0 ? (
              <p role="status" className="max-w-xs text-center text-sm text-slate-300">
                {previewStatus}
              </p>
            ) : <RemotionPreviewPlayer project={project} platform={project.safeAreaPlatform || 'tiktok'}
              onPlatformChange={safeAreaPlatform => {
                setProject(prev => ({ ...prev, safeAreaPlatform }));
                setExportUrl(null);
              }} />}
          </div>
        </div>
      </main>

      {/* Export MP4 Modal */}
      {showExportModal && (
        <dialog ref={exportDialogRef} aria-labelledby="export-heading" onCancel={() => setShowExportModal(false)} onClose={() => setShowExportModal(false)} className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[90dvh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-100 backdrop:bg-black/70 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4"><h2 id="export-heading" className="text-lg font-semibold">Ekspor video</h2><button type="button" aria-label="Tutup ekspor" onClick={() => setShowExportModal(false)} className="rounded-md p-2 hover:bg-slate-800"><X aria-hidden="true" className="h-5 w-5" /></button></div>
          <div className="text-center space-y-5" aria-live="polite">
            {exportProgress < 100 ? (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Merender Video MP4...</h3>
                  <p className="text-xs text-slate-400">
                    Menyiapkan adegan dan suara menjadi satu file. Kamu bisa menutup jendela ini sambil menunggu.
                  </p>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-300 h-full transition-[width] duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {exportProgress === 0 ? 'Menyiapkan video...' : `${exportProgress}% Selesai`}
                </span>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Video Berhasil Dirender!</h3>
                  <p className="text-xs text-slate-400">
                    Salin caption, lalu bagikan atau unduh videonya untuk diposting.
                  </p>
                </div>
                {exportUrl && (
                  <SharePanel
                    project={project}
                    exportUrl={exportUrl}
                    onCaption={(socialCaption) => setProject((current) => ({ ...current, socialCaption }))}
                  />
                )}
                <button
                  onClick={() => setShowExportModal(false)}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                >
                  Tutup
                </button>
              </>
            )}
          </div>
        </dialog>
      )}
    </div>
  );
};
