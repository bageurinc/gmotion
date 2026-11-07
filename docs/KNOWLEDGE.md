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
4. Job di [generation-job.ts](../src/lib/pipeline/generation-job.ts) membuat audio per adegan, paralel maksimal 4. Story 2D dan Ads lalu menggambar ilustrasi per adegan, sedangkan Isometrik membuat satu dunia 3D dari seluruh narasi yang sudah disetujui.
5. Editor menerima progres lewat SSE di `/api/projects/[id]/events`, dan adegan yang selesai langsung masuk pratinjau.
6. Setelah semua selesai, adegan ilustrasi dinilai dan yang lemah digambar ulang. Semua gaya lalu dicek crash.
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
| Pilihan gaya adalah Story 2D, Ads, dan Isometrik | Keputusan user pada 7 November 2026, menggantikan keputusan sebelumnya bahwa semua video baru memakai 3D. Story 2D dan Ads memakai ilustrasi per adegan, dan hanya Isometrik memakai mesin dunia. Project tersimpan dengan preset `story` atau `ads` tetap dibuka sebagai 3D |
| Contoh prompt timelapse dihapus dari halaman utama | Fitur itu berbasis komponen 2D, sehingga tidak berlaku lagi untuk video baru |
| HyperFrames tidak dipakai | User memutuskan tetap di Remotion. Uji 9,6 detik berhasil dirender, tetapi engine tidak menyelesaikan masalah utama, yaitu pembuatan dunia isometrik |

## Usulan yang belum diputuskan

Mesin isometrik diusulkan berbasis data: AI menyebut objek seperti balok, silinder, dan pelat, lalu kode yang menggambarnya. Alasannya, uji Mode Dunia menunjukkan Gemini lemah saat menghitung koordinat isometrik di SVG mentah.

`@remotion/three` dengan kamera ortografis adalah kandidat utama penggambarnya, karena tumpang tindih objek dan kamera dihitung otomatis. Uji teknisnya lolos, tetapi keputusan akhir menunggu user menonton klip di `storage/spike/iso-world/{hp,pdam,selam}/clip.mp4`.

Di Mode Dunia berbasis objek, Gemini hanya menyebut objek, ukuran, warna, dan "berada di atas apa". Kode di [iso-world.ts](../src/lib/explainer/iso-world.ts) menghitung tinggi, batas, rute pipa, kamera, sorotan, dan objek penghalang. Prinsipnya, angka yang bisa dihitung kode jangan diminta dari model.

## Hasil uji yang perlu diingat

