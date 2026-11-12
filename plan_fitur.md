# Plan Fitur gmotion

Terakhir diperbarui 11 November 2026.

Rencana pustaka aset reusable, pengaturan warna dan tema, serta integrasi video
berbasis aset tersedia di [plan_asset.md](plan_asset.md). Dokumen tersebut membedakan
aset yang baru diuji lewat demo dari fitur yang sudah tersambung di aplikasi.

## Aturan teknis

Aturan ini wajib diikuti oleh AI, model, atau developer mana pun yang mengerjakan project ini.

### Sebelum mulai

1. Baca [CLAUDE.md](CLAUDE.md), [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md), dan seluruh aturan ini.
2. Pilih item dari Prioritas berikutnya, kecuali user meminta yang lain.
3. Kerjakan satu tujuan pada satu waktu. Perubahan di luar item itu harus ditanyakan dulu.
4. Jangan bekerja langsung di `main`. Commit dan push hanya saat diminta.

### Arti checklist

- `[x]` berarti user sudah bisa memakainya di aplikasi dan hasilnya sudah diverifikasi.
- Uji coba yang hanya berjalan lewat script ditulis `[ ] (uji coba)`, walaupun berhasil.
- Lolos test bukan berarti selesai. Fitur video atau audio wajib dibuktikan dengan satu hasil nyata.
- Tulis batasan yang masih ada pada item tersebut. Jangan mencentang sebagian.

### Definisi selesai

Sebuah item boleh dicentang hanya jika semua ini terpenuhi:

1. `npx vitest run` lulus, dan ada test baru untuk perilaku baru.
2. `npx tsc --noEmit --incremental false` dan `npx eslint src` bersih.
3. Alurnya dijalankan nyata dari awal sampai akhir, termasuk export jika menyentuh video atau audio.
4. Frame hasil render sudah diperiksa jika menyentuh visual.
5. Hal yang tidak bisa diverifikasi dilaporkan terus terang, misalnya kualitas audio yang perlu didengar user.
6. `plan_fitur.md` dan `docs/KNOWLEDGE.md` sudah diperbarui.

### Arsitektur

- Bangun sistem umum. Dilarang menulis komponen, prompt, atau kondisi khusus untuk satu topik.
- Kode buatan AI wajib lolos `validateSceneCode` sebelum disimpan atau dirender.
- Kode adegan hanya boleh memakai `react`, `remotion`, `lucide-react`, dan `@/motion-kit`.
- Adegan ilustrasi wajib mengikuti kontrak di [asset-contract.ts](src/lib/explainer/asset-contract.ts). Panggung tidak boleh tahu topiknya.
- Preview dan export wajib memakai kode komposisi yang sama supaya hasilnya tidak berbeda.
- Kegagalan satu adegan tidak boleh menggagalkan seluruh video. Tandai kegagalan atau versi sederhana secara jujur di UI.
- Dilarang melaporkan sukses palsu, memakai progress palsu, atau menyembunyikan fallback.
- Ikuti pola yang sudah ada. Jangan menambah library atau abstraksi baru tanpa alasan yang jelas.

### Video

- Semua animasi harus deterministik dan dihitung dari frame. Dilarang memakai `Math.random`, `Date.now`, timer, serta CSS transition atau keyframes.
- Teks penting wajib berada di area aman, dan gambar tidak boleh menimpa judul atau subtitle.
- Warna dan terang-gelap dipilih dari topik. Warna gelap boleh jika sesuai, tetapi tidak boleh menjadi kebiasaan.
- Teks wajib memenuhi kontras: 4,5:1 untuk teks biasa dan 3:1 untuk teks besar.
- Efek, partikel, dan gerakan harus punya fungsi menjelaskan. Hindari dekorasi tanpa tujuan.
- Subjek utama harus besar dan jelas. Adegan kosong atau objek kecil di area luas dianggap gagal.
- Keputusan kualitas akhir ada pada user saat menonton. Skor kritik hanya penyaring.

### Konten

- Narasi memakai Bahasa Indonesia yang natural.
- Dilarang mengarang statistik, harga, promo, testimoni, sertifikasi, atau klaim performa.
- CTA hanya untuk iklan atau jika diminta, dan hanya memakai penawaran dari user.
- Struktur adegan mengikuti topik. Dilarang memakai template tetap seperti hook, mechanism, proof, CTA.
- Referensi hanya menjadi acuan format. Dilarang menyalin aset, logo, atau identitas kreator lain.

### Audio

- Narasi tetap menjadi suara utama, dan musik wajib mengecil saat narasi.
- Hasil akhir tidak boleh clipping.
- Musik dan SFX harus aman dipakai secara komersial.

### Model AI

- Gemini adalah model utama. Jangan memakai Opus atau model mahal untuk uji tanpa izin user.
- Penilaian gambar wajib memakai model yang benar-benar menerima gambar, dan wajib mengecek `imageVisible`.
- Jangan menambah biaya per video tanpa melaporkan dampak waktu dan token.

### Keamanan

- Semua input API wajib divalidasi dengan skema Zod.
- Project id dan nama file wajib divalidasi sebelum menyentuh disk.
- Rahasia hanya boleh berada di `.env`. Jangan menampilkannya di log, dokumen, atau jawaban.
- Jangan menjalankan tindakan yang sulit dibatalkan tanpa konfirmasi user.

### Saat melapor

- Tulis hasil apa adanya, termasuk yang gagal, belum diuji, dan masih lemah.
- Bedakan dengan jelas antara sudah berjalan di aplikasi, berhasil di uji coba, dan masih rencana.
- Sertakan angka nyata: waktu, jumlah adegan, durasi video, dan hasil test.

## Prioritas berikutnya

