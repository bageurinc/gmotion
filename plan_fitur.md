# Plan Fitur gmotion

Terakhir diperbarui 8 November 2026.

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

1. Penilaian user atas Isometrik versi gambar AI: jantung, paru-paru, dan iklan kasir. Jika disetujui, hapus mesin 3D lama yang tidak terpakai.
1a. Penilaian user atas video Story 2D dan Ads.
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
- [ ] Persentase progres generate: bar satu angka untuk seluruh pembuatan video. Pada Full SVG draf objek mengisi 0–30% dengan label langkah (merencanakan, menggambar per objek, menilai, memperbaiki). Koreksi draf juga menampilkan bar sendiri. 636 test lolos. Belum dicek di browser dan belum dinilai user. Batasan: bobot 30% dan bobot tahap adegan masih perkiraan dari dua uji
- [ ] Pilihan gaya teks judul dan subtitle: 4 pasangan font, saran AI ditandai, bisa dipilih di layar draf dan diganti gratis di studio tanpa menggambar ulang. Adegan sederhana dan CTA kini ikut gaya video lewat `TextStyleProvider`. 639 test lolos. Belum dicek di browser dan belum dirender ke MP4. Batasan: Isometrik belum didukung
- [x] Tab Kode dihapus dari studio atas permintaan user karena terlalu teknis. Studio kini hanya punya tab Revisi dan Storyboard. Route `PUT /api/projects/[id]` untuk menyimpan file tetap ada dan tetap divalidasi, hanya tidak punya tombol di UI. 639 test lolos. Belum dicek di browser
- [x] Pilihan model gambar Gemini atau DeepSeek Flash di halaman utama, tersimpan per proyek dan tampil di daftar proyek serta studio. Uji browser: pilihan tersimpan dan video lebah berhasil dibuat. Batasan: DeepSeek Flash baru diuji pada Story 2D Full SVG, belum pada Campuran, Ads, dan Isometrik
- [ ] Uji DeepSeek Flash pada Story 2D Campuran, Ads, dan Isometrik
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
- [ ] Penilaian user atas musik dan SFX
- [ ] Ganti musik dengan track bebas royalti pilihan, jika perlu
- [ ] Cek audio baru di pratinjau editor
- [ ] Timing per kata yang lebih akurat
- [ ] Pilih musik di layar draf
- [ ] Bedakan narasi per adegan agar nada tetap menyambung

## Video 3D (Mode Dunia)

Status saat ini: tersedia sebagai pilihan **Isometrik**, untuk rasio 9:16. Sejak 8 November 2026, Isometrik memakai satu gambar dunia dari model gambar, bukan objek 3D dari balok dan blob. User menilai versi 3D buruk karena objek tidak dikenali dan selalu berdiri di atas alas. Item 3D di bawah tetap dicatat sebagai riwayat, dan kodenya belum dihapus.

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
  - [ ] Tampilkan laporan cakupan di layar draf, sebelum generate: user diberi tahu objek yang belum tersedia dan memilih lanjut dengan aset yang ada atau memakai ilustrasi AI. Saat ini laporan baru muncul di chat editor setelah generate. Belum dimulai
- [ ] Set 30 prompt acuan untuk mengukur kualitas
- [ ] Perbarui README
