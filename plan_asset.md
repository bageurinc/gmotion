# Plan Aset Reusable GMotion

Terakhir diperbarui 8 November 2026.

Dokumen ini mengatur pustaka aset, backlog pembuatannya, pengaturan warna dan tema,
serta integrasi ke proses pembuatan video. Gunakan bersama [plan_fitur.md](plan_fitur.md).
Panduan API aset yang sudah dibuat ada di [README aset](src/motion-kit/isometric/README.md).

## Tujuan

Semua video baru diarahkan menggunakan aset terdaftar yang dapat dipakai ulang.
User menulis topik; AI memilih objek, varian, aksi, lingkungan, dan susunan adegan
dari kemampuan yang tersedia. Renderer menggambar komponen dan menjalankan aksinya.

Aset dibuat saat pengembangan pustaka, bukan digambar ulang pada setiap permintaan
video. Warna, tema, posisi, ukuran, dan keadaan objek dapat diubah melalui properti.
Perbedaan mekanisme harus memakai varian komponen yang benar, bukan sekadar warna.

Ini adalah arah pengembangan. File ini belum mengubah perilaku aplikasi secara
otomatis. Pemilihan aset lewat prompt, registry, tema bersama, dan renderer berbasis
rencana masih perlu diimplementasikan.

## Aturan teknis

### Arti status

- `[x]` berarti aset atau fitur sudah tersedia lewat aplikasi, lulus pemeriksaan,
  diekspor ke video, dan hasil visualnya telah diperiksa.
- `[ ] (uji coba)` berarti komponen dan demo tersedia, tetapi belum terhubung ke
  alur aplikasi atau masih memiliki batasan yang dicatat.
- `[ ]` tanpa penanda berarti belum selesai. Jangan menganggap nama di backlog
  sebagai komponen yang sudah tersedia.
- Persetujuan rencana tidak sama dengan persetujuan kualitas akhir seluruh aset.

### Aturan pemakaian

1. Gunakan registry sebagai sumber kemampuan aset yang benar-benar tersedia.
2. AI boleh menyusun adegan dan aksi; bentuk objek tetap berasal dari komponen
   terdaftar. AI tidak membuat ulang kendaraan, organ, atau mesin dengan SVG bebas.
3. Semua objek bermakna, lingkungan, dan efek penjelasan harus berasal dari
   komponen terdaftar. Bentuk dasar hanya dipakai sesuai fungsi yang didukung,
   misalnya balok untuk diagram ukuran, bukan pengganti bentuk jantung.
4. Aset yang mendukung suatu objek belum tentu mendukung semua mekanismenya.
   Mobil tersedia tidak berarti rem ABS atau pembakaran piston sudah tersedia.
5. Preview, revisi, dan export memakai rencana serta versi aset yang sama.
6. Animasi dihitung dari frame. Tidak memakai timer, waktu sistem, atau gerakan acak.
7. Proporsi, detail mekanis, serta warna yang bermakna tidak boleh berubah hanya
   karena user memilih tema lain.
8. Jika user meminta data, gunakan fakta dan sumber yang sesuai. Jumlah modul pada
   ilustrasi bukan kapasitas baterai; putaran animasi bukan data performa kendaraan.
9. Jangan menambahkan panggilan model gambar atau model 3D ke alur pustaka tanpa
   keputusan produk dan pelaporan biaya. SVG dalam pustaka tidak memerlukan Tripo.
10. User tetap dapat mengubah warna dan tema setelah video dibuat. Perubahan tampilan
    tidak boleh memerlukan generate ulang narasi, audio, atau geometri.

### Cakupan semua gaya video

| Gaya | Arah penggunaan aset |
| --- | --- |
| Isometrik | Dunia disusun dari aset SVG isometrik dengan proyeksi yang sama |
| Story 2D Full SVG | Aset 2D terdaftar dan aksi yang didukung; tetap tanpa gambar raster |
| Story 2D Campuran | Aset terdaftar; foto atau ilustrasi yang memang dibutuhkan harus menjadi media yang disetujui, tersimpan, dan punya sumber penggunaan |
| Ads | Aset objek, mockup produk, UI, label, dan media brand yang disetujui |

Kebijakan memakai pustaka berlaku lintas gaya. Jangan memaksa semua video menjadi
isometrik. Aset 2D dan isometrik memiliki kemampuan serta sudut yang berbeda.
Komposisi mengikuti topik, bukan urutan adegan tetap untuk semua video.

### Kebijakan visual bertahap

Keputusan 8 November 2026: transisi dilakukan per gaya melalui dua kebijakan.

| Kebijakan | Arti | Kapan dipakai |
| --- | --- | --- |
| `library-first` | Objek yang ada di registry **wajib** memakai aset terdaftar; validator menolak gambar ulang objek tersebut. Objek yang belum ada boleh memakai jalur lama (ilustrasi/SVG model), tetapi ditandai di review draf dan dicatat sebagai kebutuhan aset | Default sementara untuk semua gaya selama katalog masih kecil |
| `library-only` | Tidak ada ilustrasi bebas atau generate image otomatis. Objek yang belum tersedia menghasilkan pesan cakupan, bukan pengganti tersembunyi | Default per gaya setelah tingkat fallback gaya tersebut rendah dan lulus uji aplikasi |

Alasan: janji produk adalah topik apa saja dari 1–2 kalimat, sedangkan katalog awal
hanya mobil dan jalan. `library-only` di awal akan menolak sebagian besar prompt.

