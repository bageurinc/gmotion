'use client';

import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import type { StorySvgDraft } from '@/lib/explainer/story-svg-draft';
import { compileVirtualProject } from '@/lib/runtime/browser-compiler';

export function StorySvgDraftPreview({ draft, background, status, children }: {
  draft: StorySvgDraft;
  background: string;
  status: string;
  children?: ReactNode;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const Preview = useMemo(() => {
    const names = [...new Set(draft.sceneObjects.flat())];
    const cards = names.map((name) => {
      const label = name.replace(/^StoryObject/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
      return `<figure className="min-w-0">
        <svg role="img" aria-label={${JSON.stringify(label)}} viewBox="-500 -500 1000 1000"
          className="aspect-square w-full rounded-lg" style={{ backgroundColor: ${JSON.stringify(background)} }}>
          <g><${name} /></g>
        </svg>
        <figcaption className="mt-1 break-words text-xs text-slate-300">{${JSON.stringify(label)}}</figcaption>
      </figure>`;
    });
    return compileVirtualProject({
      'MainVideo.tsx': `${draft.sharedWorld}
export default function DraftPreview() {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">${cards.join('\n')}</div>;
}`,
    }, 'MainVideo.tsx');
  }, [draft, background]);

  useLayoutEffect(() => {
    grid.current?.querySelectorAll('figure > svg').forEach((svg) => {
      const shape = svg.firstElementChild as SVGGElement | null;
      const box = shape?.getBBox();
      if (!box || !box.width || !box.height) return;
      const padding = Math.max(box.width, box.height) * 0.12;
      svg.setAttribute('viewBox', `${box.x - padding} ${box.y - padding} ${box.width + 2 * padding} ${box.height + 2 * padding}`);
    });
  }, [Preview]);

  return <div ref={grid} className="w-full max-w-2xl overflow-auto p-4">
    <h2 className="text-sm font-semibold text-slate-100">Draf objek SVG siap</h2>
    <p role="status" className="mb-4 mt-1 text-sm text-slate-300">{status}</p>
    <Preview />
    {children}
  </div>;
}
