import Link from 'next/link';
import { Check, Circle, LoaderCircle } from 'lucide-react';
import { ART_STYLE_LABELS, PRESET_LABELS } from '@/types/studio';
import type { DraftIntent } from '@/lib/studio/draft-intent';

export function DraftPreparationView({
  intent,
  phase = 'preparing',
  elapsed = 0,
}: {
  intent?: DraftIntent;
  phase?: 'preparing' | 'drafting' | 'ready';
  elapsed?: number;
}) {
  const step = phase === 'preparing' ? 0 : phase === 'drafting' ? 1 : 2;
  const labels = [
    'Ide siap diproses',
    'Menyusun adegan dan narasi',
    'Draf siap diperiksa',
  ];

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" className="py-2 text-xl font-semibold">
            g<span className="text-emerald-300">motion.</span>
          </Link>
          <span className="text-sm text-slate-400">
            Ide / <span className="text-emerald-300">Draf</span> / Video
          </span>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-8 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
        <section aria-labelledby="draft-loading-heading">
          <div role="status" aria-live="polite">
            <h1
              id="draft-loading-heading"
              className="text-3xl font-semibold leading-tight"
            >
              {phase === 'ready'
                ? 'Drafmu sudah siap.'
                : 'Sedang menyusun draf.'}
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {phase === 'ready'
                ? 'Membuka narasi dan adegan untuk kamu periksa…'
                : phase === 'preparing'
                  ? 'Menyiapkan ide dan pilihan formatmu…'
                  : 'Menyusun alur cerita, narasi, dan arahan visual dari idemu.'}
            </p>
          </div>
          <ol
            aria-label="Tahap penyusunan draf"
            className="mt-7 space-y-5 border-y border-slate-700 py-6"
          >
            {labels.map((label, index) => {
              const done = index < step || phase === 'ready';
              const active = index === step && phase !== 'ready';
              return (
                <li
                  key={label}
                  aria-current={active ? 'step' : undefined}
                  className={`flex items-start gap-3 text-sm leading-6 ${active || done ? 'text-slate-100' : 'text-slate-400'}`}
                >
                  {done ? (
                    <Check
                      aria-hidden="true"
                      className="mt-1 h-4 w-4 shrink-0 text-emerald-300"
                    />
                  ) : active ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="mt-1 h-4 w-4 shrink-0 text-emerald-300 motion-safe:animate-spin"
                    />
                  ) : (
                    <Circle
                      aria-hidden="true"
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                  )}
                  <span>
                    {label}
                    <span className="sr-only">
                      {done
                        ? ', selesai'
                        : active
                          ? ', sedang berlangsung'
                          : ', menunggu'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-sm tabular-nums text-slate-400">
            Waktu berjalan {Math.floor(elapsed / 60)}:
            {String(elapsed % 60).padStart(2, '0')}
          </p>
          {elapsed >= 60 && phase !== 'ready' && (
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Masih menyusun draf. Kamu bisa kembali ke studio; permintaan ini
              tetap bisa dibuka lagi dari tab ini.
            </p>
          )}
          {intent && (
            <details className="mt-5 border-t border-slate-800 pt-3" open>
              <summary className="flex min-h-11 items-center text-sm font-medium">
                Ide yang sedang dikerjakan
              </summary>
              <p className="mt-2 break-words text-sm leading-6 text-slate-300">
                {intent.prompt}
              </p>
              <p className="mt-3 text-xs text-slate-400">
                {PRESET_LABELS[intent.preset]}
                {intent.artStyle === 'pixel' && ` · ${ART_STYLE_LABELS.pixel}`} · {intent.aspectRatio}
              </p>
            </details>
          )}
        </section>
        <section
          aria-label="Kerangka draf video"
          aria-busy={phase !== 'ready'}
          className="min-w-0"
        >
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold">Draf video</h2>
            <span className="text-xs text-slate-400">
              {phase === 'ready' ? 'Siap dibuka' : 'Sedang diproses'}
            </span>
          </div>
          <div aria-hidden="true" className="draft-skeleton space-y-7">
            <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-5">
              <div className="h-3 w-24 rounded bg-slate-700" />
              <div className="h-7 w-3/4 rounded bg-slate-800" />
              <div className="h-4 w-1/2 rounded bg-slate-800" />
            </div>
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="space-y-5 border-t border-slate-700 pt-6"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-slate-800" />
                  <div className="h-5 w-1/2 rounded bg-slate-800" />
                </div>
                <div className="space-y-3">
                  <div className="h-3 w-16 rounded bg-slate-700" />
                  <div className="h-3 w-full rounded bg-slate-800" />
                  <div className="h-3 w-5/6 rounded bg-slate-800" />
                  <div className="h-3 w-2/3 rounded bg-slate-800" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-14 rounded bg-slate-900" />
                  <div className="h-14 rounded bg-slate-900" />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs leading-5 text-slate-400">
            Ini kerangka tampilan, bukan jumlah adegan akhir. Narasi dan adegan
            akan muncul setelah draf selesai.
          </p>
        </section>
      </main>
    </div>
  );
}