- Fallback ditampilkan jujur di review draf, misalnya "3 objek dari pustaka, 1 ilustrasi AI".
- Setiap fallback dicatat (objek, gaya, topik) sebagai data prioritas katalog.
- Ambang perpindahan ke `library-only` ditetapkan per gaya dari data fallback nyata.
- Urutan perkiraan: Ads lebih dulu (isi terbatas: media brand, mockup, UI, teks,
  grafik), lalu Isometrik, lalu Story 2D yang long tail-nya paling besar.
- Kedua kebijakan masih rencana, bukan mode yang sudah tersedia di aplikasi.

## Kondisi sekarang

| Aset atau kemampuan | Bukti yang tersedia | Batasan |
| --- | --- | --- |
| `IsoCar`, varian `petrol` | SVG, PNG, demo MP4 10 detik | Susunan mesin depan dan penggerak belakang ilustratif; bukan model kendaraan tertentu |
| `IsoCar`, varian `electric` | SVG, PNG, demo perbandingan MP4 12 detik | Penggerak depan ilustratif; modul baterai bukan spesifikasi kendaraan tertentu |
| `IsoRoad` | SVG jalan, PNG, demo kedua mobil di jalan | Jalan lurus, 1–4 lajur searah; belum ada tikungan, persimpangan, atau arah berlawanan |
| Gerakan dan keadaan mobil | Roda, kaca, kap, transparansi, pulley, detail motor, aliran energi EV | Belum ada kemudi, piston, katup, atau kabel charger yang terpasang |
| Warna | Warna bodi, aspal, dan bahu jalan dapat diatur | Banyak warna internal masih tetap; belum ada kontrak tema bersama |
| Kualitas teknis aset | 13 pengujian terkait, TypeScript, dan lint terkait lulus saat pembuatan demo | Bukan klaim bahwa seluruh suite aplikasi sudah diperiksa ulang |
| Pemilihan otomatis | Komponen diekspor melalui motion kit | Registry, pencocokan prompt, dan renderer rencana belum tersambung |

Sumber komponen:

- [IsoCar.tsx](src/motion-kit/isometric/IsoCar.tsx): bodi bersama dan pengaturan varian.
- [CarMechanics.tsx](src/motion-kit/isometric/CarMechanics.tsx): komponen mekanis bensin.
- [ElectricCarMechanics.tsx](src/motion-kit/isometric/ElectricCarMechanics.tsx): platform listrik.
- [IsoRoad.tsx](src/motion-kit/isometric/IsoRoad.tsx): jalan dan marka.
- [index.ts](src/motion-kit/isometric/index.ts): ekspor aset.

Demo lokal:

- Mobil bensin: `storage/assets/iso-car/`.
- Mobil listrik dan jalan: `storage/assets/iso-electric-car/`.
- Folder `storage` diabaikan Git. Demo bukan penyimpanan produksi atau daftar aset
  yang boleh dipilih user. Komponen sumber dan metadata registry harus ikut repositori.

## Prioritas berikutnya

1. Tetapkan kontrak aset, warna, tema, dan versi sebelum memperbanyak objek.
2. Daftarkan mobil bensin, mobil listrik, dan jalan yang sudah ada.
3. Hubungkan satu prompt perbandingan mobil sampai preview, revisi, dan export.
4. Sediakan penggantian warna dan tema di studio tanpa generate ulang isi video.
5. Tambah aset dari kebutuhan topik nyata dan catatan objek yang belum tersedia.
6. Terapkan `library-first` ke seluruh jalur video baru setelah setiap gaya diuji,
   lalu `library-only` per gaya berdasarkan data fallback.
7. Bangun lapisan bersama (label, aliran, panel angka, caption, tema) sebelum
   memperbanyak objek, karena dipakai semua gaya dan topik.

## Backlog aset

### A. Pondasi dan efek lintas topik

- [ ] (uji coba) Registry aset dengan ID, versi, varian, properti, aksi, titik penghubung,
  dan batasan. Ada di `src/lib/assets/registry.ts`; belum dipakai pipeline.
- [ ] Kontrak tema serta penggantian warna semua material yang didukung.
- [ ] Panggung objek, susunan berdampingan, perbandingan, dan close-up yang dapat dipakai ulang.
- [ ] Proyeksi dan ukuran bersama; posisi dihitung dari koordinat dunia, bukan angka layar buatan AI.
- [ ] Label yang menempel pada bagian, garis penunjuk, sorotan, dan pemotongan tampilan.
- [ ] Jalur aliran mengikuti anchor, dengan arah, kecepatan ilustratif, dan waktu aktif.
- [ ] Panel angka, grafik, urutan, dan legenda tanpa data bawaan yang dikarang.
- [ ] (uji coba) Caption, label penunjuk, dan nama objek dapat dimatikan secara
  terpisah lewat `presentation.captions`, `presentation.labels`, dan
  `presentation.names` di rencana video atau override per adegan. Teks bukan
  bagian dari geometri aset. Narasi/audio dan aksi tidak dihapus saat teks
  disembunyikan; panggung memakai ruang lebih luas saat caption mati. Rencana
  lama tanpa pengaturan tetap menampilkan teks seperti sebelumnya. Belum ada
  kontrol untuk pengaturan ini di studio.
- [ ] Komponen teks dan caption yang konsisten dengan tema dan area aman.
- [ ] Galeri aset internal berisi preview, keadaan yang didukung, dan contoh video.
  Sebagian ada di `/admin/assets` (tab Terbit: preview SVG default per varian); belum ada
  preview per keadaan dan contoh video.

### A2. Alur draf aset dari permintaan user

Keputusan 8 November 2026: permintaan user yang belum didukung tidak langsung menjadi
aset global. Permintaan dicatat, admin memilih yang dibuat, dan draf baru dipakai video
setelah admin memperbaiki kualitasnya lalu menerbitkannya.

