'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { ArrowLeft, CheckCircle2, Clock, LogOut, QrCode } from 'lucide-react';
import { CreditPackage, formatRupiah } from '@/lib/billing/packages';

const POLL_INTERVAL_MS = 3000;

interface PublicPayment {
  id: string;
  credits: number;
  amount: number;
  status: 'creating' | 'pending' | 'paid' | 'expired' | 'failed';
  qrString: string | null;
  expiresAt: number;
}

interface BillingClientProps {
  email: string;
  initialCredits: number;
  packages: CreditPackage[];
  testMode: boolean;
  showGooglePasswordSettings: boolean;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours} jam ${minutes} menit` : `${minutes}:${seconds}`;
}

export function BillingClient({ email, initialCredits, packages, testMode, showGooglePasswordSettings }: BillingClientProps) {
  const [credits, setCredits] = useState(initialCredits);
  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [loadingPackage, setLoadingPackage] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [simulating, setSimulating] = useState(false);
  const qrFor = useRef('');

  const isPending = payment?.status === 'pending';
  const paymentId = payment?.id;

  useEffect(() => {
    const qrString = payment?.qrString;
    if (!qrString || qrFor.current === qrString) return;
    qrFor.current = qrString;
    // A QR needs dark modules on a light field to scan, whatever the page theme is.
    QRCode.toDataURL(qrString, { width: 320, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrImage)
      .catch(() => setError('QR gagal ditampilkan. Buat ulang pembayaran.'));
  }, [payment?.qrString]);

  useEffect(() => {
    if (!isPending || !paymentId) return;
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      const res = await fetch(`/api/billing/payments/${paymentId}`).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (!data?.payment) return;
      setPayment(data.payment);
      setCredits(data.credits);
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [isPending, paymentId]);

  const handleBuy = async (packageId: string) => {
    setError('');
    setLoadingPackage(packageId);
    setQrImage('');
    qrFor.current = '';
    const res = await fetch('/api/billing/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setLoadingPackage('');
    if (!data?.payment) {
      setError(data?.error ?? 'QRIS gagal dibuat. Periksa koneksi, lalu coba lagi.');
      return;
    }
    setNow(Date.now());
    setPayment(data.payment);
  };

  const handleSimulate = async () => {
    if (!payment) return;
    setSimulating(true);
    const res = await fetch(`/api/billing/payments/${payment.id}/simulate`, { method: 'POST' }).catch(() => null);
    if (!res?.ok) setError('Simulasi gagal.');
    setSimulating(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm font-semibold text-slate-300 transition-colors duration-150 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            <span>gmotion / Studio</span>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-sm text-slate-400">{email}</span>
            <button type="button" onClick={handleLogout} aria-label="Keluar" className="rounded-md p-1.5 text-slate-400 transition-colors duration-150 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold text-white">Isi kredit video</h1>
        <p className="mt-2 text-slate-400">
          Saldo kamu <strong className="font-semibold text-white">{credits} kredit</strong>. Biaya pembuatan video ditampilkan sebelum kamu mulai.
        </p>
        {showGooglePasswordSettings && (
          <Link href="/account/password" className="mt-2 inline-block text-sm text-emerald-300 hover:underline">
            Kata sandi akun
          </Link>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <section aria-labelledby="packages-heading" className="mt-8">
        <h2 id="packages-heading" className="text-base font-semibold">Pilih jumlah kredit</h2>
        <p className="mt-2 text-sm text-slate-300">Bayar dengan QRIS dari aplikasi bank atau dompet digital.</p>
        <div className="mt-5 divide-y divide-slate-700 border-y border-slate-700">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              disabled={Boolean(loadingPackage) || isPending}
              onClick={() => handleBuy(pkg.id)}
              className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-3 py-5 text-left transition-colors duration-150 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-60 sm:grid-cols-[1fr_1fr_auto]"
            >
              <span className="block text-sm font-semibold text-slate-300">{pkg.name}</span>
              <span className="block text-lg font-semibold text-white">{pkg.credits} kredit</span>
              <span className="col-span-2 text-sm text-emerald-300 sm:col-span-1">
                {loadingPackage === pkg.id ? 'Membuat QRIS...' : formatRupiah(pkg.priceIdr)}
              </span>
            </button>
          ))}
        </div>
        {isPending && <p className="mt-3 text-sm text-slate-300">Selesaikan pembayaran yang sedang berlangsung sebelum membeli paket lain.</p>}
        </section>

        {payment && (
          <section aria-live="polite" className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
            {payment.status === 'pending' && (
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                <div className="flex h-60 w-60 shrink-0 items-center justify-center rounded-lg bg-white">
                  {qrImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrImage} width={320} height={320} alt={`Kode QRIS senilai ${formatRupiah(payment.amount)}`} className="h-full w-full rounded-lg" />
                  ) : (
                    <QrCode className="h-10 w-10 text-slate-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Scan QRIS untuk membayar</h2>
                  <p className="mt-1 text-2xl font-bold text-white">{formatRupiah(payment.amount)}</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">
                    Buka aplikasi bank atau dompet digital, lalu scan kode ini. Halaman ini diperbarui otomatis setelah pembayaran masuk.
                  </p>
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-300">
                    <Clock className="h-4 w-4" />
                    <span>Berlaku {formatRemaining(payment.expiresAt - now)}</span>
                  </p>
                  {testMode && (
                    <button
                      type="button"
                      disabled={simulating}
                      onClick={handleSimulate}
                      className="mt-4 rounded-lg border border-amber-500/40 px-3 py-2 text-sm font-medium text-amber-200 transition-colors duration-150 hover:bg-amber-500/10 disabled:opacity-60"
                    >
                      {simulating ? 'Mengirim...' : 'Simulasikan pembayaran (mode uji)'}
                    </button>
                  )}
                </div>
              </div>
            )}
            {payment.status === 'paid' && (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
                <p className="text-white">Pembayaran diterima. {payment.credits} kredit sudah masuk ke saldo Anda.</p>
              </div>
            )}
            {payment.status === 'creating' && <p role="status" className="text-slate-300">Menyiapkan kode pembayaran…</p>}
            {payment.status === 'expired' && <p className="text-slate-300">QRIS sudah kedaluwarsa. Pilih paket lagi untuk membuat kode baru.</p>}
            {payment.status === 'failed' && <p className="text-slate-300">Pembayaran gagal. Pilih paket lagi untuk mencoba ulang.</p>}
          </section>
        )}
      </main>
    </div>
  );
}
