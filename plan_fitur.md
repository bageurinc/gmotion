# Plan Fitur gmotion

Terakhir diperbarui 8 November 2026.

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
- [x] Tes otomatis untuk alur utama (420 test)

## Draf dan alur

- [x] Prompt hanya membuat draf, belum TTS atau kode
- [x] Jumlah dan isi adegan mengikuti topik, 3–12 adegan
- [x] Layar review draf: judul, narasi, teks, arahan visual
- [x] Tambah, hapus, urutkan, dan pulihkan adegan
- [x] Simpan otomatis dengan percobaan ulang
- [x] Perkiraan durasi di layar draf
- [x] Validasi narasi kosong sebelum generate
- [ ] Minta AI memperbaiki draf lewat instruksi
- [ ] Kunci durasi sesuai target di prompt: kode membaca durasi yang disebut untuk video ("video 30 detik", "durasi 1,5 menit", "iklan 45 detik"), memberi Director anggaran kata dan jumlah adegan, lalu meminta 1 kali perbaikan jika estimasi meleset lebih dari 15%. Perkiraan durasi di layar draf kini memakai kecepatan bicara terukur 2,1 kata/detik (sebelumnya 2,4). Uji nyata Gemini + TTS: target 30 detik jadi audio 30,1 detik, target 60 detik jadi 58,6 detik; draf saja: 15 → 15,3 dan 45 → 42,6 detik. Batasan: belum dijalankan lewat browser sampai export, perbaikan menambah 1 panggilan Director (sekitar +20–35 detik) hanya saat draf meleset, durasi yang tidak didahului kata seperti video/durasi/iklan tidak terbaca, dan target di bawah 8 atau di atas 300 detik diabaikan
- [ ] Percepat pembuatan draf ke bawah 15 detik (saat ini sekitar 30–40 detik)
- [ ] Uji prompt yang berisi daftar tahap sendiri

## Generate dan editor

- [x] Editor terbuka langsung setelah draf disetujui
- [x] Job latar belakang per adegan, paralel maksimal 4
- [x] Progres per adegan lewat SSE
- [ ] Pratinjau bertambah saat adegan selesai (kode ada dan lolos test, belum disaksikan di browser)
- [x] Coba ulang hanya adegan gagal, dan lanjutkan proses yang terhenti
- [x] Export dikunci selama proses
- [x] Status kembali normal saat export gagal
- [ ] Progres export asli: route mengirim persen dari `renderMedia` lewat stream, dan timer palsu dihapus. Lolos test, belum disaksikan di browser karena butuh login Google
- [ ] Revisi chat juga mengubah narasi dan audio: Gemini memisahkan permintaan menjadi narasi baru, judul baru, dan perubahan visual. Narasi baru dibuatkan suara TTS baru, lalu durasi adegan, subtitle, judul, kartu data, dan timing kamera atau aksi disesuaikan oleh kode tanpa model. `MainVideo.tsx` ikut dibuat ulang. Jika adegan buatan model tidak punya subtitle standar, penyesuaian diserahkan ke model, dan jika hasilnya crash, narasi, judul, dan audio lama dikembalikan. Uji nyata sampai MP4: video kopi Story 2D (narasi dipendekkan 8,7 → 5,9 detik dan judul diganti, revisi 19 detik, export 26 detik) dan Full SVG (narasi diperpanjang 9,0 → 12,4 detik plus latar lebih hangat, revisi 128 detik, export 35 detik). Frame MP4 diperiksa: subtitle dan judul baru tampil. Batasan: timing kamera dan aksi diskalakan sesuai durasi baru, bukan dicocokkan ulang ke kata baru; gambar tidak digambar ulang walau narasi membahas hal baru; belum dicoba lewat browser karena butuh login Google; kualitas suara dan sinkron aksi menunggu penilaian user saat menonton
- [ ] Revisi untuk semua adegan sekaligus
- [ ] Cek crash setelah revisi chat: adegan yang direvisi dirender di Chrome (3 frame, hanya adegan itu). Jika crash, AI memperbaiki 1 kali; jika masih crash, adegan kembali ke kode sebelum revisi. Balasan chat kini menyebut hasil apa adanya (lolos, diperbaiki, dikembalikan, kode tidak berubah, atau cek tidak bisa jalan), bukan selalu "telah diterapkan". Uji nyata Gemini pada salinan video kopi: revisi biasa lolos dengan cek 6,3 detik setelah revisi 18,7 detik; crash buatan terdeteksi dan diperbaiki 1 kali, total 32 detik. Batasan: belum dicoba lewat browser karena butuh login Google, jalur "dikembalikan" baru dibuktikan lewat test, dan request revisi kini menunggu cek render sebelum menjawab
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
- [x] Pilihan model gambar Gemini atau DeepSeek Flash di halaman utama, tersimpan per proyek dan tampil di daftar proyek serta studio. Uji browser: pilihan tersimpan dan video lebah berhasil dibuat. Batasan: DeepSeek Flash baru diuji pada Story 2D Full SVG, belum pada Campuran, Ads, dan Isometrik
- [ ] Uji DeepSeek Flash pada Story 2D Campuran, Ads, dan Isometrik
- [ ] Cek tagihan nyata model gambar `gemini/gemini-3.1-flash-lite-image`
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

- [x] Empat pilihan gaya: Story 2D Campuran, Story 2D Full SVG, Ads, dan Isometrik
- [ ] Brand kit: logo, warna, dan foto produk
- [ ] Kartu penutup dan identitas seri
- [ ] Unggah aset user
- [ ] Variasi hook untuk A/B test
- [ ] Export ke beberapa rasio

## Keamanan

- [x] Validasi project id dan nama file
- [x] Validasi skema request
- [x] Validator kode berbasis AST
- [x] Blokir akses `project.json` dan file build lewat route aset
- [x] Larang edit project saat generate berjalan
- [x] Login Google dan kepemilikan project
- [x] Batas generate per user lewat saldo kredit (revisi chat belum dibatasi)
- [ ] Pratinjau dalam iframe sandbox
- [ ] Render di worker terisolasi tanpa akses jaringan
- [ ] Ganti koneksi router ke HTTPS

## Siap dijual

- [x] D1 untuk akun, saldo, dan pembayaran
- [ ] Object storage untuk file project
- [ ] Catat biaya per video
- [ ] Hitung biaya rupiah per video
- [x] Paket kredit dan pembayaran QRIS Xendit (harga masih placeholder)
- [ ] Tetapkan harga final di `src/lib/billing/packages.ts`
- [x] Uji login Google dengan kredensial sungguhan di localhost
- [x] Uji buat QRIS, simulasi bayar, dan kredit masuk dengan kunci uji Xendit
- [ ] Uji webhook Xendit dari alamat publik
- [ ] Terapkan migrasi ke D1 sungguhan
- [ ] Pindahkan generate dan render ke host yang mendukung Node dan Chromium
- [ ] Cek lisensi komersial Remotion dan Gemini TTS
- [ ] Pustaka aset untuk topik yang sering dipakai
- [ ] Set 30 prompt acuan untuk mengukur kualitas
- [ ] Perbarui README