1. Rencana AI mendaftar hal yang tidak bisa ditampilkan (`unsupported`), lalu dicatat ke `asset_requests`.
2. `/admin/assets` tab Diminta merekap permintaan per gaya dan objek.
3. Admin memilih Jadikan draf, lalu baris baru dibuat di `asset_drafts` (status `draft`).
4. AI membuat isi draf: komponen SVG dan metadata registry, divalidasi lalu dirender ke preview. Belum ada.
5. Admin memperbaiki kualitas: revisi lewat instruksi, edit kode atau metadata, dan cek frame per rasio. Belum ada.
6. Admin menerbitkan draf: entri pustaka berversi dibaca pipeline dari database tanpa deploy. Belum ada.

Penyimpanan hibrida (keputusan 8 November 2026): aset inti tetap berupa file komponen di
repositori (riwayat git, TypeScript, test). Aset hasil kurasi admin disimpan sebagai kode
komponen dan metadata berversi di database, dengan preview di object storage. Kode dari
database wajib lolos validator sebelum disimpan dan dirender. Aset database yang matang
dan sering dipakai boleh dipromosikan menjadi file. Aset disimpan sebagai komponen yang
menghasilkan SVG, bukan file `.svg` statis, supaya warna, keadaan, dan gerak tetap bisa diatur.

- [ ] (uji coba) Langkah 1–3 tersedia: kolom `unsupported` di rencana, tabel dan migrasi
  `0004_asset_library.sql`, serta halaman `/admin/assets`. Belum diverifikasi di browser.
- [ ] (uji coba) Langkah 4–5: isi draf oleh AI, pratinjau, pemeriksaan, revisi, edit, dan
  riwayat versi di `/admin/assets/draft/[id]`. Uji nyata pada draf Lampu merah.
- [ ] (uji coba) Langkah 6: terbitkan draf ke katalog tanpa deploy (`published_assets`,
  `loadAssetCatalog`, render lewat `PlanVideo`). Belum dibuktikan sampai MP4, dan belum
  dipakai pembuatan video di aplikasi.
- Media yang diunggah user (logo, foto produk) tetap milik proyek user itu dan tidak
  masuk pustaka global.

### B. Transportasi dan energi kendaraan, prioritas pertama

- [ ] (uji coba) Mobil bensin: bodi, kabin, mesin, tangki, transmisi, knalpot,
  suspensi, dan rem. Sudah ada demo; belum dipilih otomatis di aplikasi.
- [ ] (uji coba) Mobil listrik: baterai, motor, inverter, pengisi daya, port,
  pendinginan, dan kabel tegangan tinggi. Sudah ada demo; belum ada alur pengisian terpasang.
- [ ] (uji coba) Mobil LMPV 7-Seater Keluarga: `vehicle.lmpv@0.1.0`.
  Aset mobil keluarga 7 penumpang 3 baris kursi yang sangat detail (terinspirasi dari LMPV populer seperti Suzuki Ertiga, generik dan aman komersial):
  1. Eksterior: Fasad aerodinamis, grille krom multi-slat, lampu depan proyektor LED dengan alis DRL kristal, 3 baris kaca samping (kaca depan + delta A-pillar, kaca baris 2, quarter glass baris 3), velg alloy two-tone diamond-cut 5-split-spoke, spion dengan sein LED, sirip hiu antena, spoiler belakang dengan stop lamp LED, dan pintu bagasi terangkat (`tailgateOpen`).
  2. Interior Kabin 7-Seater: 3 baris kursi (baris 1 bucket seat + dasbor floating touchscreen 8 inci + setir D-cut 3-spoke + tuas transmisi; baris 2 jok 3 penumpang split 60:40 dengan sandaran tangan tengah; AC double blower di plafon dengan 4 kisi louver udara; baris 3 jok 2 penumpang split 50:50 dengan bagasi lantai rata).
  3. Ruang Mesin FWD Melintang 1.5L (`hoodOpen`): Mesin 4-silinder DOHC 16V melintang (FWD), 4 koil busi ber-wiring harness, intake manifold dengan box filter udara samping, radiator crossflow twin-fan + selang coolant, aki 12V dengan terminal positif merah, tabung booster minyak rem, tabung washer kaca, dan sabuk puli alternator/AC berputar.
  4. Sasis & Kolong (`view: 'chassis'`): Monocoque FWD, transaxle depan + CV drive half-shafts dengan karet boot, suspensi depan MacPherson strut, tangki bensin aman di bawah baris 2, knalpot lengkap (downpipe, catalytic converter, resonator, muffler belakang, ujung knalpot krom), dan suspensi belakang torsion beam dengan per keong dan shockbreaker terpisah.
  Demo MP4 dan 15 stills tersimpan di `storage/assets/lmpv/`.
- [ ] (uji coba) Jalan lurus: jumlah lajur, warna permukaan, bahu, dan marka bergerak.
- [ ] Kemasan aset mesin dan motor sebagai close-up publik dengan API yang terdokumentasi.
- [ ] Pengaturan warna kabin, kaca, trim, roda, logam, kabel, dan aksen proses.
- [ ] SPBU: dispenser, nozzle, selang, dan sambungan ke tangki kendaraan.
- [ ] Pengisi daya EV: unit, konektor, kabel, port, serta keadaan terhubung dan mengisi.
- [ ] Mekanisme mesin: silinder, piston, poros engkol, katup, dan siklus yang bisa dijelaskan.
- [ ] Mekanisme motor: rotor, stator, poros, dan reduksi gigi.
- [ ] (uji coba) AC kendaraan: sirkuit refrigeran, kondensor, katup ekspansi,
  evaporator, kipas, dan blower di `vehicle.ac@0.1.0`. Kompresor tersedia
  terpisah di `vehicle.ac-compressor@0.1.0`, dengan tampilan casing dan
  potongan poros, swash plate, serta piston.
