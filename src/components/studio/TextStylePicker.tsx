'use client';

import { useMemo } from 'react';
import { TEXT_STYLES, toSentenceCase } from '@/motion-kit/core/text-style';
import { TEXT_STYLE_OPTIONS } from '@/lib/text-style-options';
import type { TextStyleId } from '@/types/studio';

/**
 * Font pair choice for titles and subtitles. Each option is written in its own fonts, so the
 * user compares the real look without rendering. The director's pick is marked as the suggestion.
 */
export function TextStylePicker({ value, suggested, sample, disabled, onChange }: {
  value?: TextStyleId;
  suggested?: TextStyleId;
  /** Usually the first scene's headline, so the preview uses the user's own words. */
  sample: string;
  disabled?: boolean;
  onChange: (style: TextStyleId) => void;
}) {
  // Loads the six fonts once in this page; Remotion uses the same loaders in the video.
  const fonts = useMemo(() => Object.fromEntries(TEXT_STYLE_OPTIONS.map(({ id }) => [id, {
    headline: TEXT_STYLES[id].headlineFont(),
    body: TEXT_STYLES[id].bodyFont(),
  }])) as Record<TextStyleId, { headline: string; body: string }>, []);
  const headline = (sample.trim() || 'Judul video kamu').slice(0, 32);

  return (
    <div role="radiogroup" aria-label="Gaya teks judul dan subtitle" className="grid gap-2 sm:grid-cols-2">
      {TEXT_STYLE_OPTIONS.map((option) => {
        const look = TEXT_STYLES[option.id];
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={`min-w-0 rounded-lg border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 ${
              selected ? 'border-emerald-400 bg-emerald-400/10' : 'border-slate-700 hover:border-slate-500'
            }`}
          >
            <span className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-300">
              {option.label}
              {suggested === option.id && <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-emerald-300">Disarankan AI</span>}
            </span>
            <span
              className="mt-1 block truncate text-xl leading-tight text-white"
              style={{ fontFamily: fonts[option.id].headline, fontWeight: look.headlineWeight, letterSpacing: look.letterSpacing }}
            >
              {look.sentenceCase ? toSentenceCase(headline) : headline}
            </span>
            <span className="mt-0.5 block truncate text-sm text-slate-200" style={{ fontFamily: fonts[option.id].body, fontWeight: 700 }}>
              Ini contoh subtitle narasi
            </span>
            <span className="mt-1 block text-xs text-slate-400">{option.fonts} · {option.note}</span>
          </button>
        );
      })}
    </div>
  );
}
