'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Play,
  Film,
  Zap,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  Tv,
  Smartphone,
  Square,
  RefreshCw,
  FolderOpen,
  Cpu,
} from 'lucide-react';
import { StylePreset, AspectRatio, DrawingModel, StudioProject, DRAWING_MODEL_LABELS, PRESET_LABELS } from '@/types/studio';
import { STARTER_PROMPTS } from '@/lib/starter-prompts';

const PRESET_OPTIONS: Array<{ id: StylePreset; label: string; description: string }> = [
  { id: 'story-2d', label: PRESET_LABELS['story-2d'], description: 'Cerita dengan kombinasi gambar ilustrasi dan animasi SVG.' },
  { id: 'story-svg', label: PRESET_LABELS['story-svg'], description: 'Ilustrasi vektor dan gerakan objek mengikuti cerita, tanpa gambar raster.' },
  { id: 'ads-ui', label: 'Ads', description: 'Iklan produk dengan mockup, grafik, dan tombol ajakan.' },
  { id: 'world', label: 'Isometrik', description: 'Satu dunia 3D dengan kamera menyambung. Cocok untuk benda, mesin, dan alur proses.' },
];

const DRAWING_MODEL_OPTIONS: Array<{ id: DrawingModel; description: string }> = [
  { id: 'gemini', description: 'Model bawaan dengan biaya lebih tinggi.' },
  { id: 'deepseek-flash', description: 'Biaya pembuatan video lebih rendah.' },
];

const STARTER_FILTERS: Array<StylePreset | 'all'> = ['all', 'story-2d', 'story-svg', 'world', 'ads-ui'];

