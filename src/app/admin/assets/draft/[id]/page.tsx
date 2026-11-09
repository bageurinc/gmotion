import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isAdmin } from '@/lib/billing/costs';
import { getDraft, listVersions, type DraftStatus, type DraftVersion } from '@/lib/assets/library-db';
import { listPublishedAssets } from '@/lib/assets/published';
import { projectAnchor } from '@/lib/assets/draft-contract';
import { PendingForm } from '@/components/admin/PendingForm';
import { IsoCar } from '@/motion-kit/isometric';
import { PRESET_LABELS, type StoredPreset } from '@/types/studio';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Draf aset' };

const DRAFT_STATUS: Record<DraftStatus, { label: string; className: string }> = {
  draft: { label: 'Draf', className: 'bg-sky-500/15 text-sky-200' },
  review: { label: 'Perlu ditinjau', className: 'bg-amber-500/15 text-amber-200' },
  published: { label: 'Terbit', className: 'bg-emerald-500/15 text-emerald-200' },
  rejected: { label: 'Ditolak', className: 'bg-slate-700 text-slate-300' },
};
const SOURCE_LABELS: Record<DraftVersion['source'], string> = { ai: 'AI', manual: 'Edit manual', restore: 'Dipulihkan' };
const time = (ms: number) => new Date(ms).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
// Drafts are shown as images, so their SVG never runs as part of this page.
const svgSource = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

type Anchors = Record<string, [number, number, number]>;
function anchorsOf(meta: unknown, variant: string): Anchors {
  const variants = (meta as { variants?: Record<string, { anchors?: Anchors }> } | null)?.variants;
  return variants?.[variant]?.anchors ?? {};
}

