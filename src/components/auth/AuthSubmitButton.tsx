'use client';

import { useFormStatus } from 'react-dom';

export function AuthSubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-300 px-4 text-sm font-semibold text-slate-950 enabled:hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-75"
      >
        {pending && <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />}
        {pending ? pendingLabel : label}
      </button>
      <span role="status" className="sr-only">{pending ? pendingLabel : ''}</span>
    </>
  );
}
