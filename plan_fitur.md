# Plan Fitur gmotion

Terakhir diperbarui 7 November 2026.

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

1. Tingkatkan kualitas 3D: bentuk organik seperti jantung, isi layar produk pada iklan, dan adegan dekat yang terlalu sesak.
2. Penilaian user atas video Story 2D, Ads, dan Isometrik.
3. Rapikan kualitas akhir video dan audio.
4. Keamanan dan penjualan sebelum dibuka ke publik.

## Pondasi

- [x] Upgrade Next.js ke 15.5.29 dan tutup kerentanan dependency produksi
- [x] Commit pekerjaan timelapse
- [x] Tes otomatis untuk alur utama (204 test)

## Draf dan alur

- [x] Prompt hanya membuat draf, belum TTS atau kode
- [x] Jumlah dan isi adegan mengikuti topik, 3–12 adegan
- [x] Layar review draf: judul, narasi, teks, arahan visual
- [x] Tambah, hapus, urutkan, dan pulihkan adegan
- [x] Simpan otomatis dengan percobaan ulang
- [x] Perkiraan durasi di layar draf
- [x] Validasi narasi kosong sebelum generate
- [ ] Minta AI memperbaiki draf lewat instruksi
- [ ] Kunci durasi sesuai target di prompt (uji 30 detik menghasilkan 42 detik)
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
- [ ] Progres export asli (saat ini masih timer)
- [ ] Revisi chat juga mengubah narasi dan audio
- [ ] Revisi untuk semua adegan sekaligus
- [ ] Cek crash setelah revisi chat
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
- [ ] Uji topik abstrak: inflasi dan sejarah
- [ ] Adegan CTA dengan kualitas setara ilustrasi
- [x] Story 2D campuran SVG dan gambar AI dengan rencana momen, maksimal 2 keadaan per adegan. Gambar gagal jatuh ke SVG. Batasan: baru 1 topik lewat tombol, rasio 4:5 dan 16:9 belum diuji, dan kualitas belum dinilai user
- [ ] Cek tagihan nyata model gambar `gemini/gemini-3.1-flash-lite-image`
- [ ] (uji coba) Pemeriksaan bagian video yang diam: terkalibrasi di `scripts/spike-mixed.ts`, belum masuk job generate
- [ ] Tambah gerak pada Isometrik, karena satu bidikan diam sekitar 5 detik

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

Status saat ini: tersedia sebagai pilihan **Isometrik**, untuk rasio 9:16. **Story 2D** dan **Ads** tetap memakai ilustrasi per adegan. Item bertanda `(uji coba)` hanya terbukti lewat skrip atau belum dinilai user. Rasio 4:5 dan 16:9 belum diuji.

- [ ] (uji coba) Satu dunia dengan kamera menyambung: berhasil
- [ ] (uji coba) Panel data yang berubah mengikuti cerita: berhasil
- [ ] (uji coba) Subtitle kapsul: berhasil
- [ ] (uji coba) Stiker kata: komponen ada, belum muncul di klip uji
- [ ] (uji coba) Satu adegan HP terbuka dengan `@remotion/three` dan kamera ortografis: berhasil, 8 detik, data ditulis tangan, belum dinilai user
- [ ] (uji coba) Mesin isometrik: balok, pelat, silinder, kerucut, baji, tabung, nampan, dan penutup berjalan di `IsoStage`, dan posisi dihitung `resolveIsoPlan`. Bentuk organik seperti jantung belum bisa
- [ ] (uji coba) Gaya datar dengan garis tepi di Three.js: berhasil, tiga nada dari normal tanpa lampu, belum dinilai user
- [x] Pengaturan WebGL untuk pratinjau, export, dan pengecekan crash. Bisa diatur lewat `RENDER_GL`. `swangle` lolos di skrip uji, tetapi belum dijalankan di server sungguhan
- [x] Komponen Three.js hanya lewat `@/motion-kit`, kode Gemini tetap tidak mengimpor `three`
- [x] AI menyusun dunia sebagai data objek. Batasan: jawaban pertama sering ditolak validator, jadi biasanya butuh 2 permintaan, dan bentuk organik belum bisa
- [x] Warna terang atau gelap sesuai topik di Mode Dunia, dicek lewat kolom `look`
- [ ] (uji coba) Uji kualitas pada 8 topik: HP, PDAM, lift, baterai, dan inflasi terbaca. Iklan kasir jalan dengan layar HP polos. Kapal selam mirip tongkang, dan jantung mirip diagram pipa. Belum dinilai user
- [ ] (uji coba) Tombol CTA di video 3D, hanya dari adegan CTA. Komponennya ada, tetapi tidak ada pilihan iklan 3D di aplikasi
- [ ] Bentuk organik yang benar-benar dikenali. Bentuk bola sudah dihapus karena Gemini tidak memakainya untuk jantung
- [ ] Isi layar produk pada video 3D
- [x] Masukkan Mode Dunia ke alur draf dan editor. Batasan: tidak ada pratinjau bertahap karena satu dunia selesai sekaligus
- [ ] Layar draf menampilkan bagian yang disorot (per kalimat sudah ada lewat adegan)
- [x] Panel data hanya menampilkan angka yang disebut di narasi atau prompt
- [ ] Revisi chat untuk Mode Dunia (saat ini ditandai belum tersedia di editor)
- [x] Gagal dan Coba ulang pada video 3D, audio yang sudah ada tidak dibuat ulang (lolos test, belum disaksikan di browser)
- [ ] Editor TSX untuk Mode Dunia (tab masih kosong karena dunia berupa data)

## Pilihan gaya dan brand

- [x] Tiga pilihan gaya: Story 2D, Ads, dan Isometrik
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
- [ ] Login dan kepemilikan project
- [ ] Batas generate per user
- [ ] Pratinjau dalam iframe sandbox
- [ ] Render di worker terisolasi tanpa akses jaringan
- [ ] Ganti koneksi router ke HTTPS

## Siap dijual

- [ ] Postgres dan object storage
- [ ] Catat biaya per video
- [ ] Hitung biaya rupiah per video
- [ ] Paket kredit
- [ ] Cek lisensi komersial Remotion dan Gemini TTS
- [ ] Pustaka aset untuk topik yang sering dipakai
- [ ] Set 30 prompt acuan untuk mengukur kualitas
- [ ] Perbarui README