export default async function DraftPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; pesan?: string }> }) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) notFound();
  const { id } = await params;
  const query = await searchParams;
  const draft = /^[0-9a-f-]{36}$/.test(id) ? await getDraft(id) : null;
  if (!draft) notFound();

  const [versions, allPublished] = await Promise.all([listVersions(id), listPublishedAssets({ includeDeprecated: true })]);
  const published = allPublished.filter((item) => item.entry.published?.draftId === id);
  const requested = Number(query.v);
  const version = versions.find((item) => item.number === requested) ?? versions.find((item) => item.number === draft.currentVersion) ?? versions[0];
  const editable = draft.status !== 'published' && draft.status !== 'rejected';
  const action = `/api/admin/assets/drafts/${id}`;
  const report = version?.report;
  const main = report?.previews.find((preview) => preview.svg);
  const anchors = main ? anchorsOf(version?.metadata, main.variant) : {};

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="space-y-3">
          <Link href="/admin/assets?tab=draf" className="inline-flex min-h-11 items-center text-sm text-slate-300 hover:text-white">← Pustaka aset / Draf</Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-white">{draft.label}</h1>
              <p className="mt-1 font-mono text-xs text-slate-400">{draft.assetId}@{draft.version} · {PRESET_LABELS[draft.preset as StoredPreset] ?? draft.preset}</p>
            </div>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${DRAFT_STATUS[draft.status].className}`}>{DRAFT_STATUS[draft.status].label}</span>
          </div>
        </header>

        {query.pesan && <p role="status" className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm">{query.pesan}</p>}

        {!version && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">Belum ada bentuk aset</h2>
            <p className="max-w-2xl text-sm text-slate-300">AI akan menggambar komponen SVG dengan proyeksi isometrik yang sama dengan pustaka, lengkap dengan varian, keadaan, warna yang bisa diubah, dan titik label. Hasilnya diperiksa otomatis lalu ditampilkan di sini untuk Anda tinjau. Biasanya butuh 1–3 menit.</p>
            {editable
              ? <PendingForm action={action} label="Buat dengan AI" pendingLabel="AI sedang menggambar… (1–3 menit)"><input type="hidden" name="action" value="generate" /></PendingForm>
              : <p className="text-sm text-slate-400">Pulihkan draf ini dulu untuk mengubahnya.</p>}
          </section>
        )}

        {version && report && (
          <div className="grid gap-6 lg:grid-cols-[1fr_17rem]">
            <div className="space-y-6 min-w-0">
              <section aria-label="Pratinjau utama" className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-bold text-white">Versi {version.number}{version.number === draft.currentVersion ? ' (aktif)' : ''}</h2>
                  <p className="text-xs text-slate-400">{SOURCE_LABELS[version.source]}{version.model ? ` · ${version.model}` : ''} · {time(version.createdAt)}</p>
                </div>
                {version.instruction && <p className="text-sm text-slate-300">Instruksi: “{version.instruction}”</p>}
                <div className="grid gap-3 md:grid-cols-2">
                  <figure className="space-y-1">
                    <div className="relative aspect-[19/12] overflow-hidden rounded-lg bg-[#F3F5F2]">
                      {main?.svg ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={svgSource(main.svg)} alt={`${draft.label}, ${main.label}`} className="absolute inset-0 h-full w-full" />
                          <svg viewBox="0 0 760 480" className="absolute inset-0 h-full w-full" aria-label="Titik label">
                            {Object.entries(anchors).map(([name, point]) => {
                              const p = projectAnchor(point);
                              return <g key={name}><circle cx={p.x} cy={p.y} r={6} fill="#E0663A" stroke="#fff" strokeWidth={2} /><text x={p.x + 10} y={p.y - 8} fontSize={16} fontWeight={700} fill="#1F2A2E" stroke="#F3F5F2" strokeWidth={4} paintOrder="stroke">{name}</text></g>;
                            })}
                          </svg>
                        </>
                      ) : <p className="p-4 text-sm text-slate-700">Tidak ada keadaan yang berhasil dirender.</p>}
                    </div>
                    <figcaption className="text-xs text-slate-400">{main?.label ?? '—'} dengan titik label</figcaption>
                  </figure>
                  <figure className="space-y-1">
                    <div className="grid aspect-[19/12] grid-cols-2 overflow-hidden rounded-lg bg-[#F3F5F2]">
                      <div className="flex items-center"><IsoCar title="Mobil pembanding" /></div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <div className="flex items-center">{main?.svg && <img src={svgSource(main.svg)} alt="" className="w-full" />}</div>
                    </div>
                    <figcaption className="text-xs text-slate-400">Skala dibanding mobil pustaka (skala sama)</figcaption>
                  </figure>
                </div>
              </section>

              <section aria-label="Pemeriksaan" className="space-y-2">
                <h2 className="text-base font-bold text-white">Pemeriksaan otomatis</h2>
                <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
                  {report.checks.map((check) => (
                    <li key={check.id} className="flex gap-3 px-3 py-2 text-sm">
                      <span aria-hidden className={check.ok ? 'text-emerald-300' : 'text-rose-300'}>{check.ok ? '✓' : '✗'}</span>
                      <span className="min-w-0"><span className="text-slate-100">{check.label}</span>{check.detail && <span className="block break-words text-xs text-slate-400">{check.detail}</span>}</span>
                    </li>
                  ))}
                </ul>
                {report.notes?.length ? (
                  <details className="text-xs text-slate-400"><summary className="inline-flex min-h-11 cursor-pointer items-center">Catatan percobaan AI ({report.notes.length})</summary><ul className="list-disc space-y-1 pl-4">{report.notes.map((note) => <li key={note} className="break-words">{note}</li>)}</ul></details>
                ) : null}
              </section>

              <section aria-label="Semua keadaan" className="space-y-2">
                <h2 className="text-base font-bold text-white">Semua varian dan keadaan</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {report.previews.map((preview) => (
                    <figure key={preview.key} className="space-y-1">
                      <div className="aspect-[19/12] overflow-hidden rounded-lg bg-[#F3F5F2]">
                        {preview.svg
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={svgSource(preview.svg)} alt={`${draft.label}, ${preview.label}`} className="h-full w-full" />
                          : <p className="p-3 text-xs text-rose-700">{preview.error}</p>}
                      </div>
                      <figcaption className="text-xs text-slate-300">{preview.label}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>

              {editable && (
                <section aria-label="Perbaiki" className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <h2 className="text-base font-bold text-white">Perbaiki versi ini</h2>
                  <PendingForm action={action} label="Revisi dengan AI" pendingLabel="AI sedang merevisi… (1–3 menit)" className="space-y-2">
                    <input type="hidden" name="action" value="revise" />
                    <label htmlFor="instruction" className="block text-sm text-slate-300">Instruksi revisi</label>
                    <textarea id="instruction" name="instruction" required minLength={3} maxLength={1000} rows={3} placeholder="Contoh: tiang lebih tinggi, kotak lampu lebih ramping, tambah pelindung di atas tiap lampu"
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
                  </PendingForm>
                  <details>
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-slate-200">Edit kode dan metadata langsung</summary>
                    <PendingForm action={action} label="Simpan sebagai versi baru" pendingLabel="Memeriksa dan menyimpan…" className="mt-2 space-y-2">
                      <input type="hidden" name="action" value="save" />
                      <label htmlFor="code" className="block text-xs text-slate-400">Kode komponen (TSX)</label>
                      <textarea id="code" name="code" required rows={18} defaultValue={version.code} spellCheck={false} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100" />
                      <label htmlFor="metadata" className="block text-xs text-slate-400">Metadata (JSON)</label>
                      <textarea id="metadata" name="metadata" required rows={12} defaultValue={JSON.stringify(version.metadata, null, 2)} spellCheck={false} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100" />
                    </PendingForm>
                  </details>
                </section>
              )}

              <section aria-label="Terbitkan" className="space-y-2 rounded-xl border border-slate-800 p-4 text-sm text-slate-300">
                <h2 className="text-base font-bold text-white">Terbitkan</h2>
                {draft.status === 'published' ? (
                  <>
                    <p>Draf ini sudah terbit{published.length ? ` sebagai ${published.map((item) => `${item.entry.assetId}@${item.entry.version}`).join(', ')}` : ''}. Versi yang terbit dikunci; proyek yang memakainya tidak berubah.</p>
                    <PendingForm action={action} label="Buka lagi untuk versi baru" pendingLabel="Membuka…"><input type="hidden" name="action" value="reopen" /></PendingForm>
                  </>
                ) : editable && version.number === draft.currentVersion ? (
                  report.ready ? (
                    <PendingForm action={action} label={`Terbitkan versi ${version.number}`} pendingLabel="Memeriksa ulang dan menerbitkan…" className="space-y-2"
                      buttonClassName="inline-flex min-h-11 items-center rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-70">
                      <input type="hidden" name="action" value="publish" />
                      <label className="flex min-h-11 items-center gap-2">
                        <input type="checkbox" name="confirm" value="yes" required className="h-5 w-5" />
                        <span>Saya sudah meninjau bentuk, skala, semua keadaan, dan batasannya.</span>
                      </label>
                      {published.length > 0 && <p className="text-xs text-slate-400">Versi terbit sebelumnya: {published.map((item) => item.entry.version).join(', ')}. Penerbitan ini membuat versi baru.</p>}
                    </PendingForm>
                  ) : <p>Masih ada pemeriksaan yang belum lolos, jadi versi ini belum bisa diterbitkan.</p>
                ) : <p>Jadikan versi ini aktif dulu untuk menerbitkannya.</p>}
                <p className="text-xs text-slate-400">Aset terbit masuk katalog yang dipakai perencana video berbasis pustaka. Alur itu belum tersambung ke pembuatan video di aplikasi, jadi untuk saat ini aset dipakai lewat skrip uji.</p>
              </section>
            </div>

            <aside aria-label="Riwayat versi" className="space-y-2">
              <h2 className="text-base font-bold text-white">Riwayat versi</h2>
              {editable && (
                <PendingForm action={action} label="Gambar ulang dari awal" pendingLabel="AI sedang menggambar…" buttonClassName="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70">
                  <input type="hidden" name="action" value="generate" />
                </PendingForm>
              )}
              <ol className="space-y-2">
                {versions.map((item) => (
                  <li key={item.id} className={`rounded-lg border px-3 py-2 text-sm ${item.number === version.number ? 'border-slate-500 bg-slate-800/60' : 'border-slate-800'}`}>
                    <Link href={`/admin/assets/draft/${id}?v=${item.number}`} className="flex min-h-11 flex-col justify-center">
                      <span className="font-semibold text-white">Versi {item.number}{item.number === draft.currentVersion ? ' · aktif' : ''}</span>
                      <span className="text-xs text-slate-400">{SOURCE_LABELS[item.source]} · {time(item.createdAt)} · {item.report.ready ? 'lolos semua' : `${item.report.checks.filter((check) => !check.ok).length} belum lolos`}</span>
                      {item.instruction && <span className="mt-1 line-clamp-2 text-xs text-slate-300">{item.instruction}</span>}
                    </Link>
                    {editable && item.number !== draft.currentVersion && (
                      <PendingForm action={action} label="Jadikan aktif" pendingLabel="Memulihkan…" buttonClassName="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-sky-300 hover:text-sky-200 disabled:opacity-70">
                        <input type="hidden" name="action" value="restore" />
                        <input type="hidden" name="version" value={item.number} />
                      </PendingForm>
                    )}
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
