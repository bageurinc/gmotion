import { recordUsage } from '@/lib/billing/usage';
import type { WordTiming } from '@/types/studio';

const API = 'https://api.elevenlabs.io';
const RETRYABLE = new Set([429, 500, 502, 503]);
const MAX_ATTEMPTS = 3;
const VOICE_ID = /^[A-Za-z0-9]{10,40}$/;

export interface ElevenLabsVoice {
  id: string;
  name: string;
  previewUrl?: string;
}

export interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export const isElevenLabsVoiceId = (id: string) => VOICE_ID.test(id);

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim() && isElevenLabsVoiceId(process.env.ELEVENLABS_VOICE_ID?.trim() ?? ''));
}

export const elevenLabsModel = () => process.env.ELEVENLABS_MODEL?.trim() || 'eleven_v4';

export const defaultElevenLabsVoice = () => process.env.ELEVENLABS_VOICE_ID?.trim() ?? '';

/**
 * Turns ElevenLabs character timings into one timing per word of the narration, so captions
 * follow the real speech instead of an even split. Returns [] when the words do not line up.
 */
export function alignmentToWordTimings(text: string, alignment: ElevenLabsAlignment | null | undefined): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!alignment || !words.length) return [];
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment;
  const runs: Array<{ start: number; end: number }> = [];
  let current: { start: number; end: number } | null = null;
  characters.forEach((char, i) => {
    if (/\s/.test(char)) {
      if (current) runs.push(current);
      current = null;
    } else if (current) {
      current.end = ends[i] ?? current.end;
    } else {
      current = { start: starts[i] ?? 0, end: ends[i] ?? starts[i] ?? 0 };
    }
  });
  if (current) runs.push(current);
  if (runs.length !== words.length) return [];
  return words.map((word, i) => ({
    word,
    startMs: Math.round(runs[i].start * 1000),
    endMs: Math.round(Math.max(runs[i].end, runs[i].start) * 1000),
  }));
}

function failure(status: number, body: unknown): Error {
  const detail = (body as { detail?: { status?: string } } | null)?.detail;
  // Only the error kind is shown; ElevenLabs bodies can echo request details.
  if (status === 401 && detail?.status === 'missing_permissions') {
    return new Error('Kunci ElevenLabs belum punya izin text_to_speech. Aktifkan izin itu di dashboard ElevenLabs.');
  }
  if (status === 401) return new Error('Kunci ElevenLabs ditolak. Periksa ELEVENLABS_API_KEY.');
  if (status === 402 || detail?.status === 'quota_exceeded') return new Error('Kuota karakter ElevenLabs habis.');
  return new Error(`Suara ElevenLabs gagal dibuat (HTTP ${status}). Coba lagi.`);
}

export async function synthesizeElevenLabs(
  text: string,
  voiceId: string
): Promise<{ audio: Buffer; wordTimings: WordTiming[] }> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new Error('Suara ElevenLabs belum dikonfigurasi.');
  if (!isElevenLabsVoiceId(voiceId)) throw new Error('Suara ElevenLabs tidak valid. Pilih suara lagi di layar draf.');
  const model = elevenLabsModel();

  let lastError: Error = new Error('Suara ElevenLabs gagal dibuat.');
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, Number(process.env.ELEVENLABS_RETRY_DELAY_MS ?? 5000) * attempt));
    const startedAt = Date.now();
    const response = await fetch(`${API}/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: model, language_code: 'id' }),
      signal: AbortSignal.timeout(90_000),
    });
    const body = (await response.json().catch(() => null)) as { audio_base64?: string; alignment?: ElevenLabsAlignment } | null;
    const ok = response.ok && Boolean(body?.audio_base64);
    recordUsage({ kind: 'speech', model: `elevenlabs/${model}`, characters: ok ? text.length : 0, durationMs: Date.now() - startedAt, ok });
    if (ok) {
      return { audio: Buffer.from(body!.audio_base64!, 'base64'), wordTimings: alignmentToWordTimings(text, body!.alignment) };
    }
    lastError = response.ok ? new Error('ElevenLabs tidak mengirim audio. Coba lagi.') : failure(response.status, body);
    if (!RETRYABLE.has(response.status)) break;
  }
  throw lastError;
}

/**
 * The account's voices when the key may read them. A key limited to speech still offers the
 * configured voice, so the option keeps working.
 */
export async function listElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  const fallback: ElevenLabsVoice[] = isElevenLabsConfigured() ? [{ id: defaultElevenLabsVoice(), name: 'Suara ElevenLabs' }] : [];
  if (!key || !fallback.length) return fallback;
  try {
    const response = await fetch(`${API}/v2/voices?page_size=100`, { headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return fallback;
    const body = (await response.json()) as { voices?: Array<{ voice_id?: string; name?: string; preview_url?: string }> };
    const voices = (body.voices ?? [])
      .filter((voice): voice is { voice_id: string; name?: string; preview_url?: string } => isElevenLabsVoiceId(voice.voice_id ?? ''))
      .map((voice): ElevenLabsVoice => ({ id: voice.voice_id, name: (voice.name ?? voice.voice_id).slice(0, 60), previewUrl: voice.preview_url }));
    if (!voices.some((voice) => voice.id === fallback[0].id)) voices.unshift(fallback[0]);
    return voices;
  } catch {
    return fallback;
  }
}