- [ ] Ban dan aerodinamika: jalur udara, kondisi jendela, tekanan ilustratif, dan sorotan hambatan.
- [ ] Pengereman regeneratif: arah energi kembali ke baterai dan kondisi aktif yang benar.
- [ ] Rem mekanis: pedal, hidraulik, kaliper, cakram, dan keadaan menjepit.
- [ ] Lingkungan jalan: tikungan, persimpangan, lampu lalu lintas, trotoar, dan rambu generik.
- [ ] Motor roda dua, bus, dan truk setelah kebutuhan kontennya terbukti.

### C. Listrik dan perangkat sehari-hari

| Aset | Bagian dan aksi minimum |
| --- | --- |
| Baterai umum | Terminal, sel, indikator isi ilustratif, jalur energi |
| Rangkaian listrik | Kabel, sakelar, lampu, resistor, sumber, rangkaian terbuka/tertutup |
| Charger dan adaptor | Casing terbuka, komponen utama, kabel, sambungan |
| HP | Bodi, layar, baterai, papan, chip, port, tampilan potongan |
| Kipas | Motor, baling-baling, pelindung, aliran udara |
| Panel surya | Modul, sambungan, inverter, aliran menuju beban |
| Meter dan distribusi | Meter, panel, pemutus, sambungan yang dapat disorot |

- [ ] Bangun paket listrik dan perangkat dari tabel di atas berdasarkan kebutuhan video.

### D. Air, rumah, dan mesin umum

| Aset | Bagian dan aksi minimum |
| --- | --- |
| Sistem air | Tangki, pipa, pompa, katup, filter, perubahan isi, aliran |
| Kulkas | Kabin, pintu, kompresor, kondensor, evaporator, sirkuit |
| AC ruangan | (uji coba) `building.home-ac@0.1.0` menampilkan unit indoor dan outdoor, pipa, kipas, serta aliran udara sejuk dan hangat. |
| Kompresor AC ruangan | (uji coba) `building.home-ac-compressor@0.1.0` menampilkan casing hermetik dan potongan motor, roller eksentrik, serta vane. |
| Lift | Kabin, rel, kabel, pulley, motor, rem, gerak naik/turun |
| Conveyor | Sabuk, roller, motor, objek yang diangkut |
| Rumah atau ruangan | Dinding, lantai, pintu, jendela, potongan untuk melihat bagian dalam |

- [ ] (uji coba) Paket **Rumah dan Sanitasi Air**: `building.house@0.1.0` dan `building.sink@0.1.0`.
  `building.house` menyediakan dua varian bangunan lengkap:
  1. `residential`: Rumah keluarga standar (atap pelana segitiga, cerobong, pintu berengsel `doorOpen`, jendela 4-panel, taman rumput hijau depan bersemak bunga dan batu pijakan, carport dengan mobil terparkir, serta potongan interior dapur lengkap, kamar mandi ubin, dan ruang tamu).
  2. `luxury`: Rumah mewah / villa modern 2 lantai kontemporer dengan garasi beratap kanopi dan mobil mewah terparkir, taman lanskap asri dengan semak hias dan batu pijakan, teras deck kayu, kolam renang depan (*plunge pool*), balkon kaca lantai 2 (*glass balustrade*), jendela besar *floor-to-ceiling*, pintu pivot modern, serta interior 2 lantai: dapur gourmet dengan *kitchen island waterfall marble* + wastafel ganda + keran emas, kamar mandi spa marmer dengan bathtub berdiri + double vanity, dan master suite atas.
  `waterRunning` mengalirkan air dari keran dapur dan kamar mandi secara bersamaan.
  `building.sink` (`IsoSink`) menyediakan tampilan close-up wastafel dan keran air untuk varian dapur (`kitchen`) dan kamar mandi (`bathroom`).
  Terdaftar di registry dan dapat dirender oleh `PlanVideo`.
  Demo: `npx tsx scripts/assets/preview-house.tsx`, menghasilkan video MP4 15 detik dan 15 frame pada rasio 9:16, 4:5, dan 16:9 di `storage/assets/house/`. Status tetap uji coba; belum terhubung ke alur pembuatan video di aplikasi.
- [ ] Bangun kelanjutan paket air dan mesin umum (sistem air, kulkas, AC, lift, conveyor) dari tabel setelah integrasi aset kendaraan stabil.

### E. Biologi, lingkungan, dan layanan

| Paket | Aset yang direncanakan | Persyaratan khusus |
| --- | --- | --- |
| Tubuh | Tubuh potongan, jantung, paru-paru, pembuluh, alveolus | Bentuk organ khusus, arah aliran benar, pemeriksaan referensi anatomi |
| Lingkungan | Sungai, pengolahan air, saluran, sampah, pemilahan | Proses dan hubungan antarbagian terlihat |
| Usaha | Toko, rak, meja kasir, produk generik, POS | Label dan harga berasal dari konten, tanpa merek karangan |
| Ekonomi | Uang, barang, gudang, pengiriman, grafik | Metafora diberi konteks; tidak mengganti data dengan angka dekoratif |
| Manusia | Karakter, pose kerja, tangan memegang objek | Pose dan titik genggam konsisten |

