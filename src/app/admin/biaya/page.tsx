import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { costSummary, isAdmin, type UsageTotals } from '@/lib/billing/costs';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Biaya dan pemakaian' };

const PERIODS = [7, 30, 90];
const STAGE_LABELS: Record<string, string> = {
  draft: 'Buat draf',
  'draft-revision': 'Ubah draf (gratis)',
  generate: 'Generate video',
  revision: 'Revisi chat (jatah)',
  caption: 'Caption (gratis)',
  other: 'Lainnya (skrip, tanpa konteks)',
};
const FREE_STAGES = ['draft-revision', 'revision', 'caption'];

const rupiah = (value: number, digits = 0) =>
  `Rp${value.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const number = (value: number) => value.toLocaleString('id-ID');
const date = (ms: number) => new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

function Cost({ totals }: { totals: Pick<UsageTotals, 'idr' | 'unpriced'> }) {
  return (
    <span>
      {rupiah(totals.idr)}
      {totals.unpriced > 0 && <span className="ml-1 text-xs text-amber-300">+ {number(totals.unpriced)} belum bertarif</span>}
    </span>
  );
}

const TH = 'px-3 py-2 text-left text-xs font-semibold text-slate-400';
const TD = 'px-3 py-2 text-sm text-slate-200 tabular-nums';

export default async function AdminCostPage({ searchParams }: { searchParams: Promise<{ hari?: string; pesan?: string }> }) {
  const user = await getCurrentUser();
  // Hidden from everyone else, so the page does not reveal that it exists.
  if (!isAdmin(user)) notFound();

  const params = await searchParams;
  const days = PERIODS.includes(Number(params.hari)) ? Number(params.hari) : 30;
  const summary = await costSummary(Date.now() - days * 24 * 60 * 60 * 1000);
  const freeIdr = summary.byStage.filter((row) => FREE_STAGES.includes(row.stage)).reduce((sum, row) => sum + row.idr, 0);
  const margin = summary.revenueIdr - summary.total.idr;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex min-h-11 items-center text-sm text-slate-300 hover:text-white">← gmotion / Studio</Link>
            <Link href="/admin/assets" className="ml-4 inline-flex min-h-11 items-center text-sm text-slate-300 hover:text-white">Pustaka aset</Link>
            <h1 className="mt-2 text-3xl font-semibold text-white">Biaya dan pemakaian</h1>
            <p className="mt-2 text-sm text-slate-300">Pantau biaya pembuatan video, pemasukan kredit, dan tarif model.</p>
          </div>
          <nav aria-label="Periode" className="flex gap-1 rounded-lg bg-slate-900 p-1">
            {PERIODS.map((period) => (
              <Link
                key={period}
                href={`/admin/biaya?hari=${period}`}
                aria-current={period === days ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-semibold ${period === days ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {period} hari
              </Link>
            ))}
          </nav>
        </header>

        {params.pesan && <p role="status" className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm">{params.pesan}</p>}

        {summary.total.unpriced > 0 && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {number(summary.total.unpriced)} permintaan memakai model yang belum punya tarif, jadi total rupiah di bawah lebih kecil dari biaya sebenarnya. Isi tarifnya di bagian Tarif model.
          </p>
        )}

        <dl aria-label="Ringkasan" className="grid grid-cols-1 gap-x-8 gap-y-6 border-y border-slate-700 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Biaya AI', <Cost key="c" totals={summary.total} />],
            ['Pemasukan kredit', rupiah(summary.revenueIdr)],
            ['Selisih', <span key="m" className={margin < 0 ? 'text-red-300' : 'text-emerald-300'}>{rupiah(margin)}</span>],
            ['Video dibayar', number(summary.videosCharged)],
            ['Biaya per video dibayar', summary.videosCharged ? rupiah(summary.total.idr / summary.videosCharged) : '-'],
            ['Biaya jatah gratis', rupiah(freeIdr)],
            ['Permintaan AI', `${number(summary.total.requests)} (${number(summary.total.failed)} gagal)`],
            ['Token masuk / keluar', `${number(summary.total.inputTokens)} / ${number(summary.total.outputTokens)}`],
          ].map(([label, value]) => (
            <div key={String(label)} className="min-w-0">
              <dt className="text-sm text-slate-400">{label}</dt>
              <dd className="mt-2 break-words text-lg font-semibold text-white tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <section>
          <h2 className="mb-2 text-base font-bold text-white">Rata-rata biaya per gaya</h2>
          <p className="mb-2 text-xs text-slate-400">Semua biaya proyek yang sudah di-generate, termasuk draf, revisi, dan caption.</p>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full">
              <thead className="bg-slate-900"><tr><th className={TH}>Gaya</th><th className={TH}>Video</th><th className={TH}>Rata-rata</th><th className={TH}>Termahal</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {summary.byPreset.length === 0 && <tr><td className={TD} colSpan={4}>Belum ada video pada periode ini.</td></tr>}
                {summary.byPreset.map((row) => (
                  <tr key={row.preset}><td className={TD}>{row.preset}</td><td className={TD}>{number(row.videos)}</td><td className={TD}>{rupiah(row.averageIdr)}</td><td className={TD}>{rupiah(row.maxIdr)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-white">Per tahap</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full">
              <thead className="bg-slate-900"><tr><th className={TH}>Tahap</th><th className={TH}>Permintaan</th><th className={TH}>Token masuk</th><th className={TH}>Token keluar</th><th className={TH}>Gambar</th><th className={TH}>Karakter TTS</th><th className={TH}>Biaya</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {summary.byStage.map((row) => (
                  <tr key={row.stage}>
                    <td className={TD}>{STAGE_LABELS[row.stage] ?? row.stage}</td>
                    <td className={TD}>{number(row.requests)}</td>
                    <td className={TD}>{number(row.inputTokens)}</td>
                    <td className={TD}>{number(row.outputTokens)}</td>
                    <td className={TD}>{number(row.images)}</td>
                    <td className={TD}>{number(row.characters)}</td>
                    <td className={TD}><Cost totals={row} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-white">Proyek termahal</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full">
              <thead className="bg-slate-900"><tr><th className={TH}>Proyek</th><th className={TH}>User</th><th className={TH}>Gaya</th><th className={TH}>Permintaan</th><th className={TH}>Biaya</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {summary.topProjects.length === 0 && <tr><td className={TD} colSpan={5}>Belum ada data.</td></tr>}
                {summary.topProjects.map((row) => (
                  <tr key={row.projectId}>
                    <td className={`${TD} font-mono text-xs`}>{row.projectId}</td>
                    <td className={TD}>{row.email ?? '-'}</td>
                    <td className={TD}>{row.preset ?? '-'}</td>
                    <td className={TD}>{number(row.requests)}</td>
                    <td className={TD}><Cost totals={row} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-white">Per model dan tarif</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full">
              <thead className="bg-slate-900"><tr><th className={TH}>Model</th><th className={TH}>Permintaan</th><th className={TH}>Token masuk / keluar</th><th className={TH}>Gambar</th><th className={TH}>Karakter</th><th className={TH}>Biaya</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {summary.byModel.map((row) => (
                  <tr key={row.model}>
                    <td className={`${TD} font-mono text-xs`}>{row.model}{!row.hasRate && <span className="ml-2 font-sans text-amber-300">belum bertarif</span>}</td>
                    <td className={TD}>{number(row.requests)}</td>
                    <td className={TD}>{number(row.inputTokens)} / {number(row.outputTokens)}</td>
                    <td className={TD}>{number(row.images)}</td>
                    <td className={TD}>{number(row.characters)}</td>
                    <td className={TD}><Cost totals={row} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-base font-bold text-white">Tarif model</h2>
          <p className="mt-1 text-xs text-slate-400">Tarif baru berlaku mulai saat disimpan. Pemakaian sebelumnya tetap memakai tarif lama. Isi 0 untuk komponen yang tidak dipakai model itu.</p>
          {summary.rates.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-slate-300">
              {summary.rates.map((rate) => (
                <li key={rate.model} className="font-mono">
                  {rate.model}: masuk {rupiah(rate.idrPerMillionInput)}/1 jt token, keluar {rupiah(rate.idrPerMillionOutput)}/1 jt token, {rupiah(rate.idrPerImage)}/gambar, {rupiah(rate.idrPerMillionCharacters)}/1 jt karakter (sejak {date(rate.effectiveFrom)})
                </li>
              ))}
            </ul>
          )}
          {summary.upcoming.length > 0 && (
            <>
              <p className="mt-3 text-xs font-semibold text-amber-200">Perubahan tarif terjadwal</p>
              <ul className="mt-1 space-y-1 text-xs text-amber-100">
                {summary.upcoming.map((rate) => (
                  <li key={`${rate.model}-${rate.effectiveFrom}`} className="font-mono">
                    {rate.model}: masuk {rupiah(rate.idrPerMillionInput)}/1 jt token, keluar {rupiah(rate.idrPerMillionOutput)}/1 jt token, {rupiah(rate.idrPerImage)}/gambar, {rupiah(rate.idrPerMillionCharacters)}/1 jt karakter (mulai {date(rate.effectiveFrom)})
                  </li>
                ))}
              </ul>
            </>
          )}
          <form method="post" action="/api/admin/rates" className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
            <label className="text-xs text-slate-300 md:col-span-5">
              Model
              <input name="model" required list="usage-models" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white" />
              <datalist id="usage-models">{summary.byModel.map((row) => <option key={row.model} value={row.model} />)}</datalist>
            </label>
            {[
              ['idrPerMillionInput', 'Rp per 1 jt token masuk'],
              ['idrPerMillionOutput', 'Rp per 1 jt token keluar'],
              ['idrPerImage', 'Rp per gambar'],
              ['idrPerMillionCharacters', 'Rp per 1 jt karakter TTS'],
            ].map(([name, label]) => (
              <label key={name} className="text-xs text-slate-300">
                {label}
                <input name={name} type="number" min="0" step="any" defaultValue="0" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
              </label>
            ))}
            <button type="submit" className="self-end rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400">Simpan tarif</button>
          </form>
        </section>
      </main>
    </div>
  );
}
