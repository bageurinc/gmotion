# Isometric SVG assets

`IsoCar` is the first asset: an illustrative generic MPV/SUV, not a particular
manufacturer or a mechanically accurate vehicle. All visible art is SVG.

```tsx
import { IsoCar } from '@/motion-kit/isometric';

<IsoCar color="#CF5A3C" windowOpen={0.6} wheelRotation={120} />
```

The transparent canvas has a `760 × 480` viewBox. Ground axes project at ±30°;
the view is fixed, and rotation to another camera angle is not supported.
Use an outer SVG/group or element to position and scale the complete asset.

| Prop | Default | Meaning |
| --- | --- | --- |
| `powertrain` | `petrol` | `electric` replaces the combustion engine and petrol underbody components |
| `color` | `#CF5A3C` | Body color, `#RGB` or `#RRGGBB`; shades are derived |
| `windowOpen` | `0` | Both visible side windows: closed `0`, lowered `1` |
| `wheelRotation` | `0` | Degrees, supplied by the scene timeline |
| `bodyOpacity` | `1` | Painted shell opacity; lowering it reveals the cabin and engine |
| `view` | `exterior` | `cutaway` fades the shell and floor; `chassis` hides shell, glass, floor, and seats |
| `hoodOpen` | `0` | Hood raised from closed `0` to 70 degrees `1` |
| `engineRotation` | `0` | Accessory pulley angle in degrees; independent of wheel speed |
| `motorRotation` | `0` | Electric motor shaft detail angle, in degrees |
| `batteryCoverOpacity` | `0.15` | EV traction-battery lid opacity; `0` fully exposes the module illustration |
| `chargePortOpen` | `false` | Open the EV socket flap |
| `energyFlow` | `false` | Show an illustrative battery → inverter → motor → wheel route |
| `energyPhase` | `0` | Loop phase for the moving energy dots; accepts any finite number |
| `wheelOpacity` | `1` exterior, `0.25` chassis | Fade tires and rims to expose brakes and suspension |
| `headlights` | `false` | Bright headlight lens color, without a light beam |
| `shadow` | `true` | Optional ground shadow |
| `title` | `Mobil isometrik` | Accessible image title |

Use Remotion's current frame to compute wheel rotation and window opening. The
asset owns no clock, CSS animation, or random state, so seeking is deterministic.
Opening windows lowers glass within clips; window frames stay in place. Roof and
windshield remain opaque unless shell opacity is lowered. Cabin transparency is
an illustration aid; use `view="chassis"` to remove the floor and inspect the
mechanical layers below it. The engine is a separate component under the hood.

`ISO_CAR_ANCHORS` exposes attachment points in local `[x, y, z]` coordinates.
`projectCarPoint` converts them to the SVG viewBox for labels and flow endpoints.
`data-part` groups identify the shell, cabin, windows, wheels, mirror, and chassis.

Run `npx tsx scripts/assets/preview-iso-car.tsx` to regenerate SVG/PNG examples and
a 10-second MP4 under `storage/assets/iso-car/`. `--stills-only` skips the MP4.
The output includes `pratinjau-mekanik.png` and a labelled `mesin-detail.svg`.
No AI credentials or external image assets are used.

This asset is exported from the motion kit but is not yet selected automatically
by the video generation pipeline. There is no individual window control, road,
steering animation, or internal piston/valve animation.

## Mechanical layers

The schematic uses one explicit layout: a longitudinal front engine with a
transmission, driveshaft, and rear differential. It does not represent every
MPV/SUV drivetrain or any manufacturer's technical drawing.

- Engine bay: finned block, oil pan, cylinder head, valve cover, intake runners,
  airbox, battery with terminals, radiator and hoses, coolant reservoir,
  compressor and accessory pulleys/belt.
- Underbody: ladder rails and crossmembers, tank with straps, transmission,
  driveshaft and rear axle/differential, catalytic-converter/muffler shapes,
  exhaust routing, control arms, springs/dampers, discs and calipers.
- `ISO_CAR_ANCHORS` also includes engine, radiator, compressor, battery,
  transmission, driveshaft, differential, tank, and exhaust endpoints.

