import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, PASSWORD_SETTINGS_PATH } from '@/lib/auth/password';
import { getCurrentUser, getPasswordSetupSessionId, hasVerifiedEmail } from '@/lib/auth/session';
import { savePassword } from './actions';

export const metadata: Metadata = { title: 'Kata sandi akun' };

export default async function PasswordSettingsPage({ searchParams }: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(PASSWORD_SETTINGS_PATH)}`);
  if (!hasVerifiedEmail(user)) redirect('/');
  const canSetPassword = Boolean(await getPasswordSetupSessionId(user.id));
  const { status } = await searchParams;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 py-12 text-slate-100">
      <Link href="/" className="text-sm text-emerald-300 hover:underline">Kembali ke studio</Link>
      <h1 className="mt-6 text-2xl font-semibold">Kata sandi akun</h1>
      <p className="mt-2 break-all text-sm text-slate-300">{user.email}</p>
      {status === 'saved' && (
        <p role="status" className="mt-4 text-sm text-emerald-300">
          Kata sandi tersimpan. Sekarang kamu bisa masuk dengan email ini dan kata sandimu.
        </p>
      )}
      {status === 'invalid' && (
        <p role="alert" className="mt-4 text-sm text-red-200">
          Pastikan kedua kata sandi sama dan panjangnya {MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_LENGTH} karakter.
        </p>
      )}
      {status === 'failed' && (
        <p role="alert" className="mt-4 text-sm text-red-200">Kata sandi gagal disimpan. Coba masuk ulang dengan Google.</p>
      )}
      {canSetPassword ? (
        <form action={savePassword} className="mt-6 space-y-4">
          {[
            { name: 'password', label: 'Kata sandi baru' },
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
          <button className="min-h-11 w-full rounded-md bg-emerald-300 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-200">
            Simpan kata sandi
          </button>
        </form>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-300">Konfirmasi akun Google untuk membuat atau mengganti kata sandi gmotion.</p>
          <a
            href={`/api/auth/google?next=${encodeURIComponent(PASSWORD_SETTINGS_PATH)}`}
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-200"
          >
            Konfirmasi lewat Google
          </a>
        </>
      )}
    </main>
  );
}