1. Isometrik Canvas, mulai dari Tahap 1 di bagian [Isometrik Canvas](#isometrik-canvas). Penilaian Isometrik versi gambar AI tidak dilanjutkan.
1a. Penilaian user atas video Story 2D dan Ads.
1b. Story 2D: rencana kualitas menuju video yang hidup, mulai dari Tahap 1 (primitif gerak) di bagian [Story 2D: rencana kualitas](#story-2d-rencana-kualitas-menuju-video-yang-hidup).
2. Rapikan kualitas akhir video dan audio, berdasarkan penilaian itu.
3. Keamanan dan penjualan sebelum dibuka ke publik.

## Pondasi

- [x] Upgrade Next.js ke 15.5.29 dan tutup kerentanan dependency produksi
- [x] Commit pekerjaan timelapse
- [x] Tes otomatis untuk alur utama (459 test)

## Draf dan alur

- [ ] Langsung pindah ke halaman proses saat klik "Susun draf video": kode sudah tersedia di `/studio/new`, dengan skeleton, tahap aktif, waktu berjalan, dan ide yang bisa dibuka/tutup. Setelah selesai, otomatis membuka draf. Muat ulang dan Coba lagi memakai request ID yang sama; server menggabungkan permintaan aktif dan mengembalikan draf yang sudah tersimpan, terpisah per pemilik. Error tetap menampilkan ide, dan Edit ide memulihkan isi form. Verifikasi: 83 test terkait lulus, TypeScript dan build di salinan sumber terpisah lulus; uji browser dengan respons model ditahan membuktikan perpindahan sebelum draf selesai, lebar 320/375/768/1440 px, muat ulang, retry, dan pemulihan prompt. Batasan: browser memakai akun QA lokal dan respons model contoh, belum alur nyata dengan model sampai selesai; seluruh suite dan lint belum diperiksa ulang. Penyimpanan ide hanya berlaku di tab yang sama, dan deduplikasi proses aktif belum memakai antrean terdistribusi
- [x] Prompt hanya membuat draf, belum TTS atau kode
- [x] Jumlah dan isi adegan mengikuti topik, 3–12 adegan
- [x] Layar review draf: judul, narasi, teks, arahan visual
- [x] Tambah, hapus, urutkan, dan pulihkan adegan
- [x] Simpan otomatis dengan percobaan ulang
- [x] Perkiraan durasi di layar draf
- [x] Validasi narasi kosong sebelum generate
- [x] Minta AI memperbaiki draf lewat instruksi: kotak "Minta AI mengubah draf" di layar draf. Gemini menerima draf lengkap dan instruksi, lalu mengembalikan draf utuh. Adegan yang dipertahankan tetap memakai kamera, suara, dan timelapse lamanya. Target durasi di instruksi ("jadikan 30 detik") memakai anggaran kata yang sama dengan pembuatan draf. CTA hanya boleh jika prompt atau instruksi memintanya. Tombol Kembalikan memulihkan draf persis dari server, dan hilang setelah edit manual. Jatah 10 kali per draf (draf masih gratis), dan jawaban rusak dicoba ulang 1 kali tanpa memotong jatah. Kolom draf dikunci selama AI bekerja. Uji Chrome pada draf roti 5 adegan: "lebih santai, gabungkan adegan 2 dan 3, jadikan 30 detik" menghasilkan 4 adegan, perkiraan durasi 59,4 → 31,4 detik, dalam sekitar 45 detik. Kembalikan memulihkan isi yang sama, dan hasil tetap ada setelah halaman dimuat ulang. Batasan: satu permintaan butuh sekitar 45 detik, dan arahan visual adegan baru belum dinilai pada video jadi
- [ ] Kunci durasi sesuai target di prompt: kode membaca durasi yang disebut untuk video ("video 30 detik", "durasi 1,5 menit", "iklan 45 detik"), memberi Director anggaran kata dan jumlah adegan, lalu meminta 1 kali perbaikan jika estimasi meleset lebih dari 15%. Perkiraan durasi di layar draf kini memakai kecepatan bicara terukur 2,1 kata/detik (sebelumnya 2,4). Uji nyata Gemini + TTS: target 30 detik jadi audio 30,1 detik, target 60 detik jadi 58,6 detik; draf saja: 15 → 15,3 dan 45 → 42,6 detik. Batasan: belum dijalankan lewat browser sampai export, perbaikan menambah 1 panggilan Director (sekitar +20–35 detik) hanya saat draf meleset, durasi yang tidak didahului kata seperti video/durasi/iklan tidak terbaca, dan target di bawah 8 atau di atas 300 detik diabaikan
- [ ] Percepat pembuatan draf ke bawah 15 detik (saat ini sekitar 30–40 detik)
- [ ] Uji prompt yang berisi daftar tahap sendiri

## Generate dan editor

- [ ] Tambah adegan baru lewat "Instruksi revisi" setelah video dibuat: belum diimplementasikan. Saat ini revisi studio hanya mengubah adegan yang sudah ada. Penambahan adegan lewat instruksi baru tersedia saat tahap draf. Rencana: pahami posisi sisipan, susun narasi dan visual adegan baru, buat audio serta animasinya, lalu perbarui urutan, durasi, dan komposisi video tanpa merusak adegan lama. Tetap batasi maksimal 12 adegan, periksa hasil render, dan tentukan pemakaian jatah revisinya sebelum implementasi
- [ ] Hilangkan scrollbar yang muncul saat kursor menyentuh daftar progres: perbaikan sudah tersedia, khusus daftar status adegan, tanpa mematikan fungsi gulir. Uji langsung di Chrome pada `proj_1794123988607_cm89`: enam baris muat, scrollbar tidak tampil, dan status berubah dari 5/6 menjadi pemeriksaan semua adegan. Batasan: daftar panjang yang benar-benar perlu digulir dan navigasi keyboard belum diuji langsung; pemeriksaan otomatis lengkap belum dijalankan ulang
- [x] Editor terbuka langsung setelah draf disetujui
- [x] Job latar belakang per adegan, paralel maksimal 4
- [x] Progres per adegan lewat SSE
- [ ] Pratinjau bertambah saat adegan selesai (kode ada dan lolos test, belum disaksikan di browser)
- [x] Coba ulang hanya adegan gagal, dan lanjutkan proses yang terhenti
- [x] Export dikunci selama proses
- [x] Status kembali normal saat export gagal
- [x] Progres export asli: route mengirim persen dari `renderMedia` lewat stream, dan timer palsu dihapus. Lolos test Uji browser 8 November 2026: persen naik 1% → 32% → selesai dalam sekitar 25 detik, dan MP4 benar.
- [x] Revisi chat juga mengubah narasi dan audio: Gemini memisahkan permintaan menjadi narasi baru, judul baru, dan perubahan visual. Narasi baru dibuatkan suara TTS baru, lalu durasi adegan, subtitle, judul, kartu data, dan timing kamera atau aksi disesuaikan oleh kode tanpa model. `MainVideo.tsx` ikut dibuat ulang. Jika adegan buatan model tidak punya subtitle standar, penyesuaian diserahkan ke model, dan jika hasilnya crash, narasi, judul, dan audio lama dikembalikan. Uji nyata sampai MP4: video kopi Story 2D (narasi dipendekkan 8,7 → 5,9 detik dan judul diganti, revisi 19 detik, export 26 detik) dan Full SVG (narasi diperpanjang 9,0 → 12,4 detik plus latar lebih hangat, revisi 128 detik, export 35 detik). Frame MP4 diperiksa: subtitle dan judul baru tampil. Uji browser: "Ganti narasi adegan 2 jadi ..." mengganti narasi, durasi menjadi 4,4 detik, dan MP4 dari tombol Export menampilkan subtitle baru. Penyesuaian tanpa model kini membaca atribut JSX, jadi tetap jalan setelah Gemini menulis ulang format kode adegan. Batasan: timing kamera dan aksi diskalakan sesuai durasi baru, bukan dicocokkan ulang ke kata baru; gambar tidak digambar ulang walau narasi membahas hal baru; kualitas suara dan sinkron aksi menunggu penilaian user saat menonton
- [x] Revisi untuk semua adegan sekaligus: pilihan "Semua adegan" di editor kini merevisi semua adegan yang sudah jadi. Setiap adegan disiapkan paralel, adegan yang tidak terkait dibiarkan, lalu semua adegan yang berubah dicek dalam 1 kali render. Jika pesan menyebut satu nomor adegan ("adegan 2"), hanya adegan itu yang direvisi. Tebakan adegan lama dari kata khusus iklan seperti "omzet" atau "chat" dihapus, dan saran cepat diganti dengan saran umum. Revisi kedua pada proyek yang sama ditolak selama yang pertama berjalan. Uji nyata Gemini dan TTS sampai MP4 pada video kopi 5 adegan: "pendekkan narasi tiap adegan" selesai dalam 26 detik dengan 1 kali cek render, video turun dari 42,7 ke 22,7 detik, export 16 detik, dan frame tiap adegan diperiksa. Uji browser: "Buat warna latar semua adegan lebih hangat" mengubah 5 adegan dalam sekitar 80 detik, semuanya lolos cek render, dan latar hangat tampil di MP4. Pesan yang menyebut "adegan 2" saat "Semua adegan" dipilih hanya merevisi adegan 2. Batasan: permintaan yang menyebut dua nomor adegan merevisi semua adegan lalu bergantung pada penilaian Gemini per adegan
- [x] Cek crash setelah revisi chat: adegan yang direvisi dirender di Chrome (3 frame, hanya adegan itu). Jika crash, AI memperbaiki 1 kali; jika masih crash, adegan kembali ke kode sebelum revisi. Balasan chat kini menyebut hasil apa adanya (lolos, diperbaiki, dikembalikan, kode tidak berubah, atau cek tidak bisa jalan), bukan selalu "telah diterapkan". Uji nyata Gemini pada salinan video kopi: revisi biasa lolos dengan cek 6,3 detik setelah revisi 18,7 detik; crash buatan terdeteksi dan diperbaiki 1 kali, total 32 detik. Uji browser 8 November 2026 di Chrome: revisi satu adegan, semua adegan, dan narasi semuanya menampilkan "lolos cek render". Batasan: jalur "dikembalikan" baru dibuktikan lewat test, dan request revisi kini menunggu cek render sebelum menjawab
- [ ] Job queue sungguhan untuk produksi

## Kualitas visual

Bagian ini berlaku untuk Story 2D dan Ads. Pilihan Isometrik memakai bagian Video 3D.

- [x] Generator aset untuk topik apa pun dengan kontrak yang sama
- [x] Satu ilustrasi per adegan dengan gaya dan warna sama
- [x] Ilustrasi menjadi default semua preset, kecuali adegan CTA
- [x] Warna mengikuti topik, gelap boleh jika sesuai
- [x] Aturan anti-slop di director, generator, dan coder
- [x] Kamera, sorotan bagian, label, dan aliran
- [x] Gambar otomatis pas di panggung dan terpisah dari teks
- [x] Penilaian otomatis dan gambar ulang adegan lemah
- [x] Cek crash per adegan sebelum selesai
- [x] Penanda "Versi sederhana"
- [ ] Uji perbaikan crash pada crash nyata saat generate
- [ ] Uji perbaikan format jawaban gambar ulang pada video baru
- [ ] Larang panel latar penuh yang kosong secara lebih efektif
- [ ] Gaya teks sesuai topik dan kartu data opsional: Director memilih 1 dari 4 gaya (tegas, teknis, editorial, ramah) dan boleh menambah kartu angka, perbandingan, atau urutan. Angka yang tidak diucapkan di narasi membuat kartu dibuang. Uji render 4 gaya dan uji Director 2 topik lolos pada frame. Menunggu penilaian user saat menonton. Batasan: gaya Isometrik dan adegan sederhana belum ikut, belum diuji pada 16:9 dan 4:5, dan render butuh internet untuk Google Fonts
- [x] 28 contoh prompt siap pakai dengan filter gaya di halaman depan
- [ ] Sorotan lembut menggantikan kotak fokus di Story 2D: muncul setelah kamera tiba dan hilang sebelum kamera bergerak lagi. Uji 2 frame video kopi lolos, gerakan penuh belum ditonton. Menunggu penilaian user saat menonton
- [ ] Gambar AI penuh satu frame di Story 2D: prompt meminta tempat nyata dari tepi ke tepi, dan pelat judul padat diganti lapisan tembus. Uji 3 gambar nyata lolos pada frame. Menunggu penilaian user saat menonton. Batasan: gambar lama tetap punya area kosong sampai digambar ulang, dan judul bergantung pada area atas yang tenang
- [ ] Latar penuh sesuai tempat untuk adegan SVG: lingkungan dan latar menembus sampai tepi frame, luar ruang minimal langit dan awan, dalam ruang minimal dinding berpola. Uji nyata 1 adegan DeepSeek Flash lolos pada contact sheet. Menunggu penilaian user saat menonton. Batasan: video lama tetap memakai fade lama sampai digambar ulang, dan kepatuhan model hanya dijaga prompt dan kritik
- [ ] Uji topik abstrak: inflasi dan sejarah
- [ ] Adegan CTA dengan kualitas setara ilustrasi
- [x] Story 2D campuran SVG dan gambar AI dengan rencana momen, maksimal 2 keadaan per adegan. Gambar gagal jatuh ke SVG. Batasan: baru 1 topik lewat tombol, rasio 4:5 dan 16:9 belum diuji, dan kualitas belum dinilai user
- [x] Story 2D Full SVG (`story-svg`): jalur ilustrasi SVG tanpa perencana gambar. Validasi melarang komponen gambar/video dan aset raster pada generasi, perbaikan, revisi chat, dan edit manual. Uji nyata API: 3 adegan, 15,4 detik, generate 177 detik, export 14 detik; tanpa aset gambar, tanpa versi sederhana, frame diperiksa. Pilihan di browser juga diperiksa. Batasan: baru rasio 9:16 dan satu topik; koreografi/kualitas audio belum dinilai user.
- [ ] Koreografi aksi Full SVG: satu view tetap, 1–4 aksi dengan rentang kata narasi, `actionProgress` mengikuti timing suara, kamera diam. Uji nyata topik sabun sampai MP4 berhasil (3 adegan, sekitar 39 detik, tanpa versi sederhana, frame diperiksa). Menunggu penilaian user saat menonton.
- [ ] Kesinambungan antaradegan Full SVG: blok dunia bersama disalin identik ke semua adegan, dan adegan digambar berurutan dari pose akhir adegan sebelumnya. Uji nyata sampai MP4: 2 topik dengan DeepSeek Flash dan 1 topik dengan Gemini, frame sekitar potongan diperiksa. Menunggu penilaian user saat menonton. Batasan: objek di luar `WorldBase` masih bisa berubah bentuk, dan pose di potongan belum selalu menyambung
- [ ] Kamera nyambung antaradegan Full SVG: setiap adegan menulis `camera` (`continue` atau `cut`, plus titik fokus di koordinat dunia bersama). Adegan `continue` mulai dari kamera akhir adegan sebelumnya, terbang selama 1,3 detik ke fokusnya, lalu diam, dan fade di potongan itu dihapus. Adegan `cut` tetap memakai fade. Director diminta menulis visualPrompt sebagai kamera yang masuk ke bagian objek yang sama, dan penggambar dilarang menutup dunia dengan panel close-up. Uji nyata sampai MP4: `proj_1794187214510_job` (gedung tahan gempa, 6 adegan, 77,7 detik, generate 843 detik, export 37 detik). Frame di sekitar 5 potongan diperiksa: zoom ke rangka, turun ke fondasi, dan mundur ke gedung utuh terbaca tanpa fade. 614 test lolos. Menunggu penilaian user saat menonton. Batasan: gambar adegan berikutnya kadang berbeda dari pose akhir adegan sebelumnya, jadi terlihat lompatan tanpa fade (gedung 1→2, close-up 2→3); adegan 3 masih menggambar kotak bingkai di sekitar damper; narasi video uji pertama masih menyebut "Kamera bergerak…" karena dibuat sebelum aturan narasi diperbaiki. Uji ulang `proj_1794190079962_job`: narasi bersih dan adegan 2→5 menyambung rapi, tetapi adegan 1 (penampang lempeng) ke 2 (gedung) masih melompat karena dipilih `continue`; aturan `cut` sudah diperketat tetapi belum diuji dengan video baru
- [ ] Draf objek Full SVG digambar per objek: rencana latar dan objek (label Bahasa Indonesia, ukuran, prop, close-up), lalu `WorldBase` dan setiap objek digambar di panggilan sendiri, dicek render di server (termasuk latar penuh sampai x/y -1000..2000), dinilai dari kartu PNG, dan kartu lemah digambar ulang sekali. Pratinjau menampilkan latar dengan bingkai video. Adegan hanya menerima header komponen. 633 test lolos. Uji nyata draf 2 kali dengan storyboard gedung tahan gempa (322 dan 451 detik). Menunggu penilaian user. Batasan: belum diuji sampai MP4; biaya belum diukur; gedung masih cukup kaku; aturan latar tanpa efek gempa belum diuji ulang
- [ ] Kanvas mengikuti rasio video (16:9 tidak lagi kotak di tengah): kanvas gambar tetap tinggi 1000, tetapi video landscape mendapat lebar sesuai rasio (16:9 → 1778). `AssetStage` membuat panggung persegi panjang sesuai kanvas. Prompt aset, aturan kamera, draf latar/objek (cek celah latar sampai x=W+1000), dan kritik memakai lebar ini dan meminta sisi lebar diisi objek terkait, bukan dibiarkan kosong. Lebar kanvas dicatat di `manifest.canvasWidth` dan `draft.canvasWidth`. Proyek lama tetap memakai kanvas 1000 (adegan baru ikut lebar dunia bersamanya supaya latar dan kamera tidak melompat). 665 test lolos. Uji nyata di salinan `proj_f298…` (air sungai, 16:9) dengan Gemini: adegan 1 dan 6 digambar ulang dengan dunia baru; frame diperiksa: lapisan tanah dan tangki membentang selebar layar, pohon 3 → 8, tangki 3 bak plus pipa masuk/keluar. Menunggu penilaian user. Batasan: proyek lama harus dibuat ulang untuk mendapat kanvas lebar; adegan 1 masih menyisakan pita lapisan yang sedikit lebih sempit dari layar; belum diuji lewat draf objek dan sampai MP4
- [ ] Persentase progres generate: bar satu angka untuk seluruh pembuatan video. Pada Full SVG draf objek mengisi 0–30% dengan label langkah (merencanakan, menggambar per objek, menilai, memperbaiki). Koreksi draf juga menampilkan bar sendiri. 636 test lolos. Belum dicek di browser dan belum dinilai user. Batasan: bobot 30% dan bobot tahap adegan masih perkiraan dari dua uji
- [ ] Pilihan gaya teks judul dan subtitle: 4 pasangan font, saran AI ditandai, bisa dipilih di layar draf dan diganti gratis di studio tanpa menggambar ulang. Adegan sederhana dan CTA kini ikut gaya video lewat `TextStyleProvider`. 639 test lolos. Belum dicek di browser dan belum dirender ke MP4. Batasan: Isometrik belum didukung
- [x] Tab Kode dihapus dari studio atas permintaan user karena terlalu teknis. Studio kini hanya punya tab Revisi dan Storyboard. Route `PUT /api/projects/[id]` untuk menyimpan file tetap ada dan tetap divalidasi, hanya tidak punya tombol di UI. 639 test lolos. Belum dicek di browser
- [x] Pilihan model gambar Gemini atau DeepSeek Flash di halaman utama, tersimpan per proyek dan tampil di daftar proyek serta studio. Uji browser: pilihan tersimpan dan video lebah berhasil dibuat. Batasan: DeepSeek Flash baru diuji pada Story 2D Full SVG, belum pada Campuran, Ads, dan Isometrik
- [ ] Uji DeepSeek Flash pada Story 2D Campuran, Ads, dan Isometrik
- [ ] Model gambar khusus admin: Claude Sonnet 5.5 (`cc/claude-sonnet-5-5`), Claude Opus 5.5 (`cc/claude-opus-5-5`), GPT-6.1 Sol (`cx/gpt-6.1-sol`), dan GPT-6.1 Terra (`cx/gpt-6.1-terra`). Hanya muncul di pilihan model untuk akun di `ADMIN_EMAILS`, dan `POST /api/projects` menolak akun lain dengan 403. Test pemetaan dan izin lolos. Belum diuji nyata lewat gateway atau browser, dan tarif keempat model belum diisi di catatan biaya admin
- [ ] Cek tagihan nyata model gambar `gemini/gemini-3.1-flash-lite-image` (bisa dijawab dari catatan biaya admin di bagian Siap dijual)
- [x] Pemeriksaan bagian video yang diam di job generate: Story 2D Campuran, Ads, dan Isometrik diukur setelah cek crash, dan hasilnya tampil di pesan chat editor. Uji nyata lewat API: Isometrik 5 adegan, 31,1 detik, 5 bagian diam, frame MP4 diperiksa. Batasan: hanya melapor tanpa memperbaiki, baru dikalibrasi di 9:16, Ads belum diuji, Full SVG dikecualikan karena aksi kecil terbaca diam, dan pesan tidak muncul lagi saat Coba ulang jika chat sudah berisi
- [ ] Contact sheet per aksi dan frame potongan untuk kritik: frame menghindari fade, memuat pose akhir tiap aksi, dan Full SVG diawali frame terakhir adegan sebelumnya. Catatan kritik kini tersimpan di `sceneProgress.issues`. Uji nyata Full SVG sampai MP4 berhasil (3 adegan, 45,3 detik). Batasan: pada uji 4 potongan, kritik baru menyebut 1 lompatan secara eksplisit, dan lompatan bentuk panel pada video semut tidak disebut
- [ ] Gerak pada Isometrik: kamera mendorong 8% selama bidikan bertahan, dan tubuh organik yang disorot berdenyut. Uji nyata iklan kasir: 0 bagian diam, sebelumnya 6 bagian pada video paru-paru. Menunggu penilaian user saat menonton. Batasan: denyut tidak ikut menggerakkan benda yang menempel di atas blob

## Audio

- [x] Suara Gemini dengan 6 pilihan dan tombol Dengar
- [x] Dukungan WAV dan percobaan ulang saat rate limit
- [x] Musik latar 4 suasana, dipilih AI per topik
- [x] Ducking musik saat narasi
- [x] SFX per adegan
- [x] Transisi antar-adegan
- [x] Timing subtitle dari jeda audio asli
- [ ] Suara ElevenLabs sebagai pilihan berbayar: dipilih di layar draf, 2 kredit (Gemini 1 kredit, tambahan masih angka sementara). Timing subtitle per kata diambil dari ElevenLabs. Tidak ada fallback ke Gemini jika gagal. Biaya tercatat di halaman admin dengan tarif resmi. Uji nyata di Chrome pada draf roti Story 2D Campuran 5 adegan: saldo turun tepat 2 kredit (53 → 51), generate selesai dalam 320 detik tanpa versi sederhana, 5 MP3 ElevenLabs dengan timing per kata bervariasi (127–1.381 ms), export MP4 64,3 detik dengan audio AAC, dan frame diperiksa. Tercatat 824 karakter ElevenLabs (1 dari 6 permintaan gagal lalu berhasil saat dicoba ulang) dan 4 gambar. Penilaian user 8 November 2026: suara Gemini masih lebih bagus daripada suara ElevenLabs yang dipakai (`ELEVENLABS_VOICE_ID` dengan `eleven_multilingual_v2`). Batasan: kunci belum punya izin `voices_read`, jadi hanya 1 suara dan tanpa tombol Dengar; harga tambahan 1 kredit masih sementara
- [ ] Ganti suara narator di studio (tab Storyboard), berbayar: pilihan suara Gemini dan ElevenLabs dengan tombol Dengar. Semua adegan dibacakan ulang dengan teks yang sama, lalu subtitle, durasi, dan timing kamera atau aksi menyesuaikan lewat `retimeSceneCode` (model dipakai hanya jika adegan tidak punya subtitle standar), dicek render, dan `MainVideo.tsx` dibuat ulang. Biaya `VOICE_CHANGE_CREDITS` = 1 kredit (angka sementara), ditambah tambahan ElevenLabs jika pindah ke ElevenLabs. Kredit dipotong sebelum TTS dan dikembalikan jika ada adegan yang gagal; storyboard baru memakai suara baru jika semua adegan berhasil. Ledger mendapat alasan `voice` dan `voice_refund` (migrasi `0009_voice_change_credits.sql`, membangun ulang tabel karena CHECK). Test fungsi, billing, dan revisi lolos (690). Batasan: belum dicek di browser, belum diuji dengan TTS nyata, migrasi belum diterapkan ke D1 sungguhan, dan sebagian adegan yang gagal membuat video sementara mencampur dua suara sampai diganti lagi
- [ ] Penilaian user atas musik dan SFX
- [ ] Ganti musik dengan track bebas royalti pilihan, jika perlu
- [ ] Cek audio baru di pratinjau editor
- [ ] Timing per kata yang lebih akurat
- [ ] Pilih musik di layar draf
- [ ] Bedakan narasi per adegan agar nada tetap menyambung

## Isometrik Canvas

Keputusan user (11 November 2026): gaya **Isometrik** digambar Gemini dengan mesin Canvas 2D, menggantikan dunia gambar AI dan jalur pustaka SVG. Dasarnya spike di `scripts/spike-canvas-iso.ts`: kipas, mobil di jalan kota, HP, dan jantung, 3 detik per klip, skor penilai terbaik 5,2–5,8, biaya Rp1.000–4.300 per klip. Hasil dan jebakan ada di KNOWLEDGE.md bagian "Spike mesin Canvas isometrik dengan Gemini". Isometrik tetap hanya untuk admin sampai user menyetujui hasil Tahap 6.

### Bentuk video

- **Satu dunia per video.** Mengikuti masukan user sebelumnya bahwa Isometrik harus satu dunia: tanah, latar, dan letak benda ditulis sekali. Adegan berpindah lewat gerak kamera tanpa fade, dan keadaan benda bertahan antaradegan.
- **Benda ditulis sekali per video.** Gemini menulis fungsi benda seperti `drawMobil(iso, state)`, mengikuti pola `drawODU()` di video AC. Semua adegan memanggil fungsi yang sama, sehingga mobil di adegan 1 dan 5 tetap sama.
- **Dua jenis adegan.**
  - `world`: berupa data saja (target kamera, zoom, keadaan benda, label, aliran) di dunia bersama. Murah karena tidak ada kode baru.
  - `detail`: punya fungsi `draw(iso, t)` sendiri untuk close-up, potongan dalam, atau diagram, lalu kembali ke dunia lewat gerak kamera.
- **Teks tetap di lapisan HTML.** Judul, subtitle, dan kartu data memakai komponen yang sudah ada. Canvas hanya untuk label yang menempel di benda, dengan posisi dari `iso.P()`.

### Tahap 1: Mesin

- [ ] Pindahkan mesin dari `src/motion-kit/iso-canvas/` ke ekspor resmi `@/motion-kit`: `createIso`, `CanvasScene`, `ramp`, `win`. Dikerjakan 11 November 2026: diekspor bersama `layoutLabels`, `lit`, `mixColor`, dan tipe-tipenya; `CanvasScene` menerima `timeOffset` untuk waktu global. Belum dipakai job
- [ ] Label otomatis di dalam area aman platform: kotak digeser masuk jika keluar tepi, dan dua label yang bertabrakan dipisah. Dua masalah ini muncul di hampir setiap kritik spike. Dikerjakan: `label()` diantrikan dan `finish()` menatanya dengan `layoutLabels` di dalam `useSafeInsets`; garis penunjuk berakhir di titik kotak terdekat. Diperiksa pada render uji: label yang diminta di luar frame masuk ke area aman tanpa bertumpuk. Batasan: garis penunjuk dua label bisa bersilangan; label belum menghindari benda
- [ ] `iso.ground(color)`: tanah, lantai, atau air yang selalu memanjang sampai tepi frame berapa pun zoom kamera. Pengganti tanah buatan Gemini yang berhenti di tengah layar. Dikerjakan bersama `iso.strip` (jalan, trotoar, sungai tanpa ujung) dan `iso.dashes` (marka bergerak), dihitung dari sudut layar yang diproyeksikan balik ke bidang tanah. Batasan: Gemini masih kadang menggambar lempeng sendiri di samping `ground` (uji mobil putaran 3)
- [ ] `iso.shadow(x, y, w, d)` untuk bayangan lembut di bawah benda, karena di spike benda tampak melayang. Dikerjakan dengan `ctx.filter = blur(...)`
- [ ] Kamera dunia: `iso.camTo(target, zoom)` dengan easing antar-keyframe, dihitung dari waktu global video. Dikerjakan sebagai `iso.look(x, y, z, zoom)` dan `iso.camPath(keys, t)`: tahan sebelum key pertama, easing di antara key, zoom dihitung di skala log
- [ ] Font Inter dimuat dengan `delayRender` sebelum frame pertama. Dikerjakan lewat `@remotion/google-fonts/Inter` dan `waitUntilDone`; canvas digambar ulang setelah font siap. Butuh internet saat render, sama seperti teks lain
- [ ] Test: proyeksi, culling, urutan bidang, determinisme (frame yang sama dua kali identik), label tidak keluar area aman. Dikerjakan: 12 test di `engine.test.ts`, termasuk tanah menutup frame di dua zoom dan `camPath`. Uji ulang Gemini topik mobil dengan mesin baru: 5,2 → 5,4 → 6,0, ambang 6 tercapai di putaran 3, sekitar Rp3.680. Masalah yang tersisa di kritik: kendaraan bertumpuk, pohon tanpa daun, dan angka "90 km/jam" yang dikarang Gemini di label
- [ ] Gaya rumah dan contoh untuk penulis kode: `iso-canvas/examples.ts` berisi `ISO_STYLE` (tiga lapis bentuk, sisi depan menghadap +x/+y, detail permukaan, loop untuk bagian berulang, bagian tembus pandang dari jeruji, sorot cahaya dan udara transparan, 2–3 warna, tanpa tulisan) dan contoh tulisan tangan: unit outdoor AC, unit indoor AC, dan dunia sudut ruangan. Prompt benda memuat gaya dan kedua contoh AC, prompt dunia memuat gaya dan contoh dunia, prompt close-up memuat gaya. Contoh lolos validator dan uji kering (`examples.test.ts`), dan dirender lewat `scripts/render-iso-examples.ts`, frame diperiksa: ketiganya terbaca jelas. Sekaligus: arah cahaya mesin diubah dari (0,45; 0,1; 1) ke (0,5; 0,35; 1) dengan kecerahan 0,6 + 0,45 × normal·cahaya, karena sisi +y dulu hanya sekitar 57% sehingga casing putih tampak abu-abu; `mixColor` kini mengembalikan `#hex` karena hasil `rgb()` berubah abu-abu di semua bentuk; penilai benda tidak lagi meminta latar karena benda sengaja digambar sendiri. Uji A/B putaran pertama lewat `scripts/spike-iso-style.ts` (1 percobaan per benda): kipas 5,0 → 5,3, mobil 4,8 → 5,3 lalu 5,8 setelah aturan sorot cahaya, HP 5,0 → 5,5; biaya per benda tetap Rp700–1.750. Pelindung kipas kini berupa jeruji tembus pandang dengan bilah terlihat, masalah yang ada sejak spike pertama. Batasan: baru 1 percobaan per benda sehingga selisih skor bisa kebetulan; belum diuji lewat job penuh dan dunia; garis angin kipas masih batang lurus; perubahan cahaya mengubah tampilan semua proyek Isometrik Canvas yang dirender ulang; belum dinilai user
  - Uji job penuh dengan gaya rumah, "AC biasa vs AC inverter, mana yang lebih hemat listrik?" (9:16, `proj_1794380707029_isojob`): 6 adegan, 32,1 detik, 19 panggilan Gemini dengan 126.122 token masuk dan 159.382 keluar (sekitar Rp12.500 di luar TTS). Skor benda: kompresor inverter 6,3, kompresor biasa 6,0, meteran listrik 6,3, AC biasa 5,5 → 6,0, AC inverter 5,5 / 5,5; dunia 5,4 → 5,8. 4 dari 5 benda mencapai ambang 6, sedangkan di uji kipas sebelumnya tidak ada. Frame MP4 diperiksa: semua benda terbaca. Batasan: kode dunia buatan Gemini menambah label sendiri dengan keterangan berbahasa Inggris ("Fixed Speed (On/Off)", "Variable Speed", "Monitoring Real-time") yang tampil di setiap bidikan; kamera melewati lantai kosong saat berpindah sejauh sekitar 4 meter (detik 22); 2 bagian hampir diam terdeteksi
- [ ] (uji coba) Kode benda dan dunia tidak boleh memanggil `iso.label`: prompt dunia melarangnya, dan pemeriksaan benda serta dunia di `build.ts` mengirim kode berlabel kembali ke Gemini (`LABEL_FORBIDDEN`) sebelum dirender. Label hanya dari rencana adegan, yang sudah dicek terhadap narasi, dan dari close-up (maksimal 2). Test di `examples.test.ts`. Batasan: belum diuji ulang lewat job Gemini; proyek yang sudah dibuat tetap memakai label lamanya sampai dibuat ulang
- [x] Export Isometrik Canvas tidak lagi dipaksa `swangle`: `chromiumOptionsFor` mengembalikan opsi bawaan untuk proyek `isoEngine: 'canvas'`, karena mesin Canvas tidak memakai WebGL. Dengan `swangle` semua gambar canvas dikerjakan proses GPU tiruan di CPU. Proyek AC di Windows: export 1.124 detik → 77 detik untuk kode yang sama, selisih piksel 7 frame rata-rata 0,7–1,2 dari 255. Test di `scene-check.test.ts`

### Tahap 2: Kontrak kode dan validator

- [ ] Kontrak file:
  - `IsoObjects.ts`: fungsi benda, masing-masing dengan daftar keadaan yang dijelaskan
  - `IsoWorld.ts`: latar, tanah, dan letak benda
  - `IsoScenes.ts`: data adegan `world` dan fungsi `draw` adegan `detail`
  - `MainVideo.tsx`: rangkaian adegan, audio, dan subtitle
  - Dikerjakan 11 November 2026: kontrak di `src/lib/explainer/iso-canvas/contract.ts`; tipe adegan (`IsoWorldScene` berupa data kamera, keadaan, perubahan keadaan, dan label; `IsoDetailScene` dengan fungsi `draw`) serta `paintIsoScene` dan `statesAt` di `@/motion-kit`. Urutan impor dikunci (IsoObjects ← IsoWorld ← IsoScenes) supaya tidak ada impor melingkar. `start` tiap adegan adalah detik global, jadi gerak dunia tidak meloncat antaradegan. Fixture kipas dirender di Remotion: adegan dunia dan detail tampil benar. `MainVideo.tsx` belum dibuat, masuk Tahap 3
- [ ] `validateSceneCode` menerima file Isometrik Canvas: hanya mengimpor `@/motion-kit`; dilarang `Math.random`, `Date`, timer, `fetch`, `window`, `document`, gambar, dan `eval`. Nama file baru diterima `isVirtualFileName` dan `ProjectUpdateSchema`. Dikerjakan: opsi `canvas` di `validateSceneCode` menolak `canvas`, `ownerDocument`, `drawImage`, `getImageData`, `putImageData`, `createImageData`, `createPattern`, `toDataURL`, `toBlob`, `filter`, dan lainnya; `iso.ctx` tidak lagi diekspos; impor per file dibatasi. `isVirtualFileName` menerima `IsoObjects.ts`, `IsoWorld.ts`, dan `IsoScenes.ts` untuk bundel. Batasan: `ProjectUpdateSchema` sengaja belum menerima nama ini sampai editor Tahap 5, supaya edit user tidak melewati validator canvas; akses properti terhitung (`iso['c' + 'tx']`) tetap tidak tertangkap validator, sama seperti adegan lain
- [ ] Uji kering di server dengan konteks Canvas palsu, seperti di spike, dijalankan di `vm` dengan batas waktu per frame. Error dikirim balik ke Gemini, maksimal 3 percobaan. Dikerjakan: `dryRunIsoCanvas` memuat ketiga modul di konteks `vm` baru (tanpa eval string, batas 1 detik per panggilan), lalu menggambar setiap benda sendiri, dunia, dan 3 momen tiap adegan ke canvas perekam. Yang dilaporkan: error, frame lebih dari 1 detik, koordinat NaN atau tak hingga, benda atau frame kosong, frame yang berbeda saat digambar dua kali, ekspor yang hilang, dan `start` adegan yang tidak menyambung. `writeUntilValid` mengirim masalah dan jawaban sebelumnya ke model sampai lolos (maksimal 3), dan `parseNamedBlocks` membaca blok kode per nama file. 13 test baru, 715 test lulus. Belum dipakai job; prompt penulisnya masuk Tahap 3

### Tahap 3: Pipeline generate

- [ ] Rencana dunia dari narasi yang sudah disetujui: 1–5 benda utama dengan keadaannya, latar, dan per adegan memilih jenis `world` atau `detail`, fokus, label, dan aliran. Label hanya boleh berisi hal yang disebut narasi (aturan anti-slop). Dikerjakan di `iso-canvas/plan.ts`: benda dengan ukuran dan posisi dalam meter, keadaan 0–1, close-up, dan beat dengan `set` perubahan keadaan. Narasi dikunci kata per kata, fokus yang tidak dikenal menjadi bidikan lebar, angka yang tidak diucapkan dibuang (`keepStatedNumbers`), dan label yang memakai kata di luar baris, topik, atau nama benda dibuang. Draf Isometrik baru tidak lagi dibatasi petunjuk pustaka
- [ ] Gemini menulis benda paralel (maksimal 4 sekaligus). Tiap benda dirender sebagai lembar keadaan, lalu dinilai. Dikerjakan: lembar 4 frame dari keadaan 0 ke 1, dirender lewat satu bundel pratinjau (`preview-root.tsx`) yang mengompilasi kode dari input props seperti pratinjau studio, dengan satu browser per job
- [ ] Gemini menulis dunia dan adegan `detail`. Adegan `world` disusun dari data tanpa panggilan model. Dikerjakan: kamera tiba dari bidikan sebelumnya dalam 1,1 detik lalu mendorong 8%, zoom dihitung dari ukuran benda, keadaan berlanjut antaradegan, dan label menempel di atas benda fokus di bawah panel. Dunia dan close-up ditulis bersamaan setelah benda selesai
- [ ] Putaran mutu per benda dan per adegan `detail`: penilai 5 kriteria dari spike (dikenali, kebenaran isometrik, komposisi, gerak, ketepatan label). Di bawah ambang, Gemini memperbaiki dari frame dan masukan penilai. Maksimal 2 putaran (semula 3), dan yang dipakai adalah putaran dengan skor terbaik, bukan putaran terakhir. Dikerjakan di `iso-canvas/build.ts` dengan kriteria per jenis (benda: dikenali, isometrik, detail, perubahan keadaan; dunia: dikenali, isometrik, komposisi, latar, label; close-up: dikenali, isometrik, komposisi, gerak, label). Kode yang tidak pernah lolos uji kering diganti bentuk sederhana dan ditandai
- [ ] Ambang diatur lewat `ISO_QUALITY_THRESHOLD`, awalnya 6. Diturunkan ke 5,5 jika data Tahap 6 menunjukkan 6 terlalu sering tidak tercapai. Skor setiap putaran disimpan di proyek. Dikerjakan: `ISO_QUALITY_THRESHOLD` (bawaan 6) dan `ISO_QUALITY_ROUNDS`, skor tersimpan di `isoCanvasReport`. Batas putaran bawaan diturunkan ke 2 atas keputusan user (11 November 2026), karena putaran ketiga jarang menaikkan skor pada uji kipas. Belum diuji ulang dengan 2 putaran
- [ ] Benda atau adegan yang tetap di bawah ambang disebut terus terang di chat editor, beserta skor dan masalah utamanya. Dikerjakan dengan nama dan skor; masalah dari penilai tidak ditampilkan karena berbahasa Inggris dan ditujukan ke model
- [ ] Job memakai jalur ini untuk proyek Isometrik baru. Proyek Isometrik lama tetap memakai mesin lamanya. Dikerjakan: `POST /api/projects` memberi `isoEngine: 'canvas'` untuk preset `world`, dan job memakai `buildIsoCanvasFiles`. Uji nyata lewat `scripts/spike-iso-job.ts` "Gimana cara kerja kipas angin?": 6 adegan, 31,3 detik, ruang kerja dengan meja, kipas, orang duduk, tanaman, dan jendela, plus 3 close-up motor dan bilah; export 13 detik, frame MP4 diperiksa. Skor: benda 5,5 / 5,8 / 5,5, dunia 5,2, close-up 6,0 / 6,2 / 6,2. Batasan: generate 1.256 detik (21 menit, sebelum dunia dan close-up dijadikan paralel), 33 panggilan Gemini dengan 201.464 token masuk dan 239.196 keluar (sekitar Rp19.000 di luar TTS), 4 bagian hampir diam terdeteksi, label close-up kadang memakai keterangan tambahan yang tidak ada di narasi, belum dicoba dari browser, belum dinilai user
- [ ] Biaya setiap panggilan (penulis dan penilai) tercatat di pencatat biaya yang sudah ada dan tampil di `/admin/biaya`. Dikerjakan otomatis lewat `callChat` → `recordUsage` dalam konteks job; dicek dari tabel `ai_usage` pada uji kipas. Halaman admin belum dibuka untuk dicek

### Tahap 4: Pratinjau, export, dan pemeriksaan

- [ ] `browser-compiler` memetakan file Isometrik Canvas, supaya pratinjau dan export memakai kode yang sama. Dikerjakan tanpa perubahan: impor relatif `./IsoObjects` sudah diselesaikan ke `IsoObjects.ts`, dan `IsoCanvasVideo` diekspor dari `@/motion-kit`. Compiler yang sama dipakai bundel pratinjau server pada setiap putaran mutu. Batasan: pratinjau di studio belum dibuka di browser karena butuh login user
- [ ] Export membundel semua file Isometrik Canvas. Dikerjakan lewat `isVirtualFileName`; export 9:16 dan 16:9 masing-masing 13 detik
- [ ] Cek crash dan cek bagian diam yang sudah ada ikut berjalan. Terbukti pada dua uji job: cek crash lolos, cek diam melaporkan 4 bagian (9:16) dan 2 bagian (16:9)
- [ ] Rasio 9:16 dulu, lalu 16:9 dan 4:5 dengan menyesuaikan kamera, tanpa mengubah benda. Dikerjakan: `viewBand` menentukan titik tengah kamera dan tinggi benda dari rasio frame (potret 58% / 46%, 4:5 55% / 42%, lanskap 50% / 50%), karena di 16:9 subtitle menutupi bagian bawah benda. Uji job 16:9 "Gimana cara kerja kipas angin?" dengan 2 putaran: 6 adegan, 32,8 detik, generate 556 detik, 23 panggilan Gemini dengan 132.772 token masuk dan 147.858 keluar (sekitar Rp11.900 di luar TTS); skor stopkontak 6, pengguna 4,8, kipas 5,3, dunia 5,2, close-up 5,8 / 5,8. Framing baru diterapkan ke proyek itu dan diexport ulang: kipas di atas subtitle. Rencana dunia kini disimpan di `isoCanvasPlan` supaya framing bisa dihitung ulang tanpa menggambar ulang. Label close-up kehilangan baris keterangan (`sub`) karena kerap berisi klaim di luar narasi. Batasan: 4:5 belum diuji nyata; orang masih tampak kaku dan skornya rendah

### Tahap 5: Editor

- [ ] Revisi chat per adegan: instruksi user diteruskan ke Gemini bersama kode dan frame adegan itu, lalu melewati putaran mutu yang sama. Dikerjakan 11 November 2026 di `iso-canvas/revise.ts`: satu panggilan Gemini kecil menentukan sasaran (benda, dunia, close-up, bidikan, atau tidak bisa), lalu hanya bagian itu yang diubah. Benda, dunia, dan close-up ditulis ulang dari kode lama plus instruksi user lewat `improve` (validator, uji kering, penilai, maksimal 2 putaran). Bidikan (lebih dekat atau jauh lewat `zoomScale`, ganti fokus, ganti atau hapus label) hanya mengubah rencana tanpa menggambar, dan label baru tetap dicek terhadap kata narasi. Hasil akhir harus lolos `dryRunIsoCanvas`, kalau tidak video dikembalikan. Narasi, audio, dan durasi tidak berubah. Route `revise` memakai jalur ini untuk proyek `isoEngine: 'canvas'` dengan biaya 1 jatah per revisi, jatah dikembalikan bila tidak ada yang berubah; studio menampilkan kotak revisi dan saran khusus Isometrik. Uji nyata pada salinan proyek gerbang detektor: revisi benda "Pengunjung aman" 340 detik, skor 5,3 → 6,5, frame menunjukkan rambut, wajah, tangan, dan lengan mengayun di semua adegan; revisi "adegan 2 kamera lebih dekat" 5 detik, frame lebih dekat; total 6 panggilan Gemini, sekitar Rp3.200. 9 test di `revise.test.ts`, 743 test lulus. Batasan: belum diuji lewat klik di studio; revisi benda butuh sekitar 5 menit; orang masih tampak seperti boneka kotak karena mesin belum punya primitif orang; frame lama tidak dikirim ke penulis pada tulisan pertama, hanya di putaran perbaikan
- [ ] (uji coba) Revisi gerak dan waktu: sasaran `motion` untuk permintaan tentang ke mana benda pergi dan kapan sesuatu terjadi. Benda diberi jalur (`path`: dari `at` ke `to`, digerakkan keadaan baru `jalan`), dan perubahan keadaan dalam satu adegan bisa diberi waktu sendiri (`at`, `over`). Mesin yang menggerakkan benda lewat pembungkus di `IsoObjects.ts` (`applyMotion`: fungsi model menjadi `<nama>Shape`), dan semua benda di video itu digambar urut kedalaman lewat `iso.defer` dan `flush`, sehingga orang yang melewati gerbang tergambar di belakang lalu di depannya. Tujuan yang menabrak benda lain digeser lebih jauh di arah perjalanan dengan jarak 35 cm (`clearDestination`). Penentu sasaran kini melihat posisi, ukuran, keadaan, dan durasi tiap adegan, dan wajib menjawab tidak bisa daripada memilih sasaran terdekat. Revisi benda, dunia, atau close-up yang skornya turun lebih dari 0,15 ditolak dan jatah dikembalikan. Uji nyata dengan kalimat user "orang yang terkena alarm harus jalan dulu lalu alarm di bawah pintu" pada salinan proyek gerbang detektor: 15–27 detik, 1 panggilan Gemini (sekitar Rp280), adegan 7: pengunjung kunci berjalan detik 1,0–5,0 dan alarm gerbang menyala di detik 3,0; frame menunjukkan orang masuk dari belakang, lewat di bawah gerbang, lalu keluar di depan, dan lampu merah menyala setelahnya. Langkah kaki: penentu sasaran memberi `walks` untuk benda yang berjalan dengan kaki, lalu revisi gerak langsung menulis ulang gambar benda itu (`walkInstruction`): kaki melangkah, lengan berayun, dan badan naik-turun hanya saat `jalan` di antara 0 dan 1, menghadap arah perjalanan; hasil yang lebih buruk tidak dipasang dan gerak tetap berlaku. Uji nyata dengan kalimat yang sama: 449 detik, 5 panggilan Gemini (sekitar Rp4.500), skor 5,8 tetap 5,8; frame per 0,25 detik menunjukkan kaki bergantian rapat dan terbuka serta lengan berayun, dan tiang gerbang menutupi badan dengan benar saat lewat. Batasan: revisi gerak yang menambah langkah butuh sekitar 7 menit; jalur lurus bisa melewati benda lain di tengah jalan; begitu ada benda bergerak, hiasan dunia di depan benda bisa tertutup benda; belum diuji lewat klik di studio
- [ ] Revisi benda: perubahan satu benda berlaku di semua adegan. Dikerjakan lewat jalur di atas: fungsi benda dibaca dan diganti di `IsoObjects.ts` dengan pemindai kurung kurawal (`code-parts.ts`)
- [ ] Coba ulang per benda atau per adegan tanpa membuat ulang audio. Sebagian: revisi chat sudah tidak membuat ulang audio; tombol coba ulang belum ada
- [ ] Tab kode menampilkan file Isometrik Canvas dan bisa diedit, dengan validator yang sama
- [ ] (uji coba) Close-up wajib memakai fungsi benda: benda yang tercantum di `detail.objects` harus digambar lewat `drawX`, bukan digambar ulang dari primitif. `DETAIL_SYSTEM` melarang salinan, `detailRequest` menyertakan tampilan (`look`) dan posisi dunia tiap benda, dan `missingObjectCalls` di `detailProblems` menolak close-up yang tidak memanggil `drawX`, sehingga model diminta menulis ulang. Berlaku juga untuk revisi close-up lewat chat. 3 test di `pipeline.test.ts`, 756 test lulus. Batasan: belum diuji dengan generate Gemini nyata; proyek lama perlu dibuat ulang atau close-up-nya direvisi
- [ ] (uji coba) Kartu judul pembuka buatan AI untuk Isometrik Canvas: Gemini menulis `IsoTitle.tsx` sendiri per video (`TITLE_TEXT` + `TitleCard`), memilih 1–2 font dari 58 Google Fonts (`title-fonts.ts`, dimuat saat dipakai lewat `useTitleFont`), lalu menentukan tata letak, warna, dan animasi masuk, tahan, dan keluar sesuai topik, tanpa template tetap. Kartu tampil di atas adegan 1 selama sekitar 3,2 detik (dipotong agar adegan 1 masih punya 0,8 detik untuk panelnya), panel judul biasa baru muncul setelahnya, dan caption tetap jalan. Pemeriksaan: `validateSceneCode` dengan impor `react`, `remotion`, dan `@/motion-kit`, nama font harus dari daftar, maksimal 16 kata, angka di `TITLE_TEXT` harus disebut di judul atau narasi, render pratinjau di atas dunia pengganti (crash terdeteksi lewat layar magenta dan ditolak), lalu penilai visi dengan 5 kriteria (keterbacaan, tipografi, gerak, komposisi, akurasi). Ditulis bersamaan dengan gambar benda. Judul yang gagal atau tidak bisa dinilai tidak dipakai, dan video dibuka dengan panel biasa; di video, `TitleBoundary` menyembunyikan judul yang error. Uji lokal tanpa Gemini: render contoh judul berhasil dan font termuat, judul yang melempar error terdeteksi. 762 test lulus. Skrip uji: `scripts/spike-iso-title.ts --from proj_x`. Batasan: belum diuji dengan Gemini sungguhan (diuji user); revisi judul lewat chat belum ada; pratinjau penilai memakai dunia pengganti (kotak polos), bukan gambar asli; baru untuk Isometrik Canvas
- [ ] (uji coba) Desain subtitle buatan AI untuk Isometrik Canvas: Gemini menulis `IsoCaption.tsx` (`CaptionCard`) per video. Gemini menentukan font (dari daftar yang sama dengan judul), warna, bentuk latar, gaya sorotan kata aktif, dan animasi muncul. Kode judul ikut dikirim supaya desainnya serasi. Mesin tetap mengatur pembagian 5 kata, waktu per kata, dan area aman lewat `CaptionTrack` (`captionAt`). Komponen hanya menerima kata, keadaan (`past`/`active`/`future`), dan jumlah frame sejak kata diucapkan. Ditulis setelah judul, bersamaan dengan gambar benda. Pemeriksaan: `validateSceneCode`, ekspor `CaptionCard`, memakai `.text`, nama font dari daftar, render pratinjau 5 momen di dua grup kata dari adegan dengan kata terbanyak (crash terdeteksi lewat layar magenta), lalu penilai visi 5 kriteria (keterbacaan, kata aktif, gaya, komposisi, tenang). Desain yang gagal atau tidak bisa dinilai tidak dipakai, dan bila error saat video diputar, `CaptionBoundary` kembali ke pil putih. Pil putih lama kini `DefaultCaption` dan dipakai juga oleh video dunia lain. Uji lokal tanpa Gemini: render contoh berhasil, sorotan berpindah, crash terdeteksi. 768 test lulus. Batasan: belum diuji dengan Gemini sungguhan; revisi subtitle lewat chat belum ada; baru untuk Isometrik Canvas
- [ ] (uji coba) Desain panel judul adegan buatan AI untuk Isometrik Canvas: Gemini menulis `IsoPanel.tsx` (`PanelCard`) per video. Gemini menentukan bentuk, warna, font, hiasan, dan animasi saat judul adegan berganti, menggantikan bar solid dengan gradasi tipis. Kode judul pembuka ikut dikirim supaya desainnya serasi. Mesin tetap menentukan teks adegan, status, jam, dan angka (hanya angka yang disebut cerita, menghitung naik 1,4 detik) lewat `PanelTrack`/`panelAt`, serta batas bawah panel `maxBottom` di 29% tinggi frame, karena label adegan mulai di 31%. Ditulis bersamaan dengan subtitle setelah judul. Pemeriksaan: `validateSceneCode`, ekspor `PanelCard`, memakai `headline` dan `maxBottom`, nama font dari daftar, render pratinjau 3 adegan (5 momen: saat masuk dan saat tampil), deteksi crash magenta, lalu penilai visi 5 kriteria (keterbacaan, hierarki, gaya, komposisi, transisi). Desain yang gagal tidak dipakai, dan bila error saat diputar, `PanelBoundary` kembali ke panel biasa. `Hud` lama kini `DefaultPanel`, tampilannya sama (dicek lewat render) dan dipakai juga oleh video dunia lain. 779 test lulus. Batasan: belum diuji dengan Gemini sungguhan; revisi panel lewat chat belum ada; baru untuk Isometrik Canvas

### Tahap 6: Uji penerimaan

- [ ] 5 topik lewat job dan export, frame diperiksa: AC biasa vs inverter, mobil di jalan, HP dicas semalaman, jantung memompa darah, dan iklan kasir. Catat skor per putaran, berapa kali ambang tercapai, waktu generate, dan biaya per video
- [ ] User menonton dan menilai kelima video. Ambang akhir (6 atau 5,5) dan batas putaran ditetapkan dari data ini
- [ ] Harga kredit Isometrik ditinjau dari biaya nyata per video

### Tahap 7: Pembersihan setelah disetujui user

- [ ] Hapus jalur dunia gambar AI Isometrik (`iso-picture.ts`, `world-video.ts`, cek sudut pandang) dan jalur pustaka SVG untuk Isometrik, jika tidak dipakai proyek lama yang masih perlu dibuka
- [ ] Hapus `IsoStage`, `three`, `@react-three/fiber`, dan `@remotion/three` jika tidak ada lagi pemakainya
- [ ] Buka Isometrik untuk semua akun, atas keputusan user

### Pertanyaan terbuka

- Benda yang dibuat Gemini apakah disimpan ke pustaka untuk dipakai ulang di video lain (lebih murah dan konsisten), atau selalu dibuat baru per video?
- Batas biaya per video Isometrik, karena 3 putaran per adegan `detail` bisa mencapai sekitar Rp4.000 per adegan.

## Story Canvas (spike)

Pertanyaan user (11 November 2026): apakah Story 2D bisa memakai mesin Canvas seperti Isometrik. Rincian dan hasil ada di KNOWLEDGE.md bagian "Spike mesin Story Canvas dengan Gemini".

- [ ] Mesin 2D tampak samping `createStory` di `src/motion-kit/story-canvas/` dengan bayangan, sorot, dan outline otomatis, parallax, kamera, label, serta `person()` di atas rangka HumanRig (`rig.ts`, disamakan dengan sumber asli lewat test). Contoh dapur dan `STORY_STYLE` ada di `src/lib/explainer/story-canvas/examples.ts`. 5 test lolos. Spike `scripts/spike-story-canvas.ts` untuk 3 topik: skor 5,2 / 5,8 / 5,6, Rp1.400–2.100 per klip 3 detik. Belum dipakai job. Menunggu penilaian user dari `clip.mp4`. Batasan: label belum dikunci ke narasi, kamera kadang membuat orang keluar frame, dan baru 1 percobaan per topik

- [ ] Pose tambahan khusus Story: `bend`, `crouch`, `kneel`, `phone`, `wash`, `wave`, dan `lie` (berbaring di atas permukaan, kepala ke arah `facing`), plus rambut `caping`. Dicek lewat lembar pose `storage/spike/story-canvas/poses/`, ditambah 1 test baru (6 test lolos). Uji ulang Gemini: sawah 4,8 (petani membungkuk dengan caping), HP 5,6 (duduk di tepi kasur sambil memegang HP). Pose dipakai benar, tetapi skor belum naik. Penilaian user 11 November 2026: hasil Canvas lebih rapi. Batasan: pose belum ditambahkan ke HumanRig asli

- [ ] Pipeline Story Canvas sebagai Story 2D (`story-canvas`): rencana dari narasi (pemeran, tempat, props, close-up, beat dengan pose), lalu props dan tempat ditulis Gemini dengan putaran mutu. Close-up ditulis sebagai kode, sedangkan adegan biasa berupa data (kamera membingkai aktor dan props fokus, orang ditaruh mesin di atas kursi atau kasur). Judul, subtitle, dan panel didesain AI seperti Isometrik. Uji kering akhir mengecek orang tetap di frame. Kartu "Story 2D" di halaman utama sekarang memakai mesin ini, sedangkan Full SVG disembunyikan untuk proyek baru dan berlabel "Story 2D (versi lama)". Tanpa konfirmasi draf objek, atas keputusan user. 85 test story/iso canvas dan 544 test `tests` lolos. Uji job nyata sampai MP4: HP sebelum tidur (31,7 detik, generate 860 detik, sekitar Rp14.300; close-up kosong dan subtitle menutupi orang, keduanya sudah diperbaiki) dan sawah diairi (34,3 detik, generate 419 detik, sekitar Rp10.300; close-up terisi dan orang di atas subtitle, frame diperiksa). Menunggu penilaian user. Batasan: revisi chat belum ada; ganti suara dan gaya teks belum didukung (sama seperti Isometrik); 16:9 sudah diperbaiki setelah laporan subtitle menutupi isi (desain judul, subtitle, dan panel kini diukur dari sisi terpendek, dan pita kamera landscape dinaikkan; frame proyek Borobudur diperiksa), sedangkan 4:5 belum diuji; tempat luar ruang masih lemah (sawah 5,2); close-up video HP lama belum digambar ulang

- [ ] Story 2D: tokoh opsional (hanya jika diminta atau ceritanya butuh aksi manusia), skala nyata dalam meter (jantung 12 cm sampai gunung 2 km, kamera menyesuaikan zoom), dan keadaan per adegan untuk tempat (langit gelap, malam, letusan di kejauhan). 16 test story canvas lolos, termasuk bingkai jantung dan gunung. Belum diuji lewat job nyata; user mencobanya sendiri

## Story 2D: rencana kualitas menuju video yang hidup

Permintaan user (12 November 2026): sebelum menambah fitur lagi, susun rencana matang tentang tampilan ideal Story 2D. Patokannya video jantung (`proj_f0f12543…`): jantungnya benar, tetapi darah tidak terlihat mengalir, jantung tidak berdetak, dan kamera diam di bidikan yang sama selama 32 detik. Rencana ini berlaku untuk semua topik yang mirip, bukan hanya jantung.

### Gambaran ideal

Penonton harus bisa memahami prosesnya tanpa mendengar narasi, cukup dari gambarnya:
- **Yang mengalir terlihat mengalir.** Sel darah bergerak di dalam pembuluh, air di pipa dan sungai, udara masuk ke paru-paru, arus listrik di kabel, paket data di jaringan, mobil di jalan. Arahnya jelas dan kecepatannya bisa berubah sesuai cerita.
- **Benda yang hidup atau bekerja tidak pernah diam.** Jantung selalu berdetak, kipas berputar, daun bergoyang, mesin bergetar, api berkedip. Keadaan per adegan hanya mengubah seberapa kuat geraknya (detak lebih cepat, aliran lebih deras), bukan menyalakan gerak dari nol.
- **Kamera bercerita.** Adegan pembuka memakai bidikan lebar untuk konteks. Setelah itu kamera mendekat ke bagian yang sedang dibahas (serambi kanan, katup, akar), bergeser mengikuti aliran dari satu bagian ke bagian berikutnya, lalu mundur lagi untuk kesimpulan. Dua adegan berurutan tidak memakai bidikan yang sama.
- **Perubahan terjadi saat kata kuncinya diucapkan.** Bilik kanan berkontraksi tepat saat narator berkata "memompa", bukan di detik tetap. Timing per kata sudah tersedia dari TTS (`wordTimings`).
- **Skala nyata dengan perjalanan skala.** Dari organ ke sel, atau dari kota ke rumah, lewat zoom yang menyambung ke close-up, bukan potongan tiba-tiba.
- **Latar terasa penuh dan bermakna.** Potongan dada berisi rusuk, paru-paru utuh, dan diafragma. Pesisir berisi laut, ombak, pulau di kejauhan, dan langit. Tidak ada bidang kosong yang luas di area isi.

### Kelompok topik dan bahasa visualnya

Penulis kode dan perencana memakai daftar ini sebagai pola. Contohnya tidak ditulis per topik.

| Kelompok | Contoh topik | Yang wajib terlihat |
|---|---|---|
| Aliran dan sirkulasi | jantung, siklus air, pipa rumah, sungai, pernapasan | Jalur aliran yang jelas, partikel bergerak di dalamnya, warna yang berubah saat isinya berubah (biru ke merah, kotor ke bersih), katup atau gerbang yang membuka dan menutup |
| Listrik dan sinyal | listrik di rumah, saraf, sinyal HP, internet | Kabel atau jalur dengan denyut cahaya yang berjalan, komponen menyala saat dialiri |
| Mesin dan mekanisme | kulkas, mesin mobil, pompa, kipas | Bagian yang berputar atau bergeser terus, siklus kerja berulang, panas dan dingin ditandai warna dan uap |
| Pertumbuhan dan perubahan | fotosintesis, adonan mengembang, karat, tumbuhan | Perubahan bentuk bertahap, gelembung atau partikel yang muncul, sumber energi (matahari, panas) yang terlihat bekerja |
| Skala besar dan alam | gunung meletus, cuaca, gempa, tata surya | Benda seukuran asli di lapisan jauh, latar yang berubah keadaan (langit gelap, laut naik), gerak besar yang lambat |
| Kebiasaan manusia | HP sebelum tidur, cuci tangan, memasak | Tokoh dengan aksi berbeda tiap adegan, lalu close-up ke sebab ilmiahnya |

### Celah teknis saat ini

1. **Kamera hanya bisa membidik satu props utuh.** Fokus ke bagian props tidak bisa, jadi topik satu benda (jantung) memakai bidikan yang sama di setiap adegan.
2. **Aliran digambar bebas oleh model.** Setiap props membuat panah dan garis putus-putusnya sendiri, sehingga hasilnya tidak konsisten, sering statis, dan tidak ada partikel yang benar-benar berjalan di jalurnya.
3. **Gerak terus-menerus tidak diwajibkan.** Prompt menyuruh memakai `t` hanya bila dipicu keadaan, jadi benda hidup tampak beku. Pemeriksa gerak baru melapor setelah video selesai.
4. **Keadaan hanya berganti per adegan dengan waktu tetap**, tidak mengikuti kata yang diucapkan.
5. **Penilai hanya melihat beberapa foto diam**, jadi tidak bisa menilai apakah aliran dan gerak benar-benar terjadi.
6. **Latar tubuh atau abstrak cenderung kosong**, karena contoh dan aturan latar masih berupa ruangan dan alam.

### Tahap 1: Primitif gerak di mesin

Gerak yang bagus dibuat sekali di mesin, lalu dipakai semua topik, seperti pencahayaan otomatis di Isometrik.
- [ ] `s.tube(path, width, color, {wall, inner})`: pembuluh, pipa, sungai, atau kabel sebagai jalur halus dengan dinding dan isi. Dikerjakan 12 November 2026 sebagai `s.tube(points, w, color, {wall, alpha, smooth})`: jalur Catmull-Rom dengan dinding gelap, isi, dan sorot. Menunggu penilaian user
- [ ] `s.flow(path, {kind, speed, density, color, size, t})`: partikel berjalan di sepanjang jalur. Dikerjakan: jenis `cells`, `drops`, `bubbles`, `dashes`, `sparks`, `packets`, dan `dots`; jumlah partikel dihitung dari meter, bukan piksel; partikel memudar di ujung jalur; setiap partikel diberi tepi terang supaya terlihat di atas tabung yang warnanya mirip. Menunggu penilaian user. Jenis `cells` (sel darah berbentuk cakram), `drops`, `bubbles`, `dashes`, `sparks` (arus listrik), dan `packets`. Kecepatan dan kepadatan bisa diatur dari keadaan. Posisi partikel dihitung dari `t` saja, supaya tiap frame tetap deterministik.
- [ ] `s.beat(t, bpm)` dan `s.pulse(...)`: dikerjakan sebagai `s.beat(t, bpm)` → `{phase, squeeze, index}` dan `s.osc(t, period, phase)`; menunggu penilaian user. Siklus berirama dengan fase (kontraksi, relaksasi) untuk jantung, napas, dan pompa. `s.wobble`, `s.spin`, dan `s.sway` untuk gerak diam benda.
- [ ] `s.emit(x, y, {kind, rate, spread, life, t})`: uap, asap, abu, gelembung, percikan. Dikerjakan dengan jadwal kelahiran tetap, gravitasi, dan pertumbuhan ukuran. Menunggu penilaian user
- [ ] `s.flowArrow(path, ...)`: panah yang berjalan mengikuti jalur, untuk aliran besar seperti angin dan arus laut. Dikerjakan; menunggu penilaian user
- [x] Test: setiap primitif deterministik, posisinya benar di awal dan akhir jalur, dan jumlah partikel stabil di semua zoom. `motion.test.ts` berisi 6 test, dan semua 12 test `story-canvas` di motion-kit lolos. Primitif juga sudah masuk ke API prompt penulis props, tempat, dan close-up
- [ ] Lembar uji yang dinilai user: pembuluh dengan darah, pipa air, kabel listrik, dan uap. Tahap 2 dimulai setelah user puas dengan tampilannya. Dirender di `storage/spike/story-canvas/motion-sheet/` (`clip.mp4`, dan `motion.jpg` berisi tiga frame berjarak 0,2 detik): sel darah, tetes air, percikan listrik, dan panah angin terlihat bergeser antar frame. Menunggu penilaian user

### Tahap 2: Bagian props dan kamera bercerita

- [ ] Rencana: setiap props boleh punya `parts`, yaitu bagian yang dibahas narasi (serambi kanan, katup, akar), dan `flows`, yaitu aliran bernama dengan arti dan arah ("darah tanpa oksigen dari tubuh ke serambi kanan"). Dikerjakan 12 November 2026: `parts` maksimal 8 dan `flows` maksimal 6 per props, dengan aturan di prompt rencana. Menunggu uji model
- [ ] Dikerjakan: kontrak `export const drawNameMap = { parts: { id: { at, size } }, flows: { id: [[x, y], ...] } }` dibaca server lewat `readPropMaps` di VM. `mapProblems` menolak peta yang hilang, bagian di luar props, atau jalur dengan kurang dari 2 titik, lalu mengirim alasannya balik ke penulis. Prompt meminta aliran digambar dari peta yang sama. Peta disimpan di `project.storyCanvasMaps`. Penulis props wajib mengekspor letak bagian dan jalur aliran sebagai data (misalnya `export const jantungParts = {...}` dan `jantungFlows`). Uji kering memastikan setiap bagian dan aliran di rencana ada, letaknya di dalam batas props, dan jalurnya tidak kosong. Kamera dan label membaca data ini, jadi tidak perlu menebak.
- [ ] Beat: `focus` boleh menunjuk bagian (`jantung:serambi-kanan`), dengan `shot` (`wide`, `medium`, `close`) dan gerak kamera (`push`, `follow` mengikuti aliran dari bagian lama ke bagian baru, `pull`). Pemeriksa rencana menolak dua adegan berurutan dengan bidikan dan fokus yang sama. Dikerjakan sebagai field `part`, `flow`, `shot`, dan `move` (ditambah `cut`). Kamera dihitung dari peta setelah props jadi: `close` memakai bagian × 1,7, `medium` di antara close dan wide, dan `follow` memakai 8 kunci `glide` dengan kecepatan rata di sepanjang jalur. Menunggu uji model
- [ ] Label menempel ke bagian yang dibahas, dan saat kamera bergerak `follow`, labelnya ikut berjalan di jalur aliran. Sebagian dikerjakan: label menempel di atas bagian, atau di tengah jalur untuk `follow`. Label yang ikut berjalan belum dikerjakan
- [ ] Close-up masuk lewat zoom dari bagian props ke detailnya (match cut), bukan potongan kosong. Dikerjakan: 0,6 detik terakhir sebelum close-up, kamera zoom × 1,8 ke bagian yang difokus, dan perjalanan `follow` selesai sebelum zoom ini dimulai. Lembar uji kamera (jantung dan dada tulisan tangan, tanpa model) ada di `storage/spike/story-canvas/camera-sheet/` (`sheet.jpg`, `clip.mp4`). 16 test story canvas dan 801 test seluruhnya lolos. Menunggu penilaian user

### Tahap 3: Waktu mengikuti kata

- [ ] Dikerjakan 12 November 2026 sebagai `set[].word` dan `beat.cue`. `wordTime` mencari kata di `wordTimings`, termasuk imbuhan ("pompa" menemukan "memompa") dan tanda baca. Perubahan dimulai saat kata diucapkan dan selesai dalam 0,9 detik, sedangkan kamera tiba dan label muncul di kata `cue`. Menunggu penilaian user. Rencana: setiap perubahan keadaan boleh menyebut kata pemicunya (`"on": "memompa"`). Mesin mencari kata itu di `wordTimings` adegan dan memulai perubahan tepat saat kata diucapkan. Kalau katanya tidak ditemukan, perubahan jatuh ke waktu bawaan.
- [ ] Gerak kamera dan munculnya label juga bisa dikaitkan ke kata. Dikerjakan lewat `cue`
- [ ] Revisi narasi dan ganti suara menghitung ulang waktu ini tanpa model, seperti `retimeSceneCode`. Belum dikerjakan, karena revisi chat dan ganti suara belum ada untuk Story 2D. Kalau keduanya dibuat, cukup panggil ulang `buildStoryScenes` dengan `wordTimings` baru, karena rencana dan peta props sudah tersimpan di proyek

### Tahap 4: Aturan "selalu hidup" dan pemeriksaannya

- [ ] Dikerjakan: props punya `moves`, dan prompt props dan tempat mewajibkan gerak dari `t`. Prompt props dan tempat: benda hidup, mesin, cairan, api, dan alam selalu punya gerak diam dari `t`, sedangkan keadaan hanya mengubah kekuatannya. Aturan ini ditulis konkret dan bisa dilihat, karena pelajaran dari Isometrik: model menerapkan aturan konkret jauh lebih baik daripada contoh saja.
- [ ] Dikerjakan untuk props (`propMoves`/`motionProblems`, di keadaan 0 dan 1); tempat belum dicek. Uji kering gerak: gambar setiap props dan tempat di t dan t + 0,5 detik dengan keadaan sama. Kalau hasilnya identik padahal rencana menyebut benda itu hidup atau punya aliran, kirim masalahnya balik ke penulis.
- [ ] Penilai mendapat lembar gerak (4 frame berjarak 0,2 detik) di samping lembar biasa, dengan kriteria baru `flowVisible` dan `alive`. Dikerjakan dalam bentuk lebih sederhana: lembar props berisi frame 2,2 dan 2,4 detik dalam keadaan sama, dengan kriteria `alive`. Sekalian diperbaiki bug pratinjau props yang memakai waktu dibulatkan, sehingga gerak tak pernah terlihat
- [ ] Pemeriksaan bagian video yang diam setelah job dipakai sebagai ukuran sukses: target tidak ada bagian diam lebih dari 3 detik. Belum tercapai menurut alat ukur, yang masih melaporkan 1–4 bagian per video. Alatnya mengambil sampel 120 × 80 piksel per 0,5 detik dengan ambang 6/255, jadi partikel aliran yang kecil tidak terbaca. Perlu alat ukur yang peka gerak kecil sebelum target ini bisa dinilai

### Tahap 5: Contoh rujukan dan latar penuh

- [ ] Dikerjakan: `EXAMPLE_HEART` dan `EXAMPLE_WATER` di prompt props, `EXAMPLE_PLACE` dan `EXAMPLE_CHEST` di prompt tempat; semua lolos cek props, peta, dan gerak. Belum dirender sendiri untuk dinilai user (jantung dan dada tampil di lembar uji kamera). Dua contoh tulisan tangan yang memakai primitif baru: (1) potongan jantung dengan bagian, aliran darah biru dan merah, katup, dan detak; (2) sistem air (tandon, pompa, pipa, keran) dengan aliran dan gelembung. Keduanya lolos validator dan uji kering, dan dirender untuk dinilai user, seperti contoh AC di Isometrik.
- [ ] Sebagian: rongga dada sudah ada, pesisir dengan gunung belum. Contoh tempat untuk latar abstrak atau tubuh (potongan dada dengan rusuk, paru-paru, diafragma, dan jaringan) dan untuk latar alam besar (pesisir dengan gunung di kejauhan yang punya keadaan `letusan` dan `langitGelap`).
- [ ] Aturan komposisi tempat: subjek mengisi pita isi, latar mengisi sampai tepi, dan tidak ada bidang kosong yang luas di antara panel dan subtitle. Dikerjakan di prompt tempat, ditambah aturan rencana: proses selebar bentang alam digambar sebagai diagram potongan, bidikan tanpa fokus hanya untuk pembuka dan penutup, dan props yang lebih pipih dari 8:1 ditolak

### Tahap 6: Uji penerimaan

Lima topik dari kelompok berbeda, dibuat lewat studio oleh user:
1. Gimana cara kerja jantung memompa darah?
2. Dari mana air hujan berasal? (siklus air)
3. Kenapa kulkas bisa dingin?
4. Gimana listrik sampai ke rumah?
5. Kenapa main HP sebelum tidur bikin susah tidur? (topik dengan tokoh)

Lolos jika menurut penilaian user saat menonton:
- aliran atau gerak utama terlihat jelas di setiap adegan
- kamera berpindah sesuai bagian yang dibahas
- perubahan pas dengan kata yang diucapkan
- tidak ada bagian diam lebih dari 3 detik
- skor penilai props dan tempat rata-rata ≥ 6

Biaya dicatat per video, dengan target tidak lebih dari Rp15.000 di luar TTS.

Hasil uji pertama (12 November 2026), dijalankan dengan GPT-6.1 Terra atas permintaan user. Frame tiap video sudah diperiksa, dan penilaian akhir ada pada user:
- [ ] Jantung (`proj_1794423688595_storyjob`): kamera bergerak dari lebar ke serambi kanan, mengikuti aliran ke paru-paru dan kembali, lalu mundur di katup. Sel darah mengalir di pembuluh. Skor props 5,2, tempat 6,8. 13 panggilan, generate 208 detik. Bidikan `follow` sempat terlalu dekat dan sudah diperbaiki lewat penyusunan ulang tanpa model.
- [ ] Siklus air (`proj_1794424764641_storyjob`, uji ulang): diagram potongan laut, daratan, awan, dan hujan. Skor 5,2–7,4. Uji pertama (`proj_1794424052529_storyjob`) gagal secara visual karena sungai dan laut berupa pita tipis berskala asli (sungai 1,4), lalu diperbaiki lewat aturan diagram potongan.
- [ ] Kulkas (`proj_1794424052842_storyjob`): bidikan dekat ke kompresor dan pipa kapiler bagus, tetapi dua adegan memakai bidikan lebar seluruh dapur. Aturan fokus null hanya untuk pembuka dan penutup ditambahkan setelah uji ini.
- [ ] Listrik ke rumah (`proj_1794424295644_storyjob`): terbaik. Turbin, trafo, SUTET, gardu, trafo tiang, dan rumah, masing-masing dengan bidikannya sendiri. Skor 4,6–7,4.
- [ ] HP sebelum tidur (`proj_1794424769776_storyjob`, uji ulang): orang dengan HP di kamar, potongan kepala dengan mata dan otak, lalu kelenjar pineal. Semua skor ≥ 6. Uji pertama gagal seluruhnya karena pemeriksaan "orang di dalam frame" menolak bidikan dekat yang memotong tubuh. Sekarang pemeriksaan itu hanya berlaku untuk bidikan yang membingkai orang, dan tidak lagi menggagalkan video.
- Token Terra per video: 80–183 ribu masuk dan 12–24 ribu keluar, 13–27 panggilan, generate 177–266 detik. Tarif Terra belum tercatat di kode, jadi biaya rupiahnya belum dihitung.

### Tahap 6b: Detail dan gambar dasar yang lebih kaya

Keputusan user (12 November 2026), setelah menonton hasil Tahap 6: detail gambar masih kurang, dan gambar dasarnya harus lebih bagus, tidak basic. Video jantung tidak punya lengkung aorta, arteri paru, atau katup yang bergerak. Pada video kulkas, bagian yang dibahas terlalu kecil dan close-up pipa kapiler tanpa konteks.
- [x] Mesin: gradien volume halus pada setiap bentuk, `fillTo` (gradien atas ke bawah), `texture` di dalam bentuk (muscle, grain, stripes, hatch, dots, speckle, cells, tiles, bricks, scales, waves), kabut jarak otomatis pada lapisan jauh, vinyet tipis, dan pipa tiga nada
- [x] Mesin: `s.detail(size, fn)` untuk detail halus yang muncul saat kamera mendekat, `s.branch` untuk struktur bercabang (pembuluh, bronkus, akar, pohon, petir), `s.coil` untuk koil dan pipa berliku, `colorTo` untuk aliran yang berubah warna di sepanjang jalurnya. Tekstur juga otomatis dilewati saat terlalu rapat di layar
- [x] Contoh rujukan ditulis ulang dengan detail jauh lebih tinggi: jantung (vena kava, vena paru, lengkung aorta dengan tiga cabang, trunkus paru, lemak alur, serat otot, koroner, trabekula, katup masuk dan keluar yang bergerak sesuai detak), rongga dada (tulang belakang, iga, trakea bercincin, bronkus bercabang, diafragma), pompa air, dan dapur
- [x] Perencana: daftar `must` berisi 6–12 komponen wajib per props, close-up dinaikkan dari 2 ke 4 dan wajib memperlihatkan isi atau cara kerja, serta perubahan pada aliran ditulis di makna aliran
- [x] Penulis props: 50–140 bentuk dalam tiga tingkat (siluet, komponen, detail halus), dan setiap bagian yang dikunjungi kamera wajib kaya saat didekati. Tempat 50–150 bentuk dengan tekstur pada permukaan besar
- [x] Penilai: kriteria `completeness` memeriksa daftar `must`, kriteria `detail` lebih ketat dan juga ditambahkan untuk tempat dan close-up, dan ambang Story 2D sekarang 7 (ambang Isometrik + 1)
- [x] Kamera: bidikan dekat dan medium pada bagian yang tipis diperlebar sampai sisi pendeknya minimal 0,6 kali sisi panjang. Bidikan `follow` yang punya bagian jadi lebih dekat ke bagian itu
- [x] Cahaya (permintaan user, 12 November 2026): `s.light({ dir, color, strength, rim })` per tempat dan close-up, dan semua gradien, pita bayangan, serta kilau mengikuti arah dan warnanya. Bahan per bentuk (`material`: matte, metal, glass, wet, glossy), `lift` untuk bayangan lembut ke belakang, dan cahaya tepi otomatis di latar gelap. Prompt mewajibkan sumber cahaya per tempat yang ikut berubah dengan keadaan, dan bahan per bagian props. Penilai tempat dan close-up mendapat kriteria `lighting`, dan `craft` props menilai bahan. Lembar uji ada di `storage/spike/story-canvas/light-sheet`
- [x] Dari uji septic tank user (`proj_378a9ea502ec458350d535ba660c4a7807553e37`, 12 November 2026; tempat 7,1, props 5,7, tanpa close-up): kotak bidikan `follow` sekarang mengikuti bentuk pita pandang, bukan persegi, sehingga di portrait sekitar 35% lebih dekat dan tidak lagi lebih lebar dari bidikan lebar. Topik proses (props dengan aliran, gerak, atau minimal dua bagian, dan minimal 4 adegan) wajib punya minimal satu close-up, dan setiap close-up wajib menjadi fokus satu adegan. `s.glow` hanya untuk sumber cahaya, karena glow putih sebagai kilau tampak seperti silau lensa. Setiap state wajib mengubah bentuk secara besar sehingga terbaca di bidikan lebar
- [x] Draf narasi Story 2D (permintaan user, 12 November 2026, dari proyek jalan aspal `proj_2bb918508d554e41d3d577d930e4d59f9da40c4d`: 6 kalimat sekitar 10 kata, 30 detik, istilah teknis tanpa sebab-akibat). Catatan sutradara Story 2D dulu menyalin aturan dunia 3D (5–8 adegan, satu kalimat maksimal 14 kata). Sekarang 7–12 adegan, 1–2 kalimat (15–30 kata) per adegan, total 110–220 kata, dengan alur pertanyaan pembuka, masalah, tahap sebagai sebab-akibat, lalu penutup, dan kata sehari-hari sebelum istilah teknis. Prompt pendek (di bawah 600 karakter) melewati langkah riset dulu: satu panggilan sutradara menulis catatan fakta, lalu draf ditulis dari catatan itu. Durasi yang disebut user tetap memakai anggaran kata yang sudah ada. Aturan "6–7 beats, maksimal 11 kata" dari dunia 3D juga dihapus dari prompt perencana Story 2D
- [ ] Uji ulang jantung dan kulkas dengan GPT-6.1 Terra, lalu dinilai user. Ambang yang lebih tinggi menambah putaran revisi, jadi token dan waktu generate perlu dicatat

### Ditunda: kamera dan aturan untuk cerita bertokoh

Uji user dengan cerita drama (`proj_0187e91134ea93f4487941410dded45dc625cc6c`, antrean servis HP, GPT-6.1 Terra, 12 November 2026): close-up isi ponsel bagus (skor 8), tetapi 8 dari 9 adegan memakai bidikan lebar yang sama, ponsel dan laptop tidak terlihat, dan tempat gagal ambang (5,6). Penyebab: bidikan medium pada bagian props selalu ikut membingkai semua tokoh, laptop dari samping hanya batang tipis, tidak ada figuran, dan tidak ada bidikan wajah. User memilih menunda perbaikan ("Nanti saja"). Usulan yang menunggu:
- [ ] Bidikan `close` pada tokoh membingkai kepala dan dada, dan momen emosional wajib memakai bidikan dekat
- [ ] Bidikan sisipan untuk benda kecil di adegan bertokoh, tanpa memaksa semua tokoh masuk frame
- [ ] Benda yang wajahnya penting (layar, jam, panel) boleh digambar dari depan atau tiga perempat
- [ ] Figuran sederhana dan redup dari tempat, di luar batas tiga tokoh
- [ ] Adegan berurutan tidak boleh memakai susunan bidikan yang sama
- [ ] Pose `cry` dan `listen`, dan penilai menilai kecocokan pose dengan aksi

### Tahap 7: Pembersihan mesin Story 2D lama (pengerjaan akhir)

Keputusan user (12 November 2026): mesin lama (Full SVG, preset `story-svg`) dihapus sebagai pengerjaan terakhir. Tahap ini baru dimulai setelah Tahap 6 lolos dan user menyetujuinya. Sampai saat itu mesin lama tetap ada sebagai pembanding, hanya disembunyikan dari pilihan proyek baru.

- [ ] Hapus pipeline draf objek: `story-svg-draft.ts`, `story-svg-shared.ts`, rute `object-draft`, status `storySvgReviewPending` dan `autoApproveObjectDraft`, serta bagian progres draf objek di `GenerationProgress` dan `studio-progress.ts`
- [ ] Hapus jalur adegan Full SVG di generate dan revisi (`scene-generator.ts`, kamera nyambung antaradegan di `AssetStage`), catatan sutradara Full SVG, dan aturan `svgOnly` di validator jika tidak dipakai gaya lain
- [ ] Putuskan nasib sumber rig SVG (`HUMAN_RIG_SOURCE`, `human-rig-runtime.ts`). Jika dihapus, test `story-canvas/rig.ts` diubah supaya tidak lagi membandingkan dengan sumber itu
- [ ] Hapus atau ubah test yang hanya menguji mesin lama (`draft-flow`, `scene-generator`, `scene-camera`, `scene-quality`, `studio-progress`, dan lainnya)
- [ ] Hapus `story-svg` dari `StylePresetSchema`, `StoredPresetSchema`, dan label "Story 2D (versi lama)". Proyek uji lama berpreset `story-svg` tidak bisa dibuka lagi; belum ada pengguna, jadi yang terdampak hanya proyek uji user
- [ ] Perbarui CLAUDE.md, KNOWLEDGE.md, dan plan_fitur.md supaya tidak lagi menyebut Full SVG sebagai jalur aktif

### Urutan dan alasan

Tahap 1 dulu, karena semua tahap lain bergantung pada primitif gerak, dan tampilan aliran adalah keluhan utama. Tahap 2 berikutnya, karena kamera yang diam adalah penyebab terbesar video terasa kaku. Tahap 3 dan 4 menyempurnakan ketepatan dan menjaga mutu. Tahap 5 menaikkan mutu rata-rata lewat contoh. Tahap 7 (hapus mesin lama) selalu terakhir. Setiap tahap selesai dengan lembar uji atau video yang dinilai user sebelum tahap berikutnya dimulai.

### Pertanyaan terbuka

- Apakah close-up tetap ditulis bebas sebagai kode oleh model, atau sebaiknya juga berupa data (zoom ke bagian props), supaya tampilannya pasti sama dengan adegan biasa?
- Berapa batas putaran mutu per props sekarang props jadi lebih rumit (bagian dan aliran)? Saat ini 2 putaran.
- Apakah primitif gerak yang sama juga dipakai Isometrik (misalnya `iso.flow` di dalam pipa)?

## Video 3D (Mode Dunia)

Status saat ini: akan diganti oleh [Isometrik Canvas](#isometrik-canvas) (keputusan user 11 November 2026). Bagian ini menjadi riwayat. Sebelumnya tersedia sebagai pilihan **Isometrik**, untuk rasio 9:16. Sejak 8 November 2026, Isometrik memakai satu gambar dunia dari model gambar, bukan objek 3D dari balok dan blob. User menilai versi 3D buruk karena objek tidak dikenali dan selalu berdiri di atas alas. Item 3D di bawah tetap dicatat sebagai riwayat, dan kodenya belum dihapus.

- [x] Isometrik hanya untuk admin selama masih dikembangkan (keputusan user 10 November 2026). Beranda menyembunyikan pilihan, filter, dan contoh prompt Isometrik untuk akun di luar `ADMIN_EMAILS`. Admin melihat label "Admin" pada pilihan itu. Draf tersimpan yang memakai preset tersebut kembali ke Iklan produk. `POST /api/projects` menolak dengan 403 untuk akun biasa. `/api/me` mengirim `isAdmin`. Proyek Isometrik lama tetap bisa dibuka pemiliknya. Test server lolos. Belum dicek di browser
- [x] Isometrik 3D dihapus seluruhnya (keputusan user 10 November 2026): preset `world-3d`, adegan HP dan mobil GLB, pemeriksa kemampuan model 3D, layanan container `bpy` beserta container dan image Docker-nya, model di `public/models`, aset `storage/assets/three-car` dan `three-phone`, skrip terkait, proyek uji, dan baris Diminta `world-3d`. Mesin `IsoStage` tetap ada karena dipakai preset Isometrik
- [ ] Isometrik versi gambar AI: Gemini menulis tempat nyata, bagian yang dibahas, close-up, dan aliran. Model gambar menggambar satu dunia tanpa alas plus 0–2 close-up. Gemini mencari kotak tiap bagian, lalu kamera bergerak ke bagian itu, dan close-up masuk dengan cross-fade. Uji nyata lewat job dan export: jantung, paru-paru, dan iklan kasir, masing-masing 1 percobaan, 0 bagian diam, semua bagian ditemukan, frame diperiksa. Menunggu penilaian user saat menonton. Batasan: aliran berupa titik di garis lurus antar-bagian, bukan mengikuti pembuluh atau pipa di gambar; layar HP di gambar kadang memuat angka atau tulisan acak walau dilarang di prompt; botol di warung bisa mirip merek; bagian tidak bisa digerakkan sendiri karena satu gambar utuh; model gambar sering menyisakan pita kosong di atas, dan kamera menyembunyikannya di balik panel, bukan mengisinya **Story 2D Campuran**, **Story 2D Full SVG**, dan **Ads** tetap memakai ilustrasi per adegan. Item bertanda `(uji coba)` hanya terbukti lewat skrip atau belum dinilai user. Rasio 4:5 dan 16:9 belum diuji.

- [ ] (uji coba) Satu dunia dengan kamera menyambung: berhasil
- [ ] (uji coba) Panel data yang berubah mengikuti cerita: berhasil
- [ ] (uji coba) Subtitle kapsul: berhasil
- [ ] (uji coba) Stiker kata: komponen ada, belum muncul di klip uji
- [ ] (uji coba) Satu adegan HP terbuka dengan `@remotion/three` dan kamera ortografis: berhasil, 8 detik, data ditulis tangan, belum dinilai user
- [ ] (uji coba) Mesin isometrik: balok, pelat, silinder, kerucut, baji, tabung, nampan, dan penutup berjalan di `IsoStage`, dan posisi dihitung `resolveIsoPlan`
- [ ] (uji coba) Gaya datar dengan garis tepi di Three.js: berhasil, tiga nada dari normal tanpa lampu, belum dinilai user
- [ ] (uji coba) Mode render `lit` untuk dunia 3D: cahaya, bayangan lembut, sudut bulat, garis tipis, dan meja tanpa tepi. Diuji pada 2 klip HP lewat skrip, frame diperiksa. Belum dipakai job, dan menunggu penilaian user. Batasan: detail masih jauh dari video contoh, rencana detail butuh 256 detik dan 2 percobaan, kabel tetap tebal, dan benda organik butuh layanan model 3D yang belum ada kuncinya
- [x] Pengaturan WebGL untuk pratinjau, export, dan pengecekan crash. Bisa diatur lewat `RENDER_GL`. `swangle` lolos di skrip uji, tetapi belum dijalankan di server sungguhan
- [x] Komponen Three.js hanya lewat `@/motion-kit`, kode Gemini tetap tidak mengimpor `three`
- [x] AI menyusun dunia sebagai data objek. Batasan: objek buatan manusia masih sering butuh 2 permintaan karena jawaban pertama ditolak validator
- [x] Warna terang atau gelap sesuai topik di Mode Dunia, dicek lewat kolom `look`
- [ ] (uji coba) Uji kualitas pada 8 topik: HP, PDAM, lift, baterai, dan inflasi terbaca. Iklan kasir jalan dengan layar HP polos. Kapal selam mirip tongkang, dan jantung mirip diagram pipa. Belum dinilai user
- [ ] (uji coba) Tombol CTA di video 3D, hanya dari adegan CTA. Komponennya ada, tetapi tidak ada pilihan iklan 3D di aplikasi
- [ ] Bentuk organik yang dikenali: `blob` dari lobus yang melebur, warna per bagian, dan bagian bernama yang bisa disorot kamera atau disambung link. Uji nyata Gemini: jantung satu blob 16 bagian dan lebah badan bergaris sampai MP4, paru-paru lewat job dan export. Frame diperiksa. Menunggu penilaian user saat menonton. Batasan: blob tidak bisa dibelah untuk melihat isi, jadi bagian dalam hanya tampak sebagai warna di kulit, dan pipa pada jantung masih menyiku
- [ ] Isi layar produk pada video 3D: `screen` menggambar judul, baris, angka, dan tombol, dan isinya berganti per beat. Angka yang tidak diucapkan dibuang kode. Uji nyata 2 iklan kasir sampai MP4, frame diperiksa, tanpa angka karangan. Menunggu penilaian user saat menonton. Batasan: subtitle dua baris bisa menutup bawah layar, layar lain yang dipudarkan masih samar terlihat, dan belum ada logo atau foto produk
- [ ] Adegan dekat lebih lega: yang tidak berkaitan dengan fokus dipudarkan, zoom tidak lagi memotong objek besar. Dibuktikan pada 4 topik, menunggu penilaian user saat menonton. Batasan: pipa ke objek yang dipudarkan bisa tampak berakhir di udara
- [x] Masukkan Mode Dunia ke alur draf dan editor. Batasan: tidak ada pratinjau bertahap karena satu dunia selesai sekaligus
- [ ] Layar draf menampilkan bagian yang disorot (per kalimat sudah ada lewat adegan)
- [x] Panel data hanya menampilkan angka yang disebut di narasi atau prompt
- [ ] Revisi chat untuk Mode Dunia (saat ini ditandai belum tersedia di editor)
- [x] Gagal dan Coba ulang pada video 3D, audio yang sudah ada tidak dibuat ulang (lolos test, belum disaksikan di browser)
- [ ] Editor TSX untuk Mode Dunia (tab masih kosong karena dunia berupa data)

## Pilihan gaya dan brand

- [ ] Perapian seluruh antarmuka: sudah diterapkan pada beranda, login, draf, editor, kredit, dan admin; glow, gradasi dekoratif, serta badge arsitektur dihapus. Contoh ide menjadi daftar enam item dengan tombol membuka sisanya; proyek dan paket kredit memakai baris. Label Bahasa Indonesia, fokus keyboard, tombol sentuh, reduced motion, serta halaman galat dan 404 diperbaiki. Arah visual dicatat di `DESIGN.md`, bukti pemeriksaan di `docs/UI-REVIEW.md`. Uji browser desktop/mobile dan build lulus. Batasan: pemeriksaan editor/pembayaran memakai data contoh, admin belum diperiksa ulang dengan data nyata, belum diuji di HP sungguhan, dan checklist verifikasi penuh belum tuntas
- [x] Empat pilihan gaya: Story 2D Campuran, Story 2D Full SVG, Ads, dan Isometrik
- [ ] Gaya gambar pixel art untuk Story 2D Campuran: pilihan "Gaya gambar" (Ilustrasi datar atau Pixel art) muncul di beranda hanya saat Story 2D Campuran dipilih. Pilihan dibawa draft intent ke `POST /api/projects`, disimpan sebagai `storyboard.artStyle`, dan ikut dicek saat permintaan yang sama diulang. Preset lain selalu disimpan flat. Label "Pixel art" tampil di layar persiapan draf dan header editor. Kolom `artStyle` mengganti baris gaya di prompt gambar, hasil model dipaskan ke grid nyata oleh `pixelate` (180 kotak lebar untuk 9:16, 32 warna lewat k-means), dan `ImageStage` memakai `imageRendering: pixelated`. Pada video pixel art semua adegan digambar model gambar: planner diminta memilih `image`, adegan `svg` diubah menjadi `image`, dan jika planner gagal tiap adegan tetap mendapat satu gambar. Uji nyata lewat `scripts/spike-image.ts --art pixel`, topik "HP dicas semalaman", 5 adegan, 98 detik, frame diperiksa: gaya 16-bit terbaca dan sama di semua adegan. 474 test lolos. Belum dinilai user, dan belum diuji lewat job generate atau browser. Batasan: judul dan subtitle masih memakai font biasa; model gambar masih menggambar angka jam dan tulisan kecil di chip walau dilarang; adegan yang gambarnya gagal tetap jatuh ke bentuk vektor datar; jenis gaya tidak bisa diubah setelah draf dibuat; baru diuji 9:16 dan 1 topik; Full SVG, Ads, dan Isometrik belum ikut
- [ ] Gaya lain setelah pixel art: PS2/low-poly, mainan balok (jangan memakai nama merek), dan CGI halus. Belum dimulai
- [ ] Brand kit: logo, warna, dan foto produk
- [ ] Kartu penutup dan identitas seri
- [ ] Unggah aset user
- [ ] Variasi hook untuk A/B test
- [ ] Export ke beberapa rasio
- [x] Bahan posting sosmed setelah export: tombol "Bagikan" di header atau modal export membuka panel dengan tab TikTok / IG (caption dan hashtag) dan YouTube (judul maksimal 100 karakter, deskripsi, dan tag maksimal 500 karakter), masing-masing dengan tombol salin. Semua ditulis Gemini dalam 1 panggilan hanya dari narasi, maksimal 5 kali per video, dan bisa diedit. Tanpa AI, panel diisi judul dan kalimat pertama. File download bernama dari judul, misalnya `perjalanan-kopi-nusantara.mp4`. Uji Chrome: caption, judul, dan tag sesuai narasi, tombol salin bekerja, dan nama file benar. Batasan: teks yang diedit tidak disimpan ke server, dan bahan ini tidak tahu jika video berubah setelah export terakhir
- [ ] Tombol Bagikan ke aplikasi lewat menu bagikan sistem: video diambil sebagai file lalu diberikan ke `navigator.share`, dan caption disalin dulu karena Instagram dan TikTok membuang teks yang ikut. Tombol hanya muncul jika browser menerima berbagi file. Di Chrome Mac `canShare` menerima file MP4 10,8 MB, tetapi menu bagikan belum dibuka dan belum dicoba di HP sungguhan. Batasan: belum dicoba di HP sungguhan
- [x] Editor bisa dipakai di HP: di bawah 768 px player tampil di atas (40% tinggi layar) dan panel chat mengisi sisanya, header hanya memuat judul, tombol Bagikan berupa ikon, dan tombol Export. Label tab dipendekkan, modal Bagikan bisa di-scroll, dan tingginya memakai `dvh` supaya tidak tertutup bar browser HP. Uji Chrome lewat iframe 390×780 dan 360×640: tanpa scroll ke samping, semua tombol header terlihat, dan modal Bagikan muat. Desktop tetap dua kolom. Batasan: belum dicoba di HP sungguhan, tab Kode tetap tidak nyaman di layar kecil, dan halaman lain seperti draf belum dicek di lebar HP
- [ ] Upload langsung ke YouTube, TikTok, dan Instagram: ditunda sampai aplikasi publik dan object storage ada. TikTok mewajibkan audit sebelum video bisa publik, Instagram butuh akun bisnis dan review Meta, dan YouTube paling mudah untuk dimulai

## Karakter bergerak tanpa berubah bentuk (rig tulang)

Status: Fase 0–3 sudah dibuat, tersambung ke alur Full SVG, dan dibuktikan lewat aplikasi di browser sampai MP4. Penilaian user 10 November 2026: gerakan di proyek jalan kaki dan Londo Ireng sudah cukup oke; bentuk muka di proyek jalan kaki perlu dikoreksi, dan setelah diperbaiki dinilai sudah oke. Masalah dari user: tangan dan kaki karakter mengecil saat bergerak, dan tidak ada satu pun adegan dengan karakter yang berjalan dengan baik. Diagnosis dan alasan keputusan ada di [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md), bagian "Karakter berubah bentuk saat bergerak".

Cakupan: gaya Full SVG yang memakai draf objek. Proyek lama tanpa draf objek (misalnya `proj_fb3d…`) tidak dimigrasi dan perlu dibuat ulang. Hewan, mesin berkaki, dan Story 2D campuran (gambar AI) tidak termasuk.

Prinsip:
- Tulang dan gerakan berasal dari kode tetap. Gemini hanya menggambar "kulit" tiap bagian tubuh: kepala, badan, pinggul, lengan atas, lengan bawah, tangan, paha, betis, dan telapak.
- Sendi hanya boleh berputar. Panjang tulang tidak pernah berubah, jadi tangan dan kaki tidak bisa mengecil. Transisi antar pose menghaluskan sudut sendi, bukan titik path.
- Fase langkah dihitung dari jarak tempuh (`fase = jarak / panjangLangkah`), jadi kaki menapak dan tidak meluncur.
- Kulit karakter digambar sekali per video dan dipakai di semua adegan, jadi wajah dan baju tetap sama.
- Rig ini juga menjadi dasar spike rig di bagian "Seri dengan karakter konsisten". Ekspresi wajah dan gerak mulut ditambahkan di sana, bukan di sini.

Keputusan teknis:
- Draf objek dijalankan tanpa impor (`allowedImports: []`, `vm` hanya berisi `React`), dan adegan menerima blok shared world yang sama. Karena itu rig ditulis sebagai sumber kode tetap (`HUMAN_RIG_SOURCE` di `src/lib/explainer/human-rig.ts`), lalu disisipkan `joinPieces` ke blok shared world jika rencana punya karakter. Rig tidak diimpor dari `@/motion-kit`. Rig wajib lolos `validateSceneCode` dengan `svgOnly`.
- Versi pertama memakai tampak samping atau 3/4 yang bisa dicerminkan (`facing: 1 | -1`). Jalan dari depan terlihat buruk di rig 2D, jadi tampak depan hanya untuk berdiri atau bicara dan menyusul nanti.
- Benda yang dipegang (senapan, HP, map) ditempel ke tulang tangan lewat slot `holding`. Benda dua tangan memakai pose yang dirancang lurus dengan sumbu benda; IK belum dibuat.
- Baju panjang (jas berekor, rok) memakai slot `coatTail` yang menempel ke pinggul dan ikut berayun.

Fase 0, spike tanpa AI, dinilai user dulu:
- [x] `HumanRig` di [human-rig.ts](src/lib/explainer/human-rig.ts) dengan hierarki pinggul → paha → betis → telapak, bahu → lengan atas → lengan bawah → tangan, serta badan → leher → kepala. Proporsi dihitung dari tinggi objek (sekitar 7,5 kepala). Urutan gambar tetap: anggota tubuh sisi jauh di belakang badan dan digelapkan filter (`farShade`, default 0,72), sisi dekat di depan. Slot kulit: `head`, `neck`, `torso`, `pelvis`, `upperArm`, `foreArm`, `hand`, `thigh`, `shin`, `foot`, `coatTail`; slot bisa berupa fungsi `(side) => …`. Benda dipegang lewat `holding: { item, hand, angle }`. `facing: -1` mencerminkan figur
- [x] Pose bernama `stand`, `point`, `explain`, `hold`, `aim`, `raiseHand`, `crossArms`, `sit`, dan `lookUp`, dicampur lewat `pose`, `poseTo`, dan `poseMix` pada sudut sendi. Jalan memakai IK dua tulang: kaki tumpu menempel di tanah, kaki ayun mengikuti busur, tumit terangkat di akhir tumpuan, dan pinggul naik-turun. `walkMix` mencampur jalan dengan pose diam. Satu siklus (`walkPhase` + 1) memindahkan badan `HUMAN_RIG.stride(tinggi)` = 1,2 × panjang kaki. Telapak terendah selalu diletakkan di y = 0, jadi pose duduk juga menapak
- [x] `HUMAN_RIG.solve()` mengembalikan posisi semua sendi. 7 test di [human-rig.test.ts](src/lib/explainer/human-rig.test.ts): lolos `validateSceneCode` tanpa impor, panjang tulang sama di semua pose, campuran, dan 24 fase jalan, telapak terendah di tanah, kaki tumpu bergeser kurang dari 0,4% tinggi badan selama menapak, lutut tidak menekuk terbalik, serta slot dan benda dipegang ikut dirender
- [ ] (uji coba) Kulit contoh buatan tangan ([sample-person.tsx](scripts/human-rig/sample-person.tsx)) dan skrip `npx tsx scripts/spike-human-rig.ts`: MP4 11 detik 9:16 berisi jalan ke kanan, berhenti, `point` → `explain` → `hold` (HP) → `aim` (senapan) → `raiseHand`, lalu berbalik dan jalan ke kiri, ditambah kerangka debug yang berjalan di tempat. Render 9–13 detik. Frame diperiksa: tidak ada lengan atau kaki yang mengecil, tidak ada celah di sendi, telapak menapak. Uji pertama membuat lutut terlalu menekuk saat jalan; tinggi pinggul dinaikkan. Batasan: tangan sisi jauh belum menempel di laras senapan (belum ada IK lengan), garis tepi di lutut kulit contoh masih terlihat, dan jalan hanya tampak samping. Lanjut ke Fase 1 hanya jika user menilai gerakannya layak

Fase 1, karakter di draf objek:
- [x] Rencana draf punya `kind: 'object' | 'character'` (default `object`, jadi draf lama tetap terbaca). Perencana wajib memberi `character` untuk setiap orang, termasuk siluet dan barisan; orang yang mirip seperti barisan serdadu adalah satu karakter yang dipasang berkali-kali. Prop karakter hanya untuk kostum atau benda yang dibawa, tidak pernah pose. Warna kulit dan baju wajib warna nyata, bukan warna latar palet. Nama `HumanRig` dan `HUMAN_RIG` dilarang untuk objek
- [x] Prompt khusus karakter (`CHARACTER_SYSTEM`): ukuran tiap tulang dihitung dari `HUMAN_RIG.metrics(tinggi)` dan ditulis di prompt, slot digambar di koordinat lokal tulang dengan ujung bulat melewati sendi, satu gambar dipakai untuk sisi dekat dan jauh, benda dibawa lewat `holding`, dan komponen wajib mengembalikan `<HumanRig … />`
- [x] Pemeriksaan karakter di `checkPiece`: memakai `HumanRig`, tidak mendefinisikan ulang rig, 9 slot wajib terisi, path tidak boleh dibangun dari prop (path dari konstanta lokal seperti lipatan kain boleh), dirender di VM dalam pose `stand`, jalan (`walkPhase` 0,15 + `walkMix` 1), dan `point`. Raster memeriksa tinggi berdiri 0,85–1,3 × tinggi rig, telapak di y = 0 (±5%), lebar tidak lebih dari 1,2 × tinggi, tinggi saat melangkah berbeda paling banyak 12%, dan pose jalan atau menunjuk tidak boleh sama persis dengan pose berdiri
- [x] Kartu kritik karakter menampilkan 3 pose berdampingan, dan kritik diberi tahu untuk menurunkan skor jika bagian tubuh berubah ukuran, lepas dari sendi, atau ada celah
- [x] Rig disisipkan `joinPieces` di awal blok shared world hanya jika rencana punya karakter. Pratinjau draf memakai blok penuh, jadi karakter langsung tampil

Fase 2, animator adegan:
- [x] `HUMAN_RIG.walk({ progress, fromX, toX, height, scale })` di dalam rig (bukan di `@/motion-kit`, supaya adegan tidak butuh impor tambahan dan sama dengan yang dijalankan VM). Hasilnya `x`, `walkPhase` dari jarak tempuh, `walkMix` yang naik dan turun di tepi, serta `facing`. Test membuktikan kaki tumpu tidak bergeser lebih dari 0,4% tinggi pada skala 0,5
- [x] `draftApi` mengirim `HUMAN_RIG_API` (cara menempatkan, berjalan, berganti pose, larangan mengubah skala atau menggambar orang sendiri) dan menandai tiap karakter "Character on HumanRig, height …". `continuityPrompt` menambah aturan bahwa orang hanya digerakkan lewat prop dan `HUMAN_RIG.walk`, serta meneruskan pose dan arah hadap dari adegan sebelumnya
- [ ] Belum dibuat: validator yang menolak skala karakter yang berubah per frame, dan pemeriksaan kaki meluncur dari frame. Aturan ini baru ada di prompt

Fase 3, bukti nyata (lewat `scripts/e2e-character-video.ts`, yang memanggil `prepareGeneration`, `runGeneration`, setujui draf, dan export seperti route aplikasi; login dan kredit dilewati):
- [x] Londo Ireng (`proj_rig_londo_1794242584564`, storyboard disalin dari `proj_717a…`): draf objek 1.054 detik dengan `SerdaduAfrika` sebagai karakter, 6/6 adegan, generate 1.763 detik, export 60 detik. Adegan 2: empat rekrutan berbaris masuk gerbang lewat `HUMAN_RIG.walk`, langkah terlihat. Adegan 5: serdadu berpatroli lalu berganti ke pose `aim`, tanpa lengan mengecil. Batasan: kulit serdadu kaku seperti manekin dan wajahnya hampir hitam karena perencana memakai warna latar palet sebagai warna kulit (aturan warna sudah ditambahkan setelah run ini, belum diuji ulang), senapan dipegang dengan sudut janggal, dan rekrutan kecil (skala 0,28). Skor kritik adegan 5,0–6,2
- [x] Dua teman kantor berjalan kaki (`proj_rig_1794245459131`): 4 adegan, draf objek 594 detik dengan dua karakter, generate 1.010 detik, export 45 detik. Adegan 1: keduanya berjalan berdampingan dengan langkah jelas sambil berganti ke pose `explain`. Adegan 4: karakter yang sama persis (baju, tas, rambut) muncul lagi dan berjalan melewati gerbang. Batasan: model menulis ulang rumus jalan sendiri alih-alih memanggil `HUMAN_RIG.walk`, dengan `walkMix` mulai 0,2 sehingga kaki bisa sedikit meluncur di awal jalan; kepala terpotong area judul di adegan 1
- [ ] Ibu dan anak (`proj_rig_1794242692555`): draf objek berhasil dengan dua karakter, adegan 1 (ibu menunjuk jam, anak memegang HP) dan 3 jadi. Adegan 2 dan 4 (remaja berpakaian tidur di ranjang) diblokir filter keamanan Gemini (`finish_reason: content_filter`) dua kali berturut-turut, jadi tidak bisa di-export. Ini masalah terpisah dari rig
- [x] Lewat aplikasi di browser (10 November 2026, akun user di panel browser): ide "kurir berjalan mengantar paket … mengangkat dengan punggung tegak", Story 2D Full SVG 9:16 → Susun draf (4 adegan, sekitar 19 detik) → Buat Video (1 kredit) → draf objek dengan 2 karakter (`Courier`, `Homeowner`) dan 2 objek, siap ditinjau sekitar 5 menit → Setujui & lanjutkan animasi → 4/4 adegan jadi sekitar 18 menit → Ekspor MP4 (`proj_5b452444f39120794962c4ca3dd8bc81b7897d63`, 21,2 detik). Frame diperiksa: kurir berjalan membawa kardus dengan langkah jelas (adegan 1, `HUMAN_RIG.walk`), pemilik rumah masuk lalu menerima paket (adegan 4), rupa kedua karakter sama di semua adegan, dan aturan kepala baru langsung menghasilkan kepala bulat dengan rambut atau topi solid tanpa revisi. Batasan: rig belum punya pose membungkuk dan jongkok mengangkat, jadi adegan 2 (bahaya membungkuk) menampilkan kurir tetap tegak dengan diagram tulang belakang, dan adegan 3 (tekuk lutut) memperbesar karakter sampai terpotong; ada kardus ganda di beberapa frame
- [x] Koreksi bentuk muka (permintaan user): Gemini menaruh dagu tepat di atas leher karena prompt menyebut "chin and neck joint at (0,0)", sehingga kepala seperti telur miring di atas tangkai, ada celah di bawah rahang, dan rambut hanya berupa garis tepi dengan belakang kepala botak. Prompt kepala kini memberi titik profil (origin di puncak leher di bawah belakang tengkorak, kepala sedalam tingginya, posisi mata, hidung, mulut, dagu, sudut rahang, dan telinga, dihitung dari tinggi kepala), meminta leher melewati rahang tanpa celah, dan mewajibkan rambut berupa satu bentuk isi yang menutup seluruh tengkorak tanpa garis tebal melintang di wajah. Kedua karakter di `proj_rig_1794245459131` digambar ulang lewat jalur Ubah draf (116 dan 181 detik, 2 kali; percobaan pertama masih menyisakan rambut garis tepi dan garis hitam di wajah pria), blok baru dipasang ke 4 adegan, lolos validasi, dan di-export ulang (48 detik). Frame diperiksa: kepala bulat, rambut solid, leher tersambung. Batasan: masih ada lekukan kecil di sudut rahang pria; kepala pria tetap menyentuh area judul di adegan 1; aturan rambut di prompt umum belum diuji pada karakter baru; cadangan versi sebelumnya ada di `storage/spike/probe/`

Lanjutan:
- [ ] Pose `bend` (membungkuk) dan `squat` atau `lift` (jongkok mengangkat beban), karena topik postur dan kerja fisik membutuhkannya. Ditemukan di uji browser kurir

Perbaikan pendukung yang ikut dibuat:
- [ ] `OBJECT_SYSTEM` kini meminta bagian bergerak pada objek biasa (pintu, tuas, lengan mesin) diputar di sendinya, bukan menginterpolasi path. Belum diuji pada objek nyata
- [x] `callChat` mengirim ulang satu kali jika stream putus di tengah (`TypeError: terminated` dari `BodyTimeoutError`, router diam lebih dari 5 menit). Terjadi 3 kali dalam uji ini; percobaan ulang berhasil setiap kali
- [x] Jawaban kosong karena filter keamanan kini dilaporkan sebagai filter keamanan, bukan "Response must contain json and tsx code blocks"
- [x] Potongan draf mendapat 2 kali perbaikan (sebelumnya 1), dan id akar `asset-world-<nama>` tanpa tanda hubung di akhir diterima. Sebelumnya satu potongan yang gagal menggagalkan seluruh draf
- [x] Cek awalan id tidak lagi menolak id yang dibangun dari variabel (`id={`${p}body`}`) atau id kosong (`id=""`). Keduanya dulu dibaca sebagai id kosong tanpa awalan, sehingga draf gagal dengan pesan "Prefix every id ...: ." dan semua adegan ikut gagal (terjadi dengan Gemini dan DeepSeek). Id dinamis kini dicek pada SVG hasil render, dan pesan error mengutip id yang salah
- [ ] Lewati persetujuan draf objek: centang "Lewati persetujuan draf objek" di studio saat draf objek sedang digambar atau menunggu persetujuan. Jika dicentang, animasi langsung jalan setelah draf lolos pemeriksaan; jika draf sudah menunggu, centang langsung menyetujuinya. Pilihan disimpan di proyek (`autoApproveObjectDraft`) dan diingat di browser untuk video Full SVG berikutnya. Job membaca pilihan dari file proyek di setiap commit supaya centang di tengah proses tidak tertimpa. Test route dan job lolos. Batasan: belum dicek di browser, dan tanpa persetujuan user tidak menerima email "draf siap ditinjau"

Risiko: kulit buatan Gemini di koordinat lokal tulang bisa meleset dari sendinya; pemeriksaan batas tubuh dan dua kali perbaikan menjadi penjaganya. Rig 2D bisa tampak kaku untuk gaya serius, jadi Fase 0 dinilai user sebelum AI dilibatkan. Jumlah panggilan model per karakter tidak bertambah, tetapi prompt karakter lebih panjang dan perlu diukur.

## Seri dengan karakter konsisten

Status: rencana, belum dimulai. Tujuannya gaya video serius (dokumenter atau drama) yang bisa dibuat episode demi episode dengan karakter yang sama. Alasan keputusan ada di [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md), bagian "Rencana seri dengan karakter konsisten".

Prinsip:
- Karakter tidak digambar ulang AI per adegan. Karakter adalah aset terkunci berupa rig SVG (kepala, mata, alis, mulut, lengan, dan badan sebagai bagian terpisah), dipanggil lewat komponen seperti `<Character id="raka" pose="menjelaskan" expression="khawatir" talking />`. Coder tidak boleh menggambar figur manusia sendiri jika proyek punya pemeran.
- Latar boleh tetap dibuat AI per adegan.
- Format suara default: campuran. Narator memberi konteks, dan dialog pendek antar-karakter dipakai di momen penting. Narator saja dan dialog penuh tetap menjadi pilihan nanti.
- User tidak wajib membuat karakter dari nol. AI mengusulkan pemeran dari 1–2 kalimat prompt, lalu user menyetujui atau mengubahnya.

Alur:
1. Episode pertama: prompt → AI mengusulkan seri (judul, nada, palet, musik, lokasi yang sering muncul) dan pemeran (tokoh utama dan 1–3 pendukung: nama, peran, sifat, tampilan, suara) → user meninjau dan mengunci pemeran → draf episode 1.
2. Episode berikutnya: pilih seri → prompt episode → draf dengan pemeran yang sama dan memori seri. Tokoh baru hanya masuk setelah disetujui user.

Item:
- [ ] (uji coba) Spike rig karakter: 1 rig, 4 pose, 4 ekspresi, kedip dan gerak mulut dari timing per kata, render 1 adegan dialog 2 karakter sampai MP4. Lanjut hanya jika user menilai kualitasnya layak untuk gaya serius
- [ ] Data seri: tabel seri (Series Bible: nada, palet, tipografi, musik, transisi, lokasi), pemeran (rig, atribut tampilan, pose dan ekspresi tersedia, suara TTS terkunci, gaya bicara), dan `series_id` pada project. Migrasi D1 baru, dan input divalidasi Zod
- [ ] Pembuat karakter tahap 1: rig dasar dengan atribut yang bisa diatur (bentuk wajah, rambut, warna kulit, baju, aksesori), seperti pembuat avatar. Tanpa AI menggambar bentuk baru
- [ ] Layar pemeran: usulan AI dari prompt, ganti nama dan tampilan, dengar contoh suara, lalu kunci pemeran
- [ ] Draf episode: per adegan memuat lokasi, siapa yang tampil, siapa yang bicara, baris narator atau dialog, pose, dan ekspresi. Director hanya boleh memakai pemeran serta pose dan ekspresi yang tersedia, dengan pola yang sama seperti `libraryDraftNote`
- [ ] TTS multi-suara: tiap baris memakai suara karakternya, dan gerak mulut serta giliran bicara mengikuti timing audio
- [ ] Validator: tolak adegan yang menggambar figur manusia manual pada proyek yang punya pemeran, dan tolak `id`, pose, atau ekspresi yang tidak terdaftar
- [ ] Memori seri: setelah episode selesai, Gemini meringkas fakta cerita (siapa tahu apa, apa yang berubah), lalu Director membacanya di episode berikutnya supaya tidak bertentangan
- [ ] Pose atau ekspresi yang belum tersedia dicatat sebagai permintaan, seperti tab Diminta di pustaka aset
- [ ] Karakter dari prompt lewat AI (tahap 2): memakai alur draf aset yang sudah ada (validasi, render server, pemeriksaan, revisi, versi). Karakter dikunci setelah disetujui
- [ ] Nuansa serius: easing pelan tanpa pantulan, palet redup jika sesuai topik, ekspresi halus dengan jeda, kartu nama saat karakter pertama muncul per episode, musik seperti `documentary-tension`, `historical-reflection`, atau `soft-ambient`. Terkait item "Kartu penutup dan identitas seri" di bagian Pilihan gaya dan brand

Risiko: rig SVG buatan AI bisa terlihat kaku atau murahan, dan gaya serius sangat sensitif terhadap hal ini. Karena itu spike rig dinilai user lebih dulu sebelum sistem seri dibangun. Dialog multi-suara menambah panggilan TTS per video, dan dampak waktu serta biayanya harus diukur.

## Keamanan

- [x] Validasi project id dan nama file
- [x] Validasi skema request
- [x] Validator kode berbasis AST
- [x] Blokir akses `project.json` dan file build lewat route aset
- [x] Larang edit project saat generate berjalan
- [x] Login Google dan kepemilikan project
- [x] Batas generate per user lewat saldo kredit (revisi chat belum dibatasi)
- [x] Batas revisi chat: setiap video punya jatah 20 adegan revisi (angka sementara, ditetapkan bersama harga final di `src/lib/billing/credits.ts`). Jatah dicatat di tabel `revision_usage` (migrasi `0002_revision_usage.sql`) dan dipesan dengan satu INSERT bersyarat sebelum AI dipanggil, lalu dikembalikan jika revisi gagal. Revisi semua adegan memakai jatah sebanyak jumlah adegannya. Editor menampilkan sisa revisi dan pesan error, dan pesan yang gagal dikembalikan ke kotak input. Lolos test route. Uji browser: sisa revisi tampil di editor dan turun 20 → 19 → 14 → 13 sesuai jumlah adegan yang direvisi. Batasan: migrasi belum diterapkan ke D1 sungguhan, dan jalur pengembalian jatah saat error baru diuji lewat fungsi, bukan lewat route
- [ ] Pratinjau dalam iframe sandbox
- [ ] Render di worker terisolasi tanpa akses jaringan
- [ ] Ganti koneksi router ke HTTPS

## Siap dijual

- [x] D1 untuk akun, saldo, dan pembayaran
- [ ] Object storage untuk file project
- [ ] Catat biaya per video untuk admin (bukan untuk user, yang tetap hanya melihat kredit). Tujuannya menentukan harga kredit, menilai jatah gratis, menemukan video yang biayanya tidak wajar, dan membandingkan model. Rencana:
  - [x] Setiap panggilan AI mencatat satu baris ke tabel `ai_usage` (migrasi `0003_ai_usage.sql`). Dicatat di empat titik: klien chat AI SDK, chat streaming aset, model gambar, dan TTS router. Konteks user, proyek, gaya, dan tahap dibawa `AsyncLocalStorage` dari route, termasuk ke job generate di latar belakang. Uji nyata: caption, draf, ubah draf, TTS 5 adegan, dan gambar adegan Full SVG lewat chat streaming (6.816 token masuk, 13.131 keluar, 90 detik) tercatat dengan user dan proyek. Pencatatan model gambar baru dibuktikan lewat kode, belum lewat video Campuran nyata. Batasan: tahap di dalam generate belum dipecah (aset, kritik, perbaikan), tetapi model dan jenisnya terlihat; TTS `msedge-tts` langsung tidak dicatat karena gratis. Rencana awal: user, proyek, tahap (draf, ubah draf, rencana gambar, gambar, kode adegan, perbaikan crash, kritik, TTS, revisi chat, caption), model, token masuk dan keluar atau karakter TTS, jumlah gambar, durasi, dan berhasil atau gagal. Pencatatan tidak boleh menggagalkan video jika database sedang bermasalah
  - [x] Tabel `model_rates` dalam rupiah, sudah diisi dari harga resmi Google dan DeepSeek dengan kurs JISDOR Rp18.130, termasuk kenaikan Gemini 3.8 Flash per 1 Januari 2027. Sumber dan cara hitung TTS ada di KNOWLEDGE. Rencana awal: diisi dari harga resmi atau tagihan router, dengan tanggal berlaku supaya catatan lama tidak berubah saat tarif naik
  - [x] Ringkasan per video, per tahap, per model, per gaya, dan proyek termahal. Ringkasan per user dan per hari belum ada. Rencana awal: ringkasan per video: total token, gambar, karakter TTS, perkiraan rupiah, dan rincian per tahap. Juga ringkasan per user dan per hari
  - [x] Peran admin: daftar email di `ADMIN_EMAILS`, dicek di server. User biasa mendapat 404 untuk halaman dan route admin
  - [x] Halaman admin `/admin/biaya` dengan periode 7, 30, dan 90 hari, peringatan model belum bertarif, dan form tarif. Diuji di Chrome. Isi rencana: tabel video dengan biaya tertinggi, rata-rata biaya per gaya (Story 2D Campuran, Full SVG, Ads, Isometrik), biaya jatah gratis (revisi, ubah draf, caption), dan perbandingan dengan pemasukan kredit
  - [ ] Cocokkan perkiraan dengan tagihan nyata router setidaknya sekali sebelum menetapkan harga final
- [x] Paket kredit dan pembayaran QRIS Xendit (harga masih placeholder)
- [ ] Tetapkan harga final di `src/lib/billing/packages.ts`, setelah catatan biaya admin memberi angka nyata
- [x] Uji login Google dengan kredensial sungguhan di localhost
- [x] Uji buat QRIS, simulasi bayar, dan kredit masuk dengan kunci uji Xendit
- [ ] Uji webhook Xendit dari alamat publik
- [ ] Terapkan migrasi ke D1 sungguhan
- [ ] Pindahkan generate dan render ke host yang mendukung Node dan Chromium
- [ ] Cek lisensi komersial Remotion dan Gemini TTS
- [ ] Pustaka aset untuk topik yang sering dipakai. Rencana dan kebijakan `library-first` → `library-only` ada di [plan_asset.md](plan_asset.md). Belum tersambung ke pipeline aplikasi.
  - [ ] (uji coba) Registry `src/lib/assets/` (mobil bensin, mobil listrik, jalan, ditambah aset lingkungan dari pekerjaan paralel), validator rencana, pencarian katalog, dan renderer `PlanVideo` dengan kamera, mobil masuk, dan transisi bodi. Uji lewat `scripts/spike-asset-plan.ts`: 4 run topik mobil sampai MP4, 79–98 detik per video, frame diperiksa. Menunggu penilaian user saat menonton
  - [ ] (uji coba) Laporan cakupan: rencana AI mendaftar objek, aksi, atau lingkungan yang diminta tetapi tidak ada di pustaka (`unsupported`), dan hal itu tidak dibahas di narasi. Uji prompt "belok di tikungan lalu berhenti di lampu merah": tikungan, belok, dan lampu merah dilaporkan, lalu dicatat ke tabel `asset_requests`. Batasan: baru lewat skrip, belum tampil di layar draf aplikasi
  - [ ] Halaman admin `/admin/assets` dengan tab Terbit, Draf, dan Diminta. Terbit menampilkan aset dari registry kode beserta preview SVG per varian, status, gaya, kemampuan, titik label, properti, dan batasan. Diminta menampilkan rekap `asset_requests` per gaya dan objek, diurutkan dari yang paling sering, dengan tombol Jadikan draf. Draf (tabel `asset_drafts`, migrasi `0004_asset_library.sql`) bisa ditolak dan dipulihkan. Admin dicek di server; user biasa mendapat 404. Lolos test route dan data. Uji Chrome dengan akun admin: tab Terbit menampilkan 5 aset beserta preview per varian, tab Diminta menampilkan 3 permintaan dari uji lampu merah, Jadikan draf membuat `draft.lampu-merah@0.0.1`, lalu Tolak dan Pulihkan berjalan. Preview saluran air sempat tampak sama untuk varian sungai dan saluran karena prop varian tidak diteruskan; sudah diperbaiki, dan kini dijaga test. Batasan: tombol form belum punya status memuat (sekitar 3 detik di server dev); migrasi belum diterapkan ke D1 sungguhan
  - [ ] (uji coba) Isi draf oleh AI dan halaman kurasi `/admin/assets/draft/[id]`. "Buat dengan AI" meminta Gemini membuat komponen SVG dan metadata (varian, keadaan, warna, titik label, batasan) dengan proyeksi pustaka lewat `@/motion-kit/isometric/draft-kit`. Kode divalidasi `validateSceneCode` dengan impor terbatas tanpa gambar raster, dirender di server dalam `vm` dengan batas 1 detik per render, lalu diperiksa 9 hal: validator, metadata, render, kanvas 760×480, angka rusak, deterministik, varian berbeda, keadaan mengubah gambar, dan titik label di dalam kanvas. Pemeriksaan yang gagal dikirim balik ke model, maksimal 3 percobaan. Halaman menampilkan pratinjau dengan titik label, perbandingan skala dengan mobil pustaka, semua varian dan keadaan, hasil pemeriksaan, catatan percobaan AI, revisi lewat instruksi, edit kode dan metadata langsung, serta riwayat versi yang bisa diaktifkan lagi (tabel `asset_draft_versions`, migrasi `0005`). SVG draf ditampilkan sebagai gambar, jadi kodenya tidak berjalan di halaman admin. Uji nyata Gemini untuk "Lampu merah": versi 1 dalam 161 detik dan 3 percobaan (2 ditolak karena format nama), 2 varian × 5 keadaan, 9/9 lolos; revisi "perbesar, tiang dua kali tinggi mobil" dalam 126 detik dan 1 percobaan, 9/9 lolos. Halaman diperiksa di Chrome. Batasan: pembuatan dijalankan lewat `scripts/assets/generate-draft.ts` karena tab Chrome berpindah sendiri saat uji, sehingga tombol di halaman baru dibuktikan lewat test route; versi 2 masih kira-kira setinggi mobil, belum dua kali; kualitas menunggu penilaian user; draf hanya untuk gaya Isometrik
  - [ ] (uji coba) Terbitkan draf dari admin tanpa deploy: tombol Terbitkan di halaman draf, hanya untuk versi aktif yang 9/9 pemeriksaannya lolos, dengan centang konfirmasi. Pemeriksaan dijalankan ulang pada kode tersimpan, lalu versi disalin dan dikunci ke tabel `published_assets` (migrasi `0006`) sebagai `custom.<nama>@0.1.0`. Draf menjadi Terbit dan bisa dibuka lagi; terbit berikutnya menjadi `0.2.0` dengan id yang sama. Katalog (`loadAssetCatalog`) menggabungkan aset kode dan versi aktif terbaru dari database untuk pencarian, prompt, dan validator; versi lama dan yang usang tetap bisa dirender lewat `getPublishedVersions`. `PlanVideo` menerima `registry` dan komponen terbit, dan skrip uji memvalidasi ulang kode terbit lalu membundelnya. Tab Terbit menampilkan aset dari draf dengan pratinjau tersimpan. 14 test terbit dan draf lulus. Uji nyata sampai MP4: user menerbitkan Lampu merah versi 3 sebagai `custom.lampu-merah@0.1.0`, lalu skrip uji dengan topik mobil berhenti di lampu merah menghasilkan 4 adegan, 22,4 detik, total 77 detik, rencana lolos di percobaan pertama. Lampu tampil di tepi jalan, merah saat berhenti dan hijau saat jalan lagi, frame diperiksa. Batasan: belum ada tombol tandai usang di admin; pembuatan video di aplikasi belum memakai katalog ini; satu lampu hanya bisa di tepi jalan sisi dekat, belum di persimpangan
  - [ ] Isometrik `library-first` di aplikasi: proyek Isometrik baru diberi `visualPolicy: 'library-first'`. Saat draf dibuat, Director menerima daftar aset yang cocok beserta kemampuan dan batasannya (`libraryDraftNote`), supaya narasi bisa digambar. Saat generate, `buildLibraryFiles` menyusun rencana dari narasi yang sudah disetujui (narasi dan durasi dikunci ke draf, waktu aksi diskalakan), memvalidasinya dengan `requireVisibleChange`, lalu menulis `MainVideo.tsx` (`PlanVideo` + `MusicBed`) dan `AssetN.tsx` untuk aset terbit. Jika tidak ada aset yang cocok, rencana gagal, atau narasi menyebut hal yang belum ada, job memakai dunia gambar AI lama. Alasannya ditulis di chat editor, dan kebutuhannya dicatat ke tab Diminta. Proyek lama tetap memakai mesin lamanya. Pratinjau browser memetakan impor kit draf, dan export membundel file aset. Uji ujung ke ujung lewat kode aplikasi (`scripts/assets/e2e-library-video.ts`): tanpa petunjuk pustaka, draf menyebut persimpangan, garis setop, dan mendahului, sehingga job jatuh ke gambar AI (5 kebutuhan tercatat, export 15 detik); dengan petunjuk pustaka, 6 adegan, generate 146 detik memakai jalan, mobil, dan `custom.lampu-merah@0.1.0`, export MP4 32,5 detik dalam 21 detik, frame diperiksa, dan pratinjau studio di Chrome tampil. 552 test lulus. Area aman: caption menempel di batas bawah area aman platform, label tidak melewati batas kiri, kanan, dan atas, panggung menyesuaikan, dan nama mobil di layout berdampingan pindah ke kanan bawah tiap mobil supaya tidak bertabrakan dengan label. Diperiksa pada render TikTok dengan garis batas di atas frame. Batasan: 2 bagian hampir diam terdeteksi; revisi chat belum tersedia; ubah draf dengan AI belum memakai petunjuk pustaka; belum dibuat lewat klik tombol di browser oleh user; belum dinilai user
  - [ ] (uji coba) Catat kebutuhan aset untuk topik tanpa aset yang cocok: saat generate proyek Isometrik `library-first` dan tidak ada aset yang cocok, satu panggilan Gemini kecil (`extractVisualNeeds`) mendaftar maksimal 6 objek, aksi, atau lingkungan utama dari narasi, lalu mencatatnya ke tab Diminta. Video tetap memakai gambar AI, dan kegagalan panggilan ini tidak menggagalkan video. Uji Gemini langsung (tanpa mencatat): "orang berolahraga di taman" → taman, orang berlari, bangku taman, peregangan, botol minum (8 detik); "jantung memompa darah" → jantung, memompa darah, katup jantung, darah, aorta, tubuh manusia (10 detik). Batasan: sinonim belum digabung, objek dan aksi kadang tergabung ("orang berlari"), belum diuji lewat generate di browser, dan hanya berlaku untuk Isometrik
  - [ ] (uji coba) Pencarian aset dengan makna (embedding `gemini/gemini-embedding-001` lewat router): setiap aset dijadikan deskripsi (nama, alias, varian, kemampuan) lalu di-embed sekali dan disimpan di tabel `asset_embeddings` (migrasi `0007`). `searchAssets` menggabungkan alias dengan aset yang skornya minimal 0,60 dan tidak lebih dari 0,10 di bawah skor terbaik. Kalibrasi 8 topik: aset relevan 0,63–0,75, topik tanpa aset maksimal 0,57. Dipakai di petunjuk pustaka saat draf dan saat generate; jika embedding gagal, pencarian kembali ke alias. Permintaan baru digabung ke subjek yang sudah tercatat lewat Gemini (`mergeRequestSubjects`), karena embedding kata tunggal tidak membedakan sinonim ("orang"~"pejalan kaki" 0,633, "orang"~"jantung" 0,620); embedding hanya menyaring kandidat setelah lebih dari 40 subjek. Kasus nyata: proyek user "air sungai dijernihkan" (dibuat sebelum fitur ini) hanya menemukan aset sungai lewat alias, sehingga tahap koagulasi, pengendapan, filter, dan klorin dilaporkan tidak ada; pencarian baru menemukan pengolahan air (0,746). 560 test lulus. Batasan: belum diuji lewat generate di browser; penggabungan permintaan belum diuji dengan Gemini sungguhan; aturan jatuh ke gambar AI masih semua-atau-tidak
  - [ ] (uji coba) Hibrida per objek di Isometrik: bentuk sulit dari pustaka, objek sederhana yang belum ada digambar AI khusus untuk video itu. Setelah rencana pertama, maksimal 3 objek (bukan aksi) digambar paralel dengan `generateProp` (satu varian, maksimal 2 warna, 2 percobaan) memakai kit dan proyeksi pustaka, divalidasi seperti draf, lalu rencana disusun ulang dengan objek itu di katalog. Objek buatan ini tidak masuk pustaka, tetapi tetap tercatat di tab Diminta. Video jatuh ke gambar AI hanya jika tidak ada aset yang cocok atau kekurangan menyentuh lebih dari separuh adegan; selebihnya adegan yang kurang memakai aset terdekat dan chat editor menyebutnya. Uji ujung ke ujung "air sungai dijernihkan, lalu lewat pipa sampai keran di rumah": 6 adegan dari sungai dan pengolahan air, "pipa bawah tanah dan keran rumah" digambar AI, "mikroorganisme" dilaporkan memakai aset terdekat, generate 291 detik (sebelumnya 107 detik tanpa objek buatan), export 13 detik, frame diperiksa. Batasan: menambah sekitar 3 menit per video yang punya objek kurang; objek buatan sederhana dan belum ditinjau manusia; model bisa menggabungkan dua objek menjadi satu gambar; belum diuji dari klik browser
  - [ ] (uji coba) Cek sudut pandang gambar dunia Isometrik: prompt melarang langit, cakrawala, titik hilang, dan merek; model visi memeriksa hasil, dan dunia yang gagal digambar ulang sekali dari kanvas kosong. Uji nyata 1 kali dengan narasi "mobil limbung di tikungan": gambar pertama perspektif ditolak, gambar ulang dilihat dari atas tanpa langit. Batasan: menambah 1 panggilan visi per video dan 1 gambar saat gagal; close-up tidak dicek; baru 1 topik; belum dinilai user
  - [ ] (uji coba) Isometrik pustaka sebagai satu dunia (`WorldPlanVideo`): semua objek ditata sekali, setiap adegan adalah gerak kamera tanpa fade. Uji render ulang 2 proyek, frame diperiksa. Batasan: masih 3–5 bagian hampir diam karena kamera diam setelah tiba; belum dinilai user
  - [ ] (uji coba) Mesin Canvas isometrik (`src/motion-kit/iso-canvas/`): box, silinder, kerucut, prisma, bidang, bola, pipa dengan aliran, label, geser, dan putar; pencahayaan otomatis dari arah hadap tiap sisi dan sisi belakang tidak digambar. `CanvasScene` menggambar ulang per frame di Remotion. Uji Gemini lewat `scripts/spike-canvas-iso.ts`, "Kipas angin meja berputar", 3 detik 9:16: percobaan 1 (147 detik, 56 bentuk) terbaca kipas tapi pelindung padat seperti parabola, bilah tak terlihat, label terpotong; satu putaran perbaikan dengan Gemini melihat frame sendiri (47 detik) menghasilkan kipas meja yang jelas: jeruji kawat, 4 bilah berputar, kepala menggeleng, tombol di alas. Render 90 frame 2 detik. Uji lanjutan dengan cara yang sama: "HP dicas semalaman" gagal (latar gelap, terbaca sebagai papan sirkuit, bukan HP, juga setelah perbaikan) dan "Jantung memompa darah" gagal (gumpalan bola dan pipa, bukan jantung, juga setelah perbaikan). Token per video (2 panggilan): kipas 14.092 masuk / 27.330 keluar (sekitar Rp2.050), HP 11.500 / 12.344 (sekitar Rp995), jantung 12.489 / 15.087 (sekitar Rp1.196), mobil di jalan kota 14.999 / 24.409 (sekitar Rp1.863; terbaca jelas: jalan bermarka bergerak, trotoar, pohon, lampu jalan, gedung, taksi menyalip, tapi bawah frame kosong biru karena jalan berhenti, taksi menembus mobil utama, label "Marka Lajur" menunjuk mobil, perbaikan malah terlalu dekat), memakai tarif `ag/gemini-3.8-flash-high` Rp13.597,5 dan Rp67.987,5 per juta token. Keputusan user: Isometrik dibuat Gemini dengan Canvas, dengan putaran nilai dan perbaikan berambang 6 (atau 5,5). Putaran nilai di skrip spike (penilai 5 kriteria, maksimal 3 putaran, simpan yang terbaik): mobil terbaik 5,8 (Rp4.325), jantung terbaik 5,2 (Rp3.501); ambang 6 belum tercapai. Batasan: label sering terpotong tepi; belum masuk validator dan job; belum dinilai user
  - [ ] Tampilkan laporan cakupan di layar draf, sebelum generate: user diberi tahu objek yang belum tersedia dan memilih lanjut dengan aset yang ada atau memakai ilustrasi AI. Saat ini laporan baru muncul di chat editor setelah generate. Belum dimulai
- [ ] Set 30 prompt acuan untuk mengukur kualitas
- [ ] Perbarui README
