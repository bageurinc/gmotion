import { generateText } from 'ai';
import {
  Storyboard,
  SceneSpec,
  StylePreset,
  AspectRatio,
  TimelapseKind,
} from '@/types/studio';
import { getDirectorModel, isApiKeyConfigured } from '@/lib/ai/llm-client';
import { COPY_ANTI_SLOP_RULES, normalizePalette, VISUAL_ANTI_SLOP_RULES } from './anti-slop';
import { MAX_DRAFT_SCENES } from './draft';

const DIRECTOR_SYSTEM_PROMPT = `
You are a Creative Video Director and subject-matter researcher for short-form motion graphics, educational content, storytelling, and advertisements. Match the user's purpose; do not turn ordinary content into a sales pitch.

Your task is to turn a simple prompt into a complete Motion Graphic Storyboard whose structure comes from the topic itself.

CRITICAL RULES:
1. STRUCTURE FOLLOWS THE TOPIC:
   - Choose between 3 and 12 scenes. Use as many as the subject needs to be truly understood.
   - For a process, how-to, or explanation: give every real stage its own scene, in the correct real-world order. Do not skip or merge important stages.
   - For a story or history: follow its real sequence of events.
   - For an advertisement or promotion: use the structure that sells best, and end with a CTA.
   - If the user lists scenes or stages, keep that exact list and order.
   - If the user states a target duration, fit the scene count and narration length to it.
   - Never use a fixed template such as hook, mechanism, proof, CTA.
   - Each scene title names its actual content using correct domain terms, such as "Survei & Uji Tanah" or "Pengecoran Pondasi". Generic titles such as Hook, Mechanism, Proof, Result, or Resolution are forbidden.
   - Each scene teaches something specific that the previous scene did not. State real terms, components, and steps. Do not invent statistics.
   - Scene 1 opens with something that makes people keep watching, while already belonging to the topic.
   - Use role "narrative" for every scene. Use role "cta" only for a final CTA scene, and only if the user explicitly requests one or asks for an advertisement or promotion.

2. LANGUAGE & VOICE:
   - Voiceover MUST be in natural Bahasa Indonesia, 1-3 sentences per scene.
   - Conversational, authoritative, yet approachable Indonesian.
   - Kinetic headline must be brief (3-6 punchy words).
   - visualPrompt MUST be in plain Bahasa Indonesia that a non-technical user can review and edit. In 1-2 sentences, describe the concrete objects on screen and what moves. Prefer explanatory visuals such as cross-sections, cutaways, zoom-ins, and step-by-step assembly over abstract shapes.

${VISUAL_ANTI_SLOP_RULES}
${COPY_ANTI_SLOP_RULES}

3. FORMAT REQUIREMENT:
   Output ONLY valid JSON matching this schema:
   {
     "title": "Judul Video",
     "preset": "ads-ui" or "story-2d",
     "aspectRatio": "9:16",
     "fps": 30,
     "bgmTrack": "dark-tech-pulse",
     "look": "dark or bright, whichever suits this topic",
     "palette": {
       "background": "<hex drawn from this subject>",
       "surface": "<hex>",
       "primary": "<hex>",
       "secondary": "<hex>",
       "alert": "<hex>",
       "text": "<hex readable on background>"
     },
     "scenes": [
       {
         "id": "scene-1-hook",
         "order": 1,
         "role": "hook",
         "title": "Scene 1: Hook Title",
         "voiceoverText": "Naskah narasi suara lengkap bahasa indonesia",
         "kineticHeadline": "TEKS HEADLINE BOLD",
         "visualPrompt": "Deskripsi visual yang mudah dipahami",
         "cameraAction": "macro-zoom-in (or slow-push, pan-parallax, tilt-3d, static, timelapse)",
         "sfxCue": "pop",
         "timelapse": { "kind": "day-night", "fromLabel": "06:00", "toLabel": "20:00" }
       }
     ]
   }

4. TIMELAPSE SUPPORT:
   - For scenes depicting the passage of time (e.g. sunrise to sunset, 24-hour cycle, plant growth, process progression), set cameraAction to "timelapse".
   - Optionally specify "timelapse": { "kind": "day-night" | "clock" | "growth" | "crowd" | "weather", "fromLabel": "06:00", "toLabel": "20:00" }.
`;

/**
 * Robust parser that can parse both JSON objects and structured Markdown responses
 * from LLMs (such as Gemini or DeepSeek that might format output as markdown headings).
 */
