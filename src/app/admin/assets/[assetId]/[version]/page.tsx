import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isAdmin } from '@/lib/billing/costs';
import { ASSET_REGISTRY } from '@/lib/assets/registry';
import { getPublishedVersions } from '@/lib/assets/published';
import { PublishedAssetCard } from '@/components/admin/PublishedAssetCard';
import { AssetExplorer } from '@/components/admin/AssetExplorer';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Detail aset' };

export default async function AssetDetailPage({ params }: { params: Promise<{ assetId: string; version: string }> }) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) notFound();
  const { assetId, version } = await params;
  const builtin = ASSET_REGISTRY.find((entry) => entry.assetId === assetId && entry.version === version);
  const published = builtin ? undefined : (await getPublishedVersions([{ assetId, version }]))[0];
  const entry = builtin ?? published?.entry;
  if (!entry) notFound();

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header>
          <Link href="/admin/assets?tab=terbit" className="inline-flex min-h-11 items-center text-sm text-slate-300 hover:text-white">← Pustaka aset / Terbit</Link>
          <h1 className="mt-3 break-words text-3xl font-semibold text-white">Detail {entry.label}</h1>
          <p className="mt-2 text-sm text-slate-300">{builtin ? 'Aset bawaan dari repositori.' : 'Aset yang diterbitkan dari draf.'} Detail ini menampilkan versi {entry.version}.</p>
        </header>

        <AssetExplorer entry={entry} previews={published?.previews.map((preview) => ({ key: preview.key, label: preview.label, variant: preview.variant, source: preview.svg ? `data:image/svg+xml;base64,${Buffer.from(preview.svg).toString('base64')}` : null }))} />
        <PublishedAssetCard entry={entry} previews={published?.previews} detail />

        <section aria-label="Informasi aset" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
          <h2 className="text-lg font-semibold text-white">Informasi aset</h2>
          <dl className="space-y-3 break-words">
            <div><dt className="text-slate-400">Alias pencarian</dt><dd>{entry.aliases.join(', ') || 'Belum ada alias.'}</dd></div>
            <div><dt className="text-slate-400">Varian bawaan</dt><dd>{entry.variants[entry.defaultVariant]?.label ?? entry.defaultVariant}</dd></div>
            <div><dt className="text-slate-400">Pembuat dan lisensi</dt><dd>{entry.provenance.author} · {entry.provenance.license} · {entry.provenance.commercialUse ? 'Boleh digunakan secara komersial' : 'Tidak untuk penggunaan komersial'}</dd></div>
            {entry.published && <>
              <div><dt className="text-slate-400">Diterbitkan</dt><dd>{new Date(entry.published.publishedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}{entry.published.publishedBy ? ` oleh ${entry.published.publishedBy}` : ''}</dd></div>
              <div><dt className="text-slate-400">Draf sumber</dt><dd>Versi {entry.published.draftVersion}</dd></div>
            </>}
          </dl>
          {entry.published && <Link href={`/admin/assets/draft/${encodeURIComponent(entry.published.draftId)}?v=${entry.published.draftVersion}`} className="inline-flex min-h-11 items-center rounded-md bg-slate-800 px-3 font-semibold text-white hover:bg-slate-700">Buka draf sumber dan revisi</Link>}
        </section>

        {published && <section aria-label="Keadaan aset" className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Semua varian dan keadaan</h2>
          {published.previews.length === 0 && <p className="text-sm text-slate-400">Pratinjau belum tersedia untuk versi ini.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {published.previews.map((preview) => <figure key={preview.key} className="space-y-2">
              <div className="aspect-[19/12] overflow-hidden rounded-lg bg-[#F3F5F2]">
                {preview.svg
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`data:image/svg+xml;base64,${Buffer.from(preview.svg).toString('base64')}`} width={760} height={480} alt={`${entry.label}, ${preview.label}`} className="h-full w-full" />
                  : <p className="p-4 text-sm text-slate-700">Pratinjau tidak tersedia.</p>}
              </div>
              <figcaption className="text-sm text-slate-300">{preview.label}</figcaption>
            </figure>)}
          </div>
        </section>}
      </main>
    </div>
  );
}
