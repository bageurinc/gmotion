import { generateObject } from 'ai';
import {
  Storyboard,
  StoryboardSchema,
  StylePreset,
  AspectRatio,
} from '@/types/studio';
import { getDirectorModel, isApiKeyConfigured } from '@/lib/ai/llm-client';

const DIRECTOR_SYSTEM_PROMPT = `
You are an award-winning Creative Video Director specializing in high-converting short-form motion graphics for Meta Ads (FB/IG Reels), TikTok, and YouTube Shorts.

Your task is to take a simple 1-2 sentence prompt from the user and generate a complete, structured 4-scene Motion Graphic Storyboard.

CRITICAL RULES:
1. NARRATIVE STRUCTURE (4 Scenes):
   - Scene 1 (Hook): Stop the scroll in the first 2-3 seconds with high emotional stakes, problem resonance, or a shocking contrast.
   - Scene 2 (Problem/Mechanism): Clearly visualize the pain point (e.g. lost sales from slow response, ghosting, manual chaos) and introduce the core mechanism.
   - Scene 3 (Proof & Metrics): Concrete proof, numbers, growth metrics, or transformative result (e.g., closing rate +320%, fast 0.5s response).
   - Scene 4 (CTA): High-urgency, clear Call to Action (e.g., "Klik link di bio", "Coba gratis sekarang").

2. LANGUAGE & VOICE:
   - Voiceover MUST be in natural, persuasive Bahasa Indonesia.
   - Conversational, authoritative, yet approachable Indonesian (not stiff translation).
   - Kinetic headline must be brief (3-6 punchy words).

3. VISUAL CHOREOGRAPHY:
   - Provide concrete visual instructions referencing Motion-Kit components:
     * CameraRig (macro-zoom-in, slow-push, pan-parallax, tilt-3d)
     * KineticHeadline with contrast highlight words
     * PhoneMockup with dynamic island and floating badges
     * WhatsAppChatSim with bouncing dots typing & instant AI reply
     * MetricsDashboard (MetricCard, AnimatedCounter, TrendLineChart)
     * PulseCTAButton for scene 4
     * ParallaxWorld & SvgParticles for narrative presets.

4. COLOR PALETTE:
   - Cohesive, high-contrast dark-mode palette suitable for modern tech/SaaS or warm organic storytelling.
`;

export async function generateStoryboard(
  userPrompt: string,
  preset: StylePreset = 'ads-ui',
  aspectRatio: AspectRatio = '9:16'
): Promise<Storyboard> {
  if (isApiKeyConfigured()) {
    try {
      const { object } = await generateObject({
        model: getDirectorModel(),
        schema: StoryboardSchema,
        system: DIRECTOR_SYSTEM_PROMPT,
        prompt: `Buat storyboard video motion graphic untuk:
Prompt: "${userPrompt}"
Style Preset: "${preset}"
Aspect Ratio: "${aspectRatio}"
FPS: 30`,
      });
      return object;
    } catch (error) {
      console.warn('[DirectorAgent] LLM generation failed, falling back to procedural storyboard generator:', error);
      return generateProceduralStoryboard(userPrompt, preset, aspectRatio);
    }
  }

  // Fallback procedural storyboard if no API key is configured
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
