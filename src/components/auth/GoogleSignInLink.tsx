'use client';

import { useEffect, useState, type ReactNode } from 'react';

export function GoogleSignInLink({ href, children }: { href: string; children: ReactNode }) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const reset = () => setPending(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  return (
    <>
      <a
        href={href}
        aria-disabled={pending}
        onClick={(event) => {
          if (pending) {
            event.preventDefault();
            return;
          }
          if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setPending(true);
        }}
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-md bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition-colors duration-150 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 aria-disabled:cursor-wait aria-disabled:opacity-75"
      >
        {pending ? (
          <>
            <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
            Menghubungkan ke Google…
          </>
        ) : children}
      </a>
      <span role="status" className="sr-only">{pending ? 'Menghubungkan ke Google…' : ''}</span>
    </>
  );
}
