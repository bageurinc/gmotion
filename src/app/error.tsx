'use client';

import Link from 'next/link';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-12">
      <p className="mb-3 text-lg font-semibold">
        g<span className="text-emerald-300">motion.</span>
      </p>
      <h1 className="text-3xl font-semibold">Halaman belum berhasil dimuat.</h1>
      <p role="alert" className="mt-4 text-base leading-7 text-slate-300">
        Coba muat ulang. Jika masih bermasalah, kembali ke studio dan buka
        proyeknya lagi.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-5">
        <button type="button" onClick={reset} className="primary-action">
          Coba muat ulang
        </button>
        <Link
          href="/"
          className="py-3 text-sm text-slate-300 underline underline-offset-4"
        >
          Kembali ke studio
        </Link>
      </div>
    </main>
  );
}
