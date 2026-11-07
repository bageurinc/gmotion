'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, Play, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import {
  estimateNarrationSeconds,
  firstSceneWithoutNarration,
  MAX_DRAFT_SCENES,
} from '@/lib/pipeline/draft';
import { DEFAULT_VOICE, VOICE_OPTIONS } from '@/lib/pipeline/voices';
import { SceneSpec, StudioProject } from '@/types/studio';

const FIELD_CLASS =
  'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 transition-colors duration-150 hover:border-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:opacity-60';
const ICON_BUTTON_CLASS =
  'rounded-md p-2 text-slate-300 transition-colors duration-150 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';

const SAVE_RETRY_MS = 3000;

type SaveState = 'saved' | 'pending' | 'saving' | 'error';
type RemovedScene = { scene: SceneSpec; index: number };

const SAVE_LABELS: Record<SaveState, string> = {
  saved: 'Tersimpan',
  pending: 'Menyimpan…',
  saving: 'Menyimpan…',
  error: 'Gagal menyimpan, mencoba lagi…',
};

function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded} detik`;
  return `${Math.floor(rounded / 60)} menit ${rounded % 60} detik`;
}

function createScene(): SceneSpec {
  return {
    id: `scene-new-${Date.now()}`,
    order: 0,
    role: 'narrative',
    title: '',
    voiceoverText: '',
    kineticHeadline: '',
    visualPrompt: '',
    cameraAction: 'slow-push',
    sfxCue: 'none',
    durationInFrames: 120,
    wordTimings: [],
  };
}

export const DraftReviewClient: React.FC<{ initialProject: StudioProject }> = ({ initialProject }) => {
  const router = useRouter();
  const project = initialProject;
  const [title, setTitle] = useState(initialProject.storyboard.title);
  const [scenes, setScenes] = useState(initialProject.storyboard.scenes);
  const [voice, setVoice] = useState(initialProject.storyboard.voice ?? DEFAULT_VOICE);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(initialProject.generationError ?? '');
  const [removed, setRemoved] = useState<RemovedScene | null>(null);
  const hasEdited = useRef(false);
  const contentRef = useRef({ title, scenes, voice });
  contentRef.current = { title, scenes, voice };

  const persist = useCallback(async () => {
    setSaveState('saving');
    const { title: currentTitle, scenes: currentScenes, voice: currentVoice } = contentRef.current;
    try {
      const res = await fetch(`/api/projects/${initialProject.id}/storyboard`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentTitle,
          voice: currentVoice,
          scenes: currentScenes.map(({ id, title: sceneTitle, voiceoverText, kineticHeadline, visualPrompt }) => ({
            id,
            title: sceneTitle,
            voiceoverText,
            kineticHeadline,
            visualPrompt,
          })),
        }),
      });
      if (!res.ok) throw new Error('save failed');
      if (
        contentRef.current.scenes === currentScenes &&
        contentRef.current.title === currentTitle &&
        contentRef.current.voice === currentVoice
      ) {
        setSaveState('saved');
      }
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }, [initialProject.id]);

  useEffect(() => {
    if (!hasEdited.current || isGenerating) return;
    setSaveState('pending');
    const timer = setTimeout(persist, 700);
    return () => clearTimeout(timer);
  }, [title, scenes, voice, isGenerating, persist]);

  useEffect(() => {
    if (saveState !== 'error' || isGenerating) return;
    const timer = setTimeout(persist, SAVE_RETRY_MS);
    return () => clearTimeout(timer);
  }, [saveState, isGenerating, persist]);

  const edit = (next: () => void) => {
    hasEdited.current = true;
    next();
  };

  const updateScene = (id: string, field: 'title' | 'voiceoverText' | 'kineticHeadline' | 'visualPrompt', value: string) => {
    edit(() => setScenes((items) => items.map((scene) => (scene.id === id ? { ...scene, [field]: value } : scene))));
  };

  const moveScene = (index: number, offset: number) => {
    edit(() =>
      setScenes((items) => {
        const next = [...items];
        const [scene] = next.splice(index, 1);
        next.splice(index + offset, 0, scene);
        return next;
      })
    );
  };

  const removeScene = (index: number) => {
    setRemoved({ scene: scenes[index], index });
    edit(() => setScenes((items) => items.filter((_, position) => position !== index)));
  };

  const restoreScene = () => {
    if (!removed) return;
    edit(() =>
      setScenes((items) => {
        const next = [...items];
        next.splice(Math.min(removed.index, next.length), 0, removed.scene);
        return next;
      })
    );
    setRemoved(null);
  };

  const missingNarration = firstSceneWithoutNarration(scenes);
  const totalSeconds = scenes.reduce((sum, scene) => sum + estimateNarrationSeconds(scene.voiceoverText), 0);
  const validationMessage = !title.trim()
    ? 'Isi judul video dulu.'
    : missingNarration >= 0
      ? `Adegan ${missingNarration + 1} belum punya narasi.`
      : '';

  const handleGenerate = async () => {
    if (validationMessage) return;
    setError('');
    if (!(await persist())) {
      setError('Draf belum tersimpan. Periksa koneksi, lalu coba lagi.');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/projects/${initialProject.id}/generate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (err) {
      setIsGenerating(false);
      setError(err instanceof Error && err.message ? err.message : 'Video gagal dibuat. Coba lagi.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm font-semibold text-slate-300 transition-colors duration-150 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
          <span
            role="status"
            className={`text-sm ${saveState === 'error' ? 'text-red-300' : 'text-slate-300'}`}
          >
            {SAVE_LABELS[saveState]}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-36 pt-8">
        <h1 className="text-2xl font-bold text-white">Periksa draf video</h1>
        <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-slate-300">
          Ubah apa saja yang perlu diperbaiki. Video baru dibuat setelah kamu menekan Buat Video.
        </p>

        <div className="mt-6">
          <label htmlFor="draft-title" className="mb-1.5 block text-sm font-semibold text-slate-200">
            Judul video
          </label>
          <input
            id="draft-title"
            value={title}
            maxLength={120}
            disabled={isGenerating}
            onChange={(event) => edit(() => setTitle(event.target.value))}
            className={`${FIELD_CLASS} text-base font-semibold`}
          />
          <p className="mt-2 max-w-[65ch] text-sm text-slate-300">
            <span className="font-semibold text-slate-200">Prompt:</span> {project.userPrompt}
          </p>
          <label htmlFor="draft-voice" className="mb-1.5 mt-4 block text-sm font-semibold text-slate-200">
            Suara narasi
          </label>
          <div className="flex gap-2">
            <select
              id="draft-voice"
              value={voice}
              disabled={isGenerating}
              onChange={(event) => edit(() => setVoice(event.target.value))}
              className={`${FIELD_CLASS} sm:max-w-xs`}
            >
              {VOICE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} · {option.style}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void new Audio(`/voices/${voice}.wav`).play().catch(() => undefined)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 transition-colors duration-150 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              <Play className="h-4 w-4" />
              Dengar
            </button>
          </div>
        </div>

        <ol className="mt-8 divide-y divide-slate-800 border-y border-slate-800">
          {scenes.map((scene, index) => {
            const sceneSeconds = estimateNarrationSeconds(scene.voiceoverText);
            return (
              <li key={scene.id} className="py-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <h2 className="shrink-0 text-base font-bold text-white">
                      <span className="sr-only">Adegan </span>
                      {index + 1}
                    </h2>
                    <input
                      aria-label={`Judul adegan ${index + 1}`}
                      maxLength={80}
                      value={scene.title}
                      disabled={isGenerating}
                      placeholder="Judul adegan"
                      onChange={(event) => updateScene(scene.id, 'title', event.target.value)}
                      className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-bold text-white placeholder:text-slate-400 transition-colors duration-150 hover:border-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:opacity-60"
                    />
                    {sceneSeconds > 0 && (
                      <span className="shrink-0 text-sm tabular-nums text-slate-300">±{Math.round(sceneSeconds)} dtk</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label={`Naikkan adegan ${index + 1}`}
                      disabled={index === 0 || isGenerating}
                      onClick={() => moveScene(index, -1)}
                      className={ICON_BUTTON_CLASS}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Turunkan adegan ${index + 1}`}
                      disabled={index === scenes.length - 1 || isGenerating}
                      onClick={() => moveScene(index, 1)}
                      className={ICON_BUTTON_CLASS}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Hapus adegan ${index + 1}`}
                      disabled={scenes.length === 1 || isGenerating}
                      onClick={() => removeScene(index)}
                      className={ICON_BUTTON_CLASS}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-4">
                  <div>
                    <label htmlFor={`${scene.id}-voice`} className="mb-1.5 block text-sm font-semibold text-slate-200">
                      Narasi
                    </label>
                    <textarea
                      id={`${scene.id}-voice`}
                      rows={3}
                      maxLength={800}
                      value={scene.voiceoverText}
                      disabled={isGenerating}
                      placeholder="Tulis kalimat yang akan dibacakan."
                      onChange={(event) => updateScene(scene.id, 'voiceoverText', event.target.value)}
                      className={`${FIELD_CLASS} resize-y leading-relaxed`}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`${scene.id}-headline`} className="mb-1.5 block text-sm font-semibold text-slate-200">
                        Teks di layar
                      </label>
                      <input
                        id={`${scene.id}-headline`}
                        maxLength={120}
                        value={scene.kineticHeadline}
                        disabled={isGenerating}
                        placeholder="3–6 kata singkat"
                        onChange={(event) => updateScene(scene.id, 'kineticHeadline', event.target.value)}
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${scene.id}-visual`} className="mb-1.5 block text-sm font-semibold text-slate-200">
                        Arahan visual
                      </label>
                      <textarea
                        id={`${scene.id}-visual`}
                        rows={3}
                        maxLength={1200}
                        value={scene.visualPrompt}
                        disabled={isGenerating}
                        placeholder="Apa yang terlihat di adegan ini?"
                        onChange={(event) => updateScene(scene.id, 'visualPrompt', event.target.value)}
                        className={`${FIELD_CLASS} resize-y leading-relaxed`}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={scenes.length >= MAX_DRAFT_SCENES || isGenerating}
            onClick={() => edit(() => setScenes((items) => [...items, createScene()]))}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 transition-colors duration-150 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Tambah adegan
          </button>
          {scenes.length >= MAX_DRAFT_SCENES && (
            <span className="text-sm text-slate-300">Maksimal {MAX_DRAFT_SCENES} adegan.</span>
          )}
          {removed && (
            <span className="text-sm text-slate-300">
              Adegan dihapus.{' '}
              <button
                type="button"
                onClick={restoreScene}
                className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
              >
                Batalkan
              </button>
            </span>
          )}
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="min-w-0 text-sm" aria-live="polite">
            {error || validationMessage ? (
              <p className={error ? 'text-red-300' : 'text-amber-300'}>{error || validationMessage}</p>
            ) : (
              <p className="tabular-nums text-slate-200">
                {scenes.length} adegan · sekitar {formatDuration(totalSeconds)} · {project.storyboard.aspectRatio}
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={isGenerating || Boolean(validationMessage)}
            onClick={handleGenerate}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors duration-150 hover:bg-emerald-300 sm:w-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 motion-safe:animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? 'Membuka editor…' : error ? 'Coba lagi' : 'Buat Video'}
          </button>
        </div>
      </footer>
    </div>
  );
};
