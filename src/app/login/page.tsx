import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { safeNextPath } from '@/lib/auth/google';

const ERROR_MESSAGES: Record<string, string> = {
  config: 'Login Google belum dikonfigurasi di server.',
  state: 'Sesi login sudah kedaluwarsa. Coba lagi.',
  google: 'Login Google gagal. Coba lagi.',
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

  const message = error ? ERROR_MESSAGES[error] : undefined;

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
            Gunakan akun Google untuk menyimpan dan melanjutkan proyek. Akun
            gmotion dibuat otomatis saat pertama kali masuk.
          </p>

          {message && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {message}
            </p>
          )}

          <a
            href={`/api/auth/google?next=${encodeURIComponent(target)}`}
            className="mt-6 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-md bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition-colors duration-150 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
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
          </a>
          <p className="mt-4 text-xs leading-6 text-slate-400">
            Draf dan video tersimpan di akun yang kamu gunakan.
          </p>
        </section>
      </div>
    </main>
  );
}
