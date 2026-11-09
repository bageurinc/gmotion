import Link from 'next/link';
import { resolveInstanceProps } from '@/lib/assets/plan-schema';
import { PUBLISHED_RENDERER, type AssetEntry, type AssetStatus } from '@/lib/assets/types';
import { assetComponent, variantRendererProps } from '@/motion-kit/assets/asset-renderers';
import type { PublishedAsset } from '@/lib/assets/published';
import { PRESET_LABELS, type StoredPreset } from '@/types/studio';

const ASSET_STATUS: Record<AssetStatus, { label: string; className: string }> = {
  experimental: { label: 'Uji coba', className: 'bg-amber-500/15 text-amber-200' },
  ready: { label: 'Siap', className: 'bg-emerald-500/15 text-emerald-200' },
  deprecated: { label: 'Usang', className: 'bg-slate-700 text-slate-300' },
};
export const assetDetailHref = (entry: AssetEntry) => `/admin/assets/${encodeURIComponent(entry.assetId)}/${encodeURIComponent(entry.version)}`;
const presetLabel = (preset: string) => PRESET_LABELS[preset as StoredPreset] ?? preset;

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{label}</span>;
}

function AssetPreview({ entry, variant, previews }: { entry: AssetEntry; variant: string; previews?: PublishedAsset['previews'] }) {
  if (entry.renderer === PUBLISHED_RENDERER) {
    // Published assets are shown from the previews stored at publish time, as images.
    const svg = previews?.find((preview) => preview.key === variant)?.svg;
    return (
      <div className="aspect-[19/12] overflow-hidden rounded-lg bg-[#F3F5F2]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {svg ? <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`} width={760} height={480} alt={`${entry.label}, ${entry.variants[variant].label}`} className="h-full w-full" /> : <p className="p-4 text-sm text-slate-700">Pratinjau belum tersedia.</p>}
      </div>
    );
  }
  const Component = assetComponent(entry);
  if (!Component) return null;
  const props = resolveInstanceProps(entry, { id: 'preview', assetId: entry.assetId, assetVersion: entry.version, variant, props: {} });
  const label = `${entry.label}, ${entry.variants[variant].label}`;
  return (
    <div className="aspect-[19/12] overflow-hidden rounded-lg bg-[#F3F5F2]">
      <Component {...props} {...variantRendererProps(entry.renderer, variant)} title={label} aria-label={label} />
    </div>
  );
}

export function PublishedAssetCard({ entry, previews, detail = false }: { entry: AssetEntry; previews?: PublishedAsset['previews']; detail?: boolean }) {
  const status = ASSET_STATUS[entry.status];
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{detail ? entry.label : <Link href={assetDetailHref(entry)} className="underline-offset-4 hover:underline">{entry.label}</Link>}</h3>
          <p className="mt-1 font-mono text-xs text-slate-400">{entry.assetId}@{entry.version}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge {...status} />
          {entry.styles.map((style) => <Badge key={style} label={presetLabel(style)} className="bg-slate-800 text-slate-300" />)}
        </div>
      </header>

      {!detail && <Link href={assetDetailHref(entry)} className="mt-3 inline-flex min-h-11 items-center rounded-md bg-slate-800 px-3 text-sm font-semibold text-white hover:bg-slate-700">Lihat detail</Link>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {Object.entries(entry.variants).map(([id, variant]) => (
          <section key={id} aria-label={variant.label}>
            <AssetPreview entry={entry} variant={id} previews={previews} />
            <h4 className="mt-2 text-sm font-semibold text-white">{variant.label} <span className="font-mono text-xs font-normal text-slate-500">{id}</span></h4>
            <p className="mt-1 text-xs text-slate-400">{variant.capabilities.length} kemampuan · {Object.keys(variant.anchors).length} titik label</p>
            <ul className="mt-2 flex flex-wrap gap-1" aria-label="Kemampuan">
              {variant.capabilities.map((capability) => <li key={capability} className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">{capability}</li>)}
            </ul>
            {variant.limitations.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-slate-400">
                {variant.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
              </ul>
            )}
          </section>
        ))}
      </div>

      <details open={detail} className="mt-4 text-sm text-slate-300">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-slate-200">Properti dan batasan umum</summary>
        <ul className="mt-2 space-y-1 text-xs">
          {Object.entries(entry.props).map(([name, spec]) => (
            <li key={name}>
              <span className="font-mono text-slate-200">{name}</span>
              <span className="text-slate-500"> · {spec.type}{spec.animatable ? ' · bisa dianimasikan' : ''}{spec.variants ? ` · hanya ${spec.variants.join(', ')}` : ''}</span>
              <span className="text-slate-400"> · {spec.description}</span>
            </li>
          ))}
        </ul>
        {entry.limitations.length > 0 && (
          <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-slate-400">
            {entry.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        )}
      </details>
    </article>
  );
}

