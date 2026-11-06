# gmotion — SaaS Prompt-to-Motion-Graphics ("v0 for Remotion")

Platform SaaS AI Generator Video Motion Graphic berbasis **Remotion 4.x + Next.js 15 (App Router)**. Pengguna cukup mengetik 1–2 kalimat prompt (misal: *"Buat video iklan FB Ads 15 detik untuk WhatsApp AI Chatbot anti-ghosting"*), sistem secara otomatis menghasilkan video motion graphic vektor berkualitas studio lengkap dengan narasi suara Bahasa Indonesia (TTS), *kinetic typography*, live player di browser, chat revisi per-adegan, dan render MP4 HD.

---

## Arsitektur Hybrid "v0 for Video"

1. **Curated Design System (`@/motion-kit`)**: Komponen motion graphic deterministik performa tinggi:
   - `CameraRig`: Gerakan kamera sinematik (`macro-zoom-in`, `slow-push`, `pan-parallax`, `tilt-3d`, `microDrift`).
   - `KineticHeadline`: Tipografi pembuka bertenaga `spring()` dengan sorotan kata kontras.
   - `PhoneMockup`: Mockup smartphone vektor dengan *dynamic island* & floating notification badges.
   - `WhatsAppChatSim`: Simulator percakapan WhatsApp (indikator mengetik 3 bouncing dots, balasan AI instan, centang dua biru `#38BDF8`, peringatan ghosting).
   - `MetricsDashboard`: `MetricCard` 3D tilt, `AnimatedCounter` (angka rupiah/persentase), dan `TrendLineChart` glowing line SVG.
   - `PulseCTAButton`: Tombol CTA berdenyut dengan panah pengarah penonton.
   - `ParallaxWorld` & `SvgParticles`: Lanskap berlapis 2D story dengan partikel cahaya deterministik.
   - `SyncedCaptions`: Subtitle aman Reels/TikTok yang menyorot kata aktif mengikuti timestamp suara.
2. **Audio-First Frame Locking**: TTS Bahasa Indonesia diproses sebelum durasi dikunci:
   - Rumus: `durationInFrames = Math.max(90, Math.ceil((audioDurationSeconds + 0.35) * fps))`
3. **In-Browser Sucrase Dynamic Compiler (< 15ms)**: Pratinjau langsung di browser via `@remotion/player` tanpa membebani server.
4. **Server-Side Render Engine**: Ekspor MP4 resolusi 1080x1920 @ 30 FPS menggunakan `@remotion/bundler` dan `@remotion/renderer`.

---

## Konfigurasi AI & OpenRouter

Aplikasi mendukung kompatibilitas multi-provider melalui format standar OpenAI (`OPENAI_BASE_URL` & `OPENAI_API_KEY`), sangat cocok digunakan dengan **OpenRouter** maupun API OpenAI resmi.

Buat file `.env.local` dari `.env.example`:

```bash
cp .env.example .env.local
```

Isi variabel di `.env.local`:

```env
# Untuk OpenRouter:
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_API_KEY=sk-or-v1-xxxxxxxxxxxx

# Model Selection
DIRECTOR_MODEL=gpt-4o-mini
CODER_MODEL=gpt-4o

# TTS Provider (Default: msedge-tts GRATIS tanpa API key)
TTS_PROVIDER=msedge-tts
TTS_VOICE_ID=id-ID-ArdiNeural
```

> **Catatan**: Jika API Key belum diisi, sistem otomatis beralih ke *high-fidelity procedural fallback* sehingga alur studio, live player preview, dan ekspor tetap dapat diuji 100% tanpa kendala!

---

## Menjalankan Proyek Lokal

### Di Mesin Windows Anda (`C:\PROJECT\gmotion`):

```bash
# 1. Masuk ke direktori
cd C:\PROJECT\gmotion

# 2. Install dependensi
npm install --legacy-peer-deps

# 3. Jalankan unit test
npm run test

# 4. Jalankan development server
npm run dev
```

Buka browser di `http://localhost:3000`.

---

## Alur Penggunaan Studio

1. **Dashboard Home**: Masukkan prompt 1 kalimat atau klik salah satu dari *1-Click Starter Prompts*, pilih preset (**Ads UI** atau **Story 2D**), pilih rasio (**9:16**, **4:5**, atau **16:9**), lalu klik **Generate Motion Graphic Video**.
2. **Live Studio**:
   - **Kiri**: Chat Co-Director untuk instruksi revisi (misal: *"Ubah aksen warna di scene 3 jadi emas"*), editor naskah suara & headline, dan editor TSX langsung.
   - **Kanan**: Live `@remotion/player` interaktif 30 FPS.
3. **Export MP4**: Klik tombol **Export MP4**, pantau progres rendering frame-by-frame, dan unduh file `.mp4` siap unggah.
