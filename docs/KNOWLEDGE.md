# Knowledge gmotion

Catatan keputusan, alasan, dan temuan yang tidak terlihat dari kode. Terakhir diperbarui 8 November 2026.

Status fitur ada di [plan_fitur.md](../plan_fitur.md), sedangkan aturan kerja ada di [CLAUDE.md](../CLAUDE.md).

## Pembaruan alur dan antarmuka (8 November 2026)

- Penyusunan draf kini dimulai di `/studio/new` setelah navigasi dari beranda, bukan menahan pengguna di tombol sampai model selesai. Ide disimpan di `sessionStorage` per request ID; URL tidak memuat prompt. Skeleton menampilkan kerangka, tahap aktif, dan waktu berjalan, tanpa persentase perkiraan. Sukses memakai navigasi replace agar tombol Back tidak mengulang halaman proses.
- Request ID divalidasi dan dikaitkan dengan pemilik. Permintaan bersamaan pada proses server yang sama berbagi pekerjaan; draf yang sudah tersimpan dibuka kembali. Ini belum antrean terdistribusi. Uji browser memakai respons model contoh; 83 test terkait, TypeScript, dan build sumber terpisah lulus. Jangan menjalankan build pada `.next` yang sedang dipakai server dev.
- Revisi saat tahap draf dapat menambah/menghapus/mengurutkan adegan, maksimal 12. Kolom "Instruksi revisi" pada video yang sudah dibuat hanya mengubah adegan yang ada. Menambah adegan dari studio masih rencana, bukan fitur selesai.
- Scrollbar daftar progres disembunyikan khusus pada daftar status adegan; fungsi gulir tetap aktif. Diverifikasi di Chrome pada proyek pelangi enam adegan `proj_1794123988607_cm89`. Daftar panjang dan gulir keyboard belum diuji langsung.
- Arah visual antarmuka ada di `DESIGN.md`; rincian bukti dan batas pemeriksaan ada di `UI-REVIEW.md`. Item baru di plan tetap belum dicentang sampai seluruh verifikasi sesuai aturan proyek terpenuhi.

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
- **Job generate bisa mati saat tahap pemeriksaan akhir** (misalnya server dev dimulai ulang). Project tertahan `generating` dengan semua adegan `ready`, dan UI menampilkan tombol Lanjutkan. Route generate harus tetap menerima status `generating` tanpa job aktif, bukan hanya project yang punya adegan gagal. Kredit tidak terpotong dua kali karena `chargeForVideo` unik per project.
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

## Kamera nyambung Full SVG (9 November 2026)

- Keluhan user pada video gedung tahan gempa: adegan 1 bagus, tetapi pindah ke adegan 2 terasa kasar. Jika yang dijelaskan bagian dari gedung, kamera seharusnya zoom ke bagian itu.
- Penyebab: gedung sudah identik lewat `SHARED-WORLD`, tetapi kamera Full SVG selalu lebar dan diam per adegan, setiap potongan diberi fade, dan penggambar menampilkan detail sebagai "blueprint mat" besar yang menutupi gedung, bukan di lokasi aslinya.
- Aturan dari diskusi dengan user: tempat yang sama berarti kamera nyambung tanpa fade, sedangkan tempat atau jenis gambar yang berbeda berarti fade. Yang menentukan adalah apakah penonton masih di tempat yang sama, bukan apakah ini adegan baru.
- Manifest kini punya `camera: { link, focus }` (opsional, skala 1–4). `scenePath` di [continuity.ts](../src/lib/explainer/continuity.ts) mengambil kamera awal dari adegan sebelumnya. `scenePathCamera` di `AssetStage` menggerakkannya dengan skala log selama 1,3 detik, lalu diam agar aksi terbaca. Adegan tanpa `camera` tetap lebar seperti dulu.
- `generateMainVideoCode` menerima daftar adegan `continue` dan menulis `fadeIn={false}`/`fadeOut={false}` hanya jika dua adegan itu bersebelahan dan keduanya siap. Gambar ulang kritik menyusun ulang adegan berikutnya, karena kamera awalnya ikut berubah.
- Jebakan: arahan "kamera masuk ke bagian yang sama" di prompt director membuat Gemini menulis "Kamera bergerak menembus…" di `voiceoverText` (2 dari 6 adegan). Aturan director sekarang menyatakan arahan kamera hanya untuk visualPrompt. Uji 3 draf, 17 adegan: 0 narasi menyebut kamera, dan 14 visualPrompt memuat gerak kamera.
- Hasil frame `proj_1794187214510_job`: zoom ke sambungan rangka, turun ke fondasi, dan mundur ke gedung utuh terbaca. Tanpa fade, perbedaan gambar di potongan terlihat sebagai lompatan langsung, misalnya bentuk gedung di akhir adegan 1 tidak sama dengan awal adegan 2. Close-up pada zoom 3x masih cukup polos.
- Uji ulang setelah aturan narasi diperbaiki. `proj_1794188942025_job`: narasi bersih, tetapi adegan 1 gagal 2 kali karena koneksi router putus (`fetch failed`) dan jatuh ke versi sederhana tanpa gedung. Bug yang ikut terlihat: adegan 2 tetap disambung tanpa fade ke adegan sederhana itu. Sekarang `continuedScenes` mensyaratkan adegan sebelumnya punya aset, dan `scenePath` hanya mengambil kamera dari adegan yang tepat sebelumnya (`continuity.adjacent`).
- `proj_1794190079962_job` (5 adegan, 70,9 detik, generate 1.048 detik, export 35 detik, tanpa versi sederhana): adegan 2→3→4→5 menyambung rapi dengan gedung yang sama, kamera turun ke fondasi lalu mundur ke gedung utuh. Adegan 1 berupa penampang lempeng tektonik dengan tiga gedung, tetapi adegan 2 memilih `continue` dan mulai dengan satu gedung di tanah polos, sehingga terlihat lompatan. Aturan kamera kini meminta `continue` hanya jika frame akhir adegan sebelumnya sudah memperlihatkan yang dituju dengan gambar yang sama, dan meminta `cut` untuk perpindahan seperti penampang geologi ke gedung. Aturan ini belum diuji dengan video baru.
- Jebakan saat mengedit: server dev mengompilasi `scene-revision.ts` di antara dua langkah edit (pemakaian `continuedScenes` sudah ada, import belum), sehingga `/revise` sempat gagal dengan `ReferenceError`. Tambahkan import dan pemakaian dalam satu edit.

## Draf objek Full SVG digambar per objek (9 November 2026)

- Celah draf objek versi pertama: semua objek dan `WorldBase` digambar dalam satu panggilan 16.000 token dengan arahan "a few recognizable details", tanpa aturan latar penuh dan tanpa kritik. Karena adegan hanya boleh memakai komponen draf, kualitas video dibatasi oleh draf itu. Pratinjau juga tidak menampilkan latar, dan labelnya nama fungsi berbahasa Inggris.
- Alur baru di [story-svg-draft.ts](../src/lib/explainer/story-svg-draft.ts): (1) rencana JSON berisi latar (`label`, deskripsi, `groundY`) dan objek (`label` Bahasa Indonesia, deskripsi, ukuran, prop, close-up beserta skala zoom), (2) `WorldBase` dan tiap objek digambar paralel dalam panggilan masing-masing (24.000 token, minimal 40 bentuk per objek, aturan cahaya berlapis), (3) setiap potongan dirender di server dengan `renderNamedComponents` lalu diperbaiki sekali jika gagal, (4) kartu PNG dinilai Gemini dan kartu dengan skor di bawah 7 digambar ulang sekali. Gambar ulang hanya dipakai jika skornya naik, karena kritik berisik.
- `WorldBase` dicek dengan rasterisasi: 8 titik di x=-1000..2000 dan y=-1000..2000 harus tidak transparan. Ini menangkap latar yang berhenti di tepi kanvas.
- Origin objek ada di tengah alasnya. Id gradien wajib berprefiks `asset-world-<nama>-`, karena potongan digambar terpisah dan bisa bertabrakan.
- Adegan kini hanya menerima komentar header dan tanda tangan tiap komponen (`draftApi`), bukan seluruh blok. Blok asli tetap disisipkan `applySharedWorld`. Draf lama tanpa `plan` tetap mengirim blok penuh.
- Koreksi draf: perencana mengembalikan rencana baru beserta daftar `redraw`. Hanya potongan itu dan objek baru yang digambar ulang.
- Jebakan 1: tanpa contoh bentuk JSON, Gemini menulis `closeups` tanpa field `part`, sehingga rencana gagal. Prompt kini memuat contoh persis.
- Jebakan 2: penampang lempeng tektonik dijadikan objek, lalu tergambar sebagai potongan kotak. Aturan perencana kini memasukkan penampang tanah, laut, dan jaringan tubuh ke latar.
- Jebakan 3: latar menggambar gelombang gempa dan retakan menyala secara permanen, jadi setiap adegan terlihat sedang gempa. Aturan latar kini meminta keadaan tenang; efek ditambahkan animator. Aturan ini belum diuji ulang.
- Uji nyata Gemini, storyboard `proj_1794190079962_job` (gedung tahan gempa, 5 adegan, 9:16), lewat `scripts/spike-object-draft.ts`. Run 1: 322 detik, 2 objek, blok 79 KB, skor kartu 4/5/5, setelah gambar ulang 5/5/6. Run 2 (aturan penampang): 451 detik, 1 objek, blok 56 KB, skor latar 5→6 dan gedung 6. Gambar di `storage/spike/object-draft/`. Latar penuh sampai tepi dan area judul tenang. Gedung punya damper dan isolator dasar yang sama dengan narasi, tetapi masih cukup kaku dan datar, dan lantai atas kosong putih. Biaya belum diukur karena skrip berjalan di luar konteks pencatatan pemakaian.
- Belum diuji: generate penuh sampai MP4 dengan draf baru, dan apakah adegan menempatkan objek dengan benar hanya dari header komponen. Skor kritik hanya penyaring; keputusan kualitas tetap pada user.

## Karakter berubah bentuk saat bergerak (9 November 2026)

- Keluhan user: tangan dan kaki karakter mengecil saat bergerak, dan tidak ada adegan dengan karakter yang berjalan baik. Contoh: `proj_717a9895…` (Londo Ireng, Full SVG dengan draf objek) dan `proj_fb3d1714…` (Mobile Legends, jalur lama tanpa draf objek).
- Penyebab 1: pose dibuat dengan menginterpolasi koordinat path. `PrajuritAfroKNIL` menulis pose 0 dan pose 1 sebagai dua kumpulan titik, lalu menggeser titik lurus di antaranya. Tangan kanan setinggi sekitar 42 unit di `stance = 0` berganti menjadi path lain setinggi sekitar 14 unit di `stance > 0`, dan percabangan `s === 0 ? … : …` membuat bentuk melompat di frame pertama. Interpolasi lurus juga memendekkan lengan di tengah gerakan karena ujungnya memotong jalan pintas, bukan mengikuti busur. Terlihat di MP4 detik 55–57: lengan menjadi gumpalan kecil di dada dan senapan melayang tanpa dipegang.
- Penyebab 2: celana digambar sebagai satu path dari pinggang sampai sepatu, tanpa paha, betis, atau lutut terpisah, jadi pose melangkah tidak mungkin.
- Penyebab 3: berjalan dibuat dengan `translate` X sementara kaki diam, jadi karakter meluncur. Skala instance juga berbeda-beda (`0.52`, `0.72`, `1`).
- Penyebab 4: prompt draf objek hanya meminta "props: only the state or pose changes" dan "Every prop changes the drawing visibly", tanpa aturan sendi. Kode Gemini sendiri berkomentar "2-state rig with Bezier morphing; upgrade to full matrix skeletal hierarchy if run cycle required". `motion-kit` belum punya komponen karakter.
- Di jalur lama (`proj_fb3d…`), lengan ibu di Scene 4 sudah memakai `rotate`, tetapi titik putar ditebak per adegan dan figur digambar ulang per adegan, jadi bentuknya tetap tidak konsisten.
- Keputusan: rig tulang tetap dari kode dengan sendi yang hanya berputar, siklus jalan prosedural, dan fase langkah dari jarak tempuh. Gemini hanya menggambar kulit per bagian tubuh. Rencana ada di [plan_fitur.md](../plan_fitur.md), bagian "Karakter bergerak tanpa berubah bentuk".
- Batasan yang memengaruhi desain: draf objek dan blok shared world tidak boleh memakai impor, dan `renderNamedComponents` hanya menyediakan `React` di `vm`. Rig harus disisipkan sebagai sumber kode ke blok shared world, bukan diimpor dari `@/motion-kit`.
- Fase 0 (spike tanpa AI): `HUMAN_RIG_SOURCE` di [human-rig.ts](../src/lib/explainer/human-rig.ts) berisi dua deklarasi, `HUMAN_RIG` (metrik, `stride`, `solve`, `walkPose`, daftar pose, `Rig`) dan `HumanRig`. Sumbernya tanpa template literal supaya bisa disisipkan sebagai teks. [human-rig-runtime.ts](../src/lib/explainer/human-rig-runtime.ts) menjalankannya di `vm` untuk test dan pemeriksaan; jangan diimpor ke bundle Remotion karena memakai `node:vm`.
- Konvensi sudut: positif berarti ke depan. Anggota tubuh bawah memakai `rotate(-sudut)` dan badan, leher, serta kepala memakai `rotate(+sudut)`. Sudut lengan atas global = sudut bahu − condong badan, karena lengan berada di dalam grup badan. Sudut telapak disimpan global (0 = rata), lalu sendi pergelangan dihitung `telapak − paha − lutut`, supaya campuran pose tidak membuat telapak miring.
- Jalan memakai IK dua tulang, bukan kurva sudut. Dengan kurva sudut, kaki tumpu bergeser karena posisi telapak tidak linear terhadap waktu. Dengan IK, telapak diletakkan di titik yang bergerak lurus mundur selama menapak, jadi diam di dunia jika badan maju `stride` per siklus.
- Jebakan tinggi pinggul: dengan pinggul 0,93 × panjang kaki di tengah langkah, lutut menekuk sekitar 40° dan jalannya tampak jongkok. Nilai kini 0,925 saat dua kaki menapak dan 0,985 di tengah langkah. Panjang langkah 1,2 × panjang kaki supaya kaki depan masih terjangkau saat pinggul terendah.
- Hasil: 7 test lulus, MP4 `storage/spike/human-rig/clip.mp4` (11 detik, render 9–13 detik). Frame diperiksa; menunggu penilaian user.
- Fase 1–3 (10 November 2026): karakter menjadi `kind: 'character'` di rencana draf, digambar sebagai slot kulit lewat `CHARACTER_SYSTEM`, diperiksa dalam 3 pose, dan rig disisipkan ke blok shared world. `HUMAN_RIG.walk` ditaruh di dalam rig, bukan di `@/motion-kit`, karena adegan digerakkan `actionProgress` (bukan frame) dan helper di rig tersedia tanpa impor.
- Jebakan pemeriksaan 1: menolak semua template literal pada path terlalu ketat. Gemini membuat lipatan kain dari array konstanta lewat `.map`, sehingga karakter `Kid` gagal dua kali. Kini hanya path yang memakai prop komponen yang ditolak.
- Jebakan pemeriksaan 2: Gemini kadang memberi default `walkMix = 0`. Pemeriksaan yang hanya mengirim `walkPhase` melihat karakter diam dan meloloskannya. Pose jalan kini dikirim dengan `walkMix: 1` seperti dari `HUMAN_RIG.walk`, dan pose yang hasilnya sama dengan berdiri ditolak.
- Jebakan pemeriksaan 3: raster batas tubuh harus cukup lebar (x −2H..2H, y −2,4H..0,6H). Dengan area sempit, kepala yang tergambar jauh dari sendinya keluar dari area dan tidak terdeteksi.
- Perencana memakai warna palet video untuk kulit ("deep ebony skin (#1C1E24)", warna latar), sehingga serdadu Londo Ireng gelap di atas latar gelap dan wajahnya tidak terbaca. Aturan warna nyata sudah ditambahkan di perencana dan prompt karakter, tetapi belum diuji ulang.
- Model adegan kadang menulis ulang rumus jalan (jarak/langkah) alih-alih memanggil `HUMAN_RIG.walk`. Hasilnya tetap tanpa meluncur saat `walkMix` 1, tetapi `walkMix` buatan sendiri (mulai 0,2) memendekkan langkah di awal jalan sementara badan sudah bergerak penuh.
- Router kadang diam lebih dari 5 menit saat model berpikir panjang, dan `fetch` Node memutus stream (`TypeError: terminated`, `UND_ERR_BODY_TIMEOUT`). Satu panggilan yang putus dulu menggagalkan seluruh draf objek. `callChat` kini mengirim ulang sekali; dalam uji ini terjadi 3 kali dan semua percobaan ulang berhasil.
- Filter keamanan Gemini memblokir adegan remaja berpakaian tidur yang berbaring di ranjang kamar (`finish_reason: content_filter`, jawaban kosong), dua kali berturut-turut. Sebelumnya ini muncul sebagai "Response must contain json and tsx code blocks". Topik anak dan waktu tidur akan sering kena; belum ada solusi.
- Jebakan uji: menjalankan dua proses generate pada proyek yang sama membuat satu proses membaca MP3 yang sedang ditulis ulang (`Invalid ADTS frame length: 0`). Proses `npx tsx … &` dari shell non-latar juga bisa tetap hidup; pakai mode latar belakang dan pastikan hanya satu proses per proyek.
- Waktu nyata dengan karakter: draf objek 594–1.054 detik (termasuk satu kali stream putus dan gambar ulang), generate adegan 491–1.763 detik, export 19–60 detik.
- Bentuk muka (10 November 2026, koreksi user): menyebut "chin and neck joint at (0,0)" membuat Gemini menaruh dagu di atas leher. Dari samping, leher menyambung ke bawah belakang tengkorak dan rahang menjorok ke depan, jadi origin kepala kini di puncak leher di bawah belakang tengkorak, dengan titik wajah dari tinggi kepala. Gemini juga cenderung menggambar rambut sebagai garis tepi sehingga kulit kepala botak terlihat; aturan "satu bentuk isi yang solid" baru berhasil setelah disebut eksplisit. Revisi pertama tanpa aturan itu masih gagal.
- Uji lewat aplikasi di browser (10 November 2026, `proj_5b452444…`, kurir mengantar paket): alur Susun draf → Buat Video → Setujui draf objek → Ekspor MP4 berjalan tanpa campur tangan, draf objek sekitar 5 menit dan 4 adegan sekitar 18 menit. Karakter berjalan dan berganti pose dengan benar, dan aturan kepala baru langsung berhasil tanpa revisi. Celah: rig tidak punya pose membungkuk dan jongkok, sehingga narasi tentang postur tidak bisa digambar dan model adegan malah memperbesar karakter sampai terpotong.
- Mengganti gambar karakter pada proyek yang sudah jadi cukup dengan menukar blok di antara penanda SHARED-WORLD di setiap adegan, karena adegan hanya memanggil komponen lewat prop. Validasi ulang tetap dijalankan sebelum disimpan.

