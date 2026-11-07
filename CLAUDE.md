# gmotion

SaaS pembuat video motion graphic dari 1–2 kalimat prompt, berbasis Next.js 15 dan Remotion 4. Bahasa produk dan narasi adalah Bahasa Indonesia.

Baca dua file ini sebelum mengerjakan fitur:
- [plan_fitur.md](plan_fitur.md): aturan teknis wajib, checklist status, dan prioritas. Perbarui setiap ada fitur selesai.
- [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md): keputusan, alasan, hasil uji, dan jebakan teknis.

## Perintah

```bash
npm run dev
npx vitest run
npx tsc --noEmit --incremental false
npx eslint src
npx tsx scripts/generate-audio.ts
npx tsx --env-file=.env scripts/spike-assets.ts --topics jantung,jet --rounds 3
npx tsx --env-file=.env scripts/spike-world.ts --run hp --topic "Aman nggak sih HP dicas semalaman?"
```

`gh` dan `ffmpeg` tidak terpasang di mesin ini. ffmpeg tersedia di `node_modules/@remotion/compositor-darwin-arm64/`, jalankan dengan `DYLD_LIBRARY_PATH` menunjuk folder itu. Versi ini tidak punya filter `fps`, `select`, `tile`, atau `volumedetect`, dan tidak bisa menulis `rawvideo`.

## Aturan kerja

- Selalu gunakan codebase-memory MCP untuk menelusuri kode: `search_graph` untuk simbol, `trace_path` untuk relasi, `get_code_snippet` untuk sumber, dan `query_graph` atau `get_architecture` untuk struktur luas. Pakai grep dan baca file hanya untuk teks literal, config, file non-kode, atau baris yang tidak tercakup indeks. Cek `check_index_coverage` untuk setiap file yang dijadikan dasar.
- Jangan jalankan `next build` saat server dev hidup, karena keduanya memakai `.next`. Mulai ulang server dev setelah mengedit file server.
- Hanya kode yang lolos `validateSceneCode` di [code-validator.ts](src/lib/pipeline/code-validator.ts) yang boleh disimpan.
- Hasil visual dinilai dari frame hasil render, bukan dari kode. Keputusan kualitas akhir ada pada user saat menonton. Skor kritik hanya penyaring.
- Hindari mengarang fakta di video. Aturan ada di [anti-slop.ts](src/lib/pipeline/anti-slop.ts).
- Warna gelap boleh jika sesuai topik. Yang dilarang adalah warna gelap sebagai kebiasaan.
- Model utama adalah Gemini karena biaya. Jangan memakai Opus untuk uji tanpa diminta.
- Komentar kode ditulis dalam bahasa Inggris, dan teks UI dalam Bahasa Indonesia.
- Commit dan push hanya saat diminta, dan jangan langsung di `main`.

## Struktur

| Lokasi | Isi |
|---|---|
| `src/lib/pipeline/` | Director, coder, TTS, draf, job generate, validator, aturan anti-slop |
| `src/lib/explainer/` | Dunia 3D untuk gaya Isometrik, dan pipeline ilustrasi untuk Story 2D dan Ads |
| `src/lib/render/` | Bundling, export MP4, cek crash |
| `src/lib/audio/` | Sintesis musik dan SFX, timing subtitle |
| `src/lib/security/` | Skema input dan validasi nama |
| `src/motion-kit/` | Komponen video yang boleh dipakai adegan |
| `src/components/studio/` | Layar draf, editor, progres |
| `storage/` | Project dan hasil uji lokal, tidak masuk git |