- [ ] (uji coba) Paket awal **Lingkungan: pemilahan sampah**, dipilih untuk permintaan
  bagian E pada 8 November 2026. `environment.waste-sorting@0.1.0` menyediakan
  tiga wadah dengan ikon daun, kertas, dan botol, objek generik, warna wadah per
  instance, anchor label, serta aksi `progress` menuju wadah sesuai jenis objek.
  Terdaftar di katalog dan dirender oleh `PlanVideo`; belum terhubung ke alur aplikasi.
  Demo: `npx tsx scripts/assets/preview-waste-sorting.tsx`, menghasilkan MP4 6 detik
  dan frame 9:16, 4:5, 16:9 di `storage/assets/waste-sorting/` (diabaikan Git).
  Bentuk dan warna ilustratif, bukan standar pengumpulan setempat. Tidak mencakup
  sampah berbahaya, mesin sortir, sungai, pengolahan air, atau proses daur ulang.
- [ ] (uji coba) Lanjutan Lingkungan: `environment.water-channel@0.1.0`
  (varian sungai dan saluran lurus) serta `environment.water-treatment@0.1.0`
  (potongan pengolahan air permukaan). Tersedia arah aliran, material per instance,
  pengadukan ilustratif, partikel mengendap, lapisan filter, simbol pemberian
  disinfektan, dan anchor antarbagian. Koagulasi/flokulasi digabung dalam satu bak.
  Urutan mengacu pada [CDC](https://www.cdc.gov/drinking-water/about/how-water-treatment-works.html).
  Tidak mencakup pengolahan air limbah, dosis, hidraulika, atau jaminan air layak minum.
  Sungai/saluran dan instalasi adalah aset terpisah, belum tersambung fisik otomatis.
  Skrip `scripts/assets/preview-water-environment.tsx` menghasilkan demo 18 detik
  dan frame tiga rasio di `storage/assets/water-environment/`. Masih isometrik;
  alur studio, prompt sampai export, dan aset 2D belum diverifikasi.
- [ ] (uji coba) Paket **Usaha**: `business.shop`, `business.shelf`,
  `business.checkout`, `business.product`, dan `business.pos`, versi `0.1.0`.
  Lima komponen terpisah tersedia di katalog, renderer video, dan renderer preview
  admin. Toko memiliki exterior/cutaway dan pintu berengsel; rak tiga tingkat;
  kasir dengan pemindai, laci, dan gerak produk; kemasan kotak/botol/kaleng;
  POS layar mati/menyala tanpa angka. Material dan aksi sesuai metadata registry.
  Tidak ada merek, harga, label teks, mata uang, atau transaksi bawaan. Label dan
  harga hanya boleh datang dari konten adegan. Tidak mencakup karakter, genggaman,
  pickup, restock, barcode nyata, atau pemrosesan pembayaran.
  Demo tanpa teks: `npx tsx scripts/assets/preview-business.tsx`, hasil lokal di
  `storage/assets/business/`. Status tetap uji coba; seluruh alur studio belum diuji.
- [ ] Paket Tubuh, Ekonomi, dan Manusia menunggu kebutuhan berikutnya;
  belum ada komponen atau klaim ketepatan anatomi dari pekerjaan ini.
- [ ] Pisahkan aset 2D dan isometrik; jangan mengklaim satu sudut mendukung semua gaya.

## Kontrak aset reusable

### Identitas dan metadata

Setiap entri registry wajib mencatat:

| Bidang | Isi |
| --- | --- |
| `assetId`, `version` | ID stabil dan versi spesifik, misalnya `vehicle.car` dan `0.1.0` |
| `status` | `experimental`, `ready`, atau `deprecated` |
| `renderer` | Komponen lokal yang dipilih oleh kode dari daftar yang diizinkan |
| `projection` | `isometric-30` atau proyeksi 2D yang sesuai |
| `variants` | Pilihan yang benar-benar dibuat, seperti `petrol` dan `electric` |
| `propsSchema` | Properti yang diizinkan, tipe, default, dan batas nilainya |
| `capabilities` | Objek, mekanisme, keadaan, dan aksi yang sudah didukung |
| `anchors` | Titik label, sambungan pipa/kabel, gerak, dan fokus kamera per varian |
| `bounds`, `scale` | Ukuran, titik tanah, ruang gerak, dan aturan susun depan/belakang |
| `materials` | Warna yang dapat diedit dan warna semantik yang dilindungi |
| `limitations` | Mekanisme yang belum ada dan tingkat ketepatan ilustrasi |
| `provenance` | Pembuat atau sumber, lisensi, izin komersial, dan atribusi jika diperlukan |
| `examples` | Keadaan referensi, gambar preview, dan skenario render untuk verifikasi |

`vehicle.car` dan ID lain dalam dokumen ini adalah rancangan penamaan registry,
bukan ID yang sudah diterima API aplikasi. Jangan menandai aset `ready` hanya
karena namanya masuk registry; perlu melewati definisi selesai.

### Bagian, keadaan, dan aksi

- Setiap bagian bermakna memiliki ID stabil. Nama bagian tidak berubah antaradegan.
- Varian hanya membuka kemampuan yang dimilikinya. `electric` tidak menerima aksi
  menyalakan mesin pembakaran; `petrol` tidak menerima aksi mengisi traction battery.
- Aksi memiliki properti sasaran, nilai awal/akhir, rentang waktu, dan interpolasi
  yang diizinkan. Tidak ada ekspresi JavaScript dari model di dalam rencana.
- Anchor dipilih per varian. Anchor mesin bensin tidak dipakai untuk motor listrik.
- Susunan objek memakai koordinat dunia dan aturan kedalaman. Susun objek jauh
  terlebih dulu agar tidak menutupi objek dekat secara keliru.
- Tingkat detail minimal: bentuk luar, bagian yang dijelaskan, serta tampilan
  terbuka atau close-up bila narasi membahas komponen tersembunyi.
- Komponen kecil boleh memiliki versi close-up terpisah; seluruh bentuk detail
  tidak harus selalu dirender pada bidikan lebar.

## Warna dan tema yang dapat diedit

### Pembagian pengaturan

| Tingkat | Yang diubah | Contoh |
| --- | --- | --- |
| Tema video | Latar, teks, panel, aksen, terang/gelap, gaya garis | Tema terang teknis atau tema brand |
| Material aset | Warna bodi, kaca, kabin, logam, permukaan jalan | Mobil merah, kabin abu-abu, aspal gelap |
| Keadaan proses | Sorotan, status aktif, arah aliran | Bagian aktif disorot dan diberi label |

Prioritas nilai: override user pada objek → token tema video → default material aset.
Renderer menurunkan warna bidang terang/gelap dari material dasar agar objek tetap
terlihat memiliki volume. Tema gelap juga harus memperhitungkan pencahayaan objek,
bukan hanya mengganti warna latar.

Token yang direncanakan:

```text
scene.background, scene.ground
surface.panel, text.primary, text.secondary
accent.primary, accent.secondary, outline.color
material.body, material.glass, material.trim, material.interior
material.metal, material.tire, material.road, material.shoulder
flow.energy, flow.air, flow.water, status.active, status.warning
```

### Batas edit

- [ ] Sediakan tema terang, gelap, dan brand sebagai pilihan, bukan tema yang dipilih
  otomatis untuk semua topik. Kondisi tempat dan permintaan user tetap menentukan.
- [ ] Sediakan override warna per instance sehingga dua mobil bisa memiliki warna berbeda.
- [ ] Simpan tema dan override di proyek; reload, retry, dan export mempertahankannya.
- [ ] Validasi format warna dan nilai opacity. Tolak URL, CSS bebas, serta nilai tidak valid.
- [ ] Jaga kontras teks 4,5:1 dan teks besar 3:1 setelah user mengganti tema.
- [ ] Warna yang membantu identifikasi, seperti kabel tegangan tinggi, memiliki
  kebijakan semantik. Perubahan harus mempertahankan label/legenda yang jelas.
- [ ] Tema tidak mengubah kapasitas, jenis penggerak, bentuk organ, jumlah roda,
  arah aliran, atau klaim mekanis.
- [ ] Render ulang tampilan dari data tersimpan tanpa mengulang TTS atau perencanaan isi.

Tema bersama belum tersedia. Saat ini `color` hanya mengubah bodi mobil dan
turunan shading; `asphalt` serta `shoulderColor` mengubah dua material jalan.
Jangan menjanjikan bahwa seluruh warna internal sudah dapat diedit.

## Panduan teknis agar video memakai aset yang tersedia

### 1. Tentukan kebijakan sebelum membuat draf

- [ ] Simpan kebijakan visual pada proyek baru, terpisah dari pilihan gaya.
- [ ] Tetapkan `library-first` sebagai default setelah alur pustaka lulus uji aplikasi.
- [ ] Pindahkan tiap gaya ke `library-only` setelah tingkat fallback-nya rendah.
- [ ] Catat setiap fallback `library-first` (objek, gaya, topik) untuk prioritas katalog.
- [ ] Buat snapshot versi registry untuk proyek. Jangan berganti kemampuan aset di
  tengah proses karena registry global baru saja diperbarui.
- [ ] Pertahankan mesin proyek lama agar file video lama tetap bisa dibuka dan diekspor.

### 2. Cari aset dan periksa kemampuan

- [ ] Cocokkan kata seperti mobil, kendaraan listrik, EV, atau mobil bensin ke entri
  katalog melalui nama, alias, varian, dan kemampuan.
- [ ] Ambil hanya subset metadata yang relevan ke prompt model, agar katalog besar
  tidak dikirim seluruhnya pada setiap adegan.
- [ ] Periksa kesesuaian objek, proses, gaya, dan sudut pandang. Kemiripan nama saja
  tidak cukup. Mobil FWD ilustratif tidak otomatis cocok untuk penjelasan RWD tertentu.
- [ ] Periksa cakupan sebelum panggilan model gambar dan pekerjaan render mahal;
  ulangi pemeriksaan setelah narasi disetujui karena user bisa mengubah pembahasan.

### 3. AI menghasilkan rencana data

AI menerima katalog terpilih beserta keterbatasannya. Keluaran utamanya adalah data
terstruktur yang menyebut instance, varian, properti, aksi, fokus, dan waktu.
Kode renderer menentukan komponen React yang dipakai.

Contoh bentuk data berikut adalah rancangan, belum merupakan schema aplikasi:

```json
{
  "schemaVersion": 1,
  "visualPolicy": "library-only",
  "theme": { "id": "technical-light", "version": "1.0.0" },
  "instances": [
    {
      "id": "car-ev",
      "assetId": "vehicle.car",
      "assetVersion": "0.1.0",
      "variant": "electric",
      "props": { "color": "#367E83", "view": "chassis" }
    },
    {
      "id": "car-petrol",
      "assetId": "vehicle.car",
      "assetVersion": "0.1.0",
      "variant": "petrol",
      "props": { "color": "#CF5A3C", "view": "chassis" }
    }
  ],
  "scenes": [
    {
      "id": "compare-source",
      "layout": "side-by-side",
      "instances": ["car-ev", "car-petrol"],
      "focus": [
        { "instanceId": "car-ev", "anchor": "tractionBattery" },
        { "instanceId": "car-petrol", "anchor": "fuelTank" }
      ]
    }
  ]
}
```

Versi dan ID contoh perlu dibuat nyata dalam registry sebelum dipakai. Model tidak
boleh mengarang ID, import, nama komponen, prop, anchor, formula, atau kode jaringan.
Label dan data mengikuti narasi yang disetujui; contoh ini tidak menetapkan urutan
adegan tetap untuk semua video perbandingan.

### 4. Validasi sebelum render

- [ ] Buat schema Zod dengan daftar ID dan properti yang diizinkan, termasuk penolakan
  properti tak dikenal. Jangan meneruskan seluruh SVG props langsung dari model.
- [ ] Tolak versi hilang, instance ganda, anchor salah, dan aksi yang tidak tersedia.
- [ ] Batasi ukuran, jumlah instance, kepadatan objek, frame, dan rentang nilai properti.
- [ ] Cocokkan aksi ke timing suara. Rentang aksi tidak boleh melewati durasi adegan.
- [ ] Periksa sambungan: kabel, pipa, aliran, dan label mengacu pada anchor yang valid.
- [ ] Periksa cakupan narasi. Setiap aksi penting yang diucapkan harus terlihat atau
  ditandai sebagai penjelasan yang belum didukung; zoom saja tidak cukup.
- [ ] Gunakan komponen lokal melalui pemetaan registry. Validasi kode lama tetap
  dipertahankan bila masih ada kode komposisi yang dibuat atau diedit model.

Instruksi prompt saja tidak cukup untuk menerapkan kebijakan pustaka. Validator dan
jalur renderer harus menegakkannya, termasuk saat repair, retry, revisi chat, dan edit manual.

### 5. Render dan jaga kesinambungan

- [ ] Buat renderer rencana yang menghitung properti dari frame dan timing audio.
- [ ] Pertahankan ID, varian, material, dan keadaan terakhir instance antaradegan.
- [ ] Kamera bergerak ke anchor atau bounds yang terdaftar; gambar tidak dipotong
  hingga komponen yang sedang dijelaskan hilang.
- [ ] Jalan dipakai saat konteks melaju diperlukan. Close-up baterai, mesin, atau
  perbandingan sumber energi boleh memakai panggung tanpa jalan.
- [ ] Judul, label, legenda, grafik, dan subtitle berada di area aman untuk semua rasio.
- [ ] Preview dan MP4 membaca rencana tersimpan yang sama.
- [ ] Simpan versi renderer, schema, tema, dan aset agar proyek dapat dirender ulang.
  Versi lama harus tetap tersedia atau dimigrasi secara eksplisit, bukan diam-diam.

### 6. Revisi user

- [ ] Permintaan warna mengubah override material saja; tidak memanggil ulang model gambar.
- [ ] Permintaan tema mengubah token yang didukung tanpa mengubah isi dan durasi narasi.
- [ ] Permintaan mekanisme memicu pemeriksaan kemampuan dan rencana aksi baru.
- [ ] Penggantian bensin menjadi listrik menukar varian serta anchor dan aksinya;
  tidak sekadar mengganti label atau warna.
- [ ] Revisi narasi yang memperkenalkan objek baru diperiksa ulang sebelum generate.
- [ ] Hasil revisi melewati validator yang sama, lalu disimpan sebagai revisi yang bisa dipulihkan.

### 7. Jika aset belum tersedia

Jangan mengganti jantung dengan blob atau membuat model kendaraan baru secara bebas.
Jangan mengganti proses yang diminta dengan grafik umum tanpa menjelaskan perubahan cakupan.

- [ ] Kembalikan daftar objek atau aksi yang belum didukung sebelum menandai draf siap.
- [ ] Tawarkan versi yang masih benar memakai aset tersedia, atau gaya/media lain
  yang didukung; perubahan isi perlu diketahui dan disetujui user.
- [ ] Jika user tetap membutuhkan mekanisme tersebut, catat sebagai kebutuhan aset.
  Pembuatan aset baru menjadi pekerjaan pengembangan pustaka, bukan biaya tersembunyi per video.
- [ ] Tunda adegan yang belum didukung dengan status yang jelas. Adegan valid tetap
  disimpan, tetapi video belum boleh dilaporkan selesai jika bagian wajib belum tersedia.
- [ ] Catat kebutuhan yang berulang untuk menentukan prioritas katalog.

## Peta integrasi kode

Jalur pada tabel adalah lokasi saat ini atau lokasi usulan yang ditandai. Baca
sumber terkini sebelum implementasi; beberapa jalur masih menjalankan model gambar
atau SVG buatan model, meskipun komponen reusable sudah diekspor.

| Lokasi | Pekerjaan yang direncanakan |
| --- | --- |
| `src/motion-kit/isometric/` | Aset isometrik, material bersama, anchor, dan aksi |
| `src/motion-kit/index.ts` | Ekspor publik agar komposisi memakai `@/motion-kit` |
| `src/motion-kit/docs.ts` | Dokumentasi kemampuan komponen; singkirkan arahan SVG bebas untuk mode pustaka |
| `src/lib/assets/` (usulan) | Registry, pencarian katalog, schema rencana, tema, dan validasi kemampuan |
| `src/motion-kit/assets/` (usulan) | Renderer rencana lintas aset dan layout yang didukung |
| `src/types/studio.ts` | Kebijakan visual, rencana tersimpan, pilihan tema, dan versi yang dipakai |
| `src/lib/pipeline/director-agent.ts` | Draf sesuai katalog dan kemampuan yang tersedia |
| `src/lib/pipeline/generation-job.ts` | Routing mode pustaka, pemeriksaan cakupan, dan penanganan kegagalan |
| `src/lib/pipeline/world-video.ts` | Jalur dunia berbasis rencana aset; saat ini masih membuat dunia gambar AI |
| `src/lib/explainer/scene-generator.ts` | Hindari menggambar ulang objek terdaftar dalam mode pustaka |
| `src/lib/pipeline/code-validator.ts` | Penegakan kebijakan pada kode komposisi, bukan sekadar instruksi prompt |
| `src/lib/pipeline/scene-revision.ts` | Revisi terstruktur, validasi ulang, dan pelestarian aset serta tema |
| `src/components/studio/` | Pemilih tema, warna per objek, dan pesan kemampuan yang belum tersedia |
| `scripts/assets/` | Regenerasi preview dan video contoh aset |
| `tests/` | Uji kontrak, varian, tema, routing, revisi, dan konsistensi export |

Kontrak reusable melengkapi kontrak ilustrasi yang sudah ada. Jangan mengganti
`asset-contract.ts` atau memigrasi proyek lama secara massal tanpa desain migrasi.

## Tahap implementasi

### Tahap 1: kontrak dan katalog awal

- [ ] (uji coba) Tetapkan metadata registry, schema properti, serta ID dan versi nyata.
  `vehicle.car@0.1.0` dan `environment.road@0.1.0` terdaftar di `src/lib/assets/`.
  `validateAssetPlan` menolak aset, versi, varian, prop, anchor, dan aksi yang tidak
  terdaftar, serta durasi aksi yang melewati adegan. `findAssets` mencocokkan alias kata
  utuh per gaya, dan `describeForPrompt` mengirim subset katalog beserta batasannya.
  Uji: `tests/asset-registry.test.ts` (14 uji). Belum ada renderer rencana.
- [ ] (uji coba) Daftarkan mobil bensin, mobil listrik, dan jalan; lengkapi batasan per varian.
- [ ] Pisahkan warna internal tetap menjadi material yang bisa mengikuti tema.
- [ ] Buat renderer untuk objek tunggal, dua objek, jalan, dan close-up.

### Tahap 2: satu alur prompt sampai export

- [ ] (uji coba) Prompt pembuktian: perbandingan mobil listrik dan bensin, tanpa angka yang
  dikarang. Lewat skrip `scripts/spike-asset-plan.ts` dan renderer `PlanVideo`, belum lewat
  aplikasi. Dua run berhasil sampai MP4; hasil dan jebakan dicatat di KNOWLEDGE.md.
  Run ketiga (`ev3`) menambah gerak bawaan renderer: kamera, mobil masuk, dan transisi bodi.
- [ ] Periksa cakupan sebelum generate dan tampilkan batasan di review draf.
- [ ] Buat rencana dari katalog, validasi, lalu render melalui komponen yang sama.
- [ ] Buktikan tidak ada panggilan generate image atau SVG objek bebas dalam mode pustaka.
- [ ] Buktikan pemakaian mobil sesuai varian, tema, dan identitas antaradegan.

### Tahap 3: edit warna dan tema di aplikasi

- [ ] Edit warna salah satu mobil tanpa memengaruhi mobil lain.
- [ ] Ganti tema video dan periksa kontras serta seluruh area aman.
- [ ] Simpan, reload, revisi, retry, preview, dan export tanpa kehilangan pengaturan.
- [ ] Pastikan edit tampilan tidak membuat ulang audio atau aset.

### Tahap 4: perluas cakupan dan semua gaya

- [ ] Tambahkan aset berdasarkan permintaan yang gagal karena cakupan pustaka.
- [ ] Terapkan kontrak yang sama pada aset 2D, Ads, serta media brand yang disetujui.
- [ ] Uji tiap preset sebelum mengubah default video baru.
- [ ] Pertahankan kompatibilitas proyek lama dan hindari perubahan bentuk aset diam-diam.

## Definisi selesai

Satu item boleh dicentang setelah memenuhi kebutuhan yang relevan berikut:

1. Komponen memiliki kontrak, dokumentasi, sumber penggunaan, anchor, batasan, dan versi.
2. Warna dan tema yang dijanjikan benar-benar bisa diedit; geometri dan mekanisme tetap benar.
3. Semua keadaan utama dirender dan frame diperiksa pada rasio 9:16, 4:5, serta 16:9.
4. Animasi deterministik saat seek, render ulang, dan export. Banyak instance tidak
   saling mengganggu ID SVG, clip, mask, tema, atau keadaan.
5. Pengujian perilaku lulus, berikut TypeScript dan lint yang diwajibkan proyek.
   Sebelum merilis alur aplikasi, jalankan pemeriksaan lengkap sesuai `plan_fitur.md`.
6. Alur nyata dari prompt, draf, preview, revisi warna/tema, simpan/reload, sampai MP4 berhasil.
7. Aset hilang, aksi tidak didukung, atau tema tidak valid menghasilkan pesan yang jujur.
8. Bukti waktu generate, durasi video, panggilan model, dan batasan dicatat dari hasil nyata.
9. Dokumen ini dan pengetahuan proyek diperbarui. Kualitas akhir tetap dinilai user saat menonton.

## Skenario penerimaan pertama

| Permintaan | Hasil yang harus terlihat |
| --- | --- |
| Bandingkan mobil listrik dan bensin | Dua varian benar, baterai versus tangki, motor versus mesin, tanpa komponen tertukar |
| Tampilkan kedua mobil melaju | Jalan dari pustaka, lajur sesuai, marka dan roda bergerak searah |
| Perlihatkan bagian bawah | Bodi dan lantai tidak menutupi komponen yang dijelaskan |
| Ganti mobil listrik menjadi merah | Hanya warna instance listrik berubah; mekanisme dan audio tetap |
| Ubah tema menjadi gelap | Material, panel, teks, dan label tetap terbaca, hasil tersimpan |
| Jelaskan piston bergerak | Ditandai belum didukung sampai komponen mekanisme piston dibuat |
| Pakai objek yang belum ada | Draf menyebut kekurangan, tidak menggambar pengganti tersembunyi |
| Export lalu buka ulang proyek | Versi aset, warna, tema, dan hasil komposisi tetap konsisten |
