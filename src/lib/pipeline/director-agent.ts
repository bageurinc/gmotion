import { generateText } from 'ai';
import {
  Storyboard,
  SceneSpec,
  StylePreset,
  AspectRatio,
} from '@/types/studio';
import { getDirectorModel, isApiKeyConfigured } from '@/lib/ai/llm-client';

const DIRECTOR_SYSTEM_PROMPT = `
You are a Creative Video Director for short-form motion graphics, educational content, storytelling, and advertisements. Match the user's purpose; do not turn ordinary content into a sales pitch.

Your task is to take a simple prompt from the user and generate a complete, structured 4-scene Motion Graphic Storyboard.

CRITICAL RULES:
1. NARRATIVE STRUCTURE (4 Scenes):
   - Scene 1 (Hook): Stop the scroll in the first 2-3 seconds with high emotional stakes, problem resonance, or a shocking contrast.
   - Scene 2 (Problem/Mechanism): Clearly visualize the pain point and introduce the core mechanism.
   - Scene 3 (Result): Show the story outcome, insight, or transformation. Only use metrics when relevant and supplied; do not invent numerical claims for a story.
   - Scene 4 (Resolution): End with the story outcome, takeaway, or moral. Use a CTA ONLY if the user explicitly requests one or asks for an advertisement/promotion. Content, educational, and storytelling videos must not invent buttons, links, free trials, offers, or sales copy.

2. LANGUAGE & VOICE:
   - Voiceover MUST be in natural, persuasive Bahasa Indonesia.
   - Conversational, authoritative, yet approachable Indonesian.
   - Kinetic headline must be brief (3-6 punchy words).

3. FORMAT REQUIREMENT:
   Output ONLY valid JSON matching this schema:
   {
     "title": "Judul Video",
     "preset": "ads-ui" or "story-2d",
     "aspectRatio": "9:16",
     "fps": 30,
     "bgmTrack": "dark-tech-pulse",
     "palette": {
       "background": "#090D16",
       "surface": "#1E293B",
       "primary": "#10B981",
       "secondary": "#38BDF8",
       "alert": "#EF4444",
       "text": "#F8FAFC"
     },
     "scenes": [
       {
         "id": "scene-1-hook",
         "order": 1,
         "role": "hook",
         "title": "Scene 1: Hook Title",
         "voiceoverText": "Naskah narasi suara lengkap bahasa indonesia",
         "kineticHeadline": "TEKS HEADLINE BOLD",
         "visualPrompt": "Instruksi visual animasi",
         "cameraAction": "macro-zoom-in",
         "sfxCue": "pop"
       }
     ]
   }
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
        return {
          title: obj.title || userPrompt.slice(0, 40),
          preset: (obj.preset as StylePreset) || preset,
          aspectRatio: (obj.aspectRatio as AspectRatio) || aspectRatio,
          fps: obj.fps || 30,
          bgmTrack: obj.bgmTrack || (preset === 'ads-ui' ? 'dark-tech-pulse' : 'warm-acoustic'),
          palette: {
            background: obj.palette?.background || '#090D16',
            surface: obj.palette?.surface || '#1E293B',
            primary: obj.palette?.primary || '#10B981',
            secondary: obj.palette?.secondary || '#38BDF8',
            alert: obj.palette?.alert || '#EF4444',
            text: obj.palette?.text || '#F8FAFC',
          },
          scenes: obj.scenes.map((s: Record<string, unknown>, idx: number) => {
            const role = typeof s.role === 'string' && ['hook', 'problem', 'mechanism', 'proof', 'cta', 'narrative'].includes(s.role)
              ? (s.role as SceneSpec['role'])
              : (['hook', 'mechanism', 'proof', 'cta'][idx] as SceneSpec['role']) || 'hook';

            return {
              id: typeof s.id === 'string' ? s.id : `scene-${idx + 1}-${role}`,
              order: typeof s.order === 'number' ? s.order : idx + 1,
              role,
              title: typeof s.title === 'string' ? s.title : `Scene ${idx + 1}`,
              voiceoverText: typeof s.voiceoverText === 'string' ? s.voiceoverText : `Narasi adegan ${idx + 1}`,
              kineticHeadline: typeof s.kineticHeadline === 'string' ? s.kineticHeadline : `HEADLINE ${idx + 1}`,
              visualPrompt: typeof s.visualPrompt === 'string' ? s.visualPrompt : '',
              cameraAction: (typeof s.cameraAction === 'string' && ['macro-zoom-in', 'slow-push', 'pan-parallax', 'tilt-3d', 'static'].includes(s.cameraAction)
                ? s.cameraAction
                : 'macro-zoom-in') as SceneSpec['cameraAction'],
              sfxCue: (typeof s.sfxCue === 'string' && ['none', 'pop', 'whoosh', 'notification', 'cash-register', 'success'].includes(s.sfxCue)
                ? s.sfxCue
                : 'pop') as SceneSpec['sfxCue'],
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
  const sceneBlocks = text.split(/SCENE\s*\d+:/i).slice(1);
  if (sceneBlocks.length >= 2) {
    const roles: Array<SceneSpec['role']> = ['hook', 'mechanism', 'proof', 'cta'];
    const validCamActions: Array<SceneSpec['cameraAction']> = [
      'macro-zoom-in',
      'slow-push',
      'pan-parallax',
      'tilt-3d',
      'static',
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

      scenes.push({
        id: `scene-${idx + 1}-${roles[idx] || 'narrative'}`,
        order: idx + 1,
        role: roles[idx] || 'narrative',
        title: headline.slice(0, 32),
        voiceoverText: voiceover,
        kineticHeadline: headline,
        visualPrompt: block.trim().slice(0, 300),
        cameraAction: cam,
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
  aspectRatio: AspectRatio = '9:16'
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
      console.warn('[DirectorAgent] Could not parse LLM output, falling back to procedural storyboard generator.');
    } catch (error) {
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
