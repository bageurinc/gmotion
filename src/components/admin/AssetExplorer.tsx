'use client';

import { useState } from 'react';
import type { AssetEntry } from '@/lib/assets/types';
import { PUBLISHED_RENDERER } from '@/lib/assets/types';
import { assetComponent, variantRendererProps } from '@/motion-kit/assets/asset-renderers';

type Preview = { key: string; label: string; variant: string; source: string | null };
const LABELS: Record<string, string> = {
  view: 'Tampilan', exterior: 'Bagian luar', cutaway: 'Interior / potongan dalam', chassis: 'Rangka dan mesin',
  hoodOpen: 'Buka kap mesin', bodyOpacity: 'Ketebalan bodi', wheelOpacity: 'Ketebalan roda',
  batteryCoverOpacity: 'Penutup baterai', plumbingVisible: 'Tampilkan pipa', doorOpen: 'Buka pintu',
  windowOpen: 'Buka jendela', windowLit: 'Lampu ruangan', waterRunning: 'Air mengalir',
};
const label = (key: string) => LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2');
const defaults = (entry: AssetEntry, variant: string) => Object.fromEntries(Object.entries(entry.props)
  .filter(([, spec]) => !spec.variants || spec.variants.includes(variant)).map(([name, spec]) => [name, spec.default]));

export function AssetExplorer({ entry, previews = [] }: { entry: AssetEntry; previews?: Preview[] }) {
  const [variant, setVariant] = useState(entry.defaultVariant);
  const [props, setProps] = useState(() => defaults(entry, entry.defaultVariant));
  const [state, setState] = useState('');
  const isPublished = entry.renderer === PUBLISHED_RENDERER;
  const Component = assetComponent(entry);
  const states = previews.filter((preview) => preview.variant === variant);
  const selected = states.find((preview) => preview.key === state) ?? states[0];
  const controls = Object.entries(entry.props).filter(([, spec]) => !spec.variants || spec.variants.includes(variant));
  const changeVariant = (value: string) => { setVariant(value); setProps(defaults(entry, value)); setState(''); };
  const update = (name: string, value: string | number | boolean) => setProps((previous) => ({ ...previous, [name]: value }));
  const field = 'min-h-11 w-full rounded-md border border-slate-600 bg-slate-950 px-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400';

  return <section aria-label="Jelajahi bagian aset" className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold text-white">Jelajahi bagian aset</h2>
      <p className="mt-1 text-sm text-slate-300">Pilih varian dan tampilan untuk melihat bagian yang tersedia. Perubahan ini hanya untuk pratinjau.</p>
    </div>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 overflow-hidden rounded-lg bg-[#F3F5F2]">
        {isPublished ? selected?.source
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={selected.source} width={760} height={480} alt={`${entry.label}, ${selected.label}`} className="aspect-[19/12] w-full" />
          : <p className="flex aspect-[19/12] items-center justify-center p-4 text-sm text-slate-700">Pratinjau keadaan ini belum tersedia.</p>
          : Component ? <Component {...props} {...variantRendererProps(entry.renderer, variant)} title={`${entry.label}, ${label(String(props.view ?? variant))}`} aria-label={`${entry.label}, ${label(String(props.view ?? variant))}`} />
          : <p className="p-4 text-slate-700">Pratinjau belum tersedia.</p>}
      </div>
      <div className="min-w-0 space-y-4">
        <label className="block space-y-1 text-sm text-slate-200">
          <span>Varian</span>
          <select className={field} value={variant} onChange={(event) => changeVariant(event.target.value)}>
            {Object.entries(entry.variants).map(([id, info]) => <option key={id} value={id}>{info.label}</option>)}
          </select>
        </label>
        {isPublished ? <>
          <label className="block space-y-1 text-sm text-slate-200"><span>Keadaan tersimpan</span>
            <select className={field} value={selected?.key ?? ''} disabled={!states.length} onChange={(event) => setState(event.target.value)}>
              {!states.length && <option value="">Belum ada keadaan</option>}
              {states.map((preview) => <option key={preview.key} value={preview.key}>{preview.label}</option>)}
            </select>
          </label>
          <p className="text-xs text-slate-300">Menampilkan keadaan yang disimpan saat terbit. Interior atau rangka tersedia jika sudah dibuat dalam aset sumber.</p>
        </> : <>
          {controls.map(([name, spec]) => <label key={name} className="block space-y-1 text-sm text-slate-200">
            <span>{label(name)}</span>
            {spec.type === 'enum' ? <select className={field} value={String(props[name])} onChange={(event) => update(name, event.target.value)}>
              {spec.values.map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select> : spec.type === 'boolean' ? <span className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={Boolean(props[name])} onChange={(event) => update(name, event.target.checked)} className="h-5 w-5 cursor-pointer accent-emerald-500" /><span>{props[name] ? 'Aktif' : 'Nonaktif'}</span></span>
              : spec.type === 'number' ? <span className="flex min-h-11 items-center gap-3"><input type="range" min={spec.min} max={spec.max} step={spec.integer ? 1 : (spec.max - spec.min) / 100} value={Number(props[name])} onChange={(event) => update(name, Number(event.target.value))} className="min-w-0 flex-1 cursor-pointer accent-emerald-500" /><output className="w-16 text-right tabular-nums">{Number(Number(props[name]).toFixed(2))}</output></span>
              : <input type="color" value={String(props[name])} onChange={(event) => update(name, event.target.value)} className="h-11 w-full cursor-pointer rounded border border-slate-600 bg-slate-950" />}
            <span className="block text-xs text-slate-400">{spec.description}</span>
          </label>)}
          {!controls.some(([name]) => name === 'view') && <p className="text-xs text-slate-300">Aset ini belum menyediakan mode interior atau rangka terpisah.</p>}
        </>}
        <button type="button" onClick={() => changeVariant(entry.defaultVariant)} className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-slate-800 px-3 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">Atur ulang pratinjau</button>
      </div>
    </div>
  </section>;
}