The floor no longer extends into the engine bay. `view="chassis"` removes it
entirely so underbody parts can be inspected without the seats obscuring them.
`hoodOpen` rotates the same hood geometry around its rear hinge, rather than
swapping the whole vehicle illustration. The pulleys turn with `engineRotation`;
the belt follows a fixed route and does not yet animate its surface travel.

## Electric variant

```tsx
<IsoCar powertrain="electric" color="#367E83" view="chassis"
  batteryCoverOpacity={0} energyFlow energyPhase={frame / 60}
  motorRotation={frame * -12} />
```

The electric variant uses a schematic front motor and reduction gear, an
underfloor pack with ten illustrated modules, inverter, onboard charger,
auxiliary battery, cooling radiator and pipes, orange high-voltage cables, and
a rear-quarter charging port. The ten modules depict a configurable illustration,
not a battery capacity or the construction of a particular production car.
There is no fuel tank, exhaust, combustion engine, accessory belt, long
driveshaft, or rear differential in this variant. Wheels, cabin, brakes,
suspension, and shell are shared. The traction pack remains below the cabin floor.

Use `ISO_ELECTRIC_CAR_ANCHORS` for EV labels and `ISO_CAR_ANCHORS` for the original
petrol layout. The motor overlay is illustrative; internal rotor/stator operation,
regenerative braking, and a plugged-in charging cable are not implemented.

## Road

`IsoRoad` is an independent SVG asset with 1–4 same-direction lanes, edge lines,
shoulders, and clipped repeating lane marks. `length` defaults to 1100 world
units; `laneWidth` defaults to 240, wide enough for the car's tires. Colors can
be set with `asphalt` and `shoulderColor`. It shares the car's projection origin.

```tsx
<IsoRoad distance={frame * 3}>
  <IsoCar x={104} y={-60} width={760} height={480}
    style={{ width: 760, height: 480 }} />
  <IsoCar powertrain="electric" color="#367E83" x={-104} y={60}
    width={760} height={480} style={{ width: 760, height: 480 }} />
</IsoRoad>
```

The screen offsets above represent lane centers at world y = −120 and +120.
Draw the far-lane car first. Increasing `distance` moves the lane marks backwards;
for matching wheel motion use `wheelRotation={-distance / 40 * 180 / Math.PI}`.
There is no independent road clock, raster texture, or external dependency.

Roads are useful for driving scenes; component close-ups do not require one.
Run `npx tsx scripts/assets/preview-electric-car.tsx` for EV SVG/PNG variants,
a road SVG, a two-car comparison, and a 12-second video under
`storage/assets/iso-electric-car/`. `--stills-only` skips video rendering.
Automatic asset choice from a user prompt is still a separate pipeline task.


## Pemilahan sampah (uji coba)

`IsoWasteSorting` / `environment.waste-sorting@0.1.0` memakai proyeksi
`isometric-30`, viewBox 760 × 480 dan origin tanah [380, 300]. Ekspor publik
tersedia dari `@/motion-kit`. Geometri SVG dibuat lokal oleh GMotion, berlisensi
proprietary untuk penggunaan komersial; tidak memanggil model gambar.

- `item`: `leaf` (default), `paper`, `bottle`.
- `progress`: 0–1; 0 di atas masukan, 0.7 di atas wadah tujuan, 1 masuk dan hilang.
  Renderer menginterpolasi dari frame, tanpa loop atau waktu sistem.
- `organicColor`, `paperColor`, `plasticColor`: warna wadah; ikon tetap membedakan
  kategori. Warna bukan standar pemilahan lokal. Label mengikuti konten adegan.
- `ISO_WASTE_SORTING_ANCHORS`: `organic`, `paper`, `plastic`, `input`, koordinat
  dunia yang diproyeksikan dengan `projectCarPoint`.
- Banyak instance tidak memakai ID SVG bersama. Mendukung layout `single`,
  `side-by-side`, `close-up`; validator menolak layout `road` untuk aset ini.

Tidak mendukung 2D, sampah berbahaya, mesin sortir, pengolahan air, sungai, atau
klaim bahwa setiap botol/kertas dapat didaur ulang. Tiga wadah hanya ilustrasi,
bukan kapasitas atau statistik. Panduan setempat harus disediakan dalam konten.