## Persentase progres generate (9 November 2026)

- Permintaan user: pembuatan Full SVG butuh persentase supaya jelas. Sebelumnya bar hanya menghitung adegan selesai, jadi diam di 0% selama draf objek (5–8 menit) dan selama tiap adegan digambar.
- `generationPercent` di [studio-progress.ts](../src/lib/studio-progress.ts): pada Full SVG dengan draf objek, draf mengisi 0–30% dan adegan 30–100%. Bobot tahap adegan: menunggu 0, suara 0,15, menggambar 0,45, selesai atau gagal 1. Selama pemeriksaan akhir angka ditahan di 97%. Gaya lain memakai seluruh bar untuk adegan. Angka 30% diambil dari dua uji draf (322 dan 451 detik) dibanding job Full SVG 10–18 menit, jadi masih perkiraan.
- Draf melapor lewat `DraftProgressListener`: rencana 2%, menggambar 12–71% (naik setiap potongan selesai), menilai, memperbaiki, membandingkan, lalu menyusun 98%. Labelnya Bahasa Indonesia, misalnya "Gedung Tahan Gempa selesai digambar (2 dari 3)".
- Job menyimpan `storySvgDraftProgress` lewat `commit`, jadi stream `events` mengirimnya seperti perubahan lain.
- Jebakan: koreksi draf berjalan sebagai request biasa dan mengecek `updatedAt` di akhir. Progresnya disimpan tanpa mengubah `updatedAt`, supaya tidak memicu 409. Stream `events?draft=1` mengirim perubahan progres walau `updatedAt` sama, dan klien menutupnya saat request koreksi selesai.
- Belum dicek di browser: server dev user sedang berjalan di port 3000, dan server kedua akan berbagi `.next`.

## Pilihan gaya teks oleh user (9 November 2026)

- Sebelumnya director sudah memilih `textStyle` (tegas, teknis, editorial, ramah: pasangan font judul dan subtitle plus ukuran dan animasi masuk), tetapi user tidak bisa melihat atau menggantinya.
- Keputusan: AI tetap memberi saran, user yang memilih dari pasangan yang sudah disetel, bukan font bebas. Font bebas menambah waktu muat render, belum tentu lengkap untuk Bahasa Indonesia, dan bisa membuat judul keluar area aman karena ukuran judul disetel per gaya.
- `TextStylePicker` tampil di layar draf (ikut tersimpan otomatis) dan di tab Storyboard studio. Contoh judul memakai judul adegan pertama dan ditulis dengan font aslinya. Pilihan director ditandai "Disarankan AI" lewat `textStyleSuggested`. Project lama mengisinya dari gaya sebelum perubahan pertama.
- Di studio, `POST /api/projects/[id]/text-style` mengganti prop `textStyle` di setiap `SceneN.tsx` dan membuat ulang `MainVideo.tsx` dari adegan yang sudah diimpor. Tidak ada panggilan model dan tidak memotong kredit. Route ditolak saat generate atau revisi chat berjalan.
- Jebakan: adegan versi sederhana dan CTA dari coder tidak menulis `textStyle`, jadi selama ini memakai Arial walau video bergaya lain. `MainVideo` kini membungkus semua adegan dengan `TextStyleProvider`, dan komponen teks memakai gaya video jika tidak punya prop sendiri.
- Isometrik tidak mendapat pilihan ini, karena video dunianya memakai font sendiri di `PlanVideo`.
- Belum dicek di browser dan belum dirender sampai MP4.

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

## Jatah revisi dan revisi semua adegan (8 November 2026)

- Revisi hanya bisa dilakukan pada video yang sudah dibayar dengan 1 kredit. Karena itu jatah dihitung per video, bukan per user per jam: 20 adegan per video. Angka ini sementara dan ikut diputuskan bersama harga.
- `reserveRevision` memakai `INSERT ... SELECT ... WHERE SUM(units) + n <= batas`. Satu pernyataan SQLite berjalan atomik, termasuk di D1 HTTP, jadi dua request paralel tidak bisa sama-sama lolos.
- Hasil yang tidak berubah atau dikembalikan tetap memakai jatah, karena panggilan AI sudah terjadi. Jatah hanya dikembalikan jika request melempar error.
- `reviseScenes` menyiapkan adegan paralel, tetapi cek render dilakukan sekali untuk semua adegan. `bundleProject` menulis ke satu folder `build-src`, jadi cek render per adegan tidak boleh berjalan paralel.
- Planner diberi tahu nomor adegan ("scene 3 of 5") dan boleh menjawab semua `null` jika permintaan jelas untuk adegan lain.
- Proyek uji ada di `storage/projects/proj_revall_story` dengan `exports/video.mp4`.

## Uji browser revisi chat (8 November 2026)

- Diuji di Chrome dengan akun user pada salinan proyek `proj_revall_story`, yang `ownerId`-nya diisi akun user. Proyek tanpa pemilik menjawab 404 kecuali email user sama dengan `LEGACY_PROJECT_OWNER_EMAIL`.
- Revisi visual oleh Gemini menulis ulang format kode adegan: atribut jadi multi-baris, string biasa, dan objek JS bukan JSON. Gemini juga sempat membuang prop `labelBackground` dan `labelText` dari `ImageStage`. Karena itu `retimeSceneCode` kini membaca atribut JSX dengan pemindai kurung dan string, bukan mencocokkan teks persis.
- Chat editor menampilkan teks polos, jadi balasan tidak boleh memakai markdown seperti `**`.
- Pesan user sekarang langsung tampil saat dikirim (`pendingMessage`), lalu digantikan riwayat tersimpan saat balasan masuk. Chat bergulir otomatis ke pesan terakhir. Diuji di Chrome: tidak ada pesan dobel, dan posisi gulir tetap di bawah setelah balasan masuk.

## Bahan posting sosmed (8 November 2026)

- Keputusan: belum ada upload langsung. TikTok Content Posting API membatasi aplikasi yang belum diaudit ke posting privat. Instagram Content Publishing butuh akun profesional, review Meta, dan URL video publik. Aplikasi YouTube yang belum diverifikasi juga mengunggah sebagai privat. Upload langsung juga berarti menyimpan token OAuth sosmed tiap user.
- Yang dibuat: caption dan hashtag untuk TikTok / IG, serta judul, deskripsi, dan tag untuk YouTube, semuanya dalam satu panggilan Director. Ada pula tombol Bagikan lewat `navigator.share` dan nama file dari judul. Helper yang dipakai browser ada di `src/lib/social/format.ts`, terpisah dari `share.ts` supaya klien AI tidak ikut ke bundle browser.
- Tag YouTube dihitung seperti YouTube menghitungnya: daftar koma, dan tag berspasi dianggap bertanda kutip.
- Uji Gemini pada video kopi: caption, judul "Proses Pengolahan Kopi Nusantara dari Kebun ke Cangkir", dan 7 tag hanya memakai isi narasi, tanpa CTA karena prompt bukan iklan.

## Ubah draf dengan AI (8 November 2026)

- `reviseDraft` di [draft-revision.ts](../src/lib/pipeline/draft-revision.ts) meminta draf utuh kembali, bukan potongan perubahan. Adegan dicocokkan lewat `id`. Setiap id lama hanya boleh dipakai sekali, supaya model tidak bisa menggandakan adegan dengan id yang sama.
- Versi sebelum perubahan disimpan di `draftBeforeRevision` untuk Kembalikan. `PATCH` manual menghapusnya, karena Kembalikan setelah edit manual akan membuang edit itu.
- Klien menyimpan editan yang tertunda sebelum meminta AI, karena server merevisi versi yang tersimpan. Jawaban server dimuat dengan `skipNextSave`, supaya tidak dihitung sebagai edit manual dan tidak menghapus Kembalikan.
- Draf masih gratis, jadi jatahnya per draf (10 kali), bukan dari kredit. Pembuatan draf awal sendiri belum dibatasi.

## Catatan biaya AI untuk admin (8 November 2026)

- Semua chat AI SDK lewat `resilientFetch` di [llm-client.ts](../src/lib/ai/llm-client.ts), jadi token dicatat di sana tanpa mengubah tiap pemanggil. Tiga titik lain: `callChat` (aset, streaming dengan `include_usage`), `generateImage`, dan TTS router.
- Konteks dibawa `AsyncLocalStorage` ([usage.ts](../src/lib/billing/usage.ts)). `runWithUsage` di route generate membungkus `runGeneration`, dan konteksnya ikut ke semua promise job meski request sudah selesai.
- `recordUsage` tidak pernah melempar error dan tidak ditunggu. Database yang bermasalah tidak boleh menggagalkan video.
- Rupiah dihitung saat query: setiap baris memakai tarif terbaru untuk modelnya yang `effective_from`-nya sebelum permintaan. Model tanpa tarif bernilai NULL dan ditandai "belum bertarif", bukan Rp0 diam-diam.
- Percobaan gambar yang gagal tetap dicatat, dengan 0 gambar, karena sebagian penyedia menagih permintaan yang ditolak.
- Contoh nyata: caption Gemini `ag/gemini-3.8-flash-high` memakai 3.263 token masuk dan 1.118 token keluar dalam 9,3 detik. TTS Gemini untuk 5 adegan memakai 969 karakter.
- Tarif awal diisi 8 November 2026 dari harga resmi, dibaca langsung lewat Chrome karena WebSearch error. Kurs JISDOR Bank Indonesia 6 November 2026: Rp18.130 per dolar. Tarif berlaku mundur ke 7 November karena harga resmi hari itu sudah tercatat sama.

