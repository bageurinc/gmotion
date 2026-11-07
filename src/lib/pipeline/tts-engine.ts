import { mapWithConcurrency, PIPELINE_CONCURRENCY } from './concurrency';
import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import * as musicMetadata from 'music-metadata';
import { SceneSpec, WordTiming, Storyboard } from '@/types/studio';

const RATE_LIMIT_STATUS = new Set([429, 502]);
const TTS_RATE_LIMIT_RETRIES = 4;

export interface TTSOptions {
  voice?: string;
  fps?: number;
  projectId: string;
}

/**
 * Creates a PCM tone for test fixtures. This is not speech and must never be
 * substituted for narration when a TTS provider fails.
 */
export function createFallbackAudioBuffer(durationSeconds: number, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34);
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Gentle low-amplitude carrier tone so audio track registers as active in media players
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 220 * t) * 80; // Very soft 220Hz hum
    buffer.writeInt16LE(Math.round(sample), 44 + i * 2);
  }

  return buffer;
}

/**
 * Generates word boundary timestamps estimated from text syllables and total duration
 */
export function estimateWordTimings(text: string, durationSeconds: number): WordTiming[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  // Leave small buffer at start and end
  const effectiveDurationMs = (durationSeconds - 0.2) * 1000;
  const msPerWord = effectiveDurationMs / words.length;

  return words.map((word, idx) => {
    const startMs = Math.round(100 + idx * msPerWord);
    const endMs = Math.round(startMs + msPerWord * 0.9);
    return {
      word,
      startMs,
      endMs,
    };
  });
}

/**
 * Generate audio for a single scene and calculate exact durationInFrames & wordTimings.
 */
export async function generateSceneAudio(
  scene: SceneSpec,
  options: TTSOptions
): Promise<{
  audioUrl: string;
  durationInFrames: number;
  wordTimings: WordTiming[];
}> {
  const fps = options.fps || 30;
  const projectStorageDir = path.join(process.cwd(), 'storage', 'projects', options.projectId, 'assets');
  if (!fs.existsSync(projectStorageDir)) {
    fs.mkdirSync(projectStorageDir, { recursive: true });
  }

  if (!scene.voiceoverText.trim()) {
    if (scene.fixedDurationSec && scene.fixedDurationSec > 0) {
      const durationInFrames = Math.max(30, Math.round(scene.fixedDurationSec * fps));
      return {
        audioUrl: '',
        durationInFrames,
        wordTimings: [],
      };
    }
    throw new Error('Narasi kosong. Isi naskah suara sebelum membuat audio.');
  }
  const configuredVoice = process.env.TTS_VOICE_ID || 'id-ID-ArdiNeural';
  const provider = process.env.TTS_PROVIDER || 'msedge-tts';
  let audioBuffer: Buffer;

  if (provider === '9router' || provider === 'openai-compatible') {
    const baseUrl = process.env.TTS_BASE_URL || process.env.OPENAI_BASE_URL;
    const apiKey = process.env.TTS_API_KEY || process.env.OPENAI_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error('Konfigurasi TTS belum lengkap: isi TTS_BASE_URL dan TTS_API_KEY.');
    }
    const voiceName = options.voice || configuredVoice;
    const requestSpeech = () =>
      fetch(`${baseUrl.replace(/\/+$/, '')}/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.TTS_MODEL || `edge-tts/${voiceName}`,
          voice: voiceName,
          input: scene.voiceoverText,
          response_format: 'mp3',
        }),
        signal: AbortSignal.timeout(60000),
      });

    let response = await requestSpeech();
    for (let attempt = 0; attempt < TTS_RATE_LIMIT_RETRIES && RATE_LIMIT_STATUS.has(response.status); attempt += 1) {
      await response.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, Number(process.env.TTS_RETRY_DELAY_MS ?? 35_000)));
      response = await requestSpeech();
    }
    if (!response.ok) {
      // Do not include upstream bodies: they may contain credentials or provider internals.
      throw new Error(`TTS ${provider} gagal (HTTP ${response.status}). Periksa koneksi dan provider suara.`);
    }
    audioBuffer = Buffer.from(await response.arrayBuffer());
  } else if (provider === 'msedge-tts') {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
    const tts = new MsEdgeTTS();
    const tempDir = fs.mkdtempSync(path.join(projectStorageDir, '.tts-'));
    try {
      await tts.setMetadata(configuredVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      // msedge-tts takes a directory and returns the generated file path.
      const result = await tts.toFile(tempDir, scene.voiceoverText);
      audioBuffer = fs.readFileSync(result.audioFilePath);
    } finally {
      tts.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } else {
    throw new Error(`TTS_PROVIDER tidak didukung: ${provider}`);
  }

  const isWav = audioBuffer.subarray(0, 4).toString('ascii') === 'RIFF';
  const audioFileName = `${scene.id}.${isWav ? 'wav' : 'mp3'}`;
  const audioFilePath = path.join(projectStorageDir, audioFileName);
  const metadata = await musicMetadata.parseBuffer(
    audioBuffer,
    { mimeType: isWav ? 'audio/wav' : 'audio/mpeg', size: audioBuffer.length },
    { duration: true }
  );
  const audioDurationSeconds = metadata.format.duration;
  if (!audioDurationSeconds || !Number.isFinite(audioDurationSeconds) || audioDurationSeconds <= 0) {
    throw new Error('Provider TTS tidak menghasilkan audio yang valid. Coba lagi.');
  }
  // Only replace existing narration after a real audio response has been validated.
  fs.writeFileSync(audioFilePath, audioBuffer);
  const wordTimings: WordTiming[] = estimateWordTimings(scene.voiceoverText, audioDurationSeconds);

  // Audio-First Frame Lock Formula:
  // Math.max(90, Math.ceil((audioDurationSeconds + 0.35) * fps))
  const durationInFrames = Math.max(90, Math.ceil((audioDurationSeconds + 0.35) * fps));
  const revision = createHash('sha256').update(audioBuffer).digest('hex').slice(0, 12);
  const audioUrl = `/api/projects/${options.projectId}/assets/${audioFileName}?v=${revision}`;

  return {
    audioUrl,
    durationInFrames,
    wordTimings,
  };
}

/**
 * Synchronizes entire storyboard scenes with audio-first durations
 */
export async function syncStoryboardWithAudio(
  storyboard: Storyboard,
  projectId: string
): Promise<Storyboard> {
  const syncedScenes = await mapWithConcurrency(storyboard.scenes, PIPELINE_CONCURRENCY, async (scene) => {
    const audioResult = await generateSceneAudio(scene, {
      fps: storyboard.fps,
      projectId,
    });

    return {
      ...scene,
      audioUrl: audioResult.audioUrl,
      durationInFrames: audioResult.durationInFrames,
      wordTimings: audioResult.wordTimings,
    };
  });

  return {
    ...storyboard,
    scenes: syncedScenes,
  };
}
