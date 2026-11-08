import { describe, expect, it } from 'vitest';
import { exportStream, readExportStream } from './export-stream';

const read = (stream: ReadableStream<Uint8Array>, seen: number[] = []) => readExportStream(new Response(stream), (progress) => seen.push(progress));

describe('export stream', () => {
  it('delivers real progress in order, then the result', async () => {
    const seen: number[] = [];
    const result = await read(exportStream(async (report) => {
      report(12);
      report(80);
      return { exportVideoUrl: '/video.mp4' };
    }, String), seen);
    expect(seen).toEqual([12, 80]);
    expect(result).toEqual({ exportVideoUrl: '/video.mp4' });
  });

  it('surfaces a render failure', async () => {
    const stream = exportStream(async () => {
      throw new Error('crash');
    }, (error) => (error as Error).message);
    await expect(read(stream)).rejects.toThrow('crash');
  });

  it('treats a stream that ends early as a failure, not a success', async () => {
    const stream = new Response('{"type":"progress","progress":40}\n').body!;
    await expect(read(stream)).rejects.toThrow('terputus');
  });

  it('reads a line split across chunks', async () => {
    const parts = ['{"type":"do', 'ne","result":{"a":1}}\n'];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        parts.forEach((part) => controller.enqueue(new TextEncoder().encode(part)));
        controller.close();
      },
    });
    await expect(read(stream)).resolves.toEqual({ a: 1 });
  });
});
