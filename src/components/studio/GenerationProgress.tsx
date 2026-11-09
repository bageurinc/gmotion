'use client';

import React from 'react';
import { AlertCircle, Check, Circle, RefreshCw } from 'lucide-react';
import { SceneStage, StudioProject } from '@/types/studio';
import { generationPercent } from '@/lib/studio-progress';
import type { DraftProgress } from '@/lib/explainer/story-svg-draft';

const STAGE_LABELS: Record<SceneStage, string> = {
  queued: 'Menunggu',
  audio: 'Membuat suara',
  animation: 'Menggambar adegan',
  ready: 'Selesai',
  failed: 'Gagal',
};

const StageIcon: React.FC<{ stage: SceneStage }> = ({ stage }) => {
  if (stage === 'ready') return <Check className="h-4 w-4 text-emerald-300" />;
  if (stage === 'failed') return <AlertCircle className="h-4 w-4 text-red-300" />;
  if (stage === 'queued') return <Circle className="h-4 w-4 text-slate-500" />;
  return <RefreshCw className="h-4 w-4 text-cyan-300 motion-safe:animate-spin" />;
};

/** Bar and step for the Full SVG object draft, shown where the draft will appear. */
export const DraftProgressBar: React.FC<{ progress?: DraftProgress; note?: string }> = ({ progress, note }) => {
  const percent = Math.round(progress?.percent ?? 0);
  return (
    <div className="w-full max-w-xs">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-slate-100" aria-live="polite">{progress?.label ?? 'Menyiapkan…'}</span>
        <span className="shrink-0 font-semibold tabular-nums text-white">{percent}%</span>
      </div>
      <div role="progressbar" aria-label="Progres draf objek" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-cyan-400 transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
      {note && <p className="mt-2 text-xs text-slate-400">{note}</p>}
    </div>
  );
};

export const GenerationProgress: React.FC<{
  project: StudioProject;
  interrupted: boolean;
  isRetrying: boolean;
  onRetry: () => void;
}> = ({ project, interrupted, isRetrying, onRetry }) => {
  const scenes = project.storyboard.scenes;
  const stageOf = (id: string): SceneStage => project.sceneProgress?.[id]?.stage ?? 'queued';
  const readyCount = scenes.filter((scene) => stageOf(scene.id) === 'ready').length;
  const hasFailure = scenes.some((scene) => stageOf(scene.id) === 'failed');
  const canRetry = interrupted || (project.status !== 'generating' && hasFailure);
  const percent = generationPercent(project);
  const draftStep = project.status === 'generating' && !project.storySvgDraft ? project.storySvgDraftProgress : undefined;
  let heading = `${readyCount} dari ${scenes.length} adegan selesai`;
  if (project.storySvgReviewPending) heading = 'Menunggu persetujuan draf objek';
  else if (project.checkingScenes) heading = 'Memeriksa semua adegan…';
  else if (draftStep) heading = `Draf objek: ${draftStep.label}`;

  return (
    <section aria-label="Progres pembuatan video" className="border-b border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-sm font-bold text-white" aria-live="polite">{heading}</h2>
        <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-white">{percent}%</span>
        {canRetry && (
          <button
            type="button"
            disabled={isRetrying}
            onClick={onRetry}
            className="rounded-lg bg-emerald-400 px-3 py-1.5 text-sm font-bold text-slate-950 transition-colors duration-150 hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {interrupted ? 'Lanjutkan' : 'Coba lagi'}
          </button>
        )}
      </div>
      <div
        role="progressbar"
        aria-label="Progres pembuatan video"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"
      >
        <div className="h-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
      {interrupted && <p className="mt-2 text-sm text-amber-300">Proses terhenti. Adegan yang sudah selesai tetap aman.</p>}
      <ol
        aria-label="Status tiap adegan"
        tabIndex={scenes.length > 9 ? 0 : undefined}
        className="mt-3 max-h-56 space-y-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {scenes.map((scene, index) => {
          const stage = stageOf(scene.id);
          return (
            <li key={scene.id} className="flex items-center gap-2 text-sm">
              <StageIcon stage={stage} />
              <span className="min-w-0 flex-1 truncate text-slate-100">
                {index + 1}. {scene.title}
              </span>
              <span className={`shrink-0 ${stage === 'failed' ? 'text-red-300' : 'text-slate-300'}`}>
                {project.sceneProgress?.[scene.id]?.simplified ? 'Versi sederhana' : STAGE_LABELS[stage]}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