Jalankan `npx tsx scripts/assets/preview-waste-sorting.tsx` untuk membuat rencana
tervalidasi, sembilan PNG (tiga objek pada tiga rasio), dan MP4 6 detik tanpa audio.
Hasil lokal berada di `storage/assets/waste-sorting/`. Belum lulus definisi selesai
aplikasi: pemilihan prompt, revisi di studio, dan simpan/reload belum diuji.


## Sungai, saluran, dan pengolahan air (uji coba)

`IsoWaterChannel` (`environment.water-channel@0.1.0`) memiliki varian `river`
(dasar berkelok ringan) dan `canal` (saluran lurus berlapis). Komponen menerima
`variant`, `flowPhase` 0–1000, `flowing`, `waterColor`, `bankColor`.
`ISO_WATER_CHANNEL_ANCHORS` menyediakan `inlet`, `center`, `outlet`, `bank`.
Aliran bergerak ke arah x dunia positif. Tidak ada banjir, erosi, pintu air,
perubahan isi, atau simulasi pencemaran.

`IsoWaterTreatment` (`environment.water-treatment@0.1.0`, varian registry
`conventional`) menunjukkan empat bak potongan: koagulasi/flokulasi digabung,
pengendapan, filtrasi, dan disinfeksi. Props: `flowPhase` 0–1000, `flowing`,
`settling` 0–1, `waterColor`, `tankColor`. Phase menggerakkan penanda aliran dan
pengaduk; `settling` menurunkan partikel serta menambah lapisan endapan ilustratif.
`ISO_WATER_TREATMENT_ANCHORS`: `inlet`, `coagulation`, `flocculation`,
`sedimentation`, `sludge`, `filtration`, `disinfection`, `outlet`.

Kedua aset memakai viewBox 760 × 480, origin tanah [380, 300], `isometric-30`,
dan ekspor `@/motion-kit`. Geometri dibuat lokal oleh GMotion (proprietary,
penggunaan komersial), tidak memanggil model gambar atau memakai gambar referensi.
Label dan narasi berasal dari rencana. Warna air tidak menyatakan mutu atau keamanan.
`flowPhase` adalah fase ilustratif, bukan debit. Tanpa timer, random, atau ID SVG.
`flowing=false` menyembunyikan penanda; tahan phase jika pengaduk juga harus berhenti.

