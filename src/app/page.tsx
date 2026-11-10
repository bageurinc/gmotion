'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Check, RefreshCw } from 'lucide-react';
import {
  StylePreset,
  ArtStyle,
  AspectRatio,
  DrawingModel,
  StudioProject,
  ART_STYLE_LABELS,
  DRAWING_MODEL_LABELS,
  PRESET_LABELS,
  presetAllowed,
  supportsArtStyle,
} from '@/types/studio';
import { STARTER_PROMPTS } from '@/lib/starter-prompts';
import { readDraftIntent, saveDraftIntent } from '@/lib/studio/draft-intent';

const PRESETS: Array<{ id: StylePreset; description: string }> = [
  { id: 'story-2d', description: 'Ilustrasi dan animasi untuk bercerita.' },
  {
    id: 'story-svg',
    description: 'Bentuk vektor yang bergerak mengikuti cerita.',
  },
  { id: 'ads-ui', description: 'Mockup produk, grafik, dan ajakan membeli.' },
  { id: 'world', description: 'Benda dan proses dalam ruang isometrik.' },
];
const ART_STYLES: Array<{ id: ArtStyle; description: string }> = [
  { id: 'flat', description: 'Vektor rapi dengan garis tepi tebal.' },
  { id: 'pixel', description: 'Gaya game 16-bit dengan piksel kotak.' },
];
const RATIOS: Array<{ id: AspectRatio; label: string }> = [
  { id: '9:16', label: 'Reels / TikTok' },
  { id: '4:5', label: 'Feed Instagram' },
  { id: '16:9', label: 'YouTube' },
];
const FILTERS: Array<StylePreset | 'all'> = [
  'all',
  'story-2d',
  'story-svg',
  'world',
  'ads-ui',
];

