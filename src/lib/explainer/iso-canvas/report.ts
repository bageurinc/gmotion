import type { IsoCanvasReport } from './build';

const kindName = { object: 'objek', world: 'dunia', detail: 'close-up', title: 'judul', caption: 'subtitle', panel: 'panel', prop: 'benda', place: 'tempat' } as const;

/** The editor's first message for a canvas video: what stayed below the bar, said plainly. */
export function canvasFinishedMessage(report: IsoCanvasReport, videoName = 'Isometrik', revisable = true): string {
  const threshold = String(report.threshold).replace('.', ',');
  // The title is optional and has no stand-in drawing, so it gets its own sentence.
  const title = report.items.find((item) => item.kind === 'title');
  const caption = report.items.find((item) => item.kind === 'caption');
  const panel = report.items.find((item) => item.kind === 'panel');
  const drawings = report.items.filter((item) => item.kind !== 'title' && item.kind !== 'caption' && item.kind !== 'panel');
  const stand = drawings.filter((item) => item.fallback);
  const weak = drawings.filter((item) => !item.fallback && !item.passed);
  const parts = [`Video ${videoName} selesai dibuat.`];
  if (title?.fallback) parts.push('Judul pembuka gagal dibuat AI, jadi video dibuka dengan panel judul biasa.');
  else if (title && !title.passed) parts.push(`Judul pembuka dibuat AI dengan skor penilai ${title.score === null ? 'tidak terbaca' : String(title.score).replace('.', ',')}.`);
  if (caption?.fallback) parts.push('Desain subtitle gagal dibuat AI, jadi subtitle memakai tampilan biasa.');
  else if (caption && !caption.passed) parts.push(`Subtitle didesain AI dengan skor penilai ${caption.score === null ? 'tidak terbaca' : String(caption.score).replace('.', ',')}.`);
  if (panel?.fallback) parts.push('Desain panel judul adegan gagal dibuat AI, jadi panel memakai tampilan biasa.');
  else if (panel && !panel.passed) parts.push(`Panel judul adegan didesain AI dengan skor penilai ${panel.score === null ? 'tidak terbaca' : String(panel.score).replace('.', ',')}.`);
  if (stand.length) {
    parts.push(`Gambar untuk ${stand.map((item) => `${kindName[item.kind]} "${item.label}"`).join(', ')} gagal dibuat AI, jadi diganti bentuk sederhana.`);
  }
  if (weak.length) {
    const listed = weak.map((item) => `${kindName[item.kind]} "${item.label}" (skor ${item.score === null ? 'tidak terbaca' : String(item.score).replace('.', ',')})`).join(', ');
    // Critic issues are English instructions for the model, so the user sees names and scores only.
    parts.push(`Skor penilai di bawah ${threshold} untuk ${listed}.${revisable ? ' Bagian itu bisa diperbaiki lewat revisi.' : ''}`);
  }
  if (!stand.length && !weak.length) parts.push(`Semua gambar mencapai skor penilai ${threshold} atau lebih.`);
  parts.push('Tonton hasilnya di player.');
  return parts.join(' ');
}
