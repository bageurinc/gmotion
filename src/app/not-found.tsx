import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-10 w-fit py-2 text-2xl font-semibold">
        g<span className="text-emerald-300">motion.</span>
      </Link>
      <p className="mb-3 text-sm text-slate-400">Halaman tidak ditemukan</p>
      <h1 className="text-3xl font-semibold">Proyeknya belum bisa dibuka.</h1>
      <p className="mt-4 text-base leading-7 text-slate-300">
        Tautan ini mungkin sudah tidak tersedia, atau proyek tersimpan di akun
        lain. Kembali ke studio untuk melihat proyek milikmu.
      </p>
      <Link href="/" className="primary-action mt-8 w-fit">
        Kembali ke studio
      </Link>
    </main>
  );
}
