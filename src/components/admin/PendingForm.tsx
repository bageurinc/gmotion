'use client';

import React, { useState } from 'react';

/**
 * A native form post that shows a waiting label after submit, so slow admin actions
 * such as AI drafting do not look frozen. The page reloads with the result.
 */
export function PendingForm({ action, children, label, pendingLabel, buttonClassName, className }: {
  action: string;
  children?: React.ReactNode;
  label: string;
  pendingLabel: string;
  buttonClassName?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <form method="post" action={action} className={className} onSubmit={(event) => {
      if (pending) event.preventDefault();
      setPending(true);
    }}>
      {children}
      <button disabled={pending} aria-busy={pending} className={buttonClassName ?? 'inline-flex min-h-11 items-center rounded-md bg-slate-800 px-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-70'}>
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}
