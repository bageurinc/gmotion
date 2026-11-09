import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthSubmitButton } from '@/components/auth/AuthSubmitButton';
import { GoogleSignInLink } from '@/components/auth/GoogleSignInLink';
import { getCurrentUser } from '@/lib/auth/session';
import { safeNextPath } from '@/lib/auth/google';
import { MAX_PASSWORD_LENGTH, PASSWORD_SETTINGS_PATH } from '@/lib/auth/password';
import { signInWithPassword } from './actions';

const ERROR_MESSAGES: Record<string, string> = {
  config: 'Login Google belum dikonfigurasi di server.',
  state: 'Sesi login sudah kedaluwarsa. Coba lagi.',
  google: 'Login Google gagal. Coba lagi.',
  password: 'Email atau kata sandi tidak cocok, atau terlalu banyak percobaan. Coba lagi nanti atau masuk dengan Google.',
};

export const metadata: Metadata = { title: 'Masuk' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeNextPath(next);
  if (await getCurrentUser()) redirect(target);

  const message = error && Object.hasOwn(ERROR_MESSAGES, error) ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12 text-slate-100">
      <div className="grid w-full max-w-4xl gap-10 md:grid-cols-2 md:gap-16">
        <div className="border-b border-slate-700 pb-8 md:border-b-0 md:border-r md:pb-0 md:pr-12">
          <Link
            href="/"
            className="inline-block py-2 text-2xl font-semibold tracking-tight"
          >
            g<span className="text-emerald-300">motion.</span>
          </Link>
          <h1 className="mt-8 text-4xl font-medium leading-tight">
            Ceritamu punya
            <br />
            ruang untuk bergerak.
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-slate-300">
            Susun narasi, atur adegan, dan lihat idemu menjadi video.
          </p>
        </div>
        <section className="self-center" aria-labelledby="login-heading">
          <h2 id="login-heading" className="text-2xl font-semibold text-white">
            Masuk ke studio
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Masuk dengan Google atau gunakan email dan kata sandi akun gmotion kamu.
          </p>

          {message && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {message}
            </p>
          )}

          <GoogleSignInLink href={`/api/auth/google?next=${encodeURIComponent(target)}`}>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-[18px] w-[18px]"
            >
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c1-2.9 3.6-4.9 6.7-4.9Z"
              />
            </svg>
            Masuk dengan Google
          </GoogleSignInLink>

          <p className="my-4 text-center text-xs text-slate-400">atau</p>
          <form action={signInWithPassword} className="space-y-3">
            <input type="hidden" name="next" value={target} />
            <label className="block text-sm text-slate-200">
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
            <label className="block text-sm text-slate-200">
              Kata sandi
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={MAX_PASSWORD_LENGTH}
                required
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <AuthSubmitButton label="Masuk dengan email" pendingLabel="Sedang masuk…" />
          </form>
          <p className="mt-4 text-sm text-slate-300">
            Belum punya akun?{' '}
            <Link href={`/register?next=${encodeURIComponent(target)}`} className="text-emerald-300 hover:underline">
              Daftar dengan email
            </Link>
          </p>
          <p className="mt-2 text-xs leading-6 text-slate-400">
            <a
              href={`/api/auth/google?next=${encodeURIComponent(PASSWORD_SETTINGS_PATH)}`}
              className="text-emerald-300 hover:underline"
            >
              Atur kata sandi untuk akun Google
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