function parseStoryboardRaw(
  text: string,
  userPrompt: string,
  preset: StylePreset,
  aspectRatio: AspectRatio
): Storyboard | null {
  // 1. Try finding a JSON object block
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj.scenes && Array.isArray(obj.scenes) && obj.scenes.length >= 2) {
        const scenes = obj.scenes.slice(0, MAX_DRAFT_SCENES);
        return {
          title: obj.title || userPrompt.slice(0, 40),
          preset: (obj.preset as StylePreset) || preset,
          aspectRatio: (obj.aspectRatio as AspectRatio) || aspectRatio,
          fps: obj.fps || 30,
          bgmTrack: obj.bgmTrack || (preset === 'ads-ui' ? 'dark-tech-pulse' : 'warm-acoustic'),
          palette: normalizePalette({
            background: String(obj.palette?.background ?? ''),
            surface: String(obj.palette?.surface ?? ''),
            primary: String(obj.palette?.primary ?? ''),
            secondary: String(obj.palette?.secondary ?? ''),
            alert: String(obj.palette?.alert ?? ''),
            text: String(obj.palette?.text ?? ''),
          }, obj.look === 'dark' ? 'dark' : 'bright'),
          scenes: scenes.map((s: Record<string, unknown>, idx: number) => {
            const role = typeof s.role === 'string' && ['hook', 'problem', 'mechanism', 'proof', 'cta', 'narrative'].includes(s.role)
              ? (s.role as SceneSpec['role'])
              : 'narrative';

            return {
              id: typeof s.id === 'string' ? s.id : `scene-${idx + 1}-${role}`,
              order: typeof s.order === 'number' ? s.order : idx + 1,
              role,
              title: typeof s.title === 'string' ? s.title : `Scene ${idx + 1}`,
              voiceoverText: typeof s.voiceoverText === 'string' ? s.voiceoverText : `Narasi adegan ${idx + 1}`,
              kineticHeadline: typeof s.kineticHeadline === 'string' ? s.kineticHeadline : `HEADLINE ${idx + 1}`,
              visualPrompt: typeof s.visualPrompt === 'string' ? s.visualPrompt : '',
              cameraAction: (typeof s.cameraAction === 'string' && ['macro-zoom-in', 'slow-push', 'pan-parallax', 'tilt-3d', 'static', 'timelapse'].includes(s.cameraAction)
                ? s.cameraAction
                : 'macro-zoom-in') as SceneSpec['cameraAction'],
              sfxCue: (typeof s.sfxCue === 'string' && ['none', 'pop', 'whoosh', 'notification', 'cash-register', 'success'].includes(s.sfxCue)
                ? s.sfxCue
                : 'pop') as SceneSpec['sfxCue'],
              timelapse: s.timelapse && typeof s.timelapse === 'object' ? {
                kind: ['day-night', 'clock', 'growth', 'crowd', 'weather'].includes(String((s.timelapse as Record<string, unknown>).kind))
                  ? ((s.timelapse as Record<string, unknown>).kind as TimelapseKind)
                  : 'day-night',
                fromLabel: typeof (s.timelapse as Record<string, unknown>).fromLabel === 'string'
                  ? String((s.timelapse as Record<string, unknown>).fromLabel)
                  : undefined,
                toLabel: typeof (s.timelapse as Record<string, unknown>).toLabel === 'string'
                  ? String((s.timelapse as Record<string, unknown>).toLabel)
                  : undefined,
                easing: (s.timelapse as Record<string, unknown>).easing === 'linear' ? 'linear' as const : 'ease-in-out' as const,
              } : undefined,
              fixedDurationSec: typeof s.fixedDurationSec === 'number' ? s.fixedDurationSec : undefined,
              durationInFrames: typeof s.durationInFrames === 'number' ? s.durationInFrames : 120,
              wordTimings: Array.isArray(s.wordTimings) ? s.wordTimings : [],
            };
          }),
        };
      }
    } catch {
      // Ignore JSON parse failure and proceed to markdown parsing
    }
  }

  // 2. Parse Markdown structured output (e.g. SCENE 1: HOOK ... KineticHeadline: ... Voiceover: ...)
  const sceneBlocks = text.split(/SCENE\s*\d+:/i).slice(1, MAX_DRAFT_SCENES + 1);
  if (sceneBlocks.length >= 2) {
    const roles: Array<SceneSpec['role']> = ['hook', 'mechanism', 'proof', 'cta'];
    const validCamActions: Array<SceneSpec['cameraAction']> = [
      'macro-zoom-in',
      'slow-push',
      'pan-parallax',
      'tilt-3d',
      'static',
      'timelapse',
    ];

    const scenes: SceneSpec[] = [];
    sceneBlocks.forEach((block, idx) => {
      const headlineMatch =
        block.match(/KineticHeadline:\s*["']([^"']+)["']/i) ||
        block.match(/KineticHeadline:\s*([^\n]+)/i);
      const voMatch =
        block.match(/Voiceover:\s*["']([^"']+)["']/i) ||
        block.match(/Voiceover:\s*([^\n]+)/i);
      const camMatch = block.match(/CameraRig:\s*`?([a-zA-Z0-9-]+)`?/i);

      const headline = headlineMatch
        ? headlineMatch[1].replace(/["']/g, '').trim()
        : `Scene ${idx + 1}`;
      const voiceover = voMatch
        ? voMatch[1].replace(/["']/g, '').trim()
        : `Narasi untuk adegan ${idx + 1}`;
      const camRaw = camMatch ? camMatch[1] : '';
      const cam: SceneSpec['cameraAction'] = validCamActions.includes(camRaw as SceneSpec['cameraAction'])
        ? (camRaw as SceneSpec['cameraAction'])
        : idx === 0
        ? 'macro-zoom-in'
        : 'slow-push';

      const isTimelapseBlock = cam === 'timelapse' || /timelapse|timelap|time-lapse/i.test(block);

      scenes.push({
        id: `scene-${idx + 1}-${roles[idx] || 'narrative'}`,
        order: idx + 1,
        role: roles[idx] || 'narrative',
        title: headline.slice(0, 32),
        voiceoverText: voiceover,
        kineticHeadline: headline,
        visualPrompt: block.trim().slice(0, 300),
        cameraAction: cam,
        timelapse: isTimelapseBlock ? {
          kind: 'day-night',
          fromLabel: '06:00',
          toLabel: '20:00',
          easing: 'ease-in-out',
        } : undefined,
        sfxCue: idx === 0 ? 'pop' : idx === 3 ? 'success' : 'whoosh',
        durationInFrames: 120,
        wordTimings: [],
      });
    });

    return {
      title: userPrompt.slice(0, 40),
      preset,
      aspectRatio,
      fps: 30,
      bgmTrack: preset === 'ads-ui' ? 'dark-tech-pulse' : 'warm-acoustic',
      palette: {
        background: '#1A1D20',
        surface: '#24282D',
        primary: '#F59E0B',
        secondary: '#10B981',
        alert: '#EF4444',
        text: '#F9FAFB',
      },
      scenes,
    };
  }

  return null;
}

export function wantsCallToAction(prompt: string): boolean {
  if (/(?:tanpa|jangan|tidak perlu|tidak usah|no|without|bukan).{0,30}\b(?:cta|call.to.action|promosi|iklan|promotion)\b/i.test(prompt)) return false;
  return /\b(?:cta|call.to.action|iklan|promosi|advertisement|advertising|ads|marketing|jualkan|jualan)\b/i.test(prompt);
}

function applyCtaPolicy(storyboard: Storyboard, prompt: string): Storyboard {
  if (wantsCallToAction(prompt)) return storyboard;
  return { ...storyboard, scenes: storyboard.scenes.map(scene => scene.role !== 'cta' ? scene : {
    ...scene, role: 'narrative', title: 'Penutup Cerita',
    kineticHeadline: 'PELAJARAN DARI PERJALANAN INI',
    voiceoverText: 'Setiap langkah kecil membawa perubahan. Perjalanan ini mengingatkan kita untuk terus belajar dan bertumbuh.',
    visualPrompt: 'Visual penutup yang merangkum perjalanan dan pesan moral. Tanpa CTA, tombol, tautan, penawaran, atau promosi.',
  }) };
}

export function parseStoryboardFromLLMResponse(text: string, userPrompt: string, preset: StylePreset, aspectRatio: AspectRatio): Storyboard | null {
  const storyboard = parseStoryboardRaw(text, userPrompt, preset, aspectRatio);
  return storyboard ? applyCtaPolicy(storyboard, userPrompt) : null;
}

export async function generateStoryboard(
  userPrompt: string,
  preset: StylePreset = 'ads-ui',
  aspectRatio: AspectRatio = '9:16',
  options: { strict?: boolean } = {}
): Promise<Storyboard> {
  if (isApiKeyConfigured()) {
    try {
      const response = await generateText({
        model: getDirectorModel(),
        system: DIRECTOR_SYSTEM_PROMPT,
        prompt: `Buat storyboard video motion graphic untuk:
Prompt: "${userPrompt}"
Style Preset: "${preset}"
Aspect Ratio: "${aspectRatio}"
CTA allowed: ${wantsCallToAction(userPrompt)}. If false, finish with a narrative conclusion and do not include commercial copy or a CTA scene.
FPS: 30`,
      });

      const parsed = parseStoryboardFromLLMResponse(
        response.text,
        userPrompt,
        preset,
        aspectRatio
      );

      if (parsed) {
        return parsed;
      }
      if (options.strict) throw new Error('AI belum berhasil menyusun draf. Coba lagi.');
      console.warn('[DirectorAgent] Could not parse LLM output, falling back to procedural storyboard generator.');
    } catch (error) {
      if (options.strict) throw error;
      console.warn('[DirectorAgent] LLM generation failed, falling back to procedural storyboard generator:', error);
    }
  }

  // Fallback procedural storyboard if no API key or parse error
  return generateProceduralStoryboard(userPrompt, preset, aspectRatio);
}

/**
 * High-quality procedural fallback storyboard generator
 */
export function generateProceduralStoryboard(
  userPrompt: string,
  preset: StylePreset,
  aspectRatio: AspectRatio
): Storyboard {
  return applyCtaPolicy(generateProceduralStoryboardBase(userPrompt, preset, aspectRatio), userPrompt);
}

function generateProceduralStoryboardBase(
  userPrompt: string,
  preset: StylePreset,
  aspectRatio: AspectRatio
): Storyboard {
  const isConstruction = /gedung|bangun|konstruksi|lantai|tower|arsitektur|building|skyscraper/i.test(userPrompt);
  const isPlant = /tanaman|pohon|bunga|tumbuh|benih|plant|tree|flower|nature|sprout/i.test(userPrompt);
  const isDayNight = /siang ke malam|fajar|senja|sunset|sunrise|langit|matahari|bintang/i.test(userPrompt);
  const isTimelapse = /timelapse|timelap|time-lapse/i.test(userPrompt) || isDayNight;

  if (isTimelapse && isConstruction) {
    return {
      title: 'Timelapse Pembangunan Gedung Bertingkat',
      preset: preset === 'ads-ui' ? 'ads-ui' : 'story-2d',
      aspectRatio,
      fps: 30,
      bgmTrack: 'dark-tech-pulse',
      palette: {
        background: '#0F172A',
        surface: '#1E293B',
        primary: '#38BDF8',
        secondary: '#0284C7',
        alert: '#EF4444',
        text: '#F8FAFC',
      },
      scenes: [
        {
          id: 'scene-1-hook',
          order: 1,
          role: 'hook',
          title: 'Fondasi Awal Proyek',
          voiceoverText: 'Setiap karya arsitektur megah berawal dari pondasi kokoh yang ditanam jauh ke dalam bumi.',
          kineticHeadline: 'Fondasi Kokoh Mahakarya Megah',
          visualPrompt: 'Area proyek konstruksi dengan crane dan pondasi beton yang kokoh siap dibangun.',
          cameraAction: 'slow-push',
          sfxCue: 'whoosh',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-2-mechanism',
          order: 2,
          role: 'mechanism',
          title: 'Konstruksi Bertingkat Cepat',
          voiceoverText: 'Lantai demi lantai berdiri dengan presisi tinggi, membentuk siluet masa depan kota.',
          kineticHeadline: 'Pembangunan Lantai Demi Lantai',
          visualPrompt: 'Timelapse konstruksi gedung bertingkat menggunakan StagedReveal lantai naik, crane bergerak dengan PathMover, dan TimeHUD bar.',
          cameraAction: 'timelapse',
          timelapse: {
            kind: 'growth',
            fromLabel: 'Lantai 1',
            toLabel: 'Lantai 24',
            easing: 'ease-in-out',
          },
          sfxCue: 'pop',
          durationInFrames: 140,
          wordTimings: [],
        },
        {
          id: 'scene-3-proof',
          order: 3,
          role: 'proof',
          title: 'Struktur Pencakar Langit',
          voiceoverText: 'Menghadirkan efisiensi ruang dan estetika modern yang tahan uji lintas generasi.',
          kineticHeadline: 'Pencakar Langit Berdiri Kokoh',
          visualPrompt: 'Gedung modern berdiri megah dengan pantulan cahaya kaca biru dan penerangan arsitektural.',
          cameraAction: 'slow-push',
          sfxCue: 'notification',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-4-cta',
          order: 4,
          role: 'cta',
          title: 'Masa Depan Konstruksi',
          voiceoverText: 'Wujudkan pembangunan berkelas dengan standar rekayasa konstruksi terbaik hari ini.',
          kineticHeadline: 'Membangun Masa Depan Bersama',
          visualPrompt: 'Tampilan penutup sinematik dengan skyline gedung yang telah rampung dan badge penyelesaian.',
          cameraAction: 'slow-push',
          sfxCue: 'success',
          durationInFrames: 120,
          wordTimings: [],
        },
      ],
    };
  }

  if (isTimelapse && isPlant) {
    return {
      title: 'Timelapse Pertumbuhan Tanaman',
      preset: preset === 'ads-ui' ? 'ads-ui' : 'story-2d',
      aspectRatio,
      fps: 30,
      bgmTrack: 'warm-acoustic',
      palette: {
        background: '#022C22',
        surface: '#064E3B',
        primary: '#10B981',
        secondary: '#34D399',
        alert: '#F59E0B',
        text: '#ECFDF5',
      },
      scenes: [
        {
          id: 'scene-1-hook',
          order: 1,
          role: 'hook',
          title: 'Awal Sebuah Kehidupan',
          voiceoverText: 'Dari sebutir benih kecil di dalam tanah yang subur, keajaiban alam dimulai.',
          kineticHeadline: 'Keajaiban Benih Kecil',
          visualPrompt: 'Benih tertanam di dalam tanah hangat, siap untuk bertunas.',
          cameraAction: 'slow-push',
          sfxCue: 'whoosh',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-2-mechanism',
          order: 2,
          role: 'mechanism',
          title: 'Pertumbuhan Menuju Cahaya',
          voiceoverText: 'Tunas bertumbuh menembus bumi, daun bermekaran menyerap kehangatan mentari.',
          kineticHeadline: 'Tumbuh Subur Menuju Cahaya',
          visualPrompt: 'Timelapse tanaman menggunakan GrowAxis batang tumbuh, daun bermekaran via StagedReveal, dan TimeHUD progres.',
          cameraAction: 'timelapse',
          timelapse: {
            kind: 'growth',
            fromLabel: 'Hari 1',
            toLabel: 'Hari 30',
            easing: 'ease-in-out',
          },
          sfxCue: 'pop',
          durationInFrames: 135,
          wordTimings: [],
        },
        {
          id: 'scene-3-proof',
          order: 3,
          role: 'proof',
          title: 'Bunga Bermekaran Sempurna',
          voiceoverText: 'Kuncup bunga membuka kelopaknya perlahan, memancarkan pesona keindahan alami.',
          kineticHeadline: 'Bunga Mekar Sempurna',
          visualPrompt: 'Bunga mekar penuh dengan kelopak berwarna cerah dan dedaunan rimbun.',
          cameraAction: 'macro-zoom-in',
          sfxCue: 'notification',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-4-cta',
          order: 4,
          role: 'cta',
          title: 'Harmoni Bersama Alam',
          voiceoverText: 'Rawat setiap pertumbuhan dengan sabar, karena proses terbaik butuh waktu.',
          kineticHeadline: 'Tumbuh Indah Bersama Waktu',
          visualPrompt: 'Pemandangan alam asri yang damai dengan tanaman hijau yang tumbuh subur.',
          cameraAction: 'slow-push',
          sfxCue: 'success',
          durationInFrames: 120,
          wordTimings: [],
        },
      ],
    };
  }

  if (isTimelapse) {
    return {
      title: 'Timelapse Perjalanan Dari Fajar Hingga Malam',
      preset: preset === 'ads-ui' ? 'ads-ui' : 'story-2d',
      aspectRatio,
      fps: 30,
      bgmTrack: preset === 'ads-ui' ? 'dark-tech-pulse' : 'cinematic-story',
      palette: {
        background: '#090D16',
        surface: '#1E293B',
        primary: '#F59E0B',
        secondary: '#38BDF8',
        alert: '#EF4444',
        text: '#F8FAFC',
      },
      scenes: [
        {
          id: 'scene-1-hook',
          order: 1,
          role: 'hook',
          title: 'Fajar Menyingsing',
          voiceoverText: 'Ketika sang fajar menyingsing, dunia mulai bergerak menyambut hari yang baru.',
          kineticHeadline: 'Fajar Menyingsing Penuh Harapan',
          visualPrompt: 'DayNightSky dengan semburat fajar jingga keemasan dan matahari mulai terbit di cakrawala.',
          cameraAction: 'slow-push',
          sfxCue: 'whoosh',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-2-mechanism',
          order: 2,
          role: 'mechanism',
          title: 'Timelapse Putaran Waktu',
          voiceoverText: 'Waktu bergulir begitu cepat, dari terik siang hingga senja keemasan menghiasi langit.',
          kineticHeadline: 'Siklus Waktu Terus Berputar',
          visualPrompt: 'Timelapse siang ke malam menggunakan DayNightSky dan TimelapseClock berputar dari 06:00 hingga 20:00.',
          cameraAction: 'timelapse',
          timelapse: {
            kind: 'day-night',
            fromLabel: '06:00',
            toLabel: '20:00',
            easing: 'ease-in-out',
          },
          sfxCue: 'pop',
          durationInFrames: 135,
          wordTimings: [],
        },
        {
          id: 'scene-3-proof',
          order: 3,
          role: 'proof',
          title: 'Malam Berbintang',
          voiceoverText: 'Dan malam pun tiba, membawa ribuan bintang berkilau dan kedamaian tanpa batas.',
          kineticHeadline: 'Malam Berbintang Penuh Makna',
          visualPrompt: 'Langit malam dengan bulan purnama, gugusan bintang bersinar dan siluet gedung megah.',
          cameraAction: 'slow-push',
          sfxCue: 'notification',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-4-cta',
          order: 4,
          role: 'cta',
          title: 'Renungan Waktu',
          voiceoverText: 'Setiap detik adalah cerita berharga dalam perjalanan hidup kita.',
          kineticHeadline: 'Hargai Setiap Detik Waktu',
          visualPrompt: 'Penutup estetik dengan siluet pemandangan dan refleksi inspiratif tentang waktu.',
          cameraAction: 'slow-push',
          sfxCue: 'success',
          durationInFrames: 120,
          wordTimings: [],
        },
      ],
    };
  }

  const isAds = preset === 'ads-ui';

  if (isAds) {
    return {
      title: 'WhatsApp AI Anti-Ghosting Fast Closing Ads',
      preset: 'ads-ui',
      aspectRatio,
      fps: 30,
      bgmTrack: 'dark-tech-pulse',
      palette: {
        background: '#090D16',
        surface: '#1E293B',
        primary: '#10B981', // WhatsApp emerald
        secondary: '#38BDF8', // Cyan glow
        alert: '#EF4444', // Red alert for ghosting
        text: '#F8FAFC',
      },
      scenes: [
        {
          id: 'scene-1-hook',
          order: 1,
          role: 'hook',
          title: 'Stop Ghosting Calon Pembeli',
          voiceoverText:
            'Capek iklan mahal-mahal tapi calon pembeli malah ghosting gara-gara telat dibalas?',
          kineticHeadline: 'Iklan Jalan Tapi Chat di-Ghosting?',
          visualPrompt:
            'Tampilkan PhoneMockup bergetar dengan WhatsAppChatSim. Muncul pesan calon pembeli lalu notifikasi merah bertuliskan GHOSTED 4 JAM TANPA BALASAN.',
          cameraAction: 'macro-zoom-in',
          sfxCue: 'pop',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-2-mechanism',
          order: 2,
          role: 'mechanism',
          title: 'Otomatisasi Respon AI 0.5 Detik',
          voiceoverText:
            'Gunakan WhatsApp AI Chatbot anti-ghosting. Balas ratusan chat serentak dalam 0,5 detik.',
          kineticHeadline: 'Balas Kilat 0.5 Detik Otomatis',
          visualPrompt:
            'Layar smartphone menampilkan percakapan interaktif WhatsApp. Saat pembeli bertanya, bot AI langsung membalas rekomendasi produk lengkap dan centang biru aktif.',
          cameraAction: 'tilt-3d',
          sfxCue: 'whoosh',
          durationInFrames: 135,
          wordTimings: [],
        },
        {
          id: 'scene-3-proof',
          order: 3,
          role: 'proof',
          title: 'Closing Rate Meroket',
          voiceoverText:
            'Hasilnya? Closing sales naik hingga 320% tanpa perlu lembur jaga WhatsApp!',
          kineticHeadline: 'Omzet Naik 320% Tanpa Lembur',
          visualPrompt:
            'MetricsDashboard futuristik: MetricCard menampilkan Closing Rate +320%, AnimatedCounter menghitung omzet hingga Rp 120.000.000, didukung TrendLineChart kurva hijau naik tajam.',
          cameraAction: 'slow-push',
          sfxCue: 'cash-register',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-4-cta',
          order: 4,
          role: 'cta',
          title: 'Coba Gratis Sekarang',
          voiceoverText:
            'Yuk klik link di bawah sekarang juga dan klaim uji coba gratis 14 hari!',
          kineticHeadline: 'Coba Gratis Sekarang!',
          visualPrompt:
            'Tampilan penutup bold dengan PulseCTAButton berdenyut hijau neon, ikon panah klik mengarah ke bio dan badge jaminan garansi.',
          cameraAction: 'slow-push',
          sfxCue: 'success',
          durationInFrames: 120,
          wordTimings: [],
        },
      ],
    };
  }

  // 2D Illustrated Story Preset
  return {
    title: 'Perjalanan Biji Kopi Premium',
    preset: 'story-2d',
    aspectRatio,
    fps: 30,
    bgmTrack: 'warm-acoustic',
    palette: {
      background: '#1A1412',
      surface: '#2D221E',
      primary: '#D97706', // Warm amber coffee
      secondary: '#10B981', // Plantation green
      alert: '#F59E0B',
      text: '#FEF3C7',
    },
    scenes: [
      {
        id: 'scene-1-hook',
        order: 1,
        role: 'hook',
        title: 'Pucuk Daun Pagi Hari',
        voiceoverText:
          'Setiap cangkir kopi nikmat berawal dari kebun pegunungan yang diselimuti kabut pagi.',
        kineticHeadline: 'Aroma Alam Dari Kebun Pegunungan',
        visualPrompt:
          'ParallaxWorld memperlihatkan matahari terbit keemasan di balik perbukitan hijau dengan SvgParticles embun pagi yang melayang damai.',
        cameraAction: 'slow-push',
        sfxCue: 'whoosh',
        durationInFrames: 135,
        wordTimings: [],
      },
      {
        id: 'scene-2-mechanism',
        order: 2,
        role: 'mechanism',
        title: 'Petik Merah & Sangrai Sempurna',
        voiceoverText:
          'Hanya buah ceri merah terpilih yang dipetik manual lalu disangrai dengan presisi tinggi.',
        kineticHeadline: 'Dipetik Manual & Sangrai Presisi',
        visualPrompt:
          'Ilustrasi vektor biji kopi berputar di atas tungku pemanggang dengan uap aroma wangi dan percikan cahaya hangat.',
        cameraAction: 'macro-zoom-in',
        sfxCue: 'pop',
        durationInFrames: 130,
        wordTimings: [],
      },
      {
        id: 'scene-3-proof',
        order: 3,
        role: 'proof',
        title: 'Ekstraksi Cita Rasa Sempurna',
        voiceoverText:
          'Menghasilkan crema tebal dengan profil rasa manis karamel dan keasaman buah yang seimbang.',
        kineticHeadline: 'Karakter Rasa Khas Nusantara',
        visualPrompt:
          'Close-up cangkir kopi elegan dengan tetesan espresso kental dan uap mengepul yang mengalir membentuk siluet kepuasan.',
        cameraAction: 'slow-push',
        sfxCue: 'pop',
        durationInFrames: 130,
        wordTimings: [],
      },
      {
        id: 'scene-4-cta',
        order: 4,
        role: 'cta',
        title: 'Nikmati Hari Ini',
        voiceoverText:
          'Rasakan keajaiban cita rasa kopi nusantara asli langsung di rumah Anda hari ini.',
        kineticHeadline: 'Seduh Kopi Terbaikmu Hari Ini',
        visualPrompt:
          'Tampilan penutup estetik dengan logo kemasan kopi, PulseCTAButton bernuansa cokelat hangat dan tautan pesan sekarang.',
        cameraAction: 'slow-push',
        sfxCue: 'success',
        durationInFrames: 120,
        wordTimings: [],
      },
    ],
  };
}