export default function HomePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [starterFilter, setStarterFilter] = useState<StylePreset | 'all'>('all');
  const [preset, setPreset] = useState<StylePreset>('ads-ui');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [drawingModel, setDrawingModel] = useState<DrawingModel>('gemini');
  const starters = STARTER_PROMPTS.filter((item) => starterFilter === 'all' || item.preset === starterFilter);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recentProjects, setRecentProjects] = useState<StudioProject[]>([]);
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) setRecentProjects(data.projects);
      })
      .catch(() => {});
    fetch('/api/me')
      .then((res) => res.json())
      .then((data) => setCredits(data.user?.credits ?? null))
      .catch(() => {});
  }, []);

  const handleGenerate = async (
    customPrompt?: string,
    customPreset?: StylePreset,
    customRatio?: AspectRatio
  ) => {
    const p = customPrompt || prompt;
    const pr = customPreset || preset;
    const r = customRatio || aspectRatio;

    if (!p.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: p,
          preset: pr,
          aspectRatio: r,
          drawingModel,
        }),
      });

      const data = await res.json();
      if (data.code === 'insufficient_credits') {
        router.push('/billing');
        return;
      }
      if (data.project) {
        router.push(`/studio/${data.project.id}`);
      } else {
        alert(data.error || 'Gagal menyusun draf');
        setIsGenerating(false);
      }
    } catch (err) {
      console.error('Draft failed:', err);
      alert('Gagal menyusun draf');
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Background Glow Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-emerald-500/10 blur-[130px] rounded-full" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[400px] bg-cyan-500/10 blur-[140px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white">gmotion</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                v0 for Remotion
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Prompt-to-Motion-Graphics SaaS Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {credits !== null && (
            <Link href="/billing" className="text-xs font-semibold text-emerald-300 transition hover:text-emerald-200">
              {credits} kredit
            </Link>
          )}
          <a
            href="https://github.com/bageurinc/gmotion"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-400 hover:text-slate-200 transition font-medium"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* Main Hero & Generator Studio Section */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-6 py-12 flex flex-col items-center">
        {/* Hero Title */}
        <div className="text-center max-w-3xl space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-emerald-400 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hybrid v0 Architecture: Curated Motion-Kit + Remotion Player</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.12]">
            Ketik 1-2 Kalimat. <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Motion Graphic Studio Instan.
            </span>
          </h1>

          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Hasilkan video motion graphic kelas studio lengkap dengan narasi suara Bahasa Indonesia, kinetic typography, live preview tanpa server, dan ekspor MP4 beresolusi tinggi.
          </p>
        </div>

        {/* Studio Prompt Card */}
        <div className="w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          {/* Main Prompt Input Area */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Prompt Ide Video Anda:</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Contoh: Buat video iklan FB Ads 15 detik untuk aplikasi WhatsApp AI Chatbot anti-ghosting agar closing sales naik 320%..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none transition leading-relaxed"
            />
          </div>

          {/* Controls: Preset & Aspect Ratio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Style Preset Selector */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Style Preset:</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PRESET_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={preset === option.id}
                    onClick={() => setPreset(option.id)}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col ${
                      preset === option.id
                        ? 'bg-emerald-500/10 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full mb-1">
                      <span className="text-xs font-bold text-white">{option.label}</span>
                      {preset === option.id && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
            {/* Aspect Ratio Selector */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-amber-400" />
                <span>Rasio Format:</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '9:16' as AspectRatio, label: '9:16', desc: 'Reels / TikTok', icon: Smartphone },
                  { id: '4:5' as AspectRatio, label: '4:5', desc: 'Feed IG', icon: Square },
                  { id: '16:9' as AspectRatio, label: '16:9', desc: 'YouTube', icon: Tv },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = aspectRatio === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAspectRatio(item.id)}
                      className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-slate-800 border-emerald-500/60 text-white'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-bold">{item.label}</span>
                      <span className="text-[10px] text-slate-500">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drawing Model Selector */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-violet-400" />
                <span>Model AI:</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {DRAWING_MODEL_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={drawingModel === option.id}
                    onClick={() => setDrawingModel(option.id)}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col ${
                      drawingModel === option.id
                        ? 'bg-emerald-500/10 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full mb-1">
                      <span className="text-xs font-bold text-white">{DRAWING_MODEL_LABELS[option.id]}</span>
                      {drawingModel === option.id && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>
            </div>
          </div>

          {/* Action Button & Loading Progress */}
          <div className="pt-2">
            <button
              onClick={() => handleGenerate()}
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AI sedang menyusun draf adegan...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Buat Draf Video</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* 1-Click Starter Prompts */}
        <div className="w-full mt-12 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Contoh Prompt Siap Pakai ({starters.length}):</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {STARTER_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStarterFilter(filter)}
                  className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition ${
                    starterFilter === filter
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {filter === 'all' ? 'Semua' : PRESET_LABELS[filter]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {starters.map((item) => (
              <div
                key={item.title}
                onClick={() => {
                  setPrompt(item.prompt);
                  setPreset(item.preset);
                  setAspectRatio(item.ratio);
                }}
                className="group cursor-pointer bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 hover:border-emerald-500/40 rounded-2xl p-4 transition flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                      {PRESET_LABELS[item.preset]}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{item.ratio}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                    {item.prompt}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-emerald-400 font-semibold">
                  <span>Gunakan Prompt</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Projects (if any) */}
        {recentProjects.length > 0 && (
          <div className="w-full mt-12 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Proyek Tersimpan ({recentProjects.length}):</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {recentProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/studio/${p.id}`}
                  className="bg-slate-900/40 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between transition group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                        {PRESET_LABELS[p.storyboard.preset]}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {DRAWING_MODEL_LABELS[p.drawingModel ?? 'gemini']} · {p.storyboard.aspectRatio}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition truncate">
                      {p.storyboard.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">{p.userPrompt}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-800/60 mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      {p.storyboard.scenes.length} Scenes
                    </span>
                    <span className="text-emerald-400 font-bold group-hover:underline">
                      {p.status === 'draft' ? 'Lanjutkan Draf →' : 'Buka Studio →'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        gmotion &copy; 2026. Powered by Next.js 15, Remotion 4.x, and OpenAI/OpenRouter Architecture.
      </footer>
    </div>
  );
}