| Uji | Hasil |
|---|---|
| Jantung dan jet, generator Gemini | User menilai cukup bagus, padahal skor kritik sekitar 5 |
| Gedung 24 lantai | 10 adegan, 223 detik generate, 79 detik video |
| Lift, suara Puck | 6 adegan, 171 detik generate, 76 detik video |
| Penilaian otomatis | 5 dari 7 gambar ulang lebih baik, waktu bertambah sekitar 1–2 menit |
| Jet dengan audio penuh | 5 adegan, 455 detik sampai generate selesai, 62 detik video, tanpa clipping |
| Mode Dunia, HP dicas | Mekanisme berhasil, 143 detik. Bentuk HP salah, warna gelap, isometrik tidak rapi |
| `@remotion/three`, HP terbuka, 17 objek ditulis tangan | 240 frame 1080×1920. Export 3,8–4,1 detik dengan `angle` (GPU Mac) dan 22,1 detik dengan `swangle` (CPU). Selisih piksel antar keduanya rata-rata di bawah 0,7 dari 255. Frame yang sama dirender dua kali identik |
| 3D, jantung | 6 adegan, draf 21 detik, generate 184 detik, video 37,2 detik, export 34 detik. Alur benar, tetapi bentuknya diagram pipa, bukan jantung |
| 3D, inflasi | 6 adegan, draf 25 detik, generate 156 detik, video 31,8 detik, export 39 detik. Terbaca sebagai dunia toko dan uang |
| 3D, iklan aplikasi kasir | 5 adegan, draf 19 detik, generate 98 detik, video 26,1 detik, export 14 detik. CTA jalan, layar HP polos |
| Mode Dunia di aplikasi, lift | 5 adegan, draf sekitar 30 detik, generate 238 detik, video 29,8 detik, export 23–25 detik. 1 objek disesuaikan otomatis |
| Mode Dunia di aplikasi, baterai 80 persen | 6 adegan, generate 111 detik lewat tombol, video 35,7 detik, export 29 detik, tanpa perbaikan otomatis |
| Story 2D setelah pilihan dikembalikan, langit biru | 5 adegan, draf 22 detik, generate 403 detik, video 54,3 detik, export 45 detik, tanpa versi sederhana |
| Story 2D dengan model gambar, cuci tangan | 6 adegan, 6 gambar dalam 25 detik, video 68,3 detik, total 102 detik dari prompt sampai MP4. Tangan jelas dan gaya konsisten. Gambar tidak bisa digerakkan per bagian |
| Story 2D campuran lewat tombol, jari keriput | 6 adegan, 3 gambar dan 3 SVG, 6 gambar, draf sekitar 30 detik, generate 288 detik, export 65 detik, video 61 detik, 0 bagian diam di atas 4 detik, tanpa kegagalan |
| Uji campuran sabun | 5 adegan, 2 gambar dan 3 SVG, 5 gambar, total 263 detik, video 54,7 detik, 0 bagian diam di atas 4 detik. Keadaan dari gambar acuan berhasil menjelaskan proses. Satu percobaan sebelumnya jatuh ke SVG karena kuota |
| Pemeriksaan diam, ambang 6 dan batas 4 detik | Cuci tangan gambar AI gagal, diam 63 dari 68,3 detik. Isometrik baterai diam 29,5 dari 35,7 detik, dan lift 23,5 dari 29,8 detik. SVG sabun lolos |
| Dunia objek Gemini, 3 topik | Total untuk 2 permintaan: 11–12 ribu token masuk, 13–36 ribu token keluar, dan 83–240 detik. Video 30–33 detik, 7 beat, 17–20 objek. Render 12–13 detik dengan `angle` |

Uji enam topik dihentikan user setelah jantung dan jet, jadi topik abstrak seperti inflasi dan sejarah belum terbukti di generator lama.

## Temuan router dan model

- Router memakai format OpenAI di `OPENAI_BASE_URL` dan selalu menjawab streaming. Baca sebagai SSE.
- Rute `ag/claude-*` membuang gambar tanpa pesan error. Rute `ag/gemini-3.8-flash-high` dan `gemini/gemini-3.8-flash` benar-benar melihat gambar. Kritik harus memakai Gemini, dan selalu cek `imageVisible`.
- Kuota Opus user habis pada 7 November 2026, dan rute Claude sempat mengembalikan 503 serta 404 sementara.
- `ag/gemini-3.1-pro-high` mengembalikan 503 dengan upstream 404 saat diuji.
- TTS Gemini yang berfungsi adalah `gemini/gemini-2.5-flash-preview-tts`. Versi 3.8 gagal dengan error nama suara. Keluarannya WAV 24 kHz mono, dan model ini tidak tercantum di `/models`.
- Model gambar bawaan adalah `gemini/gemini-3.1-flash-lite-image`, dan bisa diganti lewat `IMAGE_MODEL`. Harganya setengah dari `gemini-3.1-flash-image`, 4–6 detik per gambar, dan tangannya jelas. `gemini/gemini-nano-banana-2.1` juga berfungsi, tetapi 11–14 detik.
- Jalur `gemini/` mengabaikan `size` dan `aspect_ratio`, dan mengembalikan gambar mendatar. Kanvas kosong sebagai gambar acuan memaksa bentuk vertikal sekaligus warna latar. Jalur `ag/` menghormati `size: 1024x1792`.
- `gemini/gemini-3.1-flash-image` berfungsi saat jalur `ag/` kehabisan kuota, dan menerima gambar acuan lewat kolom `image` di `/images/generations`. Hasilnya mempertahankan bidikan dan gaya, jadi satu gambar bisa punya beberapa keadaan. Jalur `ag/` belum teruji untuk gambar acuan karena kuotanya habis, dan `/images/edits` tidak tersedia. Biaya kedua jalur belum diketahui.
- Kuota `ag/gemini-3.1-flash-image` habis pada 7 November 2026 setelah sekitar 15 gambar dalam satu sesi uji, dengan HTTP 429 dan waktu pulih sekitar 4 jam 40 menit. Satu HTTP 500 muncul tepat sebelumnya. Untuk produksi, kuota ini lebih menentukan daripada kualitas.
- Gemini menjawab kotak objek dengan skala 0–1000 walaupun diminta pecahan, jadi `normalizeBox` wajib dipakai.
- Model gambar lain yang berfungsi adalah `gemini/gemini-2.5-flash-image` dan `gemini/gemini-3-pro-image-preview` lewat `/images/generations`, walaupun tidak tercantum di `/models` dan `imageOutput` semuanya false. `gemini-2.5-flash-image-preview`, `imagen-3.0-generate-002`, `imagen-4.0-generate-001`, dan `ag/gemini-3-pro-image` mengembalikan 404. Model `openai/gpt-image-*` dan `dall-e-3` menolak `response_format`, dan belum diuji tanpa parameter itu.
- Pada uji tangan memegang HP dan menjepit sekrup, `gemini-2.5-flash-image` lebih baik dalam 9–10 detik. `gemini-3-pro-image-preview` butuh 15–17 detik, memotong objek, dan kehilangan sekrupnya. Keluarannya PNG tanpa alpha, dan respons tidak memuat `usage`, jadi biayanya belum diketahui.
- Tidak ada model musik yang berfungsi. Lyria dan `mmf/music-*` gagal di `/audio/speech`, dan `/audio/generations` serta `/music/generations` tidak tersedia.
- `OPENAI_BASE_URL` masih memakai HTTP tanpa TLS, jadi API key terkirim tanpa enkripsi. Ganti ke HTTPS sebelum produksi.

