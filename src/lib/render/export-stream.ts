/** One JSON line per event, so the export request itself carries its real progress. */
export type ExportEvent =
  | { type: 'progress'; progress: number }
  | { type: 'done'; result: Record<string, unknown> }
  | { type: 'error'; error: string };

export const EXPORT_STREAM_TYPE = 'application/x-ndjson';

export function exportStream(
  run: (report: (progress: number) => void) => Promise<Record<string, unknown>>,
  describeError: (error: unknown) => string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (event: ExportEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The client left. The export still finishes and saves its result.
        }
      };
      try {
        send({ type: 'done', result: await run((progress) => send({ type: 'progress', progress })) });
      } catch (error) {
        send({ type: 'error', error: describeError(error) });
      }
      try {
        controller.close();
      } catch {
        // Already closed by the client leaving.
      }
    },
  });
}

/** Reads an export stream and resolves with its final result. A stream that ends early is an error. */
export async function readExportStream(response: Response, onProgress: (progress: number) => void): Promise<Record<string, unknown>> {
  if (!response.body) throw new Error('Export tidak mengirim jawaban');
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = '';
  for (;;) {
    const { value, done } = await reader.read();
    buffered += value ?? '';
    const lines = buffered.split('\n');
    buffered = done ? '' : lines.pop() ?? '';
    for (const line of lines.filter((item) => item.trim())) {
      const event = JSON.parse(line) as ExportEvent;
      if (event.type === 'progress') onProgress(event.progress);
      else if (event.type === 'done') return event.result;
      else throw new Error(event.error);
    }
    if (done) throw new Error('Koneksi export terputus sebelum selesai');
  }
}
