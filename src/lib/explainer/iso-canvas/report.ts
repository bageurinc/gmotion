import type { IsoCanvasReport } from './build';

const kindName = { object: 'objek', world: 'dunia', detail: 'close-up' } as const;

/** The editor's first message for a canvas video: what stayed below the bar, said plainly. */
export function canvasFinishedMessage(report: IsoCanvasReport): string {
  const threshold = String(report.threshold).replace('.', ',');
  const stand = report.items.filter((item) => item.fallback);
  const weak = report.items.filter((item) => !item.fallback && !item.passed);
  const parts = ['Video Isometrik selesai dibuat.'];
  if (stand.length) {
    parts.push(`Gambar untuk ${stand.map((item) => `${kindName[item.kind]} "${item.label}"`).join(', ')} gagal dibuat AI, jadi diganti bentuk sederhana.`);
  }
  if (weak.length) {
    const listed = weak.map((item) => `${kindName[item.kind]} "${item.label}" (skor ${item.score === null ? 'tidak terbaca' : String(item.score).replace('.', ',')})`).join(', ');
    // Critic issues are English instructions for the model, so the user sees names and scores only.
    parts.push(`Skor penilai di bawah ${threshold} untuk ${listed}. Bagian itu bisa diperbaiki lewat revisi.`);
  }
  if (!stand.length && !weak.length) parts.push(`Semua gambar mencapai skor penilai ${threshold} atau lebih.`);
  parts.push('Tonton hasilnya di player.');
  return parts.join(' ');
}
