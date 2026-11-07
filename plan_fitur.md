# Plan Fitur gmotion

Centang item setelah fitur selesai dan terverifikasi. Tambahkan catatan singkat kalau ada batasan. Terakhir diperbarui 7 November 2026.

## Prioritas berikutnya

1. Mesin isometrik berbasis objek, lalu uji pada 3 topik.
2. Pilihan Tujuan dan Gaya, kalau mesin isometrik lolos.
3. Rapikan kualitas akhir video dan audio.
4. Keamanan dan penjualan sebelum dibuka ke publik.

## Pondasi

- [x] Upgrade Next.js ke 15.5.29 dan tutup kerentanan dependency produksi
- [x] Commit pekerjaan timelapse
- [x] Tes otomatis untuk alur utama (150 test)

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
- [x] Pratinjau bertambah saat adegan selesai (baru diuji lewat test, belum disaksikan di browser)
- [x] Coba ulang hanya adegan gagal, dan lanjutkan proses yang terhenti
- [x] Export dikunci selama proses
- [x] Status kembali normal saat export gagal
- [ ] Progres export asli (saat ini masih timer)
- [ ] Revisi chat juga mengubah narasi dan audio
- [ ] Revisi untuk semua adegan sekaligus
- [ ] Cek crash setelah revisi chat
- [ ] Job queue sungguhan untuk produksi

## Kualitas visual

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

## Mode Dunia dan Isometrik

- [x] Uji coba satu dunia dengan kamera menyambung
- [x] Panel data yang berubah mengikuti cerita
- [x] Stiker kata dan subtitle kapsul (stiker belum muncul di klip uji)
- [ ] Mesin isometrik: balok, silinder, pelat, dan shading otomatis
- [ ] AI menyusun dunia sebagai data objek
- [ ] Warna terang atau gelap sesuai topik di Mode Dunia
- [ ] Uji kualitas pada 3 topik berbeda
- [ ] Masukkan Mode Dunia ke alur draf dan editor
- [ ] Layar draf per kalimat dan bagian yang disorot

## Pilihan gaya dan brand

- [ ] Pisahkan pilihan menjadi Tujuan dan Gaya
- [ ] Gaya Otomatis
- [ ] Ganti gaya di layar draf
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