| Model di router | Harga resmi | Tarif rupiah |
|---|---|---|
| `ag/gemini-3.8-flash-high` dan `gemini/gemini-3.8-flash` | $0,75 masuk, $3,75 keluar per 1 jt token ([Google](https://aistudio.google.com/docs/pricing)) | Rp13.598 dan Rp67.988 per 1 jt token, naik 2 kali lipat mulai 1 Januari 2027 dan sudah dijadwalkan |
| `gemini/gemini-3.1-flash-lite-image` | $0,0336 per gambar 1K | Rp609 per gambar |
| `gemini/gemini-2.5-flash-preview-tts` | $0,50 per 1 jt token teks, $10 per 1 jt token audio, 25 token per detik | Rp325.796 per 1 jt karakter |
| `ds/deepseek-v4.1-flash` | $0,30 masuk, $1,20 keluar per 1 jt token, tarif jam sibuk ([DeepSeek](https://api-docs.deepseek.com/quick_start/pricing)) | Rp5.439 dan Rp21.756 per 1 jt token |

- TTS ditagih per token audio, sedangkan kita mencatat karakter. Dari 247 adegan bernarasi: 0,0714 detik audio per karakter, sekitar 1,78 jt token audio per 1 jt karakter, ditambah perkiraan 1 token teks per 4 karakter. Hasilnya $17,97 per 1 jt karakter.
- Ini perkiraan biaya jika memakai API resmi, bukan tagihan router. Jalur `ag/` memakai kuota langganan, dan router bisa menambah token sendiri. Cocokkan dengan tagihan nyata sebelum menetapkan harga.
- Contoh: video Full SVG 5 adegan "Celah Penyadapan Komunikasi Pejabat Negara" menghabiskan sekitar Rp7.891 untuk draf, ubah draf, TTS, dan sebagian gambar adegan. Gemini 3.8 Flash adalah biaya terbesar, dan TTS 5 adegan hanya Rp316.

## Suara ElevenLabs (8 November 2026)

- Pilihan di layar draf: Gemini (1 kredit) atau ElevenLabs (2 kredit). Tambahan 1 kredit adalah angka sementara di `ELEVENLABS_EXTRA_CREDITS`. Pilihan disimpan sebagai `storyboard.voiceProvider` dan dipakai generate, coba ulang, serta revisi narasi.
- Endpoint `/v1/text-to-speech/{voice}/with-timestamps` mengembalikan waktu per karakter. `alignmentToWordTimings` mengubahnya menjadi timing per kata, jadi subtitle mengikuti suara asli, bukan pembagian rata. Jika jumlah kata tidak cocok, dipakai perkiraan lama.
- Jika ElevenLabs gagal, adegan ditandai gagal. Tidak ada fallback ke Gemini, karena user sudah membayar suara ElevenLabs.
- Kunci ElevenLabs bisa dibatasi per izin. Kunci user saat ini hanya punya `text_to_speech`. Tanpa `voices_read`, pilihan hanya berisi suara `ELEVENLABS_VOICE_ID` dan tombol Dengar disembunyikan.
- Uji satu kalimat 84 karakter: `eleven_multilingual_v2` 3,2 detik (header `character-cost` 34), `eleven_flash_v2_5` 0,3 detik (17). Timing per kata cocok untuk 13 dari 13 kata.
- Uji video roti 5 adegan: 6 permintaan untuk 824 karakter, 1 gagal lalu berhasil saat dicoba ulang. Generate berjalan paralel 4 adegan, jadi batas konkurensi akun ElevenLabs bisa tersentuh.
- Penilaian user setelah menonton video roti: suara Gemini masih lebih bagus. Yang diuji baru satu suara (`ELEVENLABS_VOICE_ID`) dengan `eleven_multilingual_v2` dan pengaturan bawaan. Suara penutur asli Indonesia dari Voice Library dan model `eleven_v3` belum dicoba.
- Harga API resmi ([elevenlabs.io/pricing/api](https://elevenlabs.io/pricing/api)): v2 Multilingual $0,08 dan Flash/Turbo $0,04 per 1.000 karakter, yaitu Rp1.450.400 dan Rp725.200 per 1 jt karakter. Ini sekitar 4,5 kali TTS Gemini (Rp325.796). Untuk video 5 adegan sekitar 1.000 karakter, biayanya sekitar Rp1.450, dibanding Rp320 dengan Gemini.

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

### Opus 5.5 sebagai penyusun dunia 3D (8 November 2026)

Diuji atas permintaan user, mode lit, `cc/claude-opus-5-5`, dengan topik HP dan kulkas agar bisa dibandingkan langsung dengan Gemini dan DeepSeek.

| Topik | Percobaan | Waktu rencana | Token masuk / keluar | Benda | Perbaikan |
|---|---|---|---|---|---|
| HP | 2 | 92 detik | 17.001 / 10.317 | 28 | tidak ada |
| Kulkas | 2 | 148 detik | 17.875 / 16.101 | 24 | tidak ada |

- Kedua jawaban pertama ditolak hanya karena satu `value` dikirim sebagai teks, bukan angka. Percobaan kedua lolos.
- Dibandingkan Gemini (hp2-lit: 256 detik, 37.754 token keluar), Opus lebih cepat dan memakai token keluar jauh lebih sedikit. Biaya dalam dolar belum dihitung karena harga router untuk Opus belum dicek.
- HP: paling rapi dari semua uji. Bingkai, papan hijau, baterai, chip, dan kepala charger terbaca, warnanya terang, dan kabelnya tipis. Tapi bentuknya tetap balok dan masih jauh dari video contoh user.
- Kulkas: lebih lengkap dari DeepSeek. Kompresor, kondensor, dan pipa ada, dan tidak ada benda yang dibuang. Tapi kulkas tetap tampil sebagai kotak terbuka, dan dua bidikan dekat (panas pindah, termostat) hanya menampilkan dinding atau satu pipa.
- Kesimpulan: model AI yang lebih kuat memperbaiki susunan, tapi tidak mengubah batas utamanya, yaitu bentuk yang disusun dari primitif. Klip ada di `storage/spike/iso-lit/hp-opus.mp4` dan `storage/spike/iso-lit/kulkas-opus.mp4`.

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

## Spike gaya pixel art (8 November 2026)

- Gaya gambar sebelumnya ditulis tetap sebagai flat vector di `sceneImagePrompt`. Sekarang baris jenis dan gaya diambil dari `ART_STYLES` menurut `storyboard.artStyle`, dan aturan tata letak serta larangan teks tetap sama untuk semua gaya.
- Model gambar memang bisa menggambar pixel art, tetapi kotaknya lunak dan tidak rata. Grid tidak diserahkan ke prompt: `pixelate` mengecilkan gambar ke 180 kotak lebar (9:16), mengurangi warna menjadi 32, lalu membesarkan lagi dengan `nearest`. State adegan tetap digambar dari gambar asli model dan baru dipaskan ke grid di akhir, supaya grid tidak memengaruhi gambar berikutnya.
- Jebakan: `sharp` 0.35.5 di mesin ini mengabaikan `png({ palette: true, colours })` dan `gif({ colours })`, dan hasilnya tetap 255–256 warna walau `imagequant` terpasang. Karena itu palet dihitung sendiri dengan k-means 8 putaran yang benihnya diambil merata menurut kecerahan, jadi hasilnya deterministik. Biayanya kecil karena hanya sekitar 58 ribu piksel.
- Jebakan: `scripts/spike-image.ts` dulu tidak mengirim kanvas kosong sebagai referensi, sehingga rute `gemini/` mengembalikan gambar lanskap 1408×768. Pada video 9:16 gambar itu dipotong tengah dan sebagian besar isinya hilang. Skrip sekarang mengirim `blankCanvas` seperti pipeline asli.
- Hasil uji (run kedua, `proj_spike_image_1794126229695`): 5 gambar 768×1376 dalam 9 detik, render 43 detik, total 98 detik. Gaya 16-bit konsisten antar-adegan. Masalah yang terlihat: jam bertuliskan "23:00", tulisan kecil di chip, font judul dan subtitle tidak bergaya pixel, dan adegan suhu panas menggambar api di sekitar bantal sehingga terkesan berlebihan.
- Belum dicoba: font pixel untuk judul dan subtitle, pilihan gaya di UI, rasio 4:5 dan 16:9, serta topik lain.
- Disambungkan ke aplikasi (8 November 2026): pilihan hanya untuk Story 2D Campuran, karena hanya preset itu yang menggambar adegan dengan model gambar (`supportsArtStyle`). Server memaksa `flat` untuk preset lain, supaya pilihan tidak diabaikan diam-diam. Adegan `svg` dibangun dari bentuk vektor datar dan akan merusak gaya, jadi video pixel art menggambar semua adegan dengan model gambar, termasuk saat planner gagal (`singlePictureScene`). Konsekuensinya biaya gambar per video naik, karena adegan diagram juga memakai model gambar.

## Registry aset dan kebijakan library-first (8 November 2026)

- Keputusan: semua gaya diarahkan memakai aset terdaftar, tetapi transisinya bertahap. Default sementara `library-first`: objek yang ada di registry wajib memakai aset, sedangkan objek yang belum ada boleh memakai jalur lama asalkan ditandai di draf dan dicatat. `library-only` diterapkan per gaya setelah tingkat fallback-nya rendah. Alasan: katalog awal hanya mobil dan jalan, jadi `library-only` langsung akan menolak sebagian besar prompt. Perkiraan urutan: Ads, lalu Isometrik, lalu Story 2D.
- Registry ada di `src/lib/assets/`. Model hanya memilih ID, versi, varian, prop, anchor, dan aksi. Schema prop Zod dibangun dari metadata registry dengan `.strict()`, jadi prop yang tidak dikenal (misalnya `onClick`) dan warna non-hex ditolak, bukan diteruskan ke SVG.
- Anchor registry merujuk langsung ke `ISO_CAR_ANCHORS` dan `ISO_ELECTRIC_CAR_ANCHORS`, bukan salinan angka, sehingga geometri dan registry tidak bisa berbeda. Varian listrik tidak punya anchor `fuelTank`, dan varian bensin tidak punya `tractionBattery`.
- Prop per varian: `engineRotation` hanya untuk bensin, sedangkan `motorRotation`, `batteryCoverOpacity`, `chargePortOpen`, `energyFlow`, dan `energyPhase` hanya untuk listrik. Aksi hanya boleh menargetkan prop angka yang `animatable`.
- Jalan hanya boleh ditempatkan lewat layout `road`. Anchor tengah lajur bergantung pada jumlah lajur dan belum diekspos.
- Pencarian katalog mencocokkan kata utuh setelah normalisasi, jadi "Seven" tidak cocok dengan alias "ev". Kata varian saja ("EV", "bensin") sudah menunjuk ke asetnya. Kecocokan nama belum berarti mekanismenya didukung; pemanggil tetap harus memeriksa `capabilities`.
- Belum ada: renderer rencana, pemisahan material internal menjadi token tema, dan sambungan ke director, generate, atau revisi.

## Uji pertama video dari aset mobil (8 November 2026)

- Alur uji: `scripts/spike-asset-plan.ts`. Prompt dicocokkan ke katalog, lalu Gemini (`ag/gemini-3.8-flash-high`) menyusun rencana JSON dari subset katalog. Rencana divalidasi `validateAssetPlan`, narasi dibuat dengan TTS, waktunya disesuaikan dengan `retimePlan`, lalu dirender oleh `PlanVideo` (`src/motion-kit/assets/`). Model tidak menulis SVG atau kode. `--reuse` merender ulang rencana tersimpan tanpa memanggil model atau TTS.
- Hasil (topik "Apa beda mobil listrik dan mobil bensin?", 9:16): dua run, masing-masing 5 adegan, 29–33 detik video, total 90–98 detik termasuk rencana 47–58 detik dan render sekitar 11 detik. Kedua run memakai varian yang benar: tangki dan mesin di bensin, baterai dan motor di listrik. Tidak ada komponen tertukar dan tidak ada angka karangan. Klip ada di `storage/spike/asset-plan/ev/` dan `ev2/`.
- Validator bekerja sebagai pengaman. Percobaan pertama kedua run ditolak karena contoh struktur di prompt lupa mencantumkan `instances` per adegan; Gemini memperbaikinya dari daftar error pada percobaan kedua. Contoh struktur di prompt sudah diperbaiki.
- Jebakan tata letak yang ditemukan dari frame: (1) label yang diletakkan di atas titiknya membuat garis penunjuk bersilangan, sehingga "Tangki bensin" tampak menunjuk mesin. Sekarang label ditaruh di tepi layar pada sisi titiknya, dan garis digambar lebih dulu dari kotak label. (2) Close-up zoom 1,9× memotong mobil terlalu banyak; sekarang 1,55× dan hanya bergeser sebagian ke tengah. (3) Dua mobil di jalan saling menutupi; sekarang lajur digeser maju-mundur 150 unit. (4) Label yang sama dengan nama mobil di layout `side-by-side` disembunyikan.
- Gerakan yang menyangkut fisika diambil alih renderer: di jalan, putaran roda selalu dihitung dari `distance`, dan `energyPhase` dihitung dari frame (tidak lagi `animatable`). Gemini sempat memilih `energyPhase` 0→250 dalam 6 detik (titik berkedip) dan roda berputar berlawanan dengan arah jalan. Aliran energi disembunyikan pada tampilan `exterior` karena tergambar di atas bodi.
- Masih terlihat: narasi kadang menyebut hal yang tidak bisa ditampilkan aset ("mobil listrik lebih senyap"), caption tampil satu kalimat penuh tanpa sorotan kata, area atas layar banyak kosong, dan belum ada judul atau transisi kamera antaradegan. Kualitas akhir belum dinilai user.

## Paket E pertama: pemilahan sampah (8 November 2026)

- `IsoWasteSorting`, registry `environment.waste-sorting@0.1.0`, status experimental.
  Tiga wadah dan objek daun/kertas/botol dengan tujuan tetap; `progress` 0–1
  menggerakkan objek secara deterministik. Warna wadah per instance bisa diedit;
  ikon tetap membedakan kategori. Anchor berasal dari komponen, bukan salinan registry.
- `PlanVideo` mendukung aset ini pada single, side-by-side, dan close-up; layout
  road menolak objek selain mobil dan jalan. Ukuran objek dibatasi tinggi panggung
  agar bidikan 16:9 tidak terpotong atau menimpa caption.
- Bukti: `npx tsx scripts/assets/preview-waste-sorting.tsx` berhasil mengekspor
  MP4 6 detik, tiga adegan tanpa audio, dan sembilan frame pada 9:16, 4:5, 16:9.
  Hasil lokal: `storage/assets/waste-sorting/`. Frame perwakilan ketiga rasio diperiksa.
  23 uji registry/pemilahan lulus, typecheck dan lint file terkait lulus.
  Tidak ada panggilan model, TTS, gambar eksternal, atau angka data dekoratif.
- Batasan: ilustrasi kategori, bukan standar warna pengumpulan setempat atau
  jaminan daur ulang. Belum ada sungai, pengolahan air, mesin sortir, aset 2D,
  organ, toko, ekonomi, karakter, maupun alur prompt/studio/simpan/reload.

## Gerak bawaan renderer aset (8 November 2026)

- Masalah dari uji pertama: video terasa statis. Gemini hanya memilih putaran puli atau poros motor yang terlalu kecil untuk terlihat, sedangkan renderer belum punya gerak sendiri dan perubahan tampilan terjadi seketika.
- Gerak yang sekarang diurus `PlanVideo`, semuanya dihitung dari frame:
  - Kamera: setiap bidikan memakai push-in pelan (`drift`), lalu condong dan zoom ke titik tengah label fokus antara detik 0,4 dan 1,8. Kekuatannya per layout ada di tabel `CAMERA`. Label dipetakan dengan transformasi yang sama, jadi garis penunjuknya tetap menempel ke anchor.
  - Mobil masuk: mobil yang tampil pertama kali melaju masuk di sepanjang sumbu depannya selama 1,1 detik dengan roda berputar. Mobil kedua terlambat 0,25 detik. Nama mobil di layout `side-by-side` tetap di posisi akhirnya dan baru muncul setelah mobil tiba.
  - Transisi tampilan: `sceneStates` mencatat keadaan masuk adegan, dan `viewTransition` memudarkan bodi selama 0,9 detik. Dari `exterior` ke `cutaway`, bodi memudar sampai 10% lalu berganti tampilan, supaya tidak ada lompatan.
- Validator punya opsi `requireVisibleChange`. Setiap adegan wajib punya aksi yang bukan `subtle`, perubahan `view`, layout `road`, atau objek yang tampil pertama kali. `wheelRotation`, `engineRotation`, dan `motorRotation` ditandai `subtle` di registry.
- Hasil `ev3` (topik sama): rencana lolos di percobaan pertama (33 detik), video 33 detik, total 79 detik. Setiap adegan bergerak: kap terbuka saat intro, bodi memudar ke sasis lalu roda memudar, tutup baterai terbuka, dan mobil melaju di jalan dengan aliran energi.
- Celah yang tersisa: aksi `bodyOpacity` pada tampilan `chassis` dihitung sebagai perubahan terlihat padahal bodinya sudah tersembunyi. Narasi juga masih bisa menyebut hal yang tidak tampil, misalnya gas buang.
- Catatan kerja bersamaan: pada sesi yang sama, ada pekerjaan lain yang menambahkan `environment.waste-sorting` (`IsoWasteSorting`) ke registry dan `PlanVideo`. Uji snapshot registry sekarang memakai `toMatchObject`.

## Lanjutan paket Lingkungan: sungai dan pengolahan air (8 November 2026)

- Registry experimental: `environment.water-channel@0.1.0` dengan river/canal
  yang geometrinya berbeda, serta `environment.water-treatment@0.1.0` dengan
  koagulasi/flokulasi digabung, pengendapan, filtrasi, dan simbol disinfeksi.
  Rujukan proses: https://www.cdc.gov/drinking-water/about/how-water-treatment-works.html
  (diakses 8 November 2026). Semua geometri SVG dibuat lokal; tidak menyalin gambar.
- API: warna air/tebing/bak per instance, `flowPhase`, `flowing`, `settling`,
  anchor dunia untuk masukan/keluaran dan proses. Animasi dari frame/rencana;
  tidak memakai timer, random, atau ID SVG. Penanda mengikuti jalur; partikel
  pengendapan bergerak ke bawah. Tidak ada angka kapasitas/debit/mutu rekaan.
- Renderer memakai komponen terdaftar; entrance mobil dibatasi ke mobil agar
  sungai/bak tidak meluncur masuk dan menerima prop roda. Bidikan lingkungan
  memakai margin kamera lebih lebar. Label di dekat atas layar digeser bersama
  agar tidak terpotong dan tetap terpisah, diuji dengan empat label dua sisi.
- Bukti: `scripts/assets/preview-water-environment.tsx` menghasilkan rencana
  tervalidasi, MP4 18 detik tanpa audio, serta 18 frame di tiga rasio. Run akhir
  18.54 detik termasuk bundling, still, dan export, tanpa panggilan model/gambar/TTS.
  Hasil: `storage/assets/water-environment/`, termasuk `evidence.json`.
  Enam adegan pada tiga rasio diperiksa; label 16:9 dan tepi 9:16 diperbaiki,
  lalu diperiksa ulang. 37 uji pada lima file terkait lulus, typecheck dan lint
  file terkait lulus; bukan klaim suite penuh aplikasi.
- Batasan: skema pengolahan air permukaan, bukan air limbah atau bukti air layak
  minum. Tidak ada dosis, hidraulika, pompa, backwash, atau penanganan lumpur.
  Sungai dan instalasi belum terhubung fisik otomatis. Belum ada aset 2D atau
  verifikasi prompt/studio/revisi/simpan/reload. Tetap experimental.

## Draf aset dan halaman admin pustaka (8 November 2026)

- Keputusan user: permintaan yang belum didukung pustaka menjadi **draf aset** di admin. Admin memperbaiki kualitasnya sebelum menerbitkan, dan permintaan tidak pernah langsung menjadi aset global. Alasannya: aset buatan AI yang langsung dipakai mengulang masalah jalur lama (bentuk balok atau blob yang berubah-ubah), kebenaran mekanismenya tidak bisa dicek validator, dan aset global harus jelas lisensinya.
- Laporan cakupan: rencana punya kolom `unsupported` (subjek, jenis objek/aksi/lingkungan, alasan). Prompt meminta model melaporkan hal yang tidak bisa ditampilkan, berdasarkan kemampuan dan batasan aset, bukan sekadar nama, dan tidak membahasnya di narasi. Uji "Mobil listrik melaju, belok di tikungan, lalu berhenti di lampu merah": rencana lolos di percobaan pertama (63 detik) dan melaporkan tikungan (lingkungan), belok (aksi), serta lampu merah (objek). Video tetap jadi (20 detik) tanpa pengganti palsu. Klip ada di `storage/spike/asset-plan/belok/`.
- Sebelum kolom ini ada, prompt hanya berkata "jangan bahas yang tidak ada di katalog", sehingga permintaan user hilang diam-diam.
- Data: `asset_requests` (satu baris per subjek per rencana, subjek dinormalkan huruf kecil dan spasi tunggal) dan `asset_drafts` (status `draft`, `review`, `published`, `rejected`; `UNIQUE(asset_id, version)`). Draf yang ditolak tetap memegang `asset_id`-nya, jadi percobaan baru mendapat akhiran `-2`. Pencatatan permintaan tidak pernah menggagalkan video.
- `plan-schema.ts` tidak boleh mengimpor `library-db.ts`, karena `PlanVideo` ikut dibundel Remotion dan `library-db` memakai `node:crypto` dan database. Skema kolom (`CoverageGapSchema`) ada di `plan-schema`, dan `library-db` memakainya ulang.
- Preview admin memakai `ASSET_RENDERERS` bertipe `Record<AssetRendererKey, …>`, sehingga aset dengan renderer baru membuat type check gagal sampai preview-nya ditambahkan.
- Uji Chrome `/admin/assets` dengan akun admin (8 November 2026): ketiga tab, Jadikan draf, Tolak, dan Pulihkan berjalan. Server dev di port 3000 memakai `storage/gmotion.db` yang sama dengan skrip, dan tabel baru sudah dibuat oleh migrasi saat skrip berjalan.
- Jebakan preview: setiap renderer yang membedakan varian lewat prop (`IsoCar` lewat `powertrain`, `IsoWaterChannel` lewat `variant`) harus dipetakan di `variantRendererProps`. Kalau tidak, semua varian tampil sama. Test membandingkan markup antarvarian untuk setiap aset yang punya lebih dari satu varian.
- Saat uji, satu klik mengenai baris yang salah karena halaman sudah berpindah tab, sehingga terbentuk draf `draft.tikungan@0.0.1` yang tidak diminta. Draf itu dibiarkan untuk diputuskan user.

## Teks opsional pada rencana aset (8 November 2026)

- `presentation` opsional pada rencana dan adegan: `captions`, `labels`, `names`
  berupa boolean, divalidasi schema strict. Override adegan menang atas rencana;
  nilai yang tidak diisi tetap true untuk kompatibilitas demo/rencana lama.
- `PlanVideo` memisahkan caption narasi, callout (teks/garis/titik), dan nama otomatis
  layout berdampingan. Tanpa caption, panggung memakai tinggi 84% dan dipusatkan
  kembali. Fokus kamera tetap mengikuti anchor meski label dimatikan.
- Teks tidak masuk geometri atau registry material aset. Menyembunyikannya tidak
  menghapus narasi/audio, mengubah aksi, atau memanggil ulang TTS/model/gambar.
  JSON reload dan `retimePlan` mempertahankan pengaturan video serta adegan.
- Bukti: 42 uji pada enam file terkait lulus (termasuk render React dengan dan
  tanpa teks, override adegan, audio tetap ada, reload, retiming, validasi),
  typecheck dan lint file terkait lulus. Bukan pemeriksaan lengkap aplikasi.
- `npx tsx scripts/assets/preview-water-environment.tsx --no-text` menghasilkan
  MP4 18 detik tanpa audio, 18 PNG, plan.json, evidence.json di
  `storage/assets/water-environment/no-text/`. Run 21.06 detik, tanpa panggilan
  model/gambar/TTS. Frame perwakilan 9:16, 4:5, dan 16:9 diperiksa tanpa teks
  terlihat. Demo berteks tidak ditimpa. Belum tersedia kontrol pengaturan di studio.

## Paket Usaha: toko, rak, kasir, kemasan dan POS (8 November 2026)

- Lima entri experimental `0.1.0`: `business.shop`, `business.shelf`,
  `business.checkout`, `business.product`, `business.pos`. Komponen lokal di
  `IsoShop.tsx`; metadata di `src/lib/assets/business.ts`. Geometri buatan GMotion,
  proprietary untuk penggunaan komersial; tanpa gambar/model/brand eksternal.
- Toko exterior/cutaway, pintu berengsel dan handle; rak tiga tingkat dengan 0–6
  slot ilustratif; meja kasir dengan scanner, gerak produk dan laci; kemasan
  box/bottle/can yang berbeda bentuk; layar POS mati/menyala dengan baris abstrak.
  Material per instance, anchor publik dan aksi tercatat di katalog. Bentuk di
  interior toko memakai komponen bagian yang sama dengan aset standalone.
- PlanVideo kini memilih dari map ASSET_RENDERERS yang juga dipakai preview admin,
  sehingga renderer baru tidak perlu didaftarkan ke dua map. Anchor kemasan
  mengikuti lift. Aturan energyFlow exterior dibatasi ke mobil agar prop mekanik
  tidak bocor ke toko. Alias produk tidak memakai kata Inggris umum "can".
- Tidak ada caption, merek, harga, nominal uang, QR, struk, atau total transaksi
  bawaan. POS aktif tidak berarti pembayaran berhasil. Label dan harga mengikuti
  konten adegan. Gerak scan tidak mengubah inventori atau memproses pembayaran.
- `npx tsx scripts/assets/preview-business.tsx`: MP4 tanpa teks/audio 24 detik,
  sembilan adegan, 27 frame di tiga rasio, plan.json dan evidence.json di
  `storage/assets/business/`. Run 25.93 detik termasuk bundle/still/video;
  panggilan model/gambar/TTS nol. Semua frame ditinjau dalam contact sheet;
  storefront dan kemasan diperiksa juga pada ukuran asli. Tidak ada bagian terpotong.
- 55 uji pada delapan file terkait lulus, termasuk seluruh renderer/varian pada
  preview admin, validasi, pencarian, properti, keadaan dan determinisme.
  Typecheck dan lint file terkait lulus; bukan klaim pemeriksaan lengkap aplikasi.
- Batasan: belum aset 2D, manusia/genggaman, pickup/restock, transaksi nyata,
  susunan toko bebas, atau alur studio prompt/revisi/simpan/reload sampai export.
  Status tidak dinaikkan menjadi ready. Paket Tubuh, Ekonomi, dan Manusia tetap backlog.

## Kurasi draf aset dengan AI (8 November 2026)

- Kontrak draf: komponen default export yang mengembalikan satu `<svg viewBox="0 0 760 480">`, hanya boleh mengimpor `react` dan `@/motion-kit/isometric/draft-kit`. Kit ini berisi proyeksi pustaka (`projectPoint`, `points`), `Surface`, `Block`, `Pipe`, `Bolt`, `Cylinder`, `SideDisc`, dan `shade`. Varian dikirim sebagai prop `variant`. Metadata (`DraftMetaSchema`) memuat varian, prop keadaan/angka/warna, titik label, kemampuan, dan batasan.
- `validateSceneCode` sekarang menerima `allowedImports`: daftar persis tanpa impor relatif, dipakai untuk draf bersama `svgOnly`.
- Render pratinjau di server memakai `node:vm` (`codeGeneration.strings: false`), dengan satu skrip dan batas 1 detik per render. Setelah satu render melebihi batas, render sisanya dilewati. Uji loop tanpa akhir sempat menahan 12 detik saat batas waktu dihitung untuk semua keadaan sekaligus. VM bukan batas keamanan; kode masuk ke sana hanya setelah lolos validator, dan hanya admin yang bisa memicunya.
- Jebakan: Next.js 15 menolak `react-dom/server` di kode app router, termasuk route handler ("You're importing a component that imports react-dom/server"). Test Vitest tidak menangkapnya; error baru muncul saat server dev mengompilasi route. Solusinya `renderSvgMarkup`: serializer kecil untuk elemen SVG dan komponen fungsi murni. Hook, context, dan class component gagal di sana, sesuai kontrak draf.
- SVG draf disimpan bersama versinya dan ditampilkan sebagai `<img src="data:image/svg+xml;base64,…">`. Gambar SVG tidak menjalankan skrip, jadi kode buatan AI tidak pernah berjalan di halaman admin.
- Uji nyata Gemini (`ag/gemini-3.8-flash-high`) untuk "Lampu merah": versi 1 butuh 161 detik dan 3 percobaan. Percobaan 1 ditolak karena nama titik label `red_light` belum diizinkan, percobaan 2 karena nilai keadaan tidak cocok pola. Format nama lalu dilonggarkan (boleh `_`). Hasilnya 2 varian (tiang tunggal, tiang lengan) × 5 keadaan (merah, kuning, hijau, kuning berkedip, mati), dan 9/9 pemeriksaan lolos. Bentuk lampu terbaca dan warna keadaan benar, tetapi lampu hanya setengah tinggi mobil di panel skala. Revisi "tiang sekitar dua kali tinggi mobil" (126 detik, 1 percobaan) membuatnya kira-kira setinggi mobil, jadi model belum patuh pada skala yang diminta.
- Saat uji di Chrome, tab berpindah kembali ke halaman daftar tanpa aksi dari sesi ini, dan sekali tab hilang dari grup. Ini pola yang sama dengan salah klik sebelumnya. Untuk uji berikutnya, pembuatan draf dijalankan lewat `scripts/assets/generate-draft.ts` (fungsi yang sama dengan tombol), dan Chrome hanya dipakai untuk melihat hasil.

## Terbitkan aset dari draf (8 November 2026)

- Terbit = salin versi aktif ke `published_assets` dan kunci. Baris tidak pernah diubah; perbaikan diterbitkan sebagai versi baru (`0.1.0` → `0.2.0`) dengan `asset_id` yang sama per draf. Proyek yang memakai versi lama tetap merender gambar yang sama.
- Pemeriksaan dijalankan ulang saat terbit, bukan memakai laporan tersimpan, supaya versi yang disimpan sebelum aturan berubah tidak lolos dengan laporan lama.
- `AssetEntry.renderer` sekarang bisa bernilai `'Published'`. Tipe ini sengaja membuat TypeScript gagal di setiap tempat yang mengindeks `ASSET_RENDERERS` langsung, sehingga semua tempat itu dipaksa memakai `assetComponent(entry, published)`. Komponen aset terbit tidak ada di bundel tetap: titik masuk render menulis kodenya sebagai file, memvalidasinya ulang, lalu memberikannya ke `PlanVideo` lewat prop `published` dengan kunci `assetId@version`.
- Katalog untuk rencana baru hanya berisi versi aktif terbaru tiap aset terbit. Versi lama dan yang usang dicari langsung lewat `getPublishedVersions` saat merender proyek yang menyebutnya.
- Admin menampilkan aset terbit dari pratinjau SVG yang disimpan saat terbit, sebagai gambar.
- Tombol "Revisi dengan AI" sudah dipakai user lewat klik nyata (versi 3 Lampu merah: "tiang lebih tinggi dari mobil", 9/9 lolos).

## Video pertama dengan aset terbit (8 November 2026)

- Topik: "Mobil listrik dan mobil bensin berhenti saat lampu merah, lalu jalan lagi saat lampu hijau." Katalog yang cocok: mobil (2 varian), jalan, dan `custom.lampu-merah@0.1.0` hasil kurasi user. Hasil: 4 adegan, 22,4 detik, rencana 43 detik dalam 1 percobaan, total 77 detik. Klip ada di `storage/spike/asset-plan/lampu2/`.
- Jebakan 1: alias aset terbit berasal dari model ("lampu lalu lintas", "traffic light", "lampu bangjo") dan tidak memuat subjek permintaan ("lampu merah"). Sekarang subjek draf ditambahkan sebagai alias saat aset dibaca, tanpa mengubah baris terbit.
- Jebakan 2: aturan validator dari pekerjaan paralel melarang objek selain mobil di layout `road`, karena renderer memang belum menggambarnya. Akibatnya model melaporkan lampu yang sudah ada sebagai "belum tersedia" dan tercatat sebagai permintaan palsu (baris itu dihapus dari database dev). Sekarang layout `road` menerima maksimal 2 objek tepi jalan dan minimal 1 mobil, dan renderer menggambarnya di tepi jalan sisi dekat, sedikit di depan mobil, dengan urutan kedalaman.
- Jebakan 3: `IsoRoad` hanya menyediakan ruang sekitar 220 unit di atas aspal, sehingga kepala lampu terpotong. Pembungkus jalan dan objek tepi jalan kini memakai `overflow: visible`.
- Jebakan 4, yang terpenting: komponen draf buatan AI tidak meneruskan `x`, `y`, `width`, dan `height` ke `<svg>`-nya, jadi aset terbit selalu digambar di titik nol dan perubahan posisi tidak berefek. Label yang dihitung dari posisi jadi tidak menempel. `placeAsset` sekarang membungkus aset terbit dengan `<svg>` berposisi dan viewBox 760×480 sendiri, sehingga renderer tidak bergantung pada kode model.

## Pustaka aset tersambung ke Isometrik di aplikasi (8 November 2026)

- Video Isometrik di aplikasi tetap berupa satu `MainVideo.tsx` yang dikompilasi di browser untuk pratinjau dan dibundel untuk export. Jalur pustaka menulis file itu dengan `PlanVideo`, dan setiap aset terbit menjadi `AssetN.tsx`. Nama file `AssetN.tsx` diterima `isVirtualFileName` (untuk bundel), tetapi tidak oleh `ProjectUpdateSchema`, jadi user tidak bisa mengedit kode aset lewat editor.
- `browser-compiler` hanya memetakan `@/motion-kit`, jadi impor `@/motion-kit/isometric/draft-kit` dari aset terbit perlu dipetakan khusus. `PlanVideo`, `planDurationInFrames`, dan `LIBRARY_ASSETS` diekspor dari `@/motion-kit` supaya `MainVideo.tsx` lolos validator kode adegan.
- Audio adegan di aplikasi berupa URL `/api/projects/{id}/assets/...`, sedangkan `staticFile` hanya cocok untuk nama file. `PlanVideo` sekarang memakai URL apa adanya bila diawali `/` atau `http`. Saat export, URL itu ditulis ulang menjadi `/public/` oleh `bundleProject`.
- Pelajaran utama: narasi draf ditulis sebelum pustaka dipakai. Tanpa petunjuk, Director menulis "persimpangan", "garis setop", dan "mendahului", sehingga 100% topik mobil jatuh ke gambar AI. Dengan `libraryDraftNote` (daftar aset, kemampuan, batasan, dan larangan menyebut hal di luar daftar kecuali diminta user), topik yang sama lolos memakai pustaka. Aturan jatuh ke gambar AI saat ada satu saja kebutuhan yang tidak didukung itu ketat, tetapi jujur terhadap narasi yang sudah disetujui.
- Area aman: `PlanVideo` memakai `useSafeInsets` (konteks dari `SocialSafeFrame`, generic jika platform tidak dipilih). Caption ditambatkan ke `bottom: insets.bottom`, panggung berada di antara inset atas dan cadangan caption 3 baris, dan `layoutCallouts` menerima batas area. Di TikTok batas kanan 17%, sehingga caption 3 baris pas di batas (piksel 895 dari 896). Nama mobil di layout berdampingan semula di kiri atas dan bertabrakan dengan label sisi kiri; sekarang di kanan bawah tiap mobil.
- Belum: revisi chat, petunjuk pustaka untuk "ubah draf dengan AI", dan laporan cakupan di layar draf.

## Kebutuhan aset dari topik tanpa aset yang cocok (8 November 2026)

- Sebelumnya, topik yang sama sekali tidak cocok dengan pustaka langsung jatuh ke gambar AI tanpa catatan, padahal topik itulah sinyal paling jelas soal aset yang belum ada. Sekarang `buildLibraryFiles` memanggil `extractVisualNeeds` pada kasus itu: satu panggilan Gemini (maks 800 token keluar) yang mengembalikan maksimal 6 item `{subject, kind}` dari topik dan narasi, divalidasi dengan `CoverageGapSchema`, lalu dicatat ke `asset_requests`. Kegagalan panggilan dicatat ke log dan video tetap jalan.
- Uji Gemini: 8–10 detik per panggilan. Hasilnya relevan, tetapi model kadang menggabungkan objek dan aksi ("orang berlari") walau prompt meminta kata paling umum. Sinonim ("orang" / "pejalan kaki") belum digabung, jadi rekap di tab Diminta bisa terpecah.

## Pencarian aset dengan embedding (8 November 2026)

- Router menyediakan `/embeddings` untuk `gemini/gemini-embedding-001` (3072 dimensi, sekitar 0,9 detik, dilaporkan 0 token). Prefiks `ag/` (antigravity) tidak mendukung embedding.
- Ukuran nyata kemiripan kata tunggal: lampu merah~lampu lalu lintas 0,859, sedan listrik~mobil listrik 0,836, kasir~meja kasir 0,807, tetapi orang~pejalan kaki 0,633 sama dengan pasangan yang tidak berhubungan (0,62–0,65). Jadi embedding dipakai untuk mencari aset dari teks panjang, bukan untuk memutuskan sinonim kata tunggal; penggabungan permintaan diputuskan Gemini.
- Kalibrasi topik terhadap deskripsi aset: aset relevan 0,63–0,75, topik tanpa aset maksimal 0,57. Batas: skor ≥ 0,60 dan ≥ skor terbaik − 0,10. Margin itu membuang "toko" (0,602) untuk topik lampu merah (terbaik 0,720). Batas bisa diatur lewat `ASSET_SEMANTIC_THRESHOLD`.
- Vektor disimpan sebagai JSON dengan 5 desimal di `asset_embeddings`, dengan kunci hash model dan teks. Perhitungan cosine dilakukan di memori; cukup untuk ribuan aset sebelum perlu layanan vektor.
- Kasus user (proyek `proj_e91b…`, "air sungai dijernihkan"): alias lama hanya menemukan aset sungai karena "dijernihkan" tidak cocok dengan "penjernihan air". Director dan perencana lalu menganggap koagulan, bak sedimentasi, pasir silika, dan klorin tidak ada, padahal tercakup aset pengolahan air. Tujuh permintaan tercatat ke tab Diminta, lima di antaranya keliru. Pencarian baru menemukan pengolahan air (0,746). Tetapi "pipa bawah tanah" dan "keran rumah" memang belum ada, jadi aturan semua-atau-tidak tetap akan menjatuhkan video ini ke gambar AI.

## Video air dari pustaka dan fase berulang (8 November 2026)

- Prompt user "air sungai dijernihkan" lewat jalur aplikasi dengan pencarian semantik: draf 5 adegan tanpa pipa/keran, generate 107 detik memakai sungai dan pengolahan air, export 15 detik. Pemeriksa gerak mencatat 5 bagian hampir diam.
- Penyebab: `flowPhase` satu satuan = satu putaran, dan model menganimasikannya 0→300 dalam 5 detik (sekitar 2 putaran per frame), sehingga gerak teraliasing menjadi diam. Kasus yang sama dengan `energyPhase` mobil. Sekarang `AssetPropSpec.driven = { speed, activeWhen }`: renderer memajukan fase dari frame (aliran 0,8 putaran/detik, energi 0,6), plan tidak boleh menganimasikannya, dan aliran yang aktif dihitung sebagai perubahan terlihat oleh `requireVisibleChange`. Katalog untuk model menandainya `movesByItself`.
- Penanda aliran yang bergerak hanya mengubah sekitar 1,3% piksel, dan pemeriksa gerak (frame 120×80) tidak menangkapnya. Yang menurunkan bagian diam dari 5 ke 2 adalah kamera: aset lingkungan kini punya `ENVIRONMENT_CAMERA` sendiri (close-up zoom 0,95, lean 0,75), dan dengan dua titik fokus kamera berpindah dari fokus pertama ke terakhir selama adegan. Label yang bagiannya keluar frame disembunyikan.
- Nama aset lingkungan yang panjang di layout berdampingan kini mengecil supaya muat di area aman. Di adegan pertama video air, nama "Sungai berkelok ringan" masih sedikit tertimpa kotak label.

## Hibrida per objek di Isometrik (8 November 2026)

- Keputusan user: aset pustaka hanya untuk bentuk yang sulit; sisanya tetap dibuat per video. Untuk Isometrik, objek sederhana yang kurang tidak ditempel di atas gambar dunia Gemini (sudut, skala, dan cahaya tidak akan cocok), melainkan digambar AI sebagai SVG dengan kit draf dan proyeksi yang sama, lalu ikut dirender `PlanVideo` sebagai aset sementara `drawn.<nama>@0.0.0` di file `AssetN.tsx`.
- Urutan: rencana pertama → kebutuhan digabung dan dicatat → maksimal 3 objek digambar paralel (`generateProp`, maks 2 percobaan, 8000 token) → yang lolos pemeriksaan render ditambahkan ke katalog → rencana kedua. Jika rencana kedua gagal, rencana pertama dipakai. Aturan "lebih dari separuh adegan" dihitung dari kekurangan rencana yang dipakai.
- Uji nyata: generate naik dari 107 ke 291 detik karena gambar objek dan perencanaan ulang. Model menggabungkan "pipa bawah tanah" dan "keran rumah" menjadi satu objek, dan hasilnya terbaca serta sewarna dengan pustaka. "Mikroorganisme" tetap dilaporkan sebagai kekurangan.

## Isometrik satu dunia untuk video pustaka (8 November 2026)

- Masukan user: video pustaka Isometrik berpindah antaradegan dengan fade, padahal Isometrik seharusnya satu dunia. Sekarang `WorldPlanVideo` menata semua instance sekali (`layoutWorld`: urutan kemunculan pertama, langkah 720 unit di sumbu x iso, mobil di lajur satu jalan, objek lain di tepi jalan), dan setiap adegan menjadi gerak kamera: pembuka dari gambaran seluruh dunia (1,6 detik), perpindahan antaradegan 1,1 detik tanpa potongan, close-up ke titik fokus, dan tur dari fokus pertama ke terakhir. Keadaan objek bertahan di dunia. `library-video` kini menulis `WorldPlanVideo` untuk Isometrik.
- Uji render ulang 2 proyek: frame menunjukkan satu dunia menyambung (sungai → instalasi → pipa dan keran; mobil di jalan dengan lampu merah). Pemeriksa gerak masih mencatat 3 (air) dan 5 (mobil) bagian hampir diam, karena kamera berhenti setelah tiba. Perlu gerak kamera yang lebih hidup saat bertahan.

## Gambar dunia Isometrik dicek sudut pandangnya (8 November 2026)

- Laporan user (`proj_7e4620…`, "mobil ngebut di tikungan limbung"): gaya Isometrik dipilih, tetapi videonya bukan isometrik. Jalur pustaka batal karena 4 dari 6 adegan butuh aksi yang belum ada (bodi miring, roda terangkat, selip, terpelanting), lalu `buildWorldFiles` memakai gambar AI. `gemini-3.1-flash-lite-image` menggambar perspektif biasa dengan langit, gunung di cakrawala, dan mobil mirip merek nyata berikut emblemnya, padahal prompt meminta "30 degree isometric".
- Penyebab di prompt: aturan "seperempat atas adalah lanjutan sekitar yang tenang" dibaca model sebagai langit untuk topik luar ruang, dan langit membawa cakrawala serta titik hilang. Kata "isometric" saja tidak cukup kuat.
- Perbaikan: `STYLE` meminta proyeksi ortografis (garis sejajar tetap sejajar, tanpa titik hilang, tanpa langit, cakrawala, atau gunung jauh) serta kendaraan dan produk tanpa merek. Seperempat atas diminta berupa tanah yang sama dilihat dari atas. Perencana juga dilarang menulis langit atau pemandangan jauh di `setting`.
- `checkIsometricView` bertanya ke model visi (model yang sama dengan pencari bagian) apakah gambar isometrik, ada langit/cakrawala, atau ada tulisan/logo. Jika gagal, dunia digambar ulang sekali dari kanvas kosong (bukan dari gambar yang ditolak, supaya perspektifnya tidak ikut tersalin) dengan alasan penolakan di prompt. Hasil ulang dipakai jika masalahnya tidak lebih banyak. Jika masih gagal, chat editor menyebutnya. Cek yang error dianggap lolos.
- Uji nyata dengan narasi proyek yang sama (`spike_isoview_car`, 1 kali): gambar pertama ditolak, gambar ulang lolos, 66 detik untuk rencana dan 3 gambar. Hasilnya dilihat dari atas, tanpa langit, tanpa emblem. Catatan: seluruh bingkai berupa aspal abu-abu gelap karena perencana memilih ground `#3B424C`, dan bagian "suspensi-luar" tetap tidak ditemukan. Close-up tidak ikut dicek.

## Rencana seri dengan karakter konsisten (9 November 2026)

- Permintaan user: gaya video serius yang bisa dibuat episode demi episode dengan karakter yang sama. Status: rencana di [plan_fitur.md](../plan_fitur.md), bagian "Seri dengan karakter konsisten". Belum ada kode.
- Keputusan: karakter berupa rig SVG terkunci yang dipanggil lewat komponen, bukan digambar ulang AI per adegan. Alasan: bentuk yang digambar AI berubah antaradegan (lihat pelajaran draf aset dan Full SVG di atas), dan wajah manusia lebih sensitif terhadap perubahan kecil. Gambar AI dengan gambar referensi tetap bergeser (rambut, baju, proporsi) dan tidak bisa digerakkan per bagian.
- Latar boleh tetap dibuat AI per adegan, karena perubahan kecil di latar tidak merusak kesan karakter yang sama.
- Alur: episode pertama membuat seri dan pemeran yang diusulkan AI dari prompt, lalu dikunci user. Episode berikutnya hanya butuh prompt dan membaca memori seri. Cara ini menjaga janji produk "dari 1–2 kalimat".
- Format suara default: campuran (narator dan dialog pendek), karena terasa sinematik tetapi risiko multi-suara dan giliran bicara masih terkendali.
- Pembuat karakter tahap 1 memakai atribut parametris (seperti pembuat avatar), bukan AI, supaya stabil dan murah. Karakter dari prompt lewat AI menyusul dengan alur draf aset yang sudah ada.
- Risiko utama: rig SVG bisa tampak kaku atau murahan. Spike 1 rig (4 pose, 4 ekspresi, 1 adegan dialog sampai MP4) dinilai user lebih dulu sebelum sistem seri dibangun.

## Kanvas Full SVG mengikuti rasio video (10 November 2026)

- Laporan user (`proj_f298…`, 16:9): banyak gambar tidak penuh dan terlihat terpotong. Penyebab dari dasar: semua aset digambar di kanvas 1000×1000 dan `AssetStage` memasangnya sebagai kotak di tengah layar. Di 16:9 sisi kiri-kanan hanya berisi latar dunia bersama, dan lapisan tanah, sungai, atau ruangan yang digambar model berhenti di tepi kotak itu. Prompt aset juga menyebut "vertical explainer", jadi komposisinya memang dipikir sempit.
- Keputusan: tinggi kanvas tetap 1000 (semua aturan y, kartu data, judul tetap sama), lebar = 1000 × rasio untuk landscape (`canvasWidthFor`). Potret dan 4:5 tetap 1000. Alternatif mengubah ke koordinat 0..1 atau melebarkan dengan `slice` ditolak: yang pertama merusak semua prompt dan data lama, yang kedua memotong atas-bawah gambar.
- Lebar disimpan di manifest oleh pipeline (`fitToCanvas`), bukan ditulis model. Jika model tetap menulis `viewBox="0 0 1000 1000"`, viewBox akar diganti ke lebar kanvas.
- Adegan selalu memakai lebar dunia bersamanya (`continuity.canvasWidth`). Uji pertama membuat ulang 1 adegan lebar di proyek lama: langit dunia lama (sampai x=2000) tidak menutup sisi kanan, muncul kotak putih, dan koordinat kamera `continue` tidak cocok. Jadi proyek lama tetap 1000, dan hanya dunia baru yang lebar.
- Jumlah objek: prompt meminta sisi lebar diisi objek yang benar-benar ada di momen itu (yang memberi masukan, yang menerima, sekitar), dan perencana draf diminta merencanakan objek pendukung untuk video landscape. Kritik menilai komposisi ≤ 4 jika subjek terjepit di kolom tengah.

## Penanda blok dunia yang hilang dari DeepSeek (10 November 2026)

- Laporan user (`proj_1c9b…`, DeepSeek Flash, 9:16, dengan draf objek): adegan 5 gagal di percobaan 1 karena kode tidak memuat baris `// SHARED-WORLD:START` dan `// SHARED-WORLD:END`. Kegagalan ini memakan satu panggilan perbaikan, dan bisa jatuh ke percobaan kedua.
- Saat draf objek atau adegan pertama sudah menetapkan blok dunia, isi blok selalu disisipkan renderer, jadi penanda hanya soal format. `applySharedWorld` sekarang merapikan penanda yang ditulis sebagai komentar blok atau dengan spasi, dan jika penanda hilang, menyisipkan blok tetap setelah import. Adegan yang mendefinisikan ulang `WorldBase` atau komponen draf sendiri tetap ditolak dengan pesan yang menyebut nama komponennya. Adegan pertama tanpa dunia bersama tetap wajib menulis blok sendiri.
- Jebakan: regex penanda tidak boleh memakai `\s*` di ujung, karena ikut memakan baris baru dan membuat baris kode berikutnya menjadi komentar.

## Nama tak terdefinisi lolos validator (10 November 2026)

- Laporan user (`proj_1c9b…`, DeepSeek Flash): adegan 5 "Toleransi Muai Susut Aman" crash saat dirender dengan `ReferenceError: cl is not defined`. Model memanggil helper `cl(...)` tanpa mendefinisikannya. `validateSceneCode` hanya memeriksa global terlarang, jadi adegan lolos, ditandai siap, dan baru diperbaiki cek-crash di akhir job setelah tahap kualitas gagal mengambil frame-nya.
- Sekarang validator menolak nama yang dipakai tetapi tidak dideklarasikan di file, kecuali global bawaan runtime (`Object.getOwnPropertyNames(globalThis)` plus `React`, `undefined`, dan beberapa tipe DOM). Global terlarang tetap dilaporkan terpisah. Pemeriksaan tidak sadar scope: nama yang dideklarasikan di mana pun dalam file dianggap ada. Itu cukup untuk kasus helper yang lupa ditulis.
- Pengecualian: aset dari model sebelum blok dunia disisipkan (`parseAssetResponse`) memakai `checkUndeclared: false`, karena adegan draf memanggil `WorldBase` dan objek draf yang baru disisipkan renderer. File adegan yang sudah tersusun tetap diperiksa di `buildAssetScene`, dan kegagalannya masuk ke panggilan perbaikan biasa. Potongan karakter yang dicek sendirian mendapat `providedNames: HUMAN_RIG_NAMES`.
- Sebelum dipakai, pemeriksaan ini dicoba ke data lokal: 438 file adegan, 7 blok draf, dan 186 aset tersimpan. Tidak ada yang salah ditolak.

## Isometrik hanya untuk admin (10 November 2026)

- Keputusan user: Isometrik masih panjang pengembangannya, jadi hanya akun di `ADMIN_EMAILS` yang bisa membuatnya. Daftar ada di `ADMIN_ONLY_PRESETS` (`src/types/studio.ts`). Pemeriksaan server di `POST /api/projects` memakai `isAdmin` yang sama dengan halaman admin, sehingga email yang belum terverifikasi tidak dihitung admin.
- Penolakan dilakukan sebelum cek kredit, jadi akun biasa tidak pernah memanggil Director untuk preset ini. Test admin memakai kredit 0 agar terbukti lolos gerbang preset tanpa memanggil model.

## Isometrik 3D dihapus (10 November 2026)

- Keputusan user: semua fungsi Isometrik 3D dihapus tanpa kecuali, termasuk container dan aset 3D. Alasannya, prosesnya masih panjang. Sebelum dihapus, sudah sempat dibuat: Studio memanggil container `bpy` lewat HTTP untuk varian warna rangka HP dengan pemeriksaan GLB; pemilihan model 3D berdasarkan bagian dan gerakan per adegan; serta template mobil dengan kap, jendela, dan kompresor yang dirender dengan `CarWorldVideo`. Prompt "AC mobil atau buka jendela" sempat lolos sebagai 6 adegan 3D lewat job.
- Yang dihapus: preset `world-3d`, `ChargingPhoneVideo`, `CarWorldVideo`, `ThreeCar`, `world-3d-plan.ts`, `world-3d-video.ts`, `capability.ts`, `phone-model-worker.ts`, `glb-check.ts`, registry `device.charging-phone` dan `vehicle.car-3d`, metadata `parts`, `motions`, `scene3d`, dan `model` di `AssetEntry`, renderer `Gltf`, folder `containers/` dan `public/models/`, container dan image Docker `gmotion-bpy`, `storage/assets/three-car` dan `three-phone`, proyek uji `proj_glb_*` dan `proj_carprev_*`, serta 9 baris `asset_requests` ber-preset `world-3d`.
- Yang tidak dihapus: `IsoStage`, `IsoVideo`, dan paket `three`, `@react-three/fiber`, serta `@remotion/three`, karena mesin dunia preset Isometrik (`world-video.ts`) masih memakainya. Hasil spike lama di `storage/spike/iso-world` juga dibiarkan.
- Jebakan yang masih berguna jika 3D dibuka lagi: `GLTFLoader` mengganti spasi di nama node dengan `_`; `GLTFExporter` di Node menulis transformasi sebagai `matrix`; dan exporter glTF Blender memetakan (x, y, z) Blender ke (x, z, -y) glTF.

## Cek awalan id, lewati persetujuan draf, dan ganti suara berbayar (11 November 2026)

- Cek awalan id di `checkPiece` membaca bagian literal awal tiap `id`. `id={`${p}body`}` dan `id=""` sama-sama menghasilkan string kosong, sehingga draf gagal dengan daftar id kosong ("Prefix every id ...: ."). Id kosong kini diabaikan (tidak bisa dirujuk dan tidak bisa bentrok), id dinamis dicek pada SVG hasil render, dan pesan mengutip setiap id.
- Job generate menyimpan salinan proyek di memori dan menulis seluruh file di setiap commit. Field yang diubah route lain saat job berjalan akan tertimpa. `autoApproveObjectDraft` karena itu dibaca ulang dari file di setiap commit. Pola ini perlu dipakai untuk field lain yang boleh diubah user di tengah job.
- Ganti suara memakai `reviseScenes` dengan `deps.voice`: teks tetap, audio dibuat ulang, dan `retimeSceneCode` menyesuaikan subtitle dan timing seperti edit narasi. Storyboard hanya berganti suara jika semua adegan berhasil, dan kredit dikembalikan jika ada yang gagal.
- `credit_ledger` memakai CHECK pada `reason`. SQLite tidak bisa mengubah CHECK, jadi alasan baru butuh migrasi yang membangun ulang tabel lalu membuat ulang index dan trigger saldo. Salinan baris lama tidak menggeser saldo karena trigger dibuat setelah salinan. Alasan `generate` tidak dipakai untuk ganti suara karena `costs.ts` menghitung baris `generate` sebagai jumlah video.


## Spike mesin Canvas isometrik dengan Gemini (11 November 2026)

- Pemicu: user membuat video AC Biasa vs Inverter dengan mesin Canvas buatan sendiri, dan hasilnya memuaskan. Pertanyaannya: apakah Gemini sanggup menggambar objek isometrik yang dikenali dengan mesin seperti itu?
- Mesin ditulis ulang di `src/motion-kit/iso-canvas/engine.ts` dari deskripsi user (file sumber video AC belum ada di repo). Proyeksi `P()` 30°, setiap bentuk dari bidang datar, normal dibalik ke luar memakai titik tengah benda, sisi dengan normal·(1,1,1) ≤ 0 tidak digambar, kecerahan 0,52 + 0,55 × normal·cahaya. Urutan antarbenda tetap manual (belakang ke depan), bidang dalam satu benda diurutkan berdasarkan x+y+z.
- Gemini menulis `function draw(iso, t)` dalam JavaScript biasa. Skrip menjalankannya dulu dengan konteks Canvas palsu (Proxy) supaya error bisa dikirim balik tanpa render.
- Hasil: percobaan pertama tanpa umpan balik visual menghasilkan proporsi dan bagian yang benar, tetapi ada kesalahan bentuk (pelindung kipas padat menutupi bilah). Satu putaran dengan frame render sebagai gambar memperbaiki hampir semuanya, dan Gemini sendiri menyebut masalahnya dengan tepat. 
- Token: sekitar 11–14 ribu masuk dan 12–27 ribu keluar per video 3 detik dengan satu putaran perbaikan, atau Rp1.000–2.050 dengan tarif saat ini. Token masuk putaran perbaikan sudah termasuk 2 gambar frame.
- Keputusan user (11 November 2026): Isometrik dibuat Gemini dengan mesin Canvas, karena hasil dan harganya memuaskan. Kualitas dijaga dengan putaran nilai dan perbaikan: adegan diterima jika skor penilai mencapai ambang (target 6, turun ke 5,5 jika terlalu sering tidak tercapai), selebihnya digambar ulang dari frame dan masukan penilai.
- Uji mobil di jalan kota (topik meminta jalan dan latar yang hidup): percobaan pertama sudah terbaca sebagai adegan kota isometrik dengan marka bergerak, taksi menyalip, pohon, lampu jalan, dan gedung. Kesalahannya pada komposisi dan logika: jalan berhenti di tengah frame sehingga separuh bawah kosong biru, taksi bertumpuk dengan mobil utama saat menyalip, label menunjuk benda yang salah. Putaran perbaikan memperbesar zoom sampai konteks jalan hilang, jadi untuk adegan lingkungan perbaikan visual tidak selalu lebih baik. Biaya sekitar Rp1.863.
- Putaran nilai dan perbaikan (penilai Gemini dengan 5 kriteria isometrik: dikenali, kebenaran isometrik, komposisi, gerak, ketepatan label; maksimal 3 putaran; ambang 6; putaran terbaik dipakai). Mobil: 5,2 → 5,8 → 5,4, sekitar Rp4.325 (43.355 token masuk, 54.937 keluar). Jantung: 4,4 → 5,2 → 5,2, sekitar Rp3.501. Ambang 6 tidak tercapai di kedua topik; ambang 5,5 meloloskan mobil saja. Putaran ketiga tidak selalu lebih baik (mobil turun karena label salah tunjuk), jadi putaran terbaik harus disimpan, bukan yang terakhir. Masukan penilai konsisten dan tepat; yang selalu muncul adalah label terpotong tepi dan tanah yang tidak sampai tepi frame, dua hal yang bisa diatasi mesin. Biaya sekitar Rp3.500–4.300 per adegan 3 detik dengan 3 putaran; penilai hanya sekitar Rp150 per putaran, sebagian besar biaya ada di token keluar penulis kode.
- Jebakan: label dari Gemini sering keluar tepi kanvas. Mesin sebaiknya menggeser kotak label ke dalam kanvas, bukan menyerahkannya ke model.
- Tahap 1 mesin (11 November 2026): `ground`, `strip`, dan `dashes` menghitung bidang yang terlihat dengan memproyeksikan balik keempat sudut layar ke bidang z (u = (sx−cx)/(cos30·s), v = (sy−cy)/s + z, x = v + u/2, y = v − u/2), lalu menambah margin. Karena itu tanah selalu menutup frame di zoom berapa pun, tanpa angka ukuran dari Gemini.
- Label diantrikan dan baru digambar di `finish()`, karena penataan butuh semua kotak sekaligus. `CanvasScene` memanggil `finish()` setelah `draw`; skrip atau runtime lain yang memanggil `draw` langsung juga wajib memanggilnya, kalau tidak label hilang.
- Canvas yang sudah digambar tidak ikut berganti font. `CanvasScene` menahan render dengan `delayRender` sampai Inter siap, lalu menggambar ulang lewat state `fontReady`.
- Uji ulang mobil dengan mesin baru: komposisi naik dari 4 ke 6 dan label dari 5 ke 7 di putaran terbaik, ambang 6 tercapai. Gemini menulis "Kecepatan 90 km/jam" di label walau tidak ada di topik. Prompt Tahap 3 perlu membatasi label pada isi narasi.
- Tahap 2 kontrak (11 November 2026): adegan dunia sengaja berupa data, bukan kode, supaya murah dan tetap satu dunia. Keadaan benda disimpan per id benda (`{ kipas: { putar: 1 } }`) dan diubah lewat `changes` yang di-easing, sehingga `drawWorld` cukup membaca angka.
- Uji kering memanggil kode model dari fungsi host yang dijalankan lewat `vm.runInContext('__job()')`, supaya batas waktu `vm` ikut berlaku walau kodenya dipanggil dari mesin di realm host. Panggilan langsung dari host ke fungsi sandbox tidak punya batas waktu.
- `iso.ctx` dihapus dari objek iso. Lewat `ctx.canvas.ownerDocument` kode model bisa menjangkau DOM di pratinjau browser; validator juga menolak nama anggota itu.
- Jebakan: aturan eslint Next melarang variabel bernama `module`, termasuk di loader CommonJS buatan sendiri.
- Tahap 3 pipeline (11 November 2026): frame untuk penilai dirender lewat satu bundel `preview-root.tsx` yang menerima file sebagai input props dan mengompilasinya dengan `compileVirtualProject`. Bundel dibuat sekali per proses dan satu browser dipakai sepanjang job, sehingga setiap putaran hanya membayar `renderStill`, bukan bundling ulang (sekitar 4 detik per bundel di spike).
- Panel atas `WorldOverlay` menutup sampai sekitar 30% tinggi frame, jadi target kamera diletakkan di 58% tinggi (`anchorY`) dan label canvas dibatasi mulai 31% (`labelTop`).
- Uji job kipas: 3 benda, dunia, dan 3 close-up memakan 33 panggilan Gemini, sekitar Rp19.000 dan 21 menit. Tidak satu pun benda atau dunia mencapai 6 dalam 3 putaran (5,2–5,8), sedangkan close-up mencapai 6–6,2. Skor benda sering datar antarputaran (5,5 → 5,5 → 5,5), jadi putaran ketiga jarang membantu dan menambah biaya. Bahan untuk menetapkan ambang dan batas putaran di Tahap 6. Keputusan user: batas putaran bawaan menjadi 2 (bisa diubah lewat `ISO_QUALITY_ROUNDS`).
- Dunia dan close-up ditulis paralel setelah benda selesai; uji kering close-up memakai dunia polos sebagai pengganti karena hanya memeriksa kode close-up itu sendiri.
- Draf Isometrik Canvas tidak lagi memakai `libraryDraftNote`, karena petunjuk itu sengaja membatasi narasi pada aset pustaka.
- Tahap 4 (11 November 2026): di 16:9 kapsul subtitle berada di sekitar 80% tinggi frame, sehingga kamera potret (target di 58%, tinggi benda 46%) membuat bagian bawah benda tertutup. `viewBand` kini memilih pita bebas per rasio. Pratinjau, export, dan bundel pratinjau server memakai `compileVirtualProject` yang sama, jadi tidak perlu pemetaan baru untuk file `.ts`.
- 2 putaran ditambah dunia dan close-up paralel: generate turun dari 1.256 ke 556 detik dan biaya dari sekitar Rp19.000 ke Rp11.900 untuk topik yang sama (beda rasio dan jumlah benda, jadi perbandingannya kasar).
- Label di kode close-up buatan model sering memakai baris keterangan berisi klaim tambahan ("Kawat Tembaga Berarus"). `paintIsoScene` membuang `sub` untuk adegan `detail`; label dunia dari rencana tetap boleh punya keterangan.
- Jebakan: garis tepi tutup silinder harus hanya digambar untuk tutup yang menghadap penonton, kalau tidak lingkaran alas tembus terlihat.
- Hasil di `storage/spike/canvas-iso/{sanity,kipas,kipas-v2,hp,hp-v2,jantung,jantung-v2,mobil,mobil-v2,q-mobil,q-jantung,stage1,s1-mobil,contract}/`.

## Gaya rumah dan contoh AC untuk Isometrik Canvas (11 November 2026)

- Pemicu: skor benda tertahan di 5,2–5,8, dan prompt benda hanya berisi API dan aturan, tanpa contoh kode yang bagus. Pelajaran dari lemo-opuscar: karya acuan menaikkan mutu lebih dari aturan. File sumber video AC buatan user tidak ada di mesin ini, jadi contoh ditulis ulang dengan API mesin sekarang.
- `iso-canvas/examples.ts`: `ISO_STYLE` plus unit outdoor AC (casing, grille dari loop batang, bilah berputar, panel servis, katup, pipa, panah udara panas), unit indoor AC (profil prism, flap berengsel, LED, aliran udara dingin), dan dunia sudut ruangan. Contoh ikut lolos validator dan uji kering, karena contoh yang melanggar aturan akan ditiru model.
- Jebakan: `iso.mixColor` dulu mengembalikan `rgb(...)`, sedangkan bayangan bidang hanya membaca `#hex`, jadi warna campuran berubah abu-abu 128. Sekarang `#hex`.
- Jebakan: dengan cahaya (0,45; 0,1; 1) sisi +y hanya mendapat kecerahan sekitar 0,57, sehingga semua bagian depan benda yang menghadap kiri tampak kusam. Cahaya sekarang (0,5; 0,35; 1) dengan 0,6 + 0,45 × normal·cahaya: atas sekitar 0,98, sisi +x 0,79, sisi +y 0,73.
- Penilai benda menerima teks latar (`Setting`) dan selalu meminta meja atau jalan, walau benda sengaja digambar sendiri. Ini berisiko membuat putaran perbaikan menambah latar ke fungsi benda. Kriteria benda sekarang melarangnya.
- A/B putaran pertama (1 percobaan per benda, tanpa putaran perbaikan): kipas 5,0 → 5,3, mobil 4,8 → 5,3, HP 5,0 → 5,5. Dari frame: mobil lama punya lempeng hitam menembus atap, versi baru bersih; kipas tetap memakai cakram padat sebagai pelindung di kedua versi. Setelah aturan "bagian tembus pandang dari jeruji" dan "sorot cahaya transparan": kipas 5,3 dengan jeruji kawat dan bilah terlihat, mobil 5,8 dengan sorot lampu lembut. Token masuk naik sekitar 3.000 per panggilan benda (sekitar Rp40), sedangkan token keluar tidak naik.
- Model menerapkan aturan yang konkret dan terlihat (jeruji, transparansi) jauh lebih baik daripada contoh saja: contoh AC berjeruji tidak membuat kipas berjeruji sampai aturannya ditulis.
- Hasil di `storage/spike/canvas-iso/{examples,examples-oldlight,style-ab,style-ab2}/`.

## Export Isometrik Canvas lambat karena swangle (11 November 2026)

- Gejala: export proyek AC (32 detik, 9:16) memakan 1.124 detik di Windows, padahal export Isometrik sebelumnya sekitar 13 detik. Satu proses `chrome-headless-shell --type=gpu-process --use-angle=swiftshader` memakan sekitar 4.600 detik CPU dalam 15 menit, sementara RTX 2050 menganggur.
- Penyebab: `chromiumOptionsFor` memberi `gl: 'swangle'` ke semua preset dunia di luar Mac, aturan dari mesin 3D lama yang butuh WebGL. Mesin Canvas tidak memakai WebGL, tetapi dengan swangle rasterisasi canvas 2D (termasuk `ctx.filter = blur(...)` di `iso.shadow`) ikut dikerjakan CPU.
- Perbaikan: proyek `isoEngine: 'canvas'` memakai opsi bawaan Chromium. Export yang sama 77 detik, dan selisih piksel antar kedua MP4 rata-rata sekitar 1 dari 255.
- Jebakan saat mengukur: mengukur render sambil export berjalan membuat keduanya berebut CPU. Progres export lompat dari 14% ke 42% begitu pengukuran selesai.
- Jebakan mesin ini: `nodemailer` ada di `package.json` dan lockfile tetapi belum terpasang di `node_modules`, sehingga `scripts/spike-iso-job.ts` gagal di impor. Dipasang dengan `npm install --no-save nodemailer@10.4.0 @types/nodemailer@8.0.2`.
- Uji job AC dengan gaya rumah: 4 dari 5 benda mencapai skor 6. Masalah baru: kode dunia Gemini memanggil `iso.label` sendiri dengan keterangan berbahasa Inggris, yang tampil di setiap bidikan dan bertumpuk dengan label rencana. Hasil di `storage/spike/canvas-iso/{ac-gpu.mp4,ac-swangle.mp4,ac-frames}/`.
- Perbaikan label: kode benda dan dunia ditolak bila memanggil `iso.label`, dan alasannya dikirim balik ke model lewat `writeUntilValid`. Label di lapisan itu tampil di semua bidikan sepanjang video, sehingga tidak bisa diatur waktunya terhadap narasi dan lolos dari pemeriksaan label rencana.

## Admin lokal tanpa login Google (11 November 2026)

- Gejala: `ADMIN_EMAILS` sudah benar, tetapi pilihan Isometrik tidak muncul. Akun lokal user adalah akun email + password (`google_sub` berawalan `password:`), dan `isAdmin` sengaja tidak menghitung akun password karena emailnya tidak terverifikasi. `.env` lokal juga belum punya `GOOGLE_CLIENT_ID`, jadi login Google tidak bisa dipakai.
- Keputusan user: di bawah `next dev` (`NODE_ENV=development`) akun password yang emailnya ada di `ADMIN_EMAILS` dihitung admin. Build produksi dan vitest (`NODE_ENV=test`) tetap memakai aturan ketat, sehingga test lama di `tests/auth.test.ts` tidak berubah. Test baru di `src/lib/billing/costs.test.ts`.
- Jebakan: deploy yang menjalankan `next dev` di server publik akan ikut melonggarkan aturan ini. Server publik harus memakai `next build` + `next start`.

## Revisi chat untuk Isometrik Canvas (11 November 2026)

- Satu video Isometrik adalah satu dunia, jadi revisi tidak bisa per file adegan seperti Story 2D. `reviseIsoCanvas` menentukan sasaran dulu (benda, dunia, close-up, bidikan, atau tidak bisa) lewat satu panggilan Gemini kecil, lalu `resolveTarget` membuang sasaran yang tidak ada: id benda asing, nomor adegan di luar rentang, close-up yang ternyata adegan world, atau sebaliknya.
- Revisi bidikan (`zoomScale`, fokus, label) hanya mengubah rencana, lalu `IsoScenes.ts` disusun ulang dari `buildWorldScenes`. Karena itu `zoomScale` disimpan di beat rencana, bukan di data kamera, supaya ikut bertahan saat framing dihitung ulang. Uji nyata: 5 detik, tanpa panggilan model untuk menggambar.
- Isi close-up dibaca kembali dari `IsoScenes.ts` dan fungsi benda dari `IsoObjects.ts` dengan pemindai kurung kurawal yang melewati string, template literal, dan komentar (`code-parts.ts`). Jumlah close-up yang terbaca harus sama dengan jumlah adegan detail, kalau tidak revisi bidikan dan close-up ditolak dengan jujur.
- `build.ts` sekarang membangun tugas putaran mutu lewat `objectTask`, `worldTask`, dan `detailTask`, yang juga dipakai revisi dengan permintaan berisi kode lama dan instruksi user. Perilaku generate tidak berubah.
- Jebakan uji: menyalin proyek untuk diuji harus ikut menyalin folder `assets` dan mengganti URL audio di storyboard dan di `MainVideo.tsx`, karena skrip overlay menanam URL audio per adegan. `scripts/spike-iso-revise.ts` sudah melakukannya.
- Jebakan test: tiga test (`browser-compiler` dengan batas 50 ms, `draft-flow`, `elevenlabs`) bisa gagal saat suite penuh berjalan di komputer yang sibuk, tetapi lolos saat dijalankan terpisah dan pada putaran suite berikutnya (743 lulus).

## Revisi gerak dan waktu untuk Isometrik Canvas (11 November 2026)

- Pemicu: user meminta "orang yang terkena alarm harus jalan dulu lalu alarm di bawah pintu". Revisi pertama diarahkan ke benda "Pengunjung kunci", dan Gemini hanya menggambar ulang kunci yang bersinar (skor 6,0 → 5,8) tanpa gerakan. Penyebabnya: fungsi benda selalu menggambar di titik nol dan tidak bisa berpindah atau mengatur waktu terhadap benda lain, alarm adalah keadaan gerbang di adegan lain, semua perubahan dalam satu adegan mulai bersamaan, dan penentu sasaran tidak punya pilihan untuk gerak sehingga memilih yang paling mirip.
- Perbaikan: sasaran `motion`. Rencana menyimpan `path` per benda dan `at`/`over` per perubahan keadaan. Benda digerakkan mesin lewat pembungkus `applyMotion` di `IsoObjects.ts`, bukan oleh kode model, jadi dunia dan close-up tetap memanggil `drawX` seperti biasa. Revisi benda berikutnya membaca dan mengganti `drawXShape`.
- Jebakan urutan gambar: dunia memanggil benda dalam urutan tetap, sehingga benda yang lewat di depan benda lain tergambar di belakangnya. Mesin kini punya `iso.defer(draw, ahead)` dan `flush()` (dipanggil `finish()`): begitu ada benda bergerak, semua benda di video itu ditunda dan digambar dari yang terjauh (x + y titik asal ditambah perjalanan). Hiasan dunia tetap digambar langsung, jadi hiasan di depan benda bisa tertutup.
- Jebakan tujuan: Gemini memilih tujuan tepat di posisi benda lain (pengunjung aman di y = 1,8). `clearDestination` menggeser tujuan di arah perjalanan sampai jejaknya terpisah 35 cm dari benda lain, maksimal 3 meter.
- Revisi gambar yang skornya turun lebih dari 0,15 ditolak, karena penilai tidak melihat permintaan user dan penurunan biasanya berarti perubahan merusak yang sudah baik.
- Hasil di `storage/spike/canvas-iso/{gate-motion.mp4,gate-frames/motion.jpg,gate-frames/motion2.jpg}`.
- Langkah kaki: benda yang hanya digeser mesin tampak seperti potongan kertas yang meluncur. Revisi gerak dengan `walks: true` langsung menulis ulang gambar benda itu agar melangkah hanya saat keadaan `jalan` di antara 0 dan 1 (faktor `Math.min(1, Math.min(k, 1 - k) * 20)` supaya siklus muncul dan hilang halus), dan tetap berdiri diam di 0 dan 1. Langkah tidak dipasang bila skornya turun lebih dari 0,15, tetapi gerak tetap berlaku. Uji nyata: 449 detik dan sekitar Rp4.500, kaki bergantian terlihat pada frame berjarak 0,25 detik.

## Close-up Isometrik Canvas memakai fungsi benda (11 November 2026)

- Pemicu: di proyek gerbang tol (`proj_4e0654b9…`), mobil di adegan dunia berwarna biru dan membulat (`drawMobil`), sedangkan kedua close-up menggambar mobil sendiri dari kotak dan prisma abu `#78929A` dengan bentuk dan posisi lain. Dalam satu video ada tiga versi mobil.
- Penyebab: `DETAIL_SYSTEM` membolehkan "call the listed object functions … or model new parts from primitives", `detailRequest` hanya memberi nama fungsi, ukuran, dan keadaan tanpa tampilan atau posisi, `detailProblems` hanya uji kering, dan penilai close-up tidak melihat adegan dunia sebagai pembanding. Gemini memilih menggambar ulang.
- Bandingan lemo-opuscar: konsistensi di sana datang dari arsitektur, bukan prompt. Satu fungsi gambar per benda, dan close-up hanya geser dan zoom kamera di dunia yang sama.
- Perbaikan: benda di `detail.objects` wajib lewat `drawX` dan ditempatkan di posisi dunianya; primitif hanya untuk bagian dalam, potongan, kawat, medan, aliran, dan panah. `missingObjectCalls` (komentar dibuang dulu) menolak close-up yang tidak memanggil `drawX`, dan pesan tolakannya dikirim balik lewat `writeUntilValid`.
- Jebakan: cek ini hanya memastikan `drawX` dipanggil, belum mencegah model menambahkan salinan kedua di samping pemanggilan itu. Kalau masih muncul, tambahkan pembanding frame dunia ke penilai close-up.

## Kartu judul pembuka buatan AI (11 November 2026)

- Permintaan user: judul video punya animasi berbeda sesuai tema, seperti sampul Shorts (kalimat pengantar kecil dan kata kunci besar dua warna). User menolak usulan awal berupa 4 tema tetap: "harusnya AI model bisa menentukan".
- lemo-opuscar tidak punya arahan judul per tema. Yang dipakai darinya: hook dalam 3 detik pertama tanpa logo yang muncul pelan, dan waktu baca sekitar huruf ÷ 15 + 1,5 detik.
- Keputusan: Gemini menulis komponen React utuh (`IsoTitle.tsx`), bukan memilih preset. Batas kreativitasnya hanya kontrak (`TITLE_TEXT`, `TitleCard({ duration })`), daftar font, aturan tata letak (di bawah 7% atas sampai sekitar 55% tinggi frame, margin 7%), dan aturan anti-ngarang.
- Daftar font dipisah ke `title-fonts.ts` tanpa `'use client'`, karena `prompts.ts` berjalan di server. Mengimpor modul client dari kode server Next bisa mengubah ekspornya menjadi referensi client.
- `useTitleFont` memilih bobot font terdekat dari `getInfo()`, jadi tebakan bobot yang salah tidak membuat render gagal.
- `compileVirtualProject` punya error boundary sendiri yang menampilkan kartu error, jadi render tidak gagal saat judul crash. Pratinjau penilai membungkus judul dengan `TitleBoundary` berlatar magenta, lalu frame yang hampir seluruhnya magenta dianggap crash.
- Jebakan yang sempat terjadi: `buildWorldScenes` memetakan semua beat rencana, sehingga memberinya satu durasi saja melempar error, dan error itu terjadi sebelum `.catch` sehingga bisa menggagalkan seluruh job. Sekarang pembuatan tugas judul ada di dalam rantai promise, dan bidikan lebar dibuat dari rencana dengan satu beat.

## Desain subtitle buatan AI (11 November 2026)

- User ingin subtitle juga diserahkan ke AI supaya lebih kreatif. Keputusan: AI hanya mendesain tampilan, sedangkan mesin tetap mengatur waktu. Alasannya, subtitle tampil sepanjang video dan harus pas dengan suara per kata, sementara pembagian 5 kata dan area aman platform sudah teruji. Kode model yang error di sini akan merusak seluruh video, tidak hanya 3 detik seperti judul.
- `CaptionTrack` (di `world/caption-track.tsx`) menggantikan `CaptionPill` di `WorldOverlay`, dengan perilaku default yang sama (`DefaultCaption`). Bedanya, adegan tanpa kata tidak lagi menampilkan pil kosong.
- Desain subtitle ditulis setelah judul supaya bisa memakai font dan warnanya. Keduanya berjalan bersamaan dengan gambar benda, jadi biasanya tidak memperpanjang job.
- Prompt melarang ukuran kata aktif berubah di tata letak (hanya boleh `transform`), karena kata yang bergeser setiap kali sorotan pindah melelahkan dilihat sepanjang video. Penilai punya kriteria "calm" untuk hal ini.
- Deteksi crash di pratinjau memakai `position: fixed` berlatar magenta di dalam boundary, karena subtitle berada di kotak bawah, bukan memenuhi frame.

## Spike mesin Story Canvas dengan Gemini (11 November 2026)

- Pemicu: user puas dengan Isometrik Canvas dan bertanya apakah Story bisa memakai cara yang sama. Hipotesis: yang membuat Isometrik bagus adalah mesin yang memberi gaya otomatis, bukan Canvas-nya. Jadi Story butuh mesin 2D sendiri, bukan sekadar pindah dari SVG ke Canvas.
- Mesin `src/motion-kit/story-canvas/engine.ts` (`createStory`): tampak samping, satuan meter, y ke atas, garis tanah y = 0. Setiap bentuk (`rect`, `circle`, `ellipse`, `poly` dengan `smooth`, `capsule`) otomatis diberi pita bayangan di kanan-bawah dan sorot di kiri-atas, dibuat dari jalur bentuk itu dikurangi salinannya yang digeser (`fill('evenodd')` di dalam `clip`), ditambah outline dari warna yang sama yang digelapkan. Ada juga `ground`, `band`, `shadow`, `glow`, `line` dengan aliran dash, `layer(depth)` untuk parallax yang bergeser dari kunci kamera pertama, `camPath`, `at`/`rotate`/`scale`/`fade`, dan label (memakai `layoutLabels` dari iso).
- Orang hanya lewat `s.person()`, digambar di atas rangka HumanRig. `story-canvas/rig.ts` adalah salinan bertipe dari bagian matematika `HUMAN_RIG_SOURCE` (tanpa komponen SVG). Test membandingkan semua pose dan jalan dengan sumber aslinya lewat `loadHumanRig`, jadi keduanya tidak boleh menyimpang. Kostum yang tersedia: rambut (short, long, bun, curly, bald, hijab, cap), atasan, bawahan, celana atau rok, lengan panjang, celemek, jas, kacamata, ekspresi, dan benda di tangan (`hold`).
- Contoh tulisan tangan (dapur, adonan mengembang) ada di `src/lib/explainer/story-canvas/examples.ts` bersama `STORY_STYLE`, dan ikut dalam prompt.
- Skrip `scripts/spike-story-canvas.ts` memakai putaran yang sama dengan spike iso: tulis, uji kering, render 4 frame, nilai, lalu perbaiki (maksimal 2 putaran, ambang 6). Kriteria "isometricCorrectness" diganti "characters".
- Hasil Gemini (`ag/gemini-3.8-flash-high`), satu percobaan per topik:
  - Sawah diairi: 5,0 lalu 5,2, sekitar Rp1.400.
  - HP sebelum tidur: 5,8, sekitar Rp2.100 (revisi tidak mengembalikan kode).
  - Cuci tangan pakai sabun: 4,6 lalu 5,6, sekitar Rp2.000.
  - Waktu tulis per putaran 36–152 detik. Skor ini setara spike pertama Isometrik (5,2–5,8), sebelum ada gaya rumah dan contoh AC.
- Yang sudah jalan: tempat langsung dikenali (sawah dengan bukit dan padi berbaris, kamar malam dengan jam dan lampu meja, wastafel dengan keran dan sabun). Gemini juga kreatif, misalnya lingkaran pembesar kuman di adegan cuci tangan dan genangan air yang naik di sawah. Warna gelap hanya muncul di topik malam.
- Kelemahan utama ada di karakter (skor 3–5), dan sumbernya rig, bukan Gemini:
  - Pose terbatas. Tidak ada pose membungkuk, jongkok, berbaring, mencuci tangan, atau melihat HP, sehingga orang hanya berdiri kaku. Contohnya, orang di topik HP berdiri di samping kasur, bukan berbaring.
  - Kaki selalu lurus.
  - Gemini menumpuk caping di atas `hairStyle: 'cap'`.
- Kelemahan lain: label berisi fakta yang tidak ada di narasi ("Batang padi punya rongga udara khusus"), karena spike tidak punya rencana narasi. Di pipeline, label harus berasal dari rencana seperti `iso-canvas/plan.ts`. Selain itu, sepertiga bawah frame sering berisi tanah kosong.
- Jebakan: pengecekan identifier terlarang di spike iso ikut membaca komentar, jadi komentar seperti `// window with a sky view` ditolak. Spike Story membuang komentar sebelum mengecek.
- Hasil di `storage/spike/story-canvas/{example,sawah,hp-tidur,cuci-tangan}/` (frame per putaran, `critique.json`, `clip.mp4`, `summary.txt`).
- Pose tambahan khusus Story di `story-canvas/rig.ts`, tidak ditambahkan ke HumanRig asli:
  - `bend`: membungkuk, tangan ke arah tanah.
  - `crouch`: jongkok.
  - `kneel`: berlutut satu kaki.
  - `phone`: kedua tangan memegang benda di depan dada, kepala menunduk.
  - `wash`: lengan bawah datar di depan pinggang.
  - `wave`: melambai.
  - `lie`: berbaring telentang.
- Semua pose baru dicek lewat test: telapak kaki tetap di y = 0. Bahu di rig diukur relatif terhadap badan, jadi pose membungkuk menambahkan sudut condong ke sudut bahu supaya lengan tetap menggantung.
- Cara kerja `lie`: `person()` menggambar figur berdiri, lalu memutarnya seperempat putaran di sekitar panggul dan menurunkannya sampai punggung menempel di permukaan y. Kepala mengarah ke `facing` dan wajah menghadap ke atas. Selama diputar, figur di dalamnya selalu menghadap berlawanan dengan sisi kepala supaya tidak meloncat di tengah blend.
- Ditambahkan juga `hairStyle: 'caping'`, dan prompt melarang menggambar topi lagi di atasnya.
- Uji ulang Gemini setelah pose ditambah, satu percobaan per topik:
  - Sawah: 4,6 lalu 4,8, sekitar Rp1.400. Petani memakai caping dan `bend`.
  - HP sebelum tidur: 5,0 lalu 5,6, sekitar Rp3.400. Orang duduk di tepi kasur sambil memegang HP dengan `sit` → `phone`, menggantikan versi lama yang berdiri di samping kasur.
- Pose dipakai dengan benar, tetapi skor tidak naik (selisihnya masih dalam rentang kebetulan satu percobaan). Keluhan penilai bergeser ke komposisi dan label:
  - Di sawah, kamera bergeser menjauh sehingga petani keluar frame, dan saat blend `bend` → `point` hanya lengannya yang tersisa di tepi atas.
  - Penunjuk label masih meleset.
  - Kalau dilanjutkan, uji kering bisa mengecek apakah kepala dan kaki setiap orang tetap di dalam frame di semua waktu sampel, lalu masalahnya dikirim balik ke penulis. Ini lebih baik daripada hanya menambah aturan di prompt.
- Hasil di `storage/spike/story-canvas/{poses,sawah-v2,hp-tidur-v2}/`.
- Penilaian user (11 November 2026) setelah menonton: hasil Story dengan Canvas lebih rapi. Belum ada keputusan untuk menjadikannya jalur generate.

## Desain panel judul adegan buatan AI (11 November 2026)

- User menilai panel atas (bar warna solid dan gradasi tipis) terlalu sederhana, lalu meminta panel juga diserahkan ke AI. Polanya sama dengan subtitle: AI mendesain tampilan, mesin menentukan isi.
- Angka tetap dihitung mesin (`panelAt`): angka baru muncul setelah cerita menyebutnya, dan hitung naiknya berlangsung 1,4 detik. Desain hanya menerima `number.reached`, `value`, `history`, dan `all`, jadi tidak bisa mengarang angka.
- Batas `maxBottom` di 29% tinggi frame, karena label adegan Canvas (`LABEL_TOP`) mulai di 31% dan close-up menjaga subjeknya di bawah 30%. Kalau panel lebih tinggi, label dan subjek akan tertutup. Penilai memeriksa ini di kriteria komposisi.
- `Hud` dipindah ke `world/panel-track.tsx` sebagai `DefaultPanel` tanpa perubahan tampilan. `WorldOverlay` dipakai juga oleh `IsoVideo` dan `IsoPicture`, jadi render default dibandingkan dengan screenshot lama.
- Urutan job: judul selesai lebih dulu, lalu panel dan subtitle ditulis bersamaan dengan memakai kode judul. Semuanya berjalan selagi benda digambar.

## Pipeline Story Canvas menjadi Story 2D (12 November 2026)

- Keputusan user: setelah memahami aturan baru Isometrik (judul, subtitle, dan panel didesain AI), Story Canvas dijadikan pipeline sungguhan. Karena belum ada pengguna, Story Canvas langsung menggantikan kartu "Story 2D" di halaman utama. Kartu mesin lama (preset `story-svg`) disembunyikan untuk proyek baru dan diberi label "Story 2D (versi lama)" supaya proyek lama tetap bisa dibuka. Preset baru bernama `story-canvas` dan tidak lagi khusus admin. Contoh prompt yang dulu memakai Full SVG sekarang membuat proyek `story-canvas`.
- Keputusan user: tidak ada konfirmasi draf objek, sama seperti Isometrik. Kalau tokoh atau tempat sering meleset, opsi berikutnya adalah jeda setelah rencana dan sebelum menggambar, dengan tombol setujui otomatis.
- Arsitekturnya sengaja meniru Isometrik Canvas:
  - Rencana dari narasi (`story-canvas/plan.ts`) berisi pemeran dengan tampilan tetap, 1–3 tempat dengan lebar dalam meter, props dengan posisi dan tinggi permukaan, close-up, dan beat. Setiap beat berisi tempat, fokus, aktor (x, arah, pose, poseTo, walkTo, `on`, hold), dan perubahan keadaan.
  - Gemini hanya menulis fungsi props (`StoryProps.ts`), fungsi tempat (`StoryPlaces.ts`), dan close-up.
  - Adegan biasa berupa data di `StoryScenes.ts`, bersama `world` (peta tempat, props, dan pemeran). `paintStoryScene` menggambar tempat, props, orang, props depan, lalu label.
- Orang tidak pernah ditulis model, jadi tampilan tokoh sama persis di semua adegan. `placeActor` menaruh orang yang duduk atau berbaring di atas permukaan props (tinggi panggul dihitung dari rig), sehingga rencana tidak perlu tahu ukuran rangka.
- Kamera membingkai semua aktor beat itu ditambah props fokus. Kamera bergerak dari bidikan sebelumnya hanya di tempat yang sama. Pindah tempat atau kembali dari close-up dihitung sebagai potongan (cut), bukan geser.
- Putaran mutu memakai `improve` dari Isometrik. `improve` kini menerima `criticSystem`, dan `IsoQualityItem.kind` mendapat `prop` dan `place`. Judul, subtitle, dan panel memakai prompt Isometrik yang sama, dengan pratinjau dari tempat dan props pengganti. Hasilnya disimpan di `StoryTitle.tsx`, `StoryCaption.tsx`, dan `StoryPanel.tsx`.
- Uji kering akhir memakai `framing: true`, yaitu memeriksa kepala dan kaki setiap orang di dalam frame setelah kamera tiba (bukan di t = 0, karena kamera masih bergerak).
- Revisi chat belum ada untuk gaya ini. Rute revisi dan studio mengatakannya dengan jelas, dan pesan selesai tidak menyarankan revisi.
- Jebakan pita kamera: pita Isometrik potret (pusat 58%, tinggi 46%) membuat kaki dan kasur tertutup kotak subtitle AI, yang mulai sekitar 62% tinggi frame. Story memakai pita sendiri untuk potret, yaitu pusat 46,5% dan tinggi 31% (antara panel 29% dan subtitle 62%). Orang jadi lebih kecil, sekitar 490 px untuk tinggi 1,7 m. Rasio 4:5 dan 16:9 masih memakai pita Isometrik dan belum diuji.
- Jebakan zoom close-up: di job pertama Gemini menulis `s.look(0, -0.08, 1.05)`, mengira zoom adalah faktor skala, sehingga gambar mata hanya sebesar 1 piksel dan frame kosong. Putaran perbaikan tidak membantu (3,0 → 3,2) karena penilai hanya melihat frame kosong. Prompt close-up sekarang menjelaskan zoom dalam piksel per meter dengan contoh angka. Uji kering menolak close-up dengan zoom di bawah 100, diukur dari `s.P(1, 0) − s.P(0, 0)` setelah adegan digambar.
- Job 1, "Kenapa main HP sebelum tidur bikin susah tidur?" (`proj_1794415984595_storyjob`, sebelum dua perbaikan di atas):
  - 5 adegan, 31,7 detik. Generate 860 detik, export 28 detik.
  - 30 panggilan Gemini, 172.940 token masuk dan 176.234 keluar, sekitar Rp14.300.
  - Skor: props 6–6,5, tempat 6, judul 7,2, panel 6,8, subtitle 7,2. Kedua close-up kosong (3,2 dan 3,4), dan subtitle menutupi orang.
  - Pose `phone` dan berbaring di atas kasur tampil benar.
- Job 2, "Kenapa sawah harus selalu diairi?" (`proj_1794417015607_storyjob`, setelah perbaikan):
  - 6 adegan, 34,3 detik. Generate 419 detik, export 18 detik.
  - 29 panggilan Gemini, 175.435 token masuk dan 116.711 keluar, sekitar Rp10.300.
  - Frame MP4 diperiksa: kedua close-up terisi (potongan batang dengan rongga udara 5,8, akar dengan nutrisi 6,6), dan petani berada di atas kotak subtitle. Petani bercaping memakai pose `bend`, `point`, dan `wave`.
  - Yang lemah: tempat sawah 5,2 (air hanya pita tipis dan padi hanya satu rumpun, bukan barisan), rumpun padi 4,8, label close-up yang rendah tertutup subtitle, dan setengah bawah frame berisi tanah gelap.
- Hasil frame di `storage/spike/story-canvas/{job-hp-frames,job-sawah-frames}/sheet.jpg`.

## Subtitle menutupi isi di 16:9 (12 November 2026)

- Laporan user: di `proj_3458ee93…` (Borobudur, Story 2D, 16:9) subtitle menghalangi konten. Frame menunjukkan kotak subtitle AI dua baris setinggi sekitar sepertiga frame (55–90%), sedangkan kamera menaruh orang dan candi di 25–75%.
- Penyebab 1: prompt desain subtitle, judul, dan panel menyuruh mengukur dari `width` ("0,045–0,07 × width"). Di 16:9 lebar 1920 menghasilkan huruf 86–134 px pada frame setinggi 1080. Ini juga berlaku untuk Isometrik 16:9 karena prompt-nya sama. Sekarang ukuran dihitung dari sisi terpendek (`unit = Math.min(width, height)`), dan subtitle dibatasi paling lebar 0,8 × width.
- Penyebab 2: Story 2D di 16:9 dan 4:5 masih memakai pita kamera Isometrik (pusat 50%, tinggi 50%). Sekarang pitanya pusat 47% dengan tinggi 38% untuk 16:9, dan pusat 47% dengan tinggi 34% untuk 4:5.
- Proyek itu diperbaiki lewat skrip sekali pakai. Bidikan disusun ulang dari `storyCanvasPlan` tanpa panggilan model (close-up dibiarkan), subtitle didesain ulang (skor 8,6), lalu `MainVideo.tsx` disusun ulang. Cadangan ada di `storage/spike/story-canvas/backup-proj_3458ee93….json`. Frame sesudahnya ada di `storage/spike/story-canvas/bug-16x9-fixed/sheet.jpg`: subtitle satu baris kecil di bawah, orang dan candi di atasnya.
- Sisa masalah: close-up "saling mengunci" mengatur kameranya sendiri, sehingga bagian bawah balok masih tertutup subtitle. Proyek Isometrik 16:9 lama tetap memakai desain subtitle lamanya.

## Story 2D: tokoh opsional, skala nyata, keadaan tempat (12 November 2026)

- Pemicu: proyek Krakatau (`proj_4a149b34…`) rapi (skor 5,8–8,4), tetapi ada tiga masalah. Gunung dan tsunami dibuat setinggi 1,8 m supaya muat di samping "pengamat pesisir", sehingga mirip diorama kelas. Langit tidak menggelap saat narasi berkata "siang jadi malam". Tokoh hanya menunjuk di ketujuh adegan.
- Keputusan user: tokoh hanya muncul jika diminta atau jika ceritanya memang butuh, seperti di Full SVG dulu. Selebihnya AI bebas dan kreatif, misalnya topik jantung menampilkan organ sesuai prompt.
- Catatan sutradara dan prompt rencana Story 2D kini menampilkan inti topiknya. Orang hanya muncul untuk aksi manusia (memasak, bertani, kebiasaan memakai HP) atau bila diminta, dan contoh JSON memakai `cast: []`.
- Skala nyata dalam meter: lebar tempat 0,01–20.000 m, ukuran props tanpa batas 12 m. `fitStoryZoom` memakai margin yang sebanding dengan ukuran subjek dan zoom 1e-4 sampai 1e7. Test: jantung 12 cm dibingkai dengan zoom di atas 2.000 px/m, gunung 2,5 km di bawah 1 px/m. Bidikan lebar tanpa aktor dan fokus membingkai semua props tempat itu, atau seluruh lebar tempat.
- Tempat punya `states` sendiri (langit gelap, malam, letusan di kejauhan). `set` beat boleh menunjuk id tempat, dan `StoryPlaceDraw` sekarang `(s, t, state)`. Prompt tempat meminta keadaan mengubah seluruh latar, dan contoh dapur memakai keadaan `malam`.
- Gaya rumah penulis tidak lagi membahas orang, karena penulis memang tidak bisa menggambar orang. Penilai tempat memberi 10 untuk kriteria karakter jika tidak ada orang.
- Uji job topik jantung dihentikan atas permintaan user, yang ingin mencobanya sendiri. Proyek setengah jadi `proj_1794421246750_storyjob` tertinggal dengan status generating. Perubahan ini belum diuji lewat job nyata.
- Proyek jantung buatan user (`proj_f0f12543…`) gagal di rencana tiga kali dengan pesan "The answer did not follow the required format". Setelah panggilan rencana diulang, penyebabnya ketemu: `props.0.states` berisi lebih dari 3 item. Jantung secara wajar punya banyak keadaan, dan prompt baru memang meminta setiap beat berubah. Sekarang daftar keadaan (maksimal 6), `set` (8), close-up (2), pemeran (3), dan aktor (3) dipotong, tidak lagi ditolak. Teks pendek seperti headline dan label juga dipotong. Props dinaikkan menjadi maksimal 8. Pesan gagal sekarang menyertakan detail skema. User ingin mencoba ulang sendiri, jadi perbaikan ini belum diuji lewat job.

## Primitif gerak Story 2D, Tahap 1 rencana kualitas (12 November 2026)

- `src/motion-kit/story-canvas/motion.ts` berisi matematika murni:
  - `samplePath`: Catmull-Rom dengan panjang busur.
  - `pointAt`: titik dan arah di jarak tertentu sepanjang jalur.
  - `flowParticles`: partikel di jalur sebagai fungsi `t` saja. Jumlahnya dihitung dari meter dibagi jarak antarpartikel, sehingga stabil di semua zoom dan tidak berkedip. Ada sedikit acakan per partikel supaya tidak terlihat seperti ban berjalan, dan partikel memudar di dekat ujung jalur.
  - `emitParticles`: kelahiran partikel dengan jadwal tetap `k / rate`, sehingga frame paralel saat export selalu sama.
  - `beatAt` dan `oscAt`: siklus berirama dan gelombang.
- Mesin menambah `s.tube`, `s.flow`, `s.flowArrow`, `s.emit`, `s.beat`, dan `s.osc`. Partikel digambar langsung ke canvas tanpa bayangan dan sorot otomatis, karena jumlahnya bisa ratusan per frame.
- Jebakan: sel darah biru di pembuluh biru hampir tidak terlihat. Sekarang setiap partikel diberi tepi terang, dan prompt meminta warna aliran jelas lebih terang dari tabungnya.
- Penilaian dari foto diam tidak cukup untuk gerak. Lembar uji dibandingkan lewat tiga frame berjarak 0,2 detik yang diambil dari MP4.
- Pengujian yang memanggil model untuk fitur ini memakai GPT-6.1 Terra (`gpt-terra`), atas permintaan user 12 November 2026.

## Bagian props dan kamera bercerita, Tahap 2 rencana kualitas (12 November 2026)

- Geometri bagian ditulis oleh penulis props, bukan oleh perencana. Perencana tidak tahu di mana serambi kanan digambar, jadi ia hanya memberi nama `parts` dan `flows`. Penulis mengekspor `drawNameMap` di koordinat props, lalu server membacanya lewat VM (`readPropMaps`, hasilnya di-clone ke JSON) setelah props selesai dan menyusun ulang bidikan dengan `buildStoryScenes(plan, timings, frame, maps)`. Bidikan sebelum props jadi (`draftScenes`) hanya dipakai untuk mengetahui beat mana yang close-up.
- Jenis bidikan: `close` membingkai bagian × 1,7, karena bagian × 1 terlalu rapat (serambi kanan terpotong). `medium` berukuran bagian × 2,2 tetapi tidak lebih besar dari 0,8 × props. Batas ini perlu, karena × 3,2 di uji pertama malah lebih lebar dari bidikan wide.
- `follow` memakai kunci kamera `glide`: `camPath` mengisi kunci ini secara linear, tidak di-ease. Tanpa itu kamera berhenti sebentar di setiap kunci, karena `ramp` adalah smoothstep per segmen.
- Zoom sebelum close-up (match cut) menghapus kunci yang jatuh di 0,6 detik terakhir. Karena itu perjalanan `follow` dibuat selesai di `d − 0,65` kalau adegan berikutnya close-up, supaya tidak terpotong.
- Pemeriksa rencana menolak dua beat berurutan dengan fokus, bagian, dan jenis bidikan yang sama, kecuali beat kedua memakai `follow`. Inilah penyebab kamera diam selama 32 detik di video jantung.
- Contoh rujukan baru di `examples.ts`: `EXAMPLE_HEART` (empat ruang, katup, detak `s.beat`, dua aliran sel darah dari peta yang sama) dan `EXAMPLE_CHEST` (rusuk, paru-paru bernapas, diafragma). Keduanya lolos `propProblems`/`placeProblems`. Ini juga bahan untuk Tahap 5.
- Perbaikan sampingan: `WorldOverlay` tidak lagi membuat `<Audio>` untuk adegan tanpa audio. Sebelumnya `staticFile('')` mengambil `/public/` dan render MP4 gagal dengan 404.
- Test preset di `world-video.test.ts` diperbarui untuk preset `story-canvas`. Test itu gagal sejak preset ditambahkan, dan baru ketahuan saat suite penuh dijalankan.

## Tahap 3–6 rencana kualitas Story 2D (12 November 2026)

- Tahap 3: `set[].word` dan `beat.cue`. `wordTime` mencocokkan kata pertama `cue` dengan `wordTimings`: sama persis, mengandung atau terkandung (minimal 4 huruf), atau dengan peluluhan awalan Indonesia (p/t/k/s hilang setelah me-/pe-, misalnya pompa → memompa). Jebakan yang ketahuan dari test: "pompa" tidak ada di dalam "memompa", karena huruf p luluh.
- Kamera dengan `cue` yang jatuh terlambat menahan bidikan lama dulu, lalu bergerak dengan waktu tempuh biasa (1,1 detik) supaya tiba tepat di kata itu.
- Tahap 4: `propMoves` menggambar props di 1,1 vs 1,6 detik dan 2,3 vs 2,9 detik dengan keadaan sama, lalu membandingkan rekaman panggilan canvas. Props `moves` atau yang punya `flows` wajib bergerak di keadaan 0 maupun 1. Jebakan: pratinjau props dulu memanggil props dengan `t = step × 0,4`, sehingga frame dalam satu detik selalu identik dan penilai tidak pernah melihat gerak.
- Tahap 5: contoh rujukan di prompt adalah jantung dan pompa air untuk props, serta dapur dan rongga dada untuk tempat. Aturan latar penuh ditambahkan.
- Tahap 6, temuan dari lima topik dengan GPT-6.1 Terra:
  - Topik bentang alam butuh diagram potongan. Siklus air berskala asli menghasilkan sungai dan laut berupa pita tipis (skor sungai 1,4). Setelah aturan diagram potongan dan penolakan props yang lebih pipih dari 8:1, skor naik ke 5,2–7,4 dan frame terisi.
  - Pemeriksaan bingkai orang tidak boleh menggagalkan video. Bidikan dekat ke HP di tangan wajar memotong tubuh. Sekarang adegan punya `keep` (pemeran yang wajib utuh, hanya untuk bidikan yang tidak memfokuskan bagian props), dan hasil pemeriksaan bingkai hanya dicatat sebagai peringatan.
  - Bidikan `follow` awalnya membingkai 35% panjang jalur, terlalu dekat sampai jantung hilang. Sekarang ukurannya maksimal dari 0,75 × bentang jalur, 0,55 × props, dan 2,2 × bagian. Proyek jantung disusun ulang tanpa model dari rencana dan peta yang tersimpan.
  - `PUSH` dinaikkan dari 1,06 ke 1,1 supaya tahan bidikan tidak terasa diam.
  - Pemeriksa bagian diam (`motion-check.ts`: 120 × 80 piksel, setiap 0,5 detik, ambang 6/255) tidak membaca partikel aliran yang kecil. Video yang alirannya jelas bergerak tetap dilaporkan punya 1–4 bagian diam. Alat ukurnya perlu dibuat lebih peka sebelum target "tidak ada bagian diam lebih dari 3 detik" bisa dinilai.
- Jebakan skrip: di zsh, `$J --prompt ...` dengan `J="npx tsx ..."` tidak dipecah menjadi kata, sehingga job gagal dengan "no such file or directory". Pakai fungsi shell. `spike-iso-job.ts` sekarang punya `--drawing-model` dan tidak mencoba export bila ada adegan gagal.
- Frame semua uji ada di `storage/spike/story-canvas/accept/{jantung,hujan,hujan2,kulkas,listrik,hp2}/sheet.jpg`.