Urutan proses merujuk [CDC: How Water Treatment Works](https://www.cdc.gov/drinking-water/about/how-water-treatment-works.html),
diakses 8 November 2026. Bentuk ini merupakan skema proses, bukan desain instalasi,
pengolahan air limbah, perhitungan tekanan/ketinggian, atau jaminan air layak minum.
Tidak ada dosis kimia, waktu kontak, pencucian balik, pengolahan lumpur, pompa,
atau data kapasitas. Material filter dan jumlah partikel bukan spesifikasi.
Sambungan di dalam instalasi bersifat skematis; antar-aset belum otomatis terhubung.
Aset 2D belum tersedia. Layout road menolak kedua aset.

Regenerasi dengan `npx tsx scripts/assets/preview-water-environment.tsx`:
rencana tervalidasi, MP4 18 detik tanpa audio, 18 PNG pada 9:16/4:5/16:9, serta
`evidence.json` di `storage/assets/water-environment/`. Folder ini diabaikan Git.
Status tetap experimental sampai alur aplikasi dan definisi selesai terpenuhi.


## Teks pada demo bersifat opsional

Geometri aset tidak memuat caption narasi atau label penunjuk. `PlanVideo`
menambahkan lapisan penyajian sesuai `presentation` yang disimpan di rencana:

```json
{
  "presentation": { "captions": false, "labels": false, "names": false }
}
```

Ini adalah potongan pengaturan, bukan rencana lengkap. Letakkan di tingkat
rencana untuk seluruh video, atau pada satu elemen `scenes` untuk override lokal.
Tiap properti opsional; nilai pada adegan menimpa nilai rencana. Tanpa pengaturan,
ketiganya bernilai true agar rencana yang sudah ada tetap sama tampilannya.
`captions` mengatur teks narasi di bawah, `labels` mengatur teks/garis/titik
penunjuk, `names` mengatur nama otomatis pada layout berdampingan. `focus`
tetap dipakai kamera meski label disembunyikan. Saat caption mati, panggung
memakai ruang lebih tinggi dan dipusatkan kembali. Ini belum merupakan kontrol UI.

Narasi, audio yang disediakan, durasi, dan aksi tetap tersimpan; mengubah
pengaturan cukup render ulang, tanpa membuat ulang aset atau audio. Caption
saat ini berupa satu kalimat adegan, belum subtitle dengan waktu per kata.

Demo bersih: `npx tsx scripts/assets/preview-water-environment.tsx --no-text`.
Hasil disimpan terpisah di `storage/assets/water-environment/no-text/`, termasuk
rencana, MP4 18 detik tanpa audio, dan frame pada tiga rasio. Demo berteks tetap
tersedia lewat perintah yang sama tanpa flag.


## Paket Usaha (uji coba)

Lima aset isometrik `0.1.0`, berstatus experimental, tersedia lewat `@/motion-kit`:

| ID registry | Komponen | Properti utama |
| --- | --- | --- |
| `business.shop` | `IsoShop` | `view`: exterior/cutaway; `doorOpen`: 0–1; `scanProgress`: 0–1; `posActive`; `wallColor`, `awningColor`, `shelfColor`, `productColor` |
| `business.shelf` | `IsoShelf` | `stockCount`: integer 0–6; `highlight`: 0–1; `color`, `productColor` |
| `business.checkout` | `IsoCheckout` | `scanProgress`, `drawerOpen`: 0–1; `active`; `color`, `productColor` |
| `business.product` | `IsoProduct` | varian `box`, `bottle`, `can`; `color`; `lift`: 0–80 |
| `business.pos` | `IsoPosTerminal` | `active`; `color` |

`IsoProduct` menerima varian melalui prop `variant`; renderer mengambilnya dari
varian registry. ID lain memakai varian tunggal generic/three-tier/counter/desktop
sesuai katalog. Tampilan toko memakai prop view, bukan varian produk. Pintu hanya
terlihat pada exterior; gerak produk di dalam toko hanya terlihat pada cutaway.
POS aktif menunjukkan layar menyala, bukan pembayaran berhasil. Gerak produk
melewati scanner tidak membaca barcode atau memengaruhi stok/total transaksi.

Semua memakai viewBox 760 × 480, origin [380, 300], `isometric-30`. Anchor publik:
`ISO_SHOP_ANCHORS`, `ISO_SHELF_ANCHORS`, `ISO_CHECKOUT_ANCHORS`,
`ISO_PRODUCT_ANCHORS`, `ISO_POS_ANCHORS`. Anchor produk standalone berada di
puncak kemasan saat diam; PlanVideo mengikuti lift. Anchor toko mengikuti skala
internalnya, bukan angka koordinat interior mentah. Rak/kasir/POS/produk di dalam
toko memakai bentuk yang sama dengan aset standalone.

Geometri dibuat lokal oleh GMotion, proprietary dengan penggunaan komersial;
tidak memakai gambar model atau merek pihak lain. Animasi berasal dari nilai
properti/frame, tanpa timer, random, atau ID SVG bersama. Tidak ada caption,
label, harga, logo, nominal uang, atau total pada geometri. Strip kemasan, bidang
papan toko, dan baris abstrak layar bukan data bisnis. Harga/label, jika diminta,
harus berasal dari konten adegan; registry tidak menerima prop price atau teks bebas.

Batasan: sudut tetap, belum 2D; tidak ada manusia/genggaman, pickup/restock,
persediaan nyata, struk, atau integrasi pembayaran. Jumlah slot rak ilustratif.
Susunan interior toko tetap, belum tata ruang bebas. Layout road ditolak.

`npx tsx scripts/assets/preview-business.tsx` membuat rencana tervalidasi, MP4
24 detik tanpa teks/audio, 27 frame pada 9:16/4:5/16:9, dan evidence.json di
`storage/assets/business/`. Hasil lokal diabaikan Git. Pemilihan dari prompt,
revisi studio, simpan/reload, dan export aplikasi belum diverifikasi untuk paket ini.



## Mobil LMPV 7-Seater Keluarga (uji coba)

Aset `vehicle.lmpv@0.1.0` dengan renderer `IsoLmpv`, berstatus experimental, tersedia lewat `@/motion-kit`.
Aset ini merepresentasikan mobil keluarga 7 penumpang 3 baris kursi yang sangat detail (terinspirasi dari LMPV populer seperti Suzuki Ertiga, generik dan aman komersial tanpa merek dagang pihak ketiga):

```tsx
import { IsoLmpv } from '@/motion-kit/isometric';

<IsoLmpv color="#4A5560" view="cutaway" hoodOpen={0} tailgateOpen={0} headlights={true} />
```

| Prop | Default | Meaning |
| --- | --- | --- |
| `color` | `#4A5560` | Warna cat bodi kendaraan (#RGB atau #RRGGBB) |
| `view` | `exterior` | `exterior`: bodi luar; `cutaway`: mengekspos interior 3 baris dan ruang mesin FWD; `chassis`: mengekspos sasis kolong monocoque, suspensi, dan knalpot |
| `hoodOpen` | `0` | Sudut angkat kap mesin (0 tertutup sampai 1 terangkat dengan gas strut) |
| `tailgateOpen` | `0` | Sudut buka pintu bagasi hatchback (0 tertutup sampai 1 terangkat ke atas) |
| `doorOpen` | `0` | Sudut buka pintu depan pengemudi (0 tertutup sampai 1 terbuka) |
| `windowOpen` | `0` | Posisi kaca samping (0 tertutup sampai 1 turun ke dalam pintu) |
| `wheelRotation` | `0` | Sudut putaran velg alloy diamond-cut dalam derajat |
| `engineRotation` | `0` | Sudut putaran puli serpentine belt alternator dan kompresor AC |
| `bodyOpacity` | `1` | Opasitas cangkang bodi luar |
| `wheelOpacity` | `1` | Opasitas roda (diturunkan pada mode chassis untuk mengekspos rem dan suspensi) |
| `headlights` | `false` | Menyalakan proyektor lampu utama LED dan alis DRL |
| `shadow` | `true` | Bayangan isometrik mobil di atas tanah |
| `title` | `Mobil LMPV 7-Seater` | Judul SVG aksesibel |

Fitur detail `IsoLmpv`:
1. **Eksterior LMPV**: Fasad aerodinamis, grille krom tebal multi-slat, lampu depan proyektor kristal dengan DRL eyebrow, lampu kabut beraksen bezel, 3 baris kaca samping (kaca depan + delta A-pillar, kaca baris 2, quarter glass baris 3), velg alloy two-tone diamond-cut 5-split-spoke, spion dengan sein LED, sirip hiu antena, spoiler belakang dengan stop lamp LED, dan pintu bagasi terangkat (`tailgateOpen`).
2. **Interior 7-Seater 3 Baris**:
   - Baris 1: Sepasang jok bucket berkontur ergonomis dengan headrest adjustable, dasbor bertingkat dengan aksen silver, layar sentuh infotainment floating 8 inci, setir 3-spoke D-cut dengan tombol fungsi dan airbag boss, panel meter kluster twin pod, konsol tengah dengan tuas transmisi otomatis/manual dan tuas rem tangan.
   - Baris 2: Jok 3 penumpang split 60:40 dengan sandaran tangan lipat tengah (armrest + cup holder) dan 3 headrest terpisah.
   - Plafon / Headliner: **Unit AC Double Blower** terpasang di atas baris 2 dengan 4 kisi louver pengarah angin dan tombol putar kecepatan kipas.
   - Baris 3 & Bagasi: Jok 2 penumpang split 50:50 dengan 2 headrest, sandaran tangan molded samping, serta bagasi belakang berlantai rata dengan kompartemen bawah.
3. **Ruang Mesin FWD Melintang 1.5L (`hoodOpen`)**: Mesin 4-silinder DOHC 16-valve melintang (FWD), 4 ignition coils dengan kabel wiring, intake manifold dengan box filter udara samping, radiator crossflow twin-fan + selang coolant, aki 12V dengan terminal positif merah dan bracket penjepit, tabung master rem + vacuum booster, tabung washer kaca dengan tutup biru, dipstick oli, dan serpentine accessory drive belt yang berputar dengan `engineRotation`.
4. **Sasis & Kolong (`view: 'chassis'`)**: Monocoque platform FWD, transaxle depan terhubung ke CV drive half-shafts dengan karet boot fleksibel, suspensi depan MacPherson strut dengan per keong dan lower wishbone, tangki bahan bakar di bawah baris 2, knalpot lengkap (downpipe, catalytic converter, pipa terowongan lantai berpelindung panas, resonator tengah, muffler peredam suara belakang, ujung knalpot krom), dan suspensi belakang torsion beam dengan per dan shockbreaker teleskopik.

Anchor publik `ISO_LMPV_ANCHORS`:
`front`, `rear`, `frontWheel`, `rearWheel`, `engine`, `transaxle`, `radiator`, `battery`, `airBox`, `cabin`, `row1Seat`, `row2Seat`, `row3Seat`, `doubleBlower`, `dashboard`, `infotainment`, `steering`, `roof`, `tailgate`, `fuelTank`, `torsionBeam`, `exhaust`.

Demo: `npx tsx scripts/assets/preview-lmpv.tsx`, menghasilkan video MP4 15 detik `mobil-lmpv-7seater.mp4`, 15 frame still pada 3 rasio aspect (9:16, 4:5, 16:9), serta file evidence dan plan di `storage/assets/lmpv/`.


Dua aset isometrik `0.1.0` untuk Bagian D (`Air, rumah, dan mesin umum`), berstatus experimental, tersedia lewat `@/motion-kit`:

| ID registry | Komponen | Properti utama |
| --- | --- | --- |
| `building.house` | `IsoHouse` | varian `residential` / `luxury` / `room`; `view`: exterior/cutaway; `doorOpen`: 0–1; `windowLit`: boolean; `waterRunning`: boolean; `carInGarage`: boolean; `carColor`: string; `garden`: boolean; `poolColor`, `wallColor`, `roofColor`, `floorColor`, `doorColor` |
| `building.sink` | `IsoSink` | varian `kitchen`/`bathroom`; `waterRunning`: boolean; `counterColor`, `basinColor` |

`IsoHouse` mendukung tiga varian utama:
1. **`residential` (Rumah Tinggal Keluarga):** Tampak eksterior dengan atap pelana segitiga, cerobong asap, pintu berengsel, jendela 4 panel, **taman halaman depan hijau asri** dengan rumput, batu pijakan (*stepping stones*), semak bunga, serta **carport dengan mobil terparkir** (`carInGarage: true`). Interior potongan (*cutaway*) menampilkan ruang keluarga, dapur (meja granit, kompor, kettle, wastafel cuci piring, keran leher angsa), dan kamar mandi (lantai ubin keramik, meja vanity wastafel, keran, cermin, bathtub, dan tiang shower).
2. **`luxury` (Rumah Mewah / Villa Modern 2 Lantai):** Arsitektur kontemporer 2 lantai dengan **garasi / carport beratap kanopi dan mobil mewah terparkir**, **taman lanskap modern** dengan semak hias berbunga, pot tanaman tropis, dan batu pijakan, **kolam renang (*plunge pool*)** dengan pantulan air jernih dan kursi santai *sun lounger*, balkon lantai 2 dengan *tempered glass railing*, jendela kaca besar *floor-to-ceiling*, pintu pivot utama, serta interior mewah 2 lantai: dapur gourmet dengan *kitchen island waterfall marble* + wastafel ganda + keran emas, kamar mandi spa dengan *freestanding soaking tub* + *double vanity*, dan master suite lantai 2.
3. **`room`:** Potongan interior diorama fokus pada ruangan.

Ketika `waterRunning: true`, air bersih mengalir dari seluruh keran dapur dan keran kamar mandi ke bak wastafel secara real-time.

Anchor publik:
- `ISO_HOUSE_ANCHORS`: `entrance`, `door`, `window`, `roof`, `chimney`, `interior`, `livingRoom`, `kitchen`, `kitchenSink`, `kitchenFaucet`, `bathroom`, `bathroomSink`, `bathroomFaucet`, `shower`, `waterInlet`, `drain`, serta anchor khusus luxury/garasi/taman: `garage`, `car`, `garden`, `pool`, `balcony`, `upperFloor`, `kitchenIsland`, `luxuryBath`.
- `ISO_SINK_ANCHORS`: `faucet`, `spout`, `basin`, `drain`, `trap`, `inlet`.

Demo: `npx tsx scripts/assets/preview-house.tsx`, menghasilkan rencana tervalidasi, MP4 15 detik `rumah-dapur-kamar-mandi.mp4`, dan 15 frame (9:16, 4:5, 16:9) di `storage/assets/house/`.
