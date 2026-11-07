# Knowledge gmotion

Catatan keputusan, alasan, dan temuan yang tidak terlihat dari kode. Terakhir diperbarui 7 November 2026.

Status fitur ada di [plan_fitur.md](../plan_fitur.md), sedangkan aturan kerja ada di [CLAUDE.md](../CLAUDE.md).

## Visi

User mengetik 1–2 kalimat tentang topik apa pun, lalu mendapat video berkualitas studio. Yang dibangun adalah sistem umum. Jangan membuat komponen manual untuk satu topik, karena jantung dan HP dicas hanya contoh uji.

Standar kualitas diambil dari dua referensi:
- **Reel jantung @motionformat, 52,6 detik.** Satu aset dipakai sekitar 85% durasi dengan beberapa keadaan.
- **Reel "aman nggak sih HP dicas semalaman", 44,5 detik.** Satu dunia isometrik, kamera menyambung, panel data tetap, stiker kata, subtitle kapsul.

Keduanya hanya acuan format. Jangan menyalin aset, logo, atau identitas kreatornya.

## Alur produksi saat ini

1. `POST /api/projects` hanya membuat draf lewat director, tanpa TTS dan tanpa kode.
2. User mereview draf: judul, narasi, teks, arahan visual, urutan, dan suara. Perubahan tersimpan otomatis.
3. `POST /api/projects/[id]/generate` menjawab 202, lalu editor langsung terbuka.
4. Job per adegan berjalan paralel maksimal 4 di [generation-job.ts](../src/lib/pipeline/generation-job.ts): audio lalu ilustrasi.
5. Editor menerima progres lewat SSE di `/api/projects/[id]/events`, dan adegan yang selesai langsung masuk pratinjau.
6. Setelah semua selesai, adegan dinilai dan yang lemah digambar ulang, lalu dicek crash.
7. Export memakai renderer yang sama dengan pengecekan crash.

Adegan bertanda `cta` tetap memakai coder lama karena butuh tombol CTA sungguhan. Adegan yang gagal diilustrasikan ditandai `simplified`, dan tampil sebagai "Versi sederhana".

## Keputusan penting

| Keputusan | Alasan |
|---|---|
| Struktur adegan mengikuti topik, 3–12 adegan | Pola hook, mechanism, proof, CTA ditolak user karena terlalu kaku |
| Draf direview sebelum generate | Mengoreksi naskah di awal jauh lebih murah |
| Editor terbuka langsung dan adegan muncul bertahap | User harus tahu proses sudah sampai mana |
| Satu ilustrasi per adegan, bukan satu aset per video | Topik proses punya tahap yang objeknya berbeda |
| Gemini sebagai model utama | Claude terlalu mahal untuk dijual kembali. User menerima hasil Gemini |
| Revisi gambar hanya dipakai jika skornya naik | Pada uji jantung, revisi kadang menurunkan skor |
| Musik dan SFX disintesis kode | Router tidak punya model musik yang berfungsi, dan hasilnya bebas royalti |
| Keamanan penuh ditunda | User memilih fokus ke hasil video dan audio dulu |

## Usulan yang belum diputuskan

Pilihan di halaman utama sebaiknya dipisah menjadi **Tujuan** (Konten, Iklan) dan **Gaya** (Otomatis, Ilustrasi, Isometrik), karena "Ads" adalah tujuan sedangkan "2D" adalah gaya. Kerjakan setelah mesin isometrik terbukti.

Mesin isometrik diusulkan berbasis data: AI menyebut objek seperti balok, silinder, dan pelat, lalu kode yang menggambarnya. Alasannya, uji Mode Dunia menunjukkan Gemini lemah saat menghitung koordinat isometrik di SVG mentah.

## Hasil uji yang perlu diingat

| Uji | Hasil |
|---|---|
| Jantung dan jet, generator Gemini | User menilai cukup bagus, padahal skor kritik sekitar 5 |
| Gedung 24 lantai | 10 adegan, 223 detik generate, 79 detik video |
| Lift, suara Puck | 6 adegan, 171 detik generate, 76 detik video |
| Penilaian otomatis | 5 dari 7 gambar ulang lebih baik, waktu bertambah sekitar 1–2 menit |
| Jet dengan audio penuh | 5 adegan, 455 detik sampai generate selesai, 62 detik video, tanpa clipping |
| Mode Dunia, HP dicas | Mekanisme berhasil, 143 detik. Bentuk HP salah, warna gelap, isometrik tidak rapi |