## Perkiraan biaya

Harga resmi Gemini API per 7 November 2026, dibaca dari [halaman harga](https://aistudio.google.com/docs/pricing). Router tidak mengirim data pemakaian, jadi tagihan nyata belum dicek.

| Item | Harga |
|---|---|
| `gemini-3.8-flash` | $0,75 masuk dan $3,75 keluar per 1 juta token, menjadi $1,50 dan $7,50 mulai 1 Januari 2027 |
| `gemini-3.1-flash-image` | $0,067 per gambar 1K |
| `gemini-2.5-flash-image` | $0,039 per gambar, dihentikan 15 Maret 2027 |
| `gemini-nano-banana-2.1` dan `gemini-3.1-flash-lite-image` | $0,0336 per gambar 1K, belum diuji di gmotion |

Perkiraan per adegan: SVG sekitar $0,05 tanpa gambar ulang, $0,13 dengan satu gambar ulang, dan $0,25 pada kasus terburuk. Gambar AI bawaan $0,07 untuk batas 2 keadaan. Jalur `ag/` memakai kuota, jadi tidak bisa diandalkan untuk produksi.

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
- **WebGL butuh `chromiumOptions.gl`.** Skrip uji memakai `angle` di Mac. Server tanpa GPU memakai `swangle`, sekitar 6 kali lebih lambat tetapi masih jauh lebih cepat dari durasi video. Opsi yang sama harus dipakai `selectComposition`, `renderStill`, `renderMedia`, dan `openBrowser`.
- **Garis tepi Three.js punya dua lapis.** `LineSegments2` untuk lipatan, karena garis WebGL biasa selalu 1 piksel, dan hull belakang untuk siluet benda melengkung. Hull harus memakai vertex gabungan supaya tidak terbelah di sudut.
- **Sorotan hull tertutup permukaan di bawahnya** jika memakai depth biasa. Karena itu hull sorotan digambar dengan depth bias tanpa menulis depth, lalu bendanya digambar lagi di atasnya.
- **Sisi yang sebidang menimbulkan z-fighting,** terlihat sebagai goresan bergerak. Dua benda juga tidak boleh saling menembus. Dunia buatan AI perlu validasi untuk kedua hal ini.
- **Jawaban pertama Gemini selalu ditolak pada 5 dari 5 percobaan,** paling sering karena objek saling tumpang tindih atau anak lebih besar dari induknya. Validator menangkapnya, dan percobaan kedua lolos tanpa perbaikan paksa pada 4 dari 5. Hal ini menggandakan token, jadi pertimbangkan memperbaiki prompt sebelum produksi.
- **Tanpa aturan warna eksplisit, Gemini kembali ke slate gelap** untuk topik rumahan. Kolom `look` dan pengecekan kontras di `resolveIsoPlan` memperbaikinya.
- **Gemini menambah meja dan pajangan** yang mengecilkan subjek. Alas kini otomatis, dan subjek wajib menutupi minimal seperempat area.
- **Objek di depan fokus bisa menutupi layar,** terlihat pada rumah di video PDAM. `occludersOf` memudarkan penghalang selama beat itu.
- **Garis tepi benda gelap harus lebih terang,** karena di latar gelap garis yang lebih gelap hilang.
- **Bentuk melengkung sulit dipotong.** Nampan selalu punya dinding tegak, sehingga kapal selam masih terlihat seperti tongkang meskipun lambungnya membulat.
- **Route Next tidak boleh mengimpor runtime Remotion.** Gejalanya error `Remotion requires React.createContext`, dan hanya muncul di server Next, tidak di `vitest`, `tsc`, atau `tsx`. Geometri yang dipakai server ada di `iso-geometry.ts`, dan `iso-world.test.ts` menjaganya.
- **Angka di panel harus cocok dengan satuannya.** Video iklan sempat menampilkan "14 %" dari "14 hari".
- **Setiap adegan Mode Dunia adalah satu beat.** Dunia disimpan sebagai data di dalam `MainVideo.tsx`, sehingga pratinjau dan export otomatis memakai kode yang sama. File `Scene*.tsx` tidak dipakai.
- **Angka di panel dibatasi kode,** bukan hanya prompt, lewat `keepStatedNumbers`. Prompt saja tidak cukup untuk mencegah Gemini mengarang angka.
- **Dua server dev dari satu folder berbagi `.next`.** Port 3000 dan 3100 sempat hidup bersamaan saat uji, dan port 3100 tidak merespons.
- **Pemeriksaan diam harus mengukur jarak antar peristiwa.** Zoom pelan selalu menghasilkan perubahan kecil, jadi ambang rendah meloloskan video monoton. Alat ini mengukur monoton, bukan pemahaman penonton.
- **Dua pose harus digambar dari gambar acuan.** Tanpa acuan, pose pertama penampang kulit dan pose kedua tangan utuh, jadi bukan kelanjutan gerakan.
- **Gambar mendatar yang dipotong paksa membuat objek terlalu besar.** Semua gambar uji sabun ternyata 1408×768. `matchesAspect` kini menolak bentuk yang salah, dan adegan itu jatuh ke SVG.
- **Gambar AI tidak mengikuti aturan ruang kosong,** jadi judul butuh pelat warna latar di `ImageStage`. Kotak objek dari Gemini kadang terlalu besar atau meleset, jadi kotak besar hanya dipakai untuk gerak kamera.
- **`THREE.Clock` deprecated** muncul di log render dari `@react-three/fiber`. Peringatan ini tidak memengaruhi hasil.
- **File audio dibagi dua:** pratinjau membaca `/audio/...`, sedangkan render membaca `staticFile`. Lihat `sharedAudio` di [VideoTimeline.tsx](../src/motion-kit/core/VideoTimeline.tsx).

## Kontrak aset

Semua ilustrasi mengikuti [asset-contract.ts](../src/lib/explainer/asset-contract.ts): canvas 1000×1000, 2–4 keadaan, 3–10 bagian dengan titik label dan fokus kamera, serta jalur gerak. Panggung tidak perlu tahu topiknya. Ukuran gambar sebenarnya diukur lewat `getBBox` lalu dipusatkan oleh `fitArtwork`.

## Aturan anti-slop

Aturan disaring dari [antislop](https://github.com/miqdadbadjuber/anti-slop) (MIT) untuk konteks video, tanpa memasang paketnya. Intinya menolak teknik tanpa tujuan, bukan menetapkan satu gaya.

## Rujukan lisensi yang perlu dicek

Sebelum menjual layanan, cek syarat komersial Remotion dan Gemini TTS preview.
