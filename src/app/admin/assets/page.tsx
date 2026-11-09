import { PublishedAssetCard } from '@/components/admin/PublishedAssetCard';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isAdmin } from '@/lib/billing/costs';
import { ASSET_REGISTRY } from '@/lib/assets/registry';
import { listDrafts, listRequestedAssets, type DraftStatus } from '@/lib/assets/library-db';
import { listPublishedAssets } from '@/lib/assets/published';
import { PRESET_LABELS, type StoredPreset } from '@/types/studio';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pustaka aset' };

const TABS = [
  { id: 'terbit', label: 'Terbit' },
  { id: 'draf', label: 'Draf' },
  { id: 'diminta', label: 'Diminta' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const DRAFT_STATUS: Record<DraftStatus, { label: string; className: string }> = {
  draft: { label: 'Draf', className: 'bg-sky-500/15 text-sky-200' },
  review: { label: 'Perlu ditinjau', className: 'bg-amber-500/15 text-amber-200' },
  published: { label: 'Terbit', className: 'bg-emerald-500/15 text-emerald-200' },
  rejected: { label: 'Ditolak', className: 'bg-slate-700 text-slate-300' },
};
const KIND_LABELS: Record<string, string> = { object: 'Objek', action: 'Aksi', environment: 'Lingkungan' };

const TH = 'px-3 py-2 text-left text-xs font-semibold text-slate-400';
const TD = 'px-3 py-2 text-sm text-slate-200';
const presetLabel = (preset: string) => PRESET_LABELS[preset as StoredPreset] ?? preset;
const date = (ms: number) => new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{label}</span>;
}

export default async function AdminAssetsPage({ searchParams }: { searchParams: Promise<{ tab?: string; pesan?: string }> }) {
  const user = await getCurrentUser();
  // Hidden from everyone else, so the page does not reveal that it exists.
  if (!isAdmin(user)) notFound();

  const params = await searchParams;
  const tab: Tab = TABS.some((item) => item.id === params.tab) ? (params.tab as Tab) : 'terbit';
  const [drafts, requested, published] = await Promise.all([listDrafts(), listRequestedAssets(), listPublishedAssets({ includeDeprecated: true })]);
  const openDrafts = drafts.filter((draft) => draft.status !== 'rejected').length;
  const counts: Record<Tab, number> = { terbit: ASSET_REGISTRY.length + published.length, draf: openDrafts, diminta: requested.length };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Link href="/" className="inline-flex min-h-11 items-center text-slate-300 hover:text-white">← gmotion / Studio</Link>
            <Link href="/admin/biaya" className="inline-flex min-h-11 items-center text-slate-300 hover:text-white">Biaya</Link>
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-white">Pustaka aset</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Aset terbit dipakai video. Draf belum dipakai sampai Anda menerbitkannya. Daftar diminta berisi objek yang dicari user tetapi belum ada di pustaka.
            </p>
          </div>
          <nav aria-label="Bagian pustaka" className="flex w-fit gap-1 rounded-lg bg-slate-900 p-1">
            {TABS.map((item) => (
              <Link
                key={item.id}
                href={`/admin/assets?tab=${item.id}`}
                aria-current={item.id === tab ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${item.id === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {item.label}
                <span className="tabular-nums text-xs text-slate-400">{counts[item.id]}</span>
              </Link>
            ))}
          </nav>
        </header>

        {params.pesan && <p role="status" className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm">{params.pesan}</p>}

        {tab === 'terbit' && (
          <section aria-label="Aset terbit" className="space-y-4">
            <p className="text-xs text-slate-400">Aset terbit berasal dari kode di repositori. Status Uji coba berarti belum lolos definisi selesai di plan_asset.md.</p>
            {ASSET_REGISTRY.map((entry) => <PublishedAssetCard key={`${entry.assetId}@${entry.version}`} entry={entry} />)}
            {published.length > 0 && <h2 className="pt-4 text-base font-bold text-white">Diterbitkan dari draf</h2>}
            {published.map((item) => <PublishedAssetCard key={`${item.entry.assetId}@${item.entry.version}`} entry={item.entry} previews={item.previews} />)}
          </section>
        )}

        {tab === 'draf' && (
          <section aria-label="Draf aset" className="space-y-3">
            <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              Buka draf untuk membuat bentuknya dengan AI, meninjau pratinjau, memperbaikinya, dan menerbitkannya setelah pemeriksaan lolos.
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full">
                <thead className="bg-slate-900"><tr><th className={TH}>Aset</th><th className={TH}>Gaya</th><th className={TH}>Status</th><th className={TH}>Dibuat</th><th className={TH}><span className="sr-only">Aksi</span></th></tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {drafts.length === 0 && <tr><td className={TD} colSpan={5}>Belum ada draf. Buka tab Diminta lalu pilih Jadikan draf.</td></tr>}
                  {drafts.map((draft) => (
                    <tr key={draft.id} className={draft.status === 'rejected' ? 'opacity-60' : undefined}>
                      <td className={TD}>
                        <Link href={`/admin/assets/draft/${draft.id}`} className="inline-flex min-h-11 items-center font-semibold text-white underline-offset-4 hover:underline">{draft.label}</Link>
                        <span className="block font-mono text-xs text-slate-500">{draft.assetId}@{draft.version}</span>
                      </td>
                      <td className={TD}>{presetLabel(draft.preset)}</td>
                      <td className={TD}><Badge {...DRAFT_STATUS[draft.status]} /></td>
                      <td className={`${TD} tabular-nums`}>{date(draft.createdAt)}{draft.createdBy && <span className="block text-xs text-slate-500">{draft.createdBy}</span>}</td>
                      <td className={`${TD} text-right`}>
                        <form method="post" action="/api/admin/assets/drafts">
                          <input type="hidden" name="action" value="status" />
                          <input type="hidden" name="id" value={draft.id} />
                          <input type="hidden" name="status" value={draft.status === 'rejected' ? 'draft' : 'rejected'} />
                          <button className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white">
                            {draft.status === 'rejected' ? 'Pulihkan' : 'Tolak'}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'diminta' && (
          <section aria-label="Aset yang diminta" className="space-y-3">
            <p className="text-xs text-slate-400">Dicatat saat rencana video menyebut objek, aksi, atau lingkungan yang belum ada di pustaka. Diurutkan dari yang paling sering diminta.</p>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full">
                <thead className="bg-slate-900"><tr><th className={TH}>Yang diminta</th><th className={TH}>Gaya</th><th className={TH}>Jumlah</th><th className={TH}>Terakhir</th><th className={TH}><span className="sr-only">Aksi</span></th></tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {requested.length === 0 && <tr><td className={TD} colSpan={5}>Belum ada permintaan yang tercatat.</td></tr>}
                  {requested.map((row) => (
                    <tr key={`${row.preset}:${row.subject}`}>
                      <td className={TD}>
                        <span className="font-semibold text-white">{row.subject}</span>
                        <span className="ml-2 text-xs text-slate-500">{KIND_LABELS[row.kind] ?? row.kind}</span>
                        {row.sampleTopic && <span className="block max-w-sm truncate text-xs text-slate-500" title={row.sampleTopic}>Contoh: {row.sampleTopic}</span>}
                      </td>
                      <td className={TD}>{presetLabel(row.preset)}</td>
                      <td className={`${TD} tabular-nums`}>{row.count}</td>
                      <td className={`${TD} tabular-nums`}>{date(row.lastAt)}</td>
                      <td className={`${TD} text-right`}>
                        {row.draftStatus ? (
                          <Badge {...DRAFT_STATUS[row.draftStatus]} />
                        ) : (
                          <form method="post" action="/api/admin/assets/drafts">
                            <input type="hidden" name="action" value="create" />
                            <input type="hidden" name="subject" value={row.subject} />
                            <input type="hidden" name="preset" value={row.preset} />
                            <button className="inline-flex min-h-11 items-center rounded-md bg-slate-800 px-3 text-sm font-semibold text-white hover:bg-slate-700">Jadikan draf</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
