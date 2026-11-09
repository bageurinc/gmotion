import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthSubmitButton } from '@/components/auth/AuthSubmitButton';
import { safeNextPath } from '@/lib/auth/google';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/auth/password';
import { getCurrentUser } from '@/lib/auth/session';
import { registerWithPassword } from './actions';

export const metadata: Metadata = { title: 'Daftar' };

export default async function RegisterPage({ searchParams }: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeNextPath(next);
  if (await getCurrentUser()) redirect(target);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12 text-slate-100">
      <Link href="/" className="self-start text-2xl font-semibold tracking-tight">
        g<span className="text-emerald-300">motion.</span>
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">Buat akun gmotion</h1>
      <p className="mt-2 text-sm text-slate-300">Daftar dengan email dan kata sandi pilihanmu.</p>
      {(error === 'invalid' || error === 'unavailable') && (
        <p role="alert" className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error === 'unavailable'
            ? 'Email ini sudah digunakan. Masuk dengan akun yang sudah ada atau gunakan email lain.'
            : `Masukkan email yang valid dan pastikan kedua kata sandi sama serta panjangnya ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} karakter.`}
        </p>
      )}
      <form action={registerWithPassword} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={target} />
        <label className="block text-sm">
          Email
          <input
            name="email"
            type="email"
            autoComplete="username"
            maxLength={254}
            required
            className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          />
        </label>
        {[
          { name: 'password', label: 'Kata sandi' },
          { name: 'confirmation', label: 'Ulangi kata sandi' },
        ].map(({ name, label }) => (
          <label key={name} className="block text-sm">
            {label}
            <input
              name={name}
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_LENGTH}
              required
              className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
        ))}
        <p className="text-xs text-slate-400">Gunakan minimal {MIN_PASSWORD_LENGTH} karakter.</p>
        <AuthSubmitButton label="Daftar" pendingLabel="Sedang mendaftar…" />
      </form>
      <p className="mt-4 text-sm text-slate-300">
        Sudah punya akun?{' '}
        <Link href={`/login?next=${encodeURIComponent(target)}`} className="text-emerald-300 hover:underline">
          Masuk
        </Link>
      </p>
    </main>
  );
}
