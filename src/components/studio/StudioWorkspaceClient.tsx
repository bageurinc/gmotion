'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { hasFailedScene, readyScenes } from '@/lib/pipeline/draft';
import { PRESET_LABELS, StudioProject, usesWorldEngine } from '@/types/studio';
import { GenerationProgress } from './GenerationProgress';

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
  Code2,
  Download,
  Sparkles,
  ArrowLeft,
  Send,
  CheckCircle2,
  RefreshCw,
  Clock,
} from 'lucide-react';

interface StudioWorkspaceClientProps {
  initialProject: StudioProject;
}

export const StudioWorkspaceClient: React.FC<StudioWorkspaceClientProps> = ({
  initialProject,
}) => {
  const [project, setProject] = useState<StudioProject>(initialProject);
  const [activeTab, setActiveTab] = useState<'chat' | 'storyboard' | 'code'>('chat');
  const [selectedFile, setSelectedFile] = useState<string>('Scene1.tsx');
  const [editingCode, setEditingCode] = useState<string>(
    initialProject.files['Scene1.tsx'] || ''
  );
  const [chatInput, setChatInput] = useState('');
  const [targetSceneId, setTargetSceneId] = useState<string>('all');
  const [isRevising, setIsRevising] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(
    initialProject.exportVideoUrl || null
  );
  const [showExportModal, setShowExportModal] = useState(false);

  const [interrupted, setInterrupted] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const isGenerating = project.status === 'generating';
  const previewScenes = readyScenes(project);
  const showProgress = isGenerating || hasFailedScene(project);
  const isBusy = isGenerating || hasFailedScene(project);

  useEffect(() => {
    if (!isGenerating || interrupted) return;
    const source = new EventSource(`/api/projects/${project.id}/events`);
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { project: StudioProject; interrupted: boolean };
      setProject(data.project);
      setInterrupted(data.interrupted);
      if (data.interrupted || data.project.status !== 'generating') source.close();
    };
    return () => source.close();
  }, [project.id, isGenerating, interrupted]);

  useEffect(() => {
    const code = project.files[selectedFile];
    if (code && !editingCode) setEditingCode(code);
  }, [project.files, selectedFile, editingCode]);

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

  const totalFrames = previewScenes.reduce(
    (acc, s) => acc + (s.durationInFrames || 120),
    0
  );
  const totalSeconds = (totalFrames / (project.storyboard.fps || 30)).toFixed(1);

  // Handle chat revision
  const handleSendRevision = async (promptText?: string) => {
    const textToSend = promptText || chatInput;
    if (!textToSend.trim() || isRevising) return;

    setIsRevising(true);
    setChatInput('');

    try {
      const res = await fetch(`/api/projects/${project.id}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: textToSend,
          sceneId: targetSceneId === 'all' ? undefined : targetSceneId,
        }),
      });

      const data = await res.json();
      if (data.project) {
        setProject(data.project);
        if (selectedFile && data.project.files[selectedFile]) {
          setEditingCode(data.project.files[selectedFile]);
        }
      }
    } catch (err) {
      console.error('Revision failed:', err);
    } finally {
      setIsRevising(false);
    }
  };

  // Handle manual code save
  const handleSaveCode = async () => {
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { [selectedFile]: editingCode } }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !data?.project) {
      alert(data?.error || 'Kode gagal disimpan.');
      return;
    }
    setProject(data.project);
  };

  // Handle export MP4
  const handleStartExport = async () => {
    setIsExporting(true);
    setShowExportModal(true);
    setExportProgress(10);

    try {
      const progressTimer = setInterval(() => {
        setExportProgress((prev) => (prev < 90 ? prev + 15 : prev));
      }, 1200);

      const res = await fetch(`/api/projects/${project.id}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safeAreaPlatform: project.safeAreaPlatform || 'tiktok' }),
      });
      clearInterval(progressTimer);

      const data = await res.json();
      if (data.exportVideoUrl) {
        setExportProgress(100);
        setExportUrl(data.exportVideoUrl);
        setProject((prev) => ({ ...prev, exportVideoUrl: data.exportVideoUrl }));
      } else {
        alert(data.error || 'Export failed');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Gagal mengekspor video');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Studio Navbar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm truncate max-w-[280px]">
              {project.storyboard.title}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              {PRESET_LABELS[project.storyboard.preset]}
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {project.storyboard.aspectRatio}
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {totalSeconds}s ({totalFrames}f)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleStartExport}
            disabled={isExporting || isBusy}
            className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            {isExporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Export MP4</span>
          </button>
        </div>
      </header>

      {/* Main Studio 2-Column Split Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Co-Director Controls */}
        <div className="w-[480px] lg:w-[520px] border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0">
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
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                activeTab === 'chat'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>AI Co-Director</span>
            </button>
            <button
              onClick={() => setActiveTab('storyboard')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                activeTab === 'storyboard'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-cyan-400" />
              <span>Storyboard ({project.storyboard.scenes.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                activeTab === 'code'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-amber-400" />
              <span>TSX Code</span>
            </button>
          </div>

          {/* Tab Content 1: AI Chat Revision */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chat Message Scroll */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {project.chatHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-tl-none'
                      }`}
                    >
                      {msg.sender === 'assistant' && (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1.5 text-[11px]">
                          <Sparkles className="w-3 h-3" />
                          <span>AI Co-Director</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {isRevising && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs italic bg-slate-800/40 p-3 rounded-xl border border-slate-700/40 w-fit">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>AI Co-Director sedang memodifikasi kode adegan...</span>
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
                <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-900/60 flex items-center gap-2 overflow-x-auto text-[11px] shrink-0">
                  <span className="text-slate-500 font-semibold whitespace-nowrap">Saran:</span>
                  <button
                    onClick={() => handleSendRevision('Ubah aksen warna di scene 3 jadi emas/gold')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 whitespace-nowrap transition"
                  >
                    ✨ Ubah warna Scene 3 jadi emas
                  </button>
                  <button
                    onClick={() => handleSendRevision('Ganti target omzet di grafik menjadi Rp 150.000.000')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 whitespace-nowrap transition"
                  >
                    📈 Target omzet Rp 150 Juta
                  </button>
                </div>

                {/* Revision Input Box */}
                <div className="p-3 border-t border-slate-800 bg-slate-900 shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-[11px] text-slate-400 font-semibold">Target Scene:</label>
                    <select
                      value={targetSceneId}
                      onChange={(e) => setTargetSceneId(e.target.value)}
                      className="bg-slate-800 text-slate-200 text-xs rounded-md px-2 py-1 border border-slate-700 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="all">Semua / Deteksi Otomatis</option>
                      {project.storyboard.scenes.map((s, i) => (
                        <option key={s.id} value={s.id}>
                          Scene {i + 1}: {s.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendRevision()}
                      placeholder="Ketik revisi (contoh: 'Perbesar font headline di scene 1')..."
                      className="flex-1 bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    <button
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
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Kinetic Headline:
                    </label>
                    <div className="text-xs font-semibold text-emerald-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      {scene.kineticHeadline}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Voiceover Narasi (TTS):
                    </label>
                    <div className="text-xs text-slate-200 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                      {scene.voiceoverText}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/40">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-cyan-400" />
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

          {/* Tab Content 3: TSX Code Editor */}
          {activeTab === 'code' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* File Selector */}
              <div className="flex border-b border-slate-800 bg-slate-900 overflow-x-auto p-1 gap-1 shrink-0">
                {Object.keys(project.files).map((fileName) => (
                  <button
                    key={fileName}
                    onClick={() => {
                      setSelectedFile(fileName);
                      setEditingCode(project.files[fileName] || '');
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap transition ${
                      selectedFile === fileName
                        ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {fileName}
                  </button>
                ))}
              </div>

              {/* Code TextArea */}
              <div className="flex-1 relative">
                <textarea
                  value={editingCode}
                  onChange={(e) => setEditingCode(e.target.value)}
                  className="w-full h-full bg-slate-950 text-slate-200 font-mono text-xs p-4 focus:outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>

              {/* Code Action Footer */}
              <div className="p-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-400">
                  Editing: <span className="font-mono text-white">{selectedFile}</span>
                </span>
                <button
                  onClick={handleSaveCode}
                  disabled={isBusy}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Terapkan Kode
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Interactive Remotion Canvas & Studio Timeline */}
        <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden">
          <div className="flex-1 w-full h-full flex flex-col items-center justify-center overflow-hidden">
            {previewScenes.length === 0 ? (
              <p className="max-w-xs text-center text-sm text-slate-300">
                Adegan pertama sedang dibuat. Pratinjaunya muncul di sini begitu selesai.
              </p>
            ) : <RemotionPreviewPlayer project={project} platform={project.safeAreaPlatform || 'tiktok'}
              onPlatformChange={safeAreaPlatform => {
                setProject(prev => ({ ...prev, safeAreaPlatform }));
                setExportUrl(null);
              }} />}
          </div>
        </div>
      </div>

      {/* Export MP4 Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-5">
            {exportProgress < 100 ? (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Merender Video MP4...</h3>
                  <p className="text-xs text-slate-400">
                    Remotion Bundler & Chromium Headless sedang memproses setiap frame video (1080x1920 @ 30 FPS).
                  </p>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {exportProgress}% Selesai
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
                    File MP4 siap diunduh dan diposting ke Instagram Reels, TikTok, atau Meta Ads Manager.
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                  >
                    Tutup
                  </button>
                  {exportUrl && (
                    <a
                      href={exportUrl}
                      download="gmotion-video.mp4"
                      className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download .mp4</span>
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
