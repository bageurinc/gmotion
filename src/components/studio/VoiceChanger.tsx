'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_VOICE, VOICE_OPTIONS } from '@/lib/pipeline/voices';
import type { StudioProject } from '@/types/studio';

type Provider = 'gemini' | 'elevenlabs';
interface ElevenVoice { id: string; name: string; previewUrl?: string }

/** Picks another narrator voice in the studio. Every scene is spoken again, which costs credits. */
export function VoiceChanger({ project, disabled, onChanged }: {
  project: StudioProject;
  disabled: boolean;
  onChanged: (project: StudioProject) => void;
}) {
  const currentProvider: Provider = project.storyboard.voiceProvider ?? 'gemini';
  const currentVoice = project.storyboard.voice ?? DEFAULT_VOICE;
  const [choice, setChoice] = useState(`${currentProvider}:${currentVoice}`);
  const [prices, setPrices] = useState<{ gemini: number; elevenlabs: number | null } | null>(null);
  const [eleven, setEleven] = useState<ElevenVoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setChoice(`${currentProvider}:${currentVoice}`);
  }, [currentProvider, currentVoice]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${project.id}/voice`).then((res) => (res.ok ? res.json() : null)).then((data) => {
      if (!cancelled && data) setPrices(data);
    }).catch(() => undefined);
    fetch('/api/voices/elevenlabs').then((res) => (res.ok ? res.json() : null)).then((data) => {
      if (!cancelled && data?.available) setEleven(data.voices ?? []);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      audioRef.current?.pause();
    };
  }, [project.id]);

  const [provider, voice] = choice.split(':') as [Provider, string];
  const unchanged = provider === currentProvider && voice === currentVoice;
  const price = provider === 'elevenlabs' ? prices?.elevenlabs : prices?.gemini;
  const previewUrl = provider === 'gemini' ? `/voices/${voice}.wav` : eleven.find((option) => option.id === voice)?.previewUrl;

  const listen = () => {
    if (!previewUrl) return;
    audioRef.current?.pause();
    audioRef.current = new Audio(previewUrl);
    void audioRef.current.play().catch(() => undefined);
  };

  const apply = async () => {
    if (unchanged || saving || price == null) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice, provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.project) onChanged(data.project);
      if (!res.ok) throw new Error(data.error || 'Suara gagal diganti.');
      setMessage(data.complete
        ? { text: `Suara diganti. ${data.credits} kredit terpakai.`, error: false }
        : { text: 'Sebagian adegan gagal diganti. Kredit dikembalikan.', error: true });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Suara gagal diganti.', error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="voice-heading" className="space-y-2">
      <h2 id="voice-heading" className="text-sm font-semibold text-slate-100">Suara narator</h2>
      <p className="text-xs text-slate-400">
        Semua adegan dibacakan ulang dengan suara baru, lalu subtitle dan timing menyesuaikan.
        {price != null && ` Biaya ${price} kredit.`}
      </p>
      <div className="flex flex-wrap gap-2">
        <label htmlFor="studio-voice" className="sr-only">Pilih suara narator</label>
        <select id="studio-voice" value={choice} disabled={disabled || saving}
          onChange={(event) => { setChoice(event.target.value); setMessage(null); }}
          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
          <optgroup label="Gemini">
            {VOICE_OPTIONS.map((option) => (
              <option key={option.id} value={`gemini:${option.id}`}>{option.label} · {option.style}</option>
            ))}
          </optgroup>
          {(eleven.length > 0 || currentProvider === 'elevenlabs') && prices?.elevenlabs != null && (
            <optgroup label="ElevenLabs">
              {(eleven.some((option) => option.id === currentVoice) || currentProvider !== 'elevenlabs'
                ? eleven
                : [{ id: currentVoice, name: 'Suara ElevenLabs' }, ...eleven]
              ).map((option) => (
                <option key={option.id} value={`elevenlabs:${option.id}`}>{option.name}</option>
              ))}
            </optgroup>
          )}
        </select>
        {previewUrl && (
          <button type="button" onClick={listen} className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800">
            Dengar
          </button>
        )}
      </div>
      <button type="button" onClick={() => void apply()} disabled={disabled || saving || unchanged || price == null}
        className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
        {saving ? 'Membacakan ulang…' : price != null ? `Ganti suara (${price} kredit)` : 'Ganti suara'}
      </button>
      {saving && <p role="status" className="text-xs text-slate-400">Semua adegan sedang dibacakan ulang dan diperiksa. Jangan tutup halaman ini.</p>}
      {message && <p role={message.error ? 'alert' : 'status'} className={`text-xs ${message.error ? 'text-red-300' : 'text-emerald-300'}`}>{message.text}</p>}
    </section>
  );
}