export default function HomePage() {
  const router = useRouter();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState('');
  const [preset, setPreset] = useState<StylePreset>('ads-ui');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [drawingModel, setDrawingModel] = useState<DrawingModel>('gemini');
  const [artStyle, setArtStyle] = useState<ArtStyle>('flat');
  const [filter, setFilter] = useState<StylePreset | 'all'>('all');
  const [showAllStarters, setShowAllStarters] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [projectsState, setProjectsState] = useState<
    'loading' | 'ready' | 'error' | 'guest'
  >('loading');
  const [credits, setCredits] = useState<number | null>(null);
  // Isometrik presets are admin-only while they are in development.
  const [admin, setAdmin] = useState(false);
  const [accountState, setAccountState] = useState<
    'loading' | 'signed-in' | 'guest' | 'error'
  >('loading');

  const loadProjects = () => {
    setProjectsState('loading');
    fetch('/api/projects')
      .then(async (res) => {
        if (res.status === 401) {
          setProjectsState('guest');
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setProjects(data.projects ?? []);
        setProjectsState('ready');
      })
      .catch(() => setProjectsState('error'));
  };

  useEffect(() => {
    const draftId = new URLSearchParams(window.location.search).get('draft');
    const draft = draftId ? readDraftIntent(draftId) : null;
    if (draft) {
      setPrompt(draft.prompt);
      setPreset(draft.preset);
      setAspectRatio(draft.aspectRatio);
      setDrawingModel(draft.drawingModel);
      setArtStyle(draft.artStyle);
    }
    loadProjects();
    fetch('/api/me')
      .then(async (res) => {
        if (res.status === 401) {
          setAccountState('guest');
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setCredits(data.user?.credits ?? null);
        setAdmin(data.user?.isAdmin === true);
        setAccountState(data.user ? 'signed-in' : 'guest');
      })
      .catch(() => setAccountState('error'));
  }, []);

  const handleGenerate = () => {
    if (!prompt.trim() || isGenerating) return;
    setError('');
    setIsGenerating(true);
    try {
      const requestId = crypto.randomUUID();
      saveDraftIntent({
        requestId,
        startedAt: Date.now(),
        prompt: prompt.trim(),
        preset,
        aspectRatio,
        drawingModel,
        artStyle: supportsArtStyle(preset) ? artStyle : 'flat',
      });
      router.push(`/studio/new?request=${requestId}`);
    } catch {
      setError(
        'Ide belum bisa disimpan di browser ini. Izinkan penyimpanan situs, lalu coba lagi.',
      );
      setIsGenerating(false);
    }
  };
  const presets = PRESETS.filter((option) => presetAllowed(option.id, admin));
  const filters = FILTERS.filter((item) => item === 'all' || presetAllowed(item, admin));
  const starters = STARTER_PROMPTS.filter(
    (item) => presetAllowed(item.preset, admin) && (filter === 'all' || item.preset === filter),
  );
  // A saved draft or filter may point at a preset this account cannot use.
  useEffect(() => {
    if (accountState === 'loading') return;
    if (!presetAllowed(preset, admin)) setPreset('ads-ui');
    if (filter !== 'all' && !presetAllowed(filter, admin)) setFilter('all');
  }, [accountState, admin, preset, filter]);

  return (
    <div className="min-h-screen text-slate-100">
      <a
        href="#brief"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-slate-800 focus:p-4"
      >
        Langsung ke ide video
      </a>
      <header className="border-b border-slate-800">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            href="/"
            aria-label="gmotion, beranda"
            className="text-2xl font-semibold tracking-tight"
          >
            g<span className="text-emerald-300">motion.</span>
          </Link>
          <nav
            aria-label="Navigasi utama"
            className="flex items-center gap-5 text-sm"
          >
            <a
              href="#projects"
              className="py-3 text-slate-300 hover:text-white"
            >
              Proyek
            </a>
            {accountState === 'signed-in' ? (
              <Link
                href="/billing"
                className="rounded-md border border-slate-700 px-3 py-2 hover:bg-slate-800"
              >
                {credits} kredit
              </Link>
            ) : accountState === 'loading' ? (
              <span className="text-slate-400" role="status">
                Memuat akun…
              </span>
            ) : (
              <Link
                href="/login"
                className="rounded-md border border-slate-700 px-3 py-2 hover:bg-slate-800"
              >
                Masuk
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[0.8fr_1.7fr] lg:gap-16">
          <div>
            <p className="mb-5 text-sm text-slate-400">
              Studio video · Bahasa Indonesia
            </p>
            <h1 className="max-w-sm text-4xl font-medium leading-[1.15] sm:text-5xl">
              Mulai dari cerita.
              <br />
              <span className="text-emerald-300">Jadikan video.</span>
            </h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-slate-300">
              Tulis idenya, periksa narasi dan adegannya, lalu buat animasi yang
              bisa kamu revisi.
            </p>
            <ol
              aria-label="Alur membuat video"
              className="mt-8 space-y-4 border-t border-slate-700 pt-6 text-sm"
            >
              {[
                'Tulis ide & pilih format',
                'Periksa draf adegan',
                'Buat, revisi & unduh video',
              ].map((label, i) => (
                <li
                  key={label}
                  className={`flex items-center gap-3 ${i === 0 ? 'text-slate-100' : 'text-slate-400'}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-700 text-xs tabular-nums">
                    {i + 1}
                  </span>
                  {label}
                </li>
              ))}
            </ol>
          </div>
          <form
            id="brief"
            onSubmit={(event) => {
              event.preventDefault();
              void handleGenerate();
            }}
            className="min-w-0 scroll-mt-6 rounded-xl border border-slate-700 bg-slate-900 p-5 sm:p-7"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <label htmlFor="video-idea" className="text-lg font-semibold">
                Video apa yang ingin kamu buat?
              </label>
              <span className="shrink-0 text-xs text-slate-400">Draf baru</span>
            </div>
            <textarea
              ref={promptRef}
              id="video-idea"
              required
              maxLength={6000}
              disabled={isGenerating}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Misalnya: Jelaskan cara menyeduh kopi dengan V60 untuk pemula. Gunakan bahasa santai dan tutup dengan tips memilih gilingan."
              className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 p-4 text-base leading-7 placeholder:text-slate-400 disabled:opacity-60"
            />
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Sebutkan topik, penonton, dan pesan yang ingin mereka ingat.
            </p>
            <fieldset disabled={isGenerating} className="mt-6">
              <legend className="mb-3 text-sm font-semibold">Gaya video</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {presets.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    aria-pressed={preset === option.id}
                    onClick={() => setPreset(option.id)}
                    className="option-control disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                      {option.id === 'ads-ui'
                        ? 'Iklan produk'
                        : PRESET_LABELS[option.id]}
                      {!presetAllowed(option.id, false) && (
                        <span className="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-200">
                          Admin
                        </span>
                      )}
                      {preset === option.id && (
                        <Check
                          aria-hidden="true"
                          className="h-4 w-4 text-emerald-300"
                        />
                      )}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-slate-300">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
            {supportsArtStyle(preset) && (
              <fieldset disabled={isGenerating} className="mt-6">
                <legend className="mb-3 text-sm font-semibold">
                  Gaya gambar
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {ART_STYLES.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      aria-pressed={artStyle === option.id}
                      onClick={() => setArtStyle(option.id)}
                      className="option-control disabled:opacity-50"
                    >
                      <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                        {ART_STYLE_LABELS[option.id]}
                        {artStyle === option.id && (
                          <Check
                            aria-hidden="true"
                            className="h-4 w-4 text-emerald-300"
                          />
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-300">
                        {option.description}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <fieldset disabled={isGenerating} className="mt-6">
              <legend className="mb-3 text-sm font-semibold">
                Format layar
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {RATIOS.map((ratio) => (
                  <button
                    type="button"
                    key={ratio.id}
                    aria-pressed={aspectRatio === ratio.id}
                    onClick={() => setAspectRatio(ratio.id)}
                    className="option-control disabled:opacity-50"
                  >
                    <span className="block text-sm font-semibold tabular-nums">
                      {ratio.id}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-300">
                      {ratio.label}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
            <details className="mt-5 border-b border-slate-700 pb-5">
              <summary className="flex min-h-11 items-center justify-between gap-3 text-sm text-slate-300">
                Pengaturan pembuatan{' '}
                <span className="text-xs">
                  {DRAWING_MODEL_LABELS[drawingModel]} · +
                </span>
              </summary>
              <label
                htmlFor="drawing-model"
                className="mt-3 block text-sm text-slate-300"
              >
                Model gambar
              </label>
              <select
                id="drawing-model"
                disabled={isGenerating}
                value={drawingModel}
                onChange={(e) =>
                  setDrawingModel(e.target.value as DrawingModel)
                }
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="gemini">
                  {DRAWING_MODEL_LABELS.gemini} — model bawaan
                </option>
                <option value="deepseek-flash">
                  {DRAWING_MODEL_LABELS['deepseek-flash']} — biaya lebih rendah
                </option>
              </select>
            </details>
            {error && (
              <p role="alert" className="mt-4 text-sm leading-6 text-red-300">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[28ch] text-xs leading-5 text-slate-300">
                Kamu bisa mengubah draf sebelum membuat video.
              </p>
              <button
                type="submit"
                disabled={!prompt.trim() || isGenerating}
                className="primary-action shrink-0"
              >
                {isGenerating && (
                  <RefreshCw
                    aria-hidden="true"
                    className="h-4 w-4 motion-safe:animate-spin"
                  />
                )}
                {isGenerating ? 'Membuka draf…' : 'Susun draf video'}
              </button>
            </div>
            <span role="status" className="sr-only">
              {isGenerating
                ? 'Membuka halaman penyusunan draf.'
                : ''}
            </span>
          </form>
        </div>
        <section
          id="projects"
          aria-labelledby="projects-heading"
          className="workspace-section scroll-mt-6"
        >
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 id="projects-heading" className="text-xl font-semibold">
              Lanjutkan proyek
            </h2>
            <span className="text-sm text-slate-400">
              {projects.length > 0
                ? `${projects.length} proyek`
                : 'Ruang kerjamu'}
            </span>
          </div>
          {projectsState === 'loading' && (
            <p role="status" className="py-4 text-sm text-slate-400">
              Memuat proyek tersimpan…
            </p>
          )}
          {projectsState === 'error' && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-4 py-4 text-sm text-slate-300"
            >
              Proyek belum bisa dimuat.
              <button
                type="button"
                onClick={loadProjects}
                className="rounded-md border border-slate-700 px-4 py-2 hover:bg-slate-800"
              >
                Muat ulang
              </button>
            </div>
          )}
          {projectsState === 'guest' && (
            <p className="py-4 text-sm leading-6 text-slate-300">
              <Link
                href="/login"
                className="text-emerald-300 underline underline-offset-4"
              >
                Masuk dengan Google
              </Link>{' '}
              untuk membuka proyek tersimpan.
            </p>
          )}
          {projectsState === 'ready' && projects.length === 0 && (
            <p className="py-4 text-sm leading-6 text-slate-300">
              Belum ada proyek. Mulai dari ide di atas, atau gunakan salah satu
              contoh di bawah.
            </p>
          )}
          {projectsState === 'ready' && (
            <div className="divide-y divide-slate-800">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/studio/${project.id}`}
                  className="group flex items-center justify-between gap-4 py-5"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-medium group-hover:text-emerald-300">
                      {project.storyboard.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {PRESET_LABELS[project.storyboard.preset]} ·{' '}
                      {project.storyboard.aspectRatio} ·{' '}
                      {project.storyboard.scenes.length} adegan
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-sm text-slate-300">
                    <span className="hidden sm:inline">
                      {project.status === 'draft' ? 'Buka draf' : 'Buka studio'}
                    </span>
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section
          aria-labelledby="examples-heading"
          className="workspace-section"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="examples-heading" className="text-xl font-semibold">
                Butuh titik awal?
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Pilih ide, lalu sesuaikan dengan ceritamu.
              </p>
            </div>
            <div
              role="group"
              aria-label="Filter contoh"
              className="flex flex-wrap gap-1"
            >
              {filters.map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={filter === item}
                  onClick={() => {
                    setFilter(item);
                    setShowAllStarters(false);
                  }}
                  className={`rounded-md px-3 py-2 text-sm transition-colors ${filter === item ? 'bg-slate-800 text-emerald-300' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
                >
                  {item === 'all'
                    ? 'Semua'
                    : item === 'ads-ui'
                      ? 'Iklan'
                      : PRESET_LABELS[item]}
                </button>
              ))}
            </div>
          </div>
          <div id="starter-list" className="mt-6 divide-y divide-slate-800">
            {(showAllStarters ? starters : starters.slice(0, 6)).map((item) => (
              <button
                type="button"
                key={item.title}
                disabled={isGenerating}
                onClick={() => {
                  setPrompt(item.prompt);
                  setPreset(item.preset);
                  setAspectRatio(item.ratio);
                  promptRef.current?.focus();
                  promptRef.current?.scrollIntoView({
                    behavior: 'instant',
                    block: 'center',
                  });
                }}
                className="group grid w-full gap-2 py-5 text-left transition-colors hover:bg-slate-900 sm:grid-cols-[180px_1fr_auto] sm:gap-6 disabled:opacity-50"
              >
                <span className="text-sm font-medium group-hover:text-emerald-300">
                  {item.title}
                </span>
                <span className="line-clamp-2 text-sm leading-6 text-slate-300">
                  {item.prompt}
                </span>
                <span className="text-xs leading-6 text-slate-400">
                  {item.ratio}
                  <span className="sr-only"> — Gunakan ide ini</span>
                </span>
              </button>
            ))}
          </div>
          {starters.length > 6 && (
            <button
              type="button"
              aria-expanded={showAllStarters}
              aria-controls="starter-list"
              onClick={() => setShowAllStarters((value) => !value)}
              className="mt-4 rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              {showAllStarters
                ? 'Tampilkan lebih sedikit'
                : `Lihat semua ${starters.length} ide`}
            </button>
          )}
        </section>
      </main>
      <footer className="border-t border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-5 py-6 text-xs text-slate-400 sm:px-8">
          <span>gmotion · Ruang untuk cerita bergerak.</span>
          <span>Ide → Draf → Video</span>
        </div>
      </footer>
    </div>
  );
}
