'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DraftPreparationView } from './DraftPreparationView';
import {
  readDraftIntent,
  saveDraftIntent,
  type DraftIntent,
} from '@/lib/studio/draft-intent';

class DraftRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function requestDraft(intent: DraftIntent): Promise<string> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: intent.requestId,
      prompt: intent.prompt,
      preset: intent.preset,
      aspectRatio: intent.aspectRatio,
      drawingModel: intent.drawingModel,
      artStyle: intent.artStyle,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new DraftRequestError(
      data?.error || 'Draf belum berhasil dibuat. Coba lagi.',
      response.status,
      data?.code,
    );
  const projectId = data?.project?.id;
  if (typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(projectId))
    throw new Error('Jawaban server belum lengkap. Coba lagi.');
  // The draft is already saved on the server; browser storage failure must not block opening it.
  try {
    saveDraftIntent({ ...intent, projectId });
  } catch {
    /* A retry can recover it by requestId. */
  }
  return projectId;
}

export function DraftPreparationClient({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [intent, setIntent] = useState<DraftIntent>();
  const [phase, setPhase] = useState<'preparing' | 'drafting' | 'ready'>(
    'preparing',
  );
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const request = useRef<{ id: string; promise: Promise<string> } | null>(null);

  useEffect(() => {
    const saved = readDraftIntent(requestId);
    if (!saved) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setError('');
    setIntent(saved);
    if (saved.projectId) {
      setPhase('ready');
      router.replace(`/studio/${saved.projectId}`);
      return;
    }
    let disposed = false;
    setPhase('drafting');
    if (!request.current || request.current.id !== requestId)
      request.current = { id: requestId, promise: requestDraft(saved) };
    request.current.promise
      .then((projectId) => {
        if (disposed) return;
        setPhase('ready');
        router.replace(`/studio/${projectId}`);
      })
      .catch((err: unknown) => {
        if (disposed) return;
        if (err instanceof DraftRequestError && err.status === 401) {
          router.replace(
            `/login?next=${encodeURIComponent(`/studio/new?request=${requestId}`)}`,
          );
          return;
        }
        if (
          err instanceof DraftRequestError &&
          err.code === 'insufficient_credits'
        ) {
          router.replace('/billing');
          return;
        }
        setError(
          err instanceof TypeError
            ? 'Koneksi terputus. Periksa koneksi, lalu coba lagi.'
            : err instanceof Error
              ? err.message
              : 'Draf belum berhasil disusun. Coba lagi.',
        );
      });
    return () => {
      disposed = true;
    };
  }, [requestId, attempt, router]);

  useEffect(() => {
    if (!intent || error || phase === 'ready') return;
    const tick = () =>
      setElapsed(
        Math.max(0, Math.floor((Date.now() - intent.startedAt) / 1000)),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [intent, error, phase]);

  if (missing || error)
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-12">
        <Link href="/" className="mb-8 w-fit py-2 text-xl font-semibold">
          g<span className="text-emerald-300">motion.</span>
        </Link>
        <h1 className="text-3xl font-semibold">
          {missing ? 'Mulai dari ide videomu.' : 'Draf belum berhasil disusun.'}
        </h1>
        <p
          role={error ? 'alert' : undefined}
          className="mt-4 text-base leading-7 text-slate-300"
        >
          {missing
            ? 'Ide untuk permintaan ini tidak tersedia di tab ini. Kembali ke studio untuk menulis atau memilih ide.'
            : error}
        </p>
        {!missing && intent && (
          <p className="mt-5 break-words rounded-md border border-slate-700 p-4 text-sm leading-6 text-slate-300">
            {intent.prompt}
          </p>
        )}
        <div className="mt-7 flex flex-wrap items-center gap-4">
          {!missing && (
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                request.current = null;
                setAttempt((value) => value + 1);
              }}
            >
              Coba susun lagi
            </button>
          )}
          <Link
            className={
              missing
                ? 'primary-action'
                : 'py-3 text-sm text-slate-300 underline underline-offset-4'
            }
            href={intent ? `/?draft=${intent.requestId}#brief` : '/'}
          >
            {missing ? 'Kembali ke studio' : 'Edit ide video'}
          </Link>
        </div>
      </main>
    );

  return (
    <DraftPreparationView intent={intent} phase={phase} elapsed={elapsed} />
  );
}
