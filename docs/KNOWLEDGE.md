# Knowledge gmotion

Catatan keputusan, alasan, dan temuan yang tidak terlihat dari kode. Terakhir diperbarui 8 November 2026.

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
4. Job di [generation-job.ts](../src/lib/pipeline/generation-job.ts) membuat audio per adegan, paralel maksimal 4. Story 2D dan Ads lalu menggambar ilustrasi per adegan, sedangkan Isometrik membuat satu gambar dunia dari seluruh narasi yang sudah disetujui, lewat [iso-picture.ts](../src/lib/explainer/iso-picture.ts).
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
| Empat gaya: Story 2D Campuran, Story 2D Full SVG, Ads, dan Isometrik | Keputusan user pada 7 November 2026. `story-2d` tetap menjadi jalur campuran; `story-svg` memakai ilustrasi SVG per adegan tanpa perencana/generator gambar. Hanya Isometrik memakai mesin dunia. Project lama `story`/`ads` tetap 3D; file video lama tidak dimigrasi. |
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

## Akun dan pembayaran

- **Login hanya Google.** Akun dibuat otomatis saat pertama masuk, jadi `/register` mengarah ke `/login`. Identitas memakai `sub` Google, bukan email, karena email bisa berubah.
- **Sesi disimpan sebagai hash SHA-256 token.** Kebocoran database tidak memberi sesi yang masih hidup.
- **Pembayaran memakai QRIS lewat Xendit Payments API v3,** `POST /v3/payment_requests` dengan `channel_code: QRIS`. `/qr_codes` berlabel legacy di [panduan migrasi](https://docs.xendit.co/docs/migrate-direct-per-method-apis-to-v3.md). Invoice sengaja tidak dipakai.
- **Saldo hanya berubah lewat `credit_ledger`.** Trigger memperbarui `users.credits`, dan `UNIQUE (reason, ref)` membuat webhook ganda tidak menambah saldo dua kali. Cara ini dipilih karena setiap query D1 lewat HTTP adalah transaksi sendiri.
- **Satu project bayar sekali.** Coba ulang adegan gagal gratis, dan tidak ada refund otomatis. Membuat draf butuh saldo minimal 1 kredit karena sudah memakai token model, tetapi saldo baru terpotong saat generate.
- **Pembayaran terlambat tetap dikreditkan.** Uang yang sudah masuk tidak boleh hilang hanya karena batas waktu lokal lewat.
- **Rekonsiliasi berjalan selama layar QR terbuka,** paling sering sekali per 10 detik. Ini cadangan jika webhook tidak sampai, termasuk di localhost yang tidak bisa dijangkau Xendit.
- **Project lama tanpa `ownerId` tersembunyi** kecuali untuk akun di `LEGACY_PROJECT_OWNER_EMAIL`.

OAuth client `gmotion` ada di project Google Cloud `gittask`, bersama client lama "Web client 1". Yang perlu diingat:

- **Project masih Testing.** Hanya test user yang bisa login, batasnya 100 user. Saat ini hanya `404.ginda@gmail.com`. Publish perlu melengkapi halaman Branding.
- **Layar Google menampilkan nama "GitTask",** karena consent screen dipakai bersama seluruh project.
- **Redirect URI baru terdaftar untuk localhost port 3100 dan 3101.** Domain produksi harus ditambahkan, dan `APP_URL` harus sama persis dengan port atau domain yang dipakai.

Hasil uji dengan kunci uji Xendit, 8 November 2026:

- **Request QRIS tanpa `expires_at` diterima** dengan status `201` dan `REQUIRES_ACTION`. QR ada di `actions[]` dengan `descriptor: QR_STRING`.
- **Kedaluwarsa bawaan QRIS adalah 48 jam,** dibaca dari `channel_properties.expires_at` pada respons.
- **Endpoint `simulate` mendukung QRIS.** Status `SUCCEEDED` terbaca lewat rekonsiliasi dalam 20 detik, dan kredit masuk sekali.

Belum diuji:

- Webhook `payment.capture` sungguhan, karena localhost tidak bisa dijangkau Xendit dan `XENDIT_WEBHOOK_TOKEN` belum ada. Parser webhook dibuat dari contoh DANA.
- Pembayaran dengan aplikasi bank atau dompet digital sungguhan.
- Apakah `expires_at` bisa dikirim untuk memperpendek masa berlaku QR.

## Cloudflare

- **Aplikasi utama tidak bisa berjalan di Cloudflare Workers.** Generate dan render memakai `fs`, Remotion, Chromium, dan `sharp`, dan project disimpan sebagai file di `storage/`. Workers tidak menyediakan filesystem lokal maupun Chromium.
- **D1 diakses lewat REST API,** jadi bisa dipakai dari server Node di mana saja. Lapisan database ada di [client.ts](../src/lib/db/client.ts).
- **Tanpa variabel D1, mode dev memakai `storage/gmotion.db`.** Di production aplikasi menolak jalan, supaya data tidak terpecah ke dua database. SQL dan migrasinya sama, tetapi belum pernah dijalankan pada D1 sungguhan.

## Perkiraan biaya

Harga resmi Gemini API per 7 November 2026, dibaca dari [halaman harga](https://aistudio.google.com/docs/pricing). Tagihan nyata lewat router belum dicek.

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


## Pemisahan Story 2D Campuran dan Full SVG

- ID `story-2d` tetap kompatibel dan labelnya kini **Story 2D Campuran**. Proyek lama dengan ID ini mendapat label baru, tetapi isi videonya tidak diubah (termasuk video lama yang kebetulan seluruhnya SVG).
- ID baru `story-svg` dipertahankan dari request, draf, penyimpanan, generate, hingga export. Tidak masuk `planSceneMoments` atau `buildImageScene`; memakai `generateVideoSceneFile` dan fallback vektor.
- Director dan generator mendapat arahan aksi objek sesuai narasi. Ini bukan jaminan peningkatan koreografi otomatis; kualitas dan kesinambungan masih perlu dinilai user.
- `validateSceneCode(..., { svgOnly: true })` digunakan untuk aset, coder/fallback AI, perbaikan crash, revisi chat, dan edit manual. Menolak komponen gambar/video, elemen raster, serta referensi aset gambar/CSS URL; referensi internal SVG dan audio tetap diizinkan. Ini pemeriksaan format, bukan batas keamanan penuh untuk kode bermusuhan.
- Empat kartu preset ditata dua kolom mulai ukuran `sm`, satu kolom pada ponsel. Label terpusat dipakai di daftar proyek dan studio.
- Verifikasi otomatis: 242 test, pemeriksaan TypeScript tanpa incremental, dan ESLint src lulus. Uji nyata API Full SVG `proj_1794057480407_8pkq`: draf 26 detik, 3 adegan/461 frame (15,4 detik), generate 177 detik, ekspor 14 detik. Tidak ada aset gambar atau fallback sederhana. Frame MP4 pada detik 3, 8, 12 diperiksa. Nilai kritik 4,8/5/5; kandidat gambar ulang tidak mengungguli hasil awal. Transisi antar-view masih menumpuk transparansi, bentuk permukaan berubah antaradegan, dan komposisi adegan terakhir lebih kecil. Ini catatan kualitas lanjutan, bukan kegagalan pemisahan preset. Rasio 4:5/16:9 belum diuji nyata, kualitas audio belum didengar user.

## Koreografi Full SVG

- Penyebab koreografi lemah: panggung berganti bidikan menurut daftar bagian, bukan urutan aksi narasi, dan pergantian view menumpuk dua gambar transparan.
- Manifest `story-svg` kini wajib punya `choreography` (1–4 aksi dengan `startWord` dan `endWord`) dan tepat satu view. `buildActionCues` mengubah kata menjadi frame, lalu `actionProgress` dikirim ke `Asset` dan tetap 1 setelah aksi selesai, sehingga pose akhir terlihat. Kamera dan fit diam agar aksi terbaca.
- Aksi yang tidak dibaca kode lewat `actionProgress` ditolak dan masuk repair (`unanimatedActions`). Pemeriksaan ini hanya membuktikan nilainya dibaca, bukan bahwa gerakannya bagus.
- Tanpa `wordTimings`, prompt dan compose memakai pembagian rata yang sama dari `narrationWords`.
- Karena tidak ada bidikan per bagian, Full SVG tidak punya label bagian dan partikel alur. Teks bergantung pada headline dan caption.

## Perbandingan model penggambar Full SVG (7 November 2026)

Satu topik (cara sabun mengangkat minyak), 3 adegan, rasio 9:16, storyboard dan narasi sama. Penilai tetap `ag/gemini-3.8-flash-high`. Ulangi dengan `npx tsx --env-file=.env scripts/spike-model-cost.ts --from <project> --model <model>`. Data per panggilan ada di `storage/spike/`.

| | Gemini 3.8 Flash | DeepSeek V4.1 Flash | DeepSeek V4 Pro |
|---|---|---|---|
| Project | `proj_1794058318375_ollx` | `proj_1794058660160_5741` | `proj_1794058660160_wl84` |
| Skor kritik akhir | 5,2 / 5,6 / 5,4 | 4,4 / 5 / 4,4 | 4 / 4,6 / 3,4 |
| Panggilan gambar | Tidak diukur | 6 | 6 |
| Token masuk / cache / keluar | Tidak diukur | 53.381 / 6.528 / 98.801 | 50.074 / 4.096 / 155.175 |
| Token reasoning (bagian dari keluar) | Tidak diukur | 66.479 | 125.972 |
| Waktu LLM total | Tidak diukur | 505 detik | 2.440 detik |
| Waktu job | Sekitar 4,5 menit | 549 detik | 1.002 detik |
| Biaya gambar jam sibuk | Lihat bagian kesinambungan | $0,133 | $0,675 |
| Biaya gambar luar jam sibuk | Lihat bagian kesinambungan | $0,066 | $0,338 |

- Harga dibaca dari [halaman harga DeepSeek](https://api-docs.deepseek.com/quick_start/pricing) pada 7 November 2026. Per 1 juta token, V4.1 Flash: cache $0,006, masuk $0,30, keluar $1,20. V4 Pro: cache $0,044, masuk $1,32, keluar $3,96. Tarif luar jam sibuk setengahnya. Jam sibuk 01:00–04:00 dan 06:00–10:00 UTC, Senin–Jumat, setara 08:00–11:00 dan 13:00–17:00 WIB.
- Biaya DeepSeek adalah token nyata dikali harga resmi, belum tagihan nyata dari router. Router terlihat menambah sekitar 2.800 token masuk pada setiap panggilan, dan belum diketahui apakah token itu ditagihkan.
- Harga Gemini naik dua kali lipat mulai 1 Januari 2027.
- Penilai Gemini menambah sekitar $0,05 per video pada semua run. Biaya TTS tidak dihitung.
- Jalur `ag/` ternyata mengirim `usage` pada uji ini.
- Model `ds/deepseek-v4-flash` lama kini dilayani V4.1 Flash, jadi tidak diuji terpisah.
- Daftar router menandai semua model `ds/` tanpa vision, tetapi dokumen resmi menandai Flash mendukung vision dan Pro tidak. Gambar ulang tetap berhasil, tetapi belum terbukti model melihat contact sheet. Pro pasti hanya mengandalkan teks kritik.
- Pengamatan frame: Gemini paling kaya detail dan aksinya paling jelas, tetapi bentuk kulit berubah tiap adegan dan garis air keluar panel. Flash lebih konsisten antaradegan, tetapi sabun adegan 1 hanya sampai puncak minyak dan misel adegan 3 turun ke kulit. Pro punya akhir `bersih` paling jelas, tetapi ilustrasinya paling polos dan misel menembus kulit.
- Satu panggilan penilai Flash habis waktu pada 5 menit, jadi kandidat gambar ulang itu dilewati. Skor tiap model hanya penyaring, dan uji ini hanya satu topik dan satu percobaan.

## Pilihan model dan kesinambungan Full SVG

- Keputusan user pada 7 November 2026: user memilih Gemini atau DeepSeek Flash per proyek. V4 Pro tidak ditawarkan karena lebih mahal dan lebih lambat, tanpa hasil yang lebih baik.
- Pilihan disimpan di `project.drawingModel`, bukan storyboard, agar tidak tertimpa saat draf diedit. Project lama dianggap Gemini. `DEEPSEEK_FLASH_MODEL` bisa mengganti ID model.
- Pilihan hanya berlaku untuk penggambar: aset, repair, gambar ulang, rencana momen, dan dunia isometrik. Director, coder cadangan, revisi chat, TTS, penilai, dan pencari objek pada gambar tetap Gemini.
- Prompt saja terbukti gagal menjaga kesinambungan. Sekarang adegan pertama wajib menulis blok `SHARED-WORLD` berisi `WorldBase` dan komponen objek berulang. `applySharedWorld` menimpa salinan model dengan blok itu, sehingga kode dasarnya identik. `<WorldBase />` wajib tanpa prop dan kamera diam, jadi dasar dunia tidak bergeser antaradegan.
- Full SVG digambar berurutan dan adegan menerima kode adegan sebelumnya. Audio tetap dibuat paralel lebih dulu. Gambar ulang kritik memakai blok yang sama, jadi kritik tidak bisa mengubah dasar dunia.
- Adegan yang gagal mendapat satu percobaan penuh lagi sebelum jatuh ke versi sederhana, karena versi itu punya gaya lain. Pada `proj_1794060416811_rln7`, adegan 1 jatuh ke versi sederhana dan merusak gaya video. Penyebabnya tidak tercatat, dan tidak terulang pada `proj_1794061113205_metf`.

| Uji berantai | Model | Skor kritik | Waktu job | Biaya gambar jam sibuk | Luar jam sibuk |
|---|---|---|---|---|---|
| Sabun `proj_1794060396569_617b` | DeepSeek Flash | 5,2 / 4,8 / 5,4 | 424 detik | $0,152 | $0,076 |
| Lebah `proj_1794061113205_metf` | DeepSeek Flash | 4,8 / 6 / 4,8 | 586 detik | $0,213 | $0,107 |
| Sabun `proj_1794060396569_y3sn` | Gemini | 4,4 / 4,4 / 4,8 | 581 detik | $0,642 | Tidak ada tarif luar jam sibuk |

- Biaya Gemini di atas memakai token nyata 8 panggilan, termasuk 2 repair: 184.755 masuk dan 134.361 keluar. Ini mengoreksi perkiraan $0,16 pada uji sebelumnya dan perkiraan per adegan di bagian biaya. Mulai 1 Januari 2027 run yang sama menjadi $1,28.
- Run Gemini berjalan bersamaan dengan DeepSeek Flash, jadi waktu job tidak bisa dipakai untuk menyimpulkan model mana yang lebih cepat. Teks UI hanya membandingkan biaya.
- Penilai Gemini menambah sekitar $0,056 per video. Satu sampel per model dan jumlah repair berbeda, jadi selisih biaya bisa berubah.
- Frame sekitar potongan: kulit, lapisan lemak, dan air identik pada video sabun. Misel menyambung dari adegan 2 ke 3 pada kedua model. Pada Flash, pose sabun belum menyambung dari adegan 1 ke 2. Pada lebah, bentuk sarang berubah dari adegan 2 ke 3 karena sarang bukan bagian `WorldBase`.
- Skor kritik tidak naik meski kesinambungan membaik, jadi skor bukan ukuran kesinambungan. User belum menonton hasil ini, dan audio belum didengar.

## Pemeriksaan render yang diadopsi dari awesome-opus5-5-videos

Sumbernya [awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos), kumpulan 703 prompt video Opus 5.5. Yang diambil hanya tekniknya. Isi prompt tetap milik pembuatnya.

- Prompt di repo itu sering berisi proses seperti render, cek, dan perbaiki. Di gmotion proses dijalankan job, jadi teknik ini masuk ke kode, bukan prompt.
- `measureStillness` memakai `renderFrames` setiap 0,5 detik pada skala 0,5, tidak perlu MP4, dan tidak memakai token. Waktunya 3–8 detik per video. Hasil baterai sama dengan pengukuran dari MP4 (29,5 detik), lift 23,5 detik, serta sabun campuran dan jari keriput tetap 0.
- **Jangan memanggil `renderStill` ratusan kali pada satu browser.** Pada project lama yang crash, `Target.closeTarget` menjadi unhandled rejection dan mematikan proses Node. `renderFrames` menolak dengan benar, dan ada `cancelSignal` 3 menit karena satu percobaan sempat menggantung lebih dari 10 menit. Penyebab gantung itu belum dipastikan.
- **Full SVG sengaja tidak diukur.** Empat dari lima video Full SVG lama tertandai 14–28,5 detik diam, padahal frame sabun menunjukkan molekul bergerak sesuai narasi. Kamera diam dan objek kecil membuat selisih antar frame di bawah ambang. Membandingkan dengan frame jangkar bukan jalan keluar, karena zoom pelan pada Isometrik akan lolos.
- Contact sheet kini memakai grid 4 kolom. Frame diambil di luar fade 9 frame, karena frame lama di dekat potongan setengah pudar.
- Frame adegan sebelumnya masuk sheet Full SVG, sehingga tidak ada panggilan model tambahan. Sheet menjadi lebih besar, dan dampak tokennya belum diukur.
- Uji nyata lewat aplikasi: Isometrik `proj_1794063405237_scn7`, 5 adegan, 31,1 detik, generate 168 detik, export sekitar 16 detik. Cek ini menandai 5 bagian, dan frame MP4 memang satu bidikan diam per adegan. Full SVG DeepSeek Flash `proj_1794063405229_elp3`, 3 adegan, 45,3 detik, generate 627 detik, export sekitar 23 detik, skor 5,8 / 5,8 / 4,8.
- Catatan kritik kini disimpan di `sceneProgress.issues`. Kritik yang dijalankan ulang pada 2 video Full SVG (4 potongan) menyebut 1 lompatan secara eksplisit: pada sabun, kubah minyak menjadi lonjong dengan `viewConsistency` 5. Kritik juga menemukan lompatan di dalam adegan pada frame pose akhir. Pergantian panel bulat ke layar penuh pada video semut tidak disebut sebagai lompatan potongan.
- **Kritik dulu menghukum Full SVG karena label yang memang tidak ada.** `labelAccuracy` bernilai 1–3 pada keenam adegan uji. Permintaan kritik kini menyebut adegan koreografi tanpa label, dan `labelAccuracy` hanya menilai kebenaran fakta. Permintaan label hilang dari `issues`, dan skornya naik ke 7–9.
- **Ambang Full SVG dinaikkan ke 6,5 atas keputusan user pada 7 November 2026, gaya lain tetap 5,5.** Dengan 6,5, 2 adegan semut tertandai untuk gambar ulang pada data uji. Angka ini baru berdasar 2 video, dan ambang baru belum dijalankan pada generate nyata. Pada 2 video yang sama, skor naik dari 5,2 / 4,8 / 4,4 dan 5,6 / 5,4 / 6,6 menjadi 6,6 / 6,2 / 6,2 dan 7,2 / 7 / 8. Adegan di bawah ambang turun dari 4 menjadi 0, jadi tidak ada gambar ulang, padahal `issues` masih memuat lompatan dan aksi yang membeku. Biaya turun, tetapi kritik jadi hampir tidak memicu perbaikan. Pada penilaian ini lompatan potongan disebut di 2 dari 4 potongan.
- **Skor kritik berisik.** Versi semut yang sama mendapat 5,8 / 5,8 / 4,8 saat generate dan 5,2 / 4,8 / 4,4 saat dinilai ulang.

## Latar penuh dan safe area (8 November 2026)

Safe area hanya membatasi teks dan subjek. Latar dan lingkungan harus sampai ke tepi frame.

- **Penyebab tanah terpotong ada dua.** `AssetStage` memakai `overflow: hidden` dan mask fade pada pita panggung, dan model berhenti menggambar di tepi kanvas 1000×1000, padahal frame terlihat kira-kira x=-30 sampai 1120 dan y=-425 sampai 1615 pada 9:16.
- **Latar polos bukan terutama efek anti-slop.** Penyebab utamanya aturan lama "jangan melukis latar penuh, karena panggung yang melukis latar", padahal panggung hanya melukis gradien palet. Aturan "bentuk dekoratif harus punya alasan" di anti-slop ikut menekan, jadi kini latar nyata dinyatakan bukan dekorasi.
- **Prop `fullBleed` hanya dipakai adegan baru.** Gambar lama berhenti di tepi kanvas, jadi tanpa fade tepinya akan terlihat lebih keras.
- **`fitArtwork` kini hanya menghitung bagian di dalam kanvas.** Tanpa ini, tanah selebar x=-1000 sampai 2000 mengecilkan subjek.
- **Pelat judul hanya muncul saat kamera zoom.** Pada shot lebar langit terlihat utuh, dan judul mengandalkan area atas yang tenang. Saat zoom, subjek bisa naik ke belakang judul.
- Uji nyata: adegan 1 video gedung dengan DeepSeek Flash, 173 detik. Tanah penuh ke tepi frame, ada langit dan awan, judul tetap terbaca. Catatan: rig bor lebih kecil daripada aturan 70–85% kanvas, dan batuan gelap bawah cukup luas. Baru 1 adegan, belum sampai MP4 penuh.

## Gaya teks dan kartu data (8 November 2026)

- Sebelumnya semua judul memakai Arial tebal dengan satu animasi, dan `highlightWords` tidak pernah dikirim. Kini `storyboard.textStyle` memilih font, ukuran, huruf, dan animasi masuk. Tanpa field ini, video lama tetap memakai tampilan lama.
- Gaya: `tegas` (Anton), `teknis` (Barlow Condensed), `editorial` (Playfair Display, Lora), `ramah` (Baloo 2). `@remotion/google-fonts` dipasang pada versi yang sama dengan Remotion. Font hanya dimuat jika dipakai.
- **Kartu data bersifat opsional.** `scene.dataVisual` berisi `stat`, `compare`, atau `steps`. `spokenDataVisual` dijalankan saat adegan disusun, jadi hasil edit narasi ikut diperiksa. Satu angka yang tidak diucapkan, atau satuannya beda, membuang seluruh kartu.
- Kartu muncul saat angkanya diucapkan, dan `steps` muncul di awal. Kartu memakai slot `cta` agar posisinya mengikuti safe area. Adegan CTA tidak melewati penyusun ini, jadi keduanya tidak bertabrakan.
- Kartu menutup kanvas sekitar y=830 ke bawah pada 9:16, jadi prompt meminta subjek tetap di atas y=800 saat ada kartu. Aturan ini baru dari prompt dan belum diuji pada gambar baru.
- Uji Director: Borobudur memilih `editorial` dengan 3 kartu dari 6 adegan, kue pukis memilih `ramah` dengan 1 kartu dari 6 adegan. Pada kue pukis, kartu 60 menit akan terbuang jika narasi menulis "enam puluh" dengan huruf.

## Gambar AI penuh satu frame (8 November 2026)

- Gambar AI sebenarnya sudah menutupi frame. Isinya terlihat seperti pita di tengah karena prompt meminta 28% atas dan 30% bawah kosong, latar satu warna polos, dan `ImageStage` menutup 27% atas dengan pelat padat.
- Prompt kini meminta tempat nyata dari tepi ke tepi, dan area atas yang tenang untuk judul. Pelat padat diganti lapisan tembus 85% yang hilang di 32% tinggi frame.
- **Jangan menulis "sedikit detail" untuk area bawah.** Model menjadikannya pita warna polos dengan tepi keras. Setelah aturan itu diganti "detail sama sampai tepi bawah", 2 dari 2 gambar uji penuh.
- Biaya uji rendah: tiap gambar 5–6 detik. Gambar baru tampak lebih detail daripada gaya vektor datar sebelumnya, jadi konsistensi dengan adegan SVG perlu dinilai saat menonton.
- **Kotak fokus diganti sorotan lembut.** Kotak bergaris terasa kaku di atas ilustrasi. Peredupan 42% meninggalkan bercak abu-abu di latar terang, jadi nilainya diturunkan ke 20% dengan jangkauan lebih luas. Karena `ImageStage` dipakai bersama, video lama ikut berubah.
- Label objek di `ImageStage` dan `AssetStage` kini mengikuti `textStyle`, dan label `ImageStage` memakai warna palet. Kotak subtitle tetap gelap di semua tema agar selalu terbaca.
- `bundleProject` membuat aset project sempat 404 selama beberapa detik. Studio yang sedang terbuka bisa kehilangan gambar sesaat saat project itu di-bundle.

## Kualitas 3D: blob, layar, dan adegan dekat (8 November 2026)

- **Tambah bentuk saja tidak cukup.** Pada uji pertama Gemini memakai `blob`, tetapi memecah jantung menjadi 11 blob terpisah, jadi hasilnya tetap barisan benda. Penyebabnya struktural: kamera hanya bisa menyorot objek, dan schema mewajibkan minimal 6 objek. Setelah lobus bisa diberi `id` yang dipakai `focus` dan `through`, dan minimal objek jadi 1, jantung menjadi satu blob 16 bagian. Prinsipnya, kalau model terus memecah sesuatu, cari insentif di schema sebelum menambah kalimat prompt.
- **Blob dibuat dari SDF dan surface nets di `iso-geometry.ts`,** tanpa library baru dan tanpa `remotion`, karena server memakainya untuk menghitung permukaan. Bentuk direntangkan mengisi `size`, jadi model tidak menghitung satuan dunia, dan aturan tumpukan tetap berlaku.
- **Warna per lobus harus berbobot.** Satu pemilik per verteks membuat batas warna bergerigi mengikuti grid, dan lobus yang terkubur tidak punya verteks sehingga tidak bisa disorot. Bobot lunak menyelesaikan keduanya.
- **Blob tidak ikut cek tumpang tindih.** Kotak batasnya jauh lebih besar dari lengkungannya. Pada lebah, cek ini membuang badan lebah saat repair. Koordinat lobus yang sedikit keluar dari -1 sampai 1 dijepit `clampLobes`, karena sebelumnya satu angka menggagalkan seluruh jawaban.
- **Layar digambar ke kanvas lalu menjadi tekstur,** jadi pratinjau dan export memakai kode yang sama. Hanya box dan plate. Baris dengan angka yang tidak diucapkan dibuang, karena layar terlihat seperti data produk sungguhan.
- **Pipa di depan layar merusak bidikan.** Close-up layar memudarkan semua link, label dihapus karena menutupi judul, dan zoom dipakai sampai batas agar teks terbaca.
- **Adegan dekat memudarkan semua yang ada di bidikan,** kecuali fokus, induk, anak, dan link yang menyentuhnya. Ini menggantikan `occludersOf`, yang hanya memudarkan objek di depan fokus. Jendela pudar digabung antar-beat supaya objek tidak berkedip, dan titik aliran dari pipa yang pudar ikut dihentikan.
- **Dua dev server lagi-lagi bentrok.** Port 3100 sudah hidup saat `preview_start` dijalankan, sehingga server kedua naik di 3101 dengan `.next` yang sama. Cek port dulu sebelum menyalakan server.

| Uji Gemini | Percobaan | Waktu model | Token masuk / keluar | Biaya model | Video | Export |
|---|---|---|---|---|---|---|
| Jantung, 11 blob terpisah (sebelum perbaikan) | 2 | 193 detik | 15.929 / 32.661 | $0,134 | 32,8 detik | 16,5 detik |
| Jantung, 1 blob `iso-world/jantung3` | 1 | 60 detik | 5.315 / 8.950 | $0,038 | 31,3 detik | 27,3 detik |
| Lebah, `iso-world/lebah3` | 2 | 108 detik | 13.314 / 16.043 | $0,070 | 31,3 detik | 27,9 detik |
| Paru-paru lewat job `proj_1794081608603_isojob` | 1 | 83 detik | 5.494 / 15.755 | $0,063 | 40,2 detik | 17 detik |
| Iklan kasir lewat job `proj_1794081812429_isojob` | 1 | 61 detik | 5.464 / 9.446 | $0,040 | 28,8 detik | 13 detik |

- Biaya di atas adalah token nyata dikali harga resmi `gemini-3.8-flash`, belum tagihan nyata dan belum termasuk TTS. Harga naik dua kali lipat mulai 1 Januari 2027.
- Tiga render jantung, lebah, dan kasir berjalan bersamaan, jadi waktu export 23–28 detik pada tabel lebih lambat daripada waktu tunggal.
- Job memakai `scripts/spike-iso-job.ts`, yang menjalankan director, `runGeneration`, dan export yang sama dengan aplikasi tanpa langkah login. Tombol di browser belum diuji karena panel browser belum login Google.
- Satu topik per jenis. Keberhasilan jantung dan lebah belum membuktikan semua bentuk organik, dan ketiga blob masih dinilai dari frame, bukan dari video yang ditonton user.

## Progres export (8 November 2026)

Persen di layar dulu timer yang naik 15% tiap 1,2 detik. Kini route export mengirim satu baris JSON per peristiwa dari `onProgress` milik `renderMedia`, jadi tidak perlu menyimpan progres ke disk. Angka berhenti di 99% sampai file jadi. Stream yang putus sebelum `done` dianggap gagal, dan kegagalan render datang sebagai baris `error` dengan HTTP 200, karena header sudah terkirim. Kalau tab ditutup, render tetap selesai dan tersimpan.

## Target durasi dari prompt (8 November 2026)

- Penyebab uji "30 detik jadi 42 detik": Director hanya diberi kalimat "fit the scene count to it", dan perkiraan di layar draf memakai 2,4 kata/detik. Diukur dari 283 adegan bernarasi di `storage/projects`, Gemini TTS bicara sekitar 2,08 kata/detik. Durasi adegan = audio + 0,35 detik, minimal 3 detik. Galat rata-rata per adegan 11% dengan 2,1, dan 16% dengan 2,4.
- `parseTargetDurationSeconds` di [draft.ts](../src/lib/pipeline/draft.ts) hanya membaca durasi yang menempel pada kata seperti video, durasi, iklan, reels, atau di awal prompt. Ini supaya "rebus telur 7 menit" tidak dianggap target. Rentang 8–300 detik.
- `durationBudget` mengubah target menjadi rentang kata total dan 1 adegan per 5–9 detik. Director menerima anggaran ini, dan jika estimasi draf meleset lebih dari 15%, diminta 1 kali menulis ulang. Hasil yang lebih dekat ke target yang dipakai.
- Uji nyata Gemini dan TTS: 30 detik menjadi 4 adegan, 59 kata, audio 30,1 detik; 60 detik menjadi 7 adegan, 114 kata, audio 58,6 detik. Draf saja: 15 detik menjadi 15,3, iklan 45 detik menjadi 42,6. Pada uji ini tidak ada perbaikan yang terpicu.
- Satu panggilan Director pernah memakan 372 detik pada uji iklan. Itu latensi router, bukan percobaan ulang durasi.
- Video tersusun dengan `Series` tanpa tumpang tindih transisi, jadi panjang MP4 sama dengan jumlah durasi adegan.

## Cek crash setelah revisi chat (8 November 2026)

- Sebelumnya route revisi menyimpan kode baru tanpa render dan selalu menjawab "telah diterapkan". Padahal `reviseSceneCode` diam-diam mengembalikan kode lama jika jawaban AI tidak lolos validator, jadi user bisa diberi tahu sukses padahal tidak ada yang berubah.
- `guardRevisedScene` di [scene-check.ts](../src/lib/render/scene-check.ts) memakai `findSceneCrashes(project, [index])` supaya hanya adegan yang direvisi yang dirender. Urutan: cek, 1 perbaikan AI, cek ulang, lalu kembali ke kode sebelum revisi. Kode sebelum revisi tidak dicek ulang karena sudah pernah lolos.
- Berbeda dari job generate, revisi tidak jatuh ke "versi sederhana", karena versi sebelum revisi lebih dekat dengan yang user punya.
- Jika pemeriksa sendiri gagal, misalnya Chrome tidak ada, revisi tetap disimpan dan balasan menyebut cek tidak bisa jalan.
- `validateSceneCode` meloloskan kode yang memakai `useCurrentFrame` tanpa import. Crash seperti ini hanya tertangkap saat render.
- Uji nyata: revisi Gemini 18,7 detik ditambah cek render 6,3 detik. Kasus crash: deteksi, 1 perbaikan Gemini, dan cek ulang selesai dalam 32 detik.

## Revisi chat mengubah narasi dan audio (8 November 2026)

- Alur di [scene-revision.ts](../src/lib/pipeline/scene-revision.ts): Gemini (model Director) memecah permintaan menjadi `voiceoverText`, `kineticHeadline`, dan `visualInstruction`. Narasi baru dibuatkan TTS dulu, karena durasi, subtitle, dan timing mengikuti audio. Tanpa kunci API atau jika jawaban rusak, seluruh permintaan diperlakukan sebagai perubahan visual seperti sebelumnya.
- `retimeSceneCode` mengubah kode hasil `composeImageScene` dan `composeAssetScene` tanpa model: isi `SyncedCaptions`, teks `KineticHeadline`, `buildAssetShots`, `shots` dan `actionCues` yang diskalakan, serta `DataCard` yang dihapus jika angkanya tidak lagi diucapkan. Versi ini menjadi cadangan aman jika perubahan visual membuat crash.
- `generateSceneAudio` menimpa file `scene-N-*.wav` dengan nama yang sama. Karena itu audio lama dibaca ke memori sebelum TTS, dan ditulis kembali jika revisi dibatalkan total.
- Biaya per revisi narasi: 1 panggilan Director tambahan dan 1 TTS adegan. Revisi visual pada Full SVG mahal karena kode adegan bisa 48 KB: uji latar lebih hangat butuh 128 detik.
- Proyek uji ada di `storage/projects/proj_revnarr_story` dan `storage/projects/proj_revnarr_svg`, masing-masing dengan `exports/video.mp4`.

## Isometrik dirombak menjadi gambar AI (8 November 2026)

User menilai video Isometrik 3D buruk. Objeknya tidak menggambarkan yang dibahas dan hanya tampak seperti selang. Semua benda juga berdiri di atas alas, padahal jantung seharusnya tampil di dalam tubuh manusia. Penyebabnya mendasar: balok, silinder, dan blob tidak cukup untuk benda yang dikenali, berapa pun aturannya. User memilih arah "objek digambar AI".

Alur baru di [iso-picture.ts](../src/lib/explainer/iso-picture.ts) dan [IsoPicture.tsx](../src/motion-kit/world/IsoPicture.tsx):
1. Gemini menulis `setting` (tempat nyata subjek, dengan cutaway bila perlu), 2–6 `parts` dengan deskripsi untuk dicari, 0–2 `details` untuk close-up, `flows`, dan beat.
2. Model gambar menggambar dunia di kanvas vertikal. Close-up digambar dengan gambar dunia sebagai acuan gaya.
3. `locateObjects` mencari kotak tiap bagian di gambar dunia. Bagian yang tidak ditemukan memakai bidikan lebar dan dicatat di `worldRepairs`.
4. Panggung memakai kamera gambar Story 2D, ditambah dorongan 3,5% per detik per bidikan, cincin fokus, label, dan titik aliran.

| Uji (job dan export, 9:16) | Rencana | Gambar | Generate | Export | Video | Diam |
|---|---|---|---|---|---|---|
| Jantung | 1 percobaan, 21 detik | 1 gambar, 14 detik | 56 detik | 28 detik | 33,5 detik | 0 |
| Paru-paru | 1 percobaan, 23 detik | 2 gambar, 15 detik | 67 detik | 27 detik | 37,6 detik | 0 |
| Iklan kasir | 1 percobaan, 23 detik | 2 gambar, 16 detik | 85 detik | 15 detik | 28,0 detik | 0 |

Sebelum dorongan kamera ditambahkan, paru-paru ditandai 6 bagian diam dan kasir 2. Biaya gambar sekitar $0,034 per gambar menurut harga resmi, jadi $0,03–0,07 per video ditambah rencana Gemini sekitar 4.000 token masuk dan 3.000 keluar. Tagihan sebenarnya belum dicek.

Temuan:
- `gemini/gemini-3.1-flash-lite-image` sering menggambar adegan hanya di 70% bawah kanvas, dan menyisakan pita polos di atas dengan garis keras. Meminta model mengisi pita itu gagal: model hanya menambah sudut tembok di atas garis yang sama. Sekarang `blankTopShare` mengukur pita, lalu kamera memperbesar dan menggeser gambar agar pita selalu tertutup panel judul.
- `blankTopShare` hanya menghitung pita yang berakhir dengan garis keras di kedua tepi. Subjek yang muncul dari latar polos, seperti dada di latar krem, tidak dihitung. Baris pertama yang berubah sering berupa garis anti-alias, jadi tepinya dibaca 3 baris lebih bawah.
- Larangan teks dan angka di prompt tidak sepenuhnya ditaati. Layar HP pada close-up kasir memuat angka acak seperti "45.00" sebelum aturan layar ditambahkan, dan setelahnya masih ada "0" di kotak. Ini berisiko terbaca sebagai harga karangan.
- Mesin 3D lama (`iso-world.ts`, `iso-plan.ts`, `IsoStage.tsx`) masih ada dan masih diuji, tetapi tidak dipakai job lagi. Hapus jika user menyetujui arah baru.

## Uji gaya 3D seperti video contoh user (8 November 2026)

User mengirim video contoh: 3D sungguhan dengan satu dunia, yaitu HP terbuka di meja dan charger dibelah, dengan model komponen yang detail, cahaya lembut, dan kamera yang menyambung. Panel, subtitle, stiker, dan titik arus di contoh itu sudah dimiliki `WorldOverlay`. Yang kurang adalah kualitas dunia 3D.

Yang sudah dikerjakan:
- `IsoStage` punya `look: 'lit'` dengan cahaya langit dan satu lampu utama, bayangan lembut, balok bersudut bulat (`RoundedBoxGeometry`), dan garis tepi 1,4 px. Mode lama tetap `flat`.
- `buildIsoWorld` dengan `look: 'lit'` membuat meja yang meluas dua kali lebar dunia, jadi tepi alas tidak terlihat.
- Prompt objek buatan manusia diminta 24–44 benda dengan komponen dalam, dan arus listrik memakai kabel tipis.

Temuan:
- Lampu fisik Three.js membagi dengan pi. Langit 1,7 ditambah lampu 1,5 membuat permukaan atas mendekati warna aslinya tanpa terpotong putih. Langit 0,62 ditambah lampu 0,7 membuat semuanya abu-abu gelap.
- Objek yang dipudarkan harus berhenti menjatuhkan bayangan, karena bayangannya muncul sebagai kotak abu-abu tanpa benda.
- Render ulang rencana HP lama dengan mode lit hanya butuh 17 detik untuk 30 detik video, tanpa biaya model.
- Rencana HP baru dengan aturan detail: 33 benda, 2 percobaan, 256 detik, 15.045 token masuk dan 37.754 keluar. Jauh lebih mahal dan lambat dari rencana biasa. Gemini juga memilih tampilan gelap untuk HP, dan kabel tetap tebal walau diminta tipis.
- Router model tidak punya layanan teks-ke-3D: tidak ada satu pun dari 72 model. Model 3D untuk benda organik butuh kunci layanan lain yang belum diputuskan user.

Klip ada di `storage/spike/iso-world/hp-lit/clip.mp4` (rencana lama) dan `storage/spike/iso-world/hp2-lit/clip.mp4` (rencana detail baru).

### DeepSeek Flash sebagai penyusun dunia 3D (8 November 2026)

Diuji atas permintaan user dengan topik kulkas, mode lit, `ds/deepseek-v4.1-flash`.
- Percobaan pertama gagal total dengan "Answer was not JSON". Jawaban kedua kemungkinan terpotong, karena model memakai sekitar dua kali jumlah token untuk berpikir. Probe dengan prompt yang sama memakai 13.437 token keluaran untuk 6.567 karakter teks.
- Percobaan ulang: 2 percobaan dengan jawaban pertama berupa JSON rusak, 128 detik, 11.854 token masuk dan 23.475 keluar.
- 6 benda dibuang karena tidak muat (kipas, termostat, katup ekspansi, dan lainnya), dan 2 beat kehilangan fokus. Kulkas tampil sebagai kotak abu-abu terbuka dengan pintu tergeletak di lantai, sehingga tidak terbaca sebagai kulkas.
- Kesimpulan: untuk dunia 3D, DeepSeek Flash lebih buruk dari Gemini dan jangan dipakai. Klip ada di `storage/spike/iso-world/kulkas-ds/clip.mp4`.

### Perbandingan layanan model 3D (dibaca dari halaman harga resmi, 8 November 2026)

| Layanan | Masukan | Harga per model | Catatan |
|---|---|---|---|
| Tripo langsung | Teks atau gambar | Teks $0,10 tanpa tekstur, $0,20 dengan tekstur. Gambar $0,20–0,30 | 1 kredit = $0,01, isi saldo mulai $1. Gagal tidak ditagih. Syarat layanan melarang menyediakan layanan generasinya ke pengguna akhir tanpa izin tertulis |
| Meshy | Teks atau gambar | 30 kredit (meshy-7.1), 15 kredit (meshy-6-lite) | API wajib Pro Rp350.000/bulan untuk 1.000 kredit. Median waktu sekitar 75 detik untuk bentuk ditambah 80 detik untuk tekstur |
| fal.ai Rodin | Teks atau gambar | $0,40, atau $1,20 dengan HighPack | |
| fal.ai Trellis | Gambar | $0,02 | Bisa dipasangkan dengan model gambar kita, sekitar $0,05 per benda |
| fal.ai Tripo v2.5 | Gambar | $0,20–0,40 | |
| fal.ai Hunyuan3D 2.1 | Gambar | $0,30 | Sudah dihentikan |

Usulan: satu kunci fal.ai untuk membandingkan Trellis, Rodin, dan Tripo pada benda yang sama. Belum diputuskan user.

