import type { AspectRatio, StylePreset } from '@/types/studio';

export interface StarterPrompt {
  title: string;
  prompt: string;
  preset: StylePreset;
  ratio: AspectRatio;
}

const story2d = (title: string, prompt: string): StarterPrompt => ({ title, prompt, preset: 'story-2d', ratio: '9:16' });
const fullSvg = (title: string, prompt: string): StarterPrompt => ({ title, prompt, preset: 'story-canvas', ratio: '9:16' });
const isometric = (title: string, prompt: string): StarterPrompt => ({ title, prompt, preset: 'world', ratio: '9:16' });
const ads = (title: string, prompt: string): StarterPrompt => ({ title, prompt, preset: 'ads-ui', ratio: '9:16' });

/** Numbers here are well-known facts, because a prompt's numbers can appear on screen as data. */
export const STARTER_PROMPTS: StarterPrompt[] = [
  story2d('Perjalanan Biji Kopi', 'Ceritakan perjalanan biji kopi nusantara dari kebun pegunungan berkabut hingga diseduh hangat di cangkir.'),
  story2d('Rahasia Candi Borobudur', 'Ceritakan bagaimana Candi Borobudur dibangun sekitar tahun 800, dengan 72 stupa berlubang di teras atasnya.'),
  story2d('Letusan Krakatau 1883', 'Ceritakan letusan Gunung Krakatau tahun 1883 dan dampaknya bagi dunia, dengan cara yang mudah dipahami.'),
  story2d('Asal Mula Batik Tulis', 'Ceritakan proses membuat batik tulis, dari menggambar pola, mencanting malam, mewarnai, sampai melorod kain.'),
  story2d('Kenapa Rendang Tahan Lama', 'Jelaskan proses memasak rendang dari santan cair sampai kering, dan kenapa hasilnya bisa awet.'),
  story2d('Jalur Rempah Maluku', 'Ceritakan kenapa cengkeh dan pala dari Maluku pernah diperebutkan bangsa-bangsa di dunia.'),
  story2d('Kehidupan Terumbu Karang', 'Ceritakan bagaimana terumbu karang tumbuh dan menjadi rumah bagi ikan di laut Indonesia.'),
  story2d('Komodo si Naga Purba', 'Ceritakan kehidupan komodo di Pulau Komodo, cara berburunya, dan kenapa hewan ini perlu dilindungi.'),

  fullSvg('Cara Sabun Membersihkan', 'Bagaimana cara kerja sabun melepas minyak dan kuman dari tangan?'),
  fullSvg('Tahapan Gedung Pencakar Langit', 'Jelaskan tahapan membangun gedung pencakar langit, dari uji tanah, pondasi, rangka, sampai fasad kaca.'),
  fullSvg('Cara Kerja Jantung', 'Jelaskan cara jantung memompa darah melalui 4 ruangnya ke paru-paru dan seluruh tubuh.'),
  fullSvg('Kenapa Pesawat Bisa Terbang', 'Jelaskan bagaimana sayap dan mesin membuat pesawat bisa terangkat dan terbang.'),
  fullSvg('Terjadinya Gempa Bumi', 'Jelaskan bagaimana lempeng bumi bergerak dan menyebabkan gempa.'),
  fullSvg('Terbentuknya Pelangi', 'Jelaskan bagaimana cahaya matahari dan tetes air hujan membentuk pelangi.'),
  fullSvg('Perjalanan Air Hujan', 'Jelaskan siklus air dari laut, menguap, menjadi awan, turun sebagai hujan, lalu kembali ke laut.'),
  fullSvg('Cara Kerja Vaksin', 'Jelaskan bagaimana vaksin melatih sistem kekebalan tubuh mengenali kuman.'),

  isometric('HP Dicas Semalaman', 'Aman nggak sih HP dicas semalaman?'),
  isometric('Dari Sungai ke Keran', 'Bagaimana air sungai diolah PDAM sampai keluar bersih dari keran rumah?'),
  isometric('Cara Kerja Lift', 'Bagaimana lift naik turun dengan aman, dan apa yang terjadi kalau kabelnya putus?'),
  isometric('Kenapa Harga Naik', 'Apa itu inflasi dan kenapa harga barang bisa naik setiap tahun?'),
  isometric('Isi Baterai Mobil Listrik', 'Bagaimana baterai mobil listrik menyimpan dan mengeluarkan energi?'),
  isometric('Jalan Sampah Kita', 'Ke mana sampah rumah tangga pergi setelah diangkut truk?'),

  ads('Chatbot WhatsApp Sales', 'Buat iklan 15 detik untuk aplikasi chatbot WhatsApp yang membantu tim sales membalas calon pembeli lebih cepat.'),
  ads('Invoice & Pengingat WA', 'Iklan aplikasi tagihan otomatis dan pengingat pembayaran lewat WhatsApp untuk pemilik UMKM.'),
  ads('Aplikasi Kasir Warung', 'Iklan aplikasi kasir di HP untuk warung, supaya stok dan penjualan harian tercatat rapi.'),
  ads('Promo Kedai Kopi', 'Iklan kedai kopi lokal yang baru buka, dengan suasana hangat dan biji kopi nusantara.'),
  ads('Klinik Gigi Keluarga', 'Iklan klinik gigi keluarga yang ramah untuk anak, dengan ajakan buat janji temu.'),
  ads('Kursus Bahasa Inggris', 'Iklan kursus bahasa Inggris online untuk karyawan yang ingin percaya diri saat rapat.'),
];