Uji enam topik dihentikan user setelah jantung dan jet, jadi topik abstrak seperti inflasi dan sejarah belum terbukti di generator lama.

## Temuan router dan model

- Router memakai format OpenAI di `OPENAI_BASE_URL` dan selalu menjawab streaming. Baca sebagai SSE.
- Rute `ag/claude-*` membuang gambar tanpa pesan error. Rute `ag/gemini-3.8-flash-high` dan `gemini/gemini-3.8-flash` benar-benar melihat gambar. Kritik harus memakai Gemini, dan selalu cek `imageVisible`.
- Kuota Opus user habis pada 7 November 2026, dan rute Claude sempat mengembalikan 503 serta 404 sementara.
- `ag/gemini-3.1-pro-high` mengembalikan 503 dengan upstream 404 saat diuji.
- TTS Gemini yang berfungsi adalah `gemini/gemini-2.5-flash-preview-tts`. Versi 3.8 gagal dengan error nama suara. Keluarannya WAV 24 kHz mono, dan model ini tidak tercantum di `/models`.
- Tidak ada model musik yang berfungsi. Lyria dan `mmf/music-*` gagal di `/audio/speech`, dan `/audio/generations` serta `/music/generations` tidak tersedia.
- `OPENAI_BASE_URL` masih memakai HTTP tanpa TLS, jadi API key terkirim tanpa enkripsi. Ganti ke HTTPS sebelum produksi.

## Jebakan teknis

- **Sucrase dan esbuild berbeda.** Karakter `>` di teks JSX lolos pratinjau tetapi gagal export. Validator memakai esbuild supaya kesalahan tertangkap saat generate.
- **Crash runtime tidak tertangkap validator.** Contohnya `interpolate` dengan input menurun. Karena itu ada render frame contoh di [scene-check.ts](../src/lib/render/scene-check.ts).
- **Warna gelap datang dari dua sumber:** contoh palet di prompt director, dan lapisan hitam 72% di `SceneBackground`. Keduanya sudah ditangani, dan `SceneBackground` kini punya prop `scrim`.
- **`next build` menimpa `.next` milik server dev.** Gejalanya error `Cannot find module './vendor-chunks/...'`. Hentikan server dan hapus `.next`.
- **Mengedit file server saat dev hidup** bisa memicu `__webpack_modules__[moduleId] is not a function`. Jangan mengedit saat generate uji berjalan.
- **Setelah `.next` dihapus,** `npx tsc --noEmit` mengeluh `TS6053` dari `tsbuildinfo` lama. Pakai `--incremental false`.
- **esbuild menghapus import yang tidak dipakai.** Validator memakai `verbatimModuleSyntax` supaya import terlarang tetap terbaca.
- **Validator AST bukan batas keamanan penuh.** Akses properti hasil gabungan string tidak bisa dideteksi statis, jadi sandbox iframe tetap diperlukan.
- **Skrip uji harus menunggu server siap.** Request pertama ke route dev bisa mendapat HTML, bukan JSON.
- **File audio dibagi dua:** pratinjau membaca `/audio/...`, sedangkan render membaca `staticFile`. Lihat `sharedAudio` di [VideoTimeline.tsx](../src/motion-kit/core/VideoTimeline.tsx).

## Kontrak aset

Semua ilustrasi mengikuti [asset-contract.ts](../src/lib/explainer/asset-contract.ts): canvas 1000×1000, 2–4 keadaan, 3–10 bagian dengan titik label dan fokus kamera, serta jalur gerak. Panggung tidak perlu tahu topiknya. Ukuran gambar sebenarnya diukur lewat `getBBox` lalu dipusatkan oleh `fitArtwork`.

## Aturan anti-slop

Aturan disaring dari [antislop](https://github.com/miqdadbadjuber/anti-slop) (MIT) untuk konteks video, tanpa memasang paketnya. Intinya menolak teknik tanpa tujuan, bukan menetapkan satu gaya.

## Rujukan lisensi yang perlu dicek

Sebelum menjual layanan, cek syarat komersial Remotion dan Gemini TTS preview.
