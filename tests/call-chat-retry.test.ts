import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callChat } from '@/lib/explainer/asset-generator';

const sse = (text: string) => new Response(new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`));
    controller.close();
  },
}), { status: 200 });

const broken = () => new Response(new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"par"}}]}\n\n'));
    controller.error(new TypeError('terminated'));
  },
}), { status: 200 });

describe('callChat', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_BASE_URL', 'http://router.test');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends the request once more when the stream breaks mid-response', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(broken()).mockResolvedValueOnce(sse('whole answer'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await callChat({ model: 'm', system: 's', content: 'c', maxTokens: 10 });
    expect(result.text).toBe('whole answer');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after the second broken stream and does not retry other errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(broken()).mockResolvedValueOnce(broken()));
    await expect(callChat({ model: 'm', system: 's', content: 'c', maxTokens: 10 })).rejects.toThrow(/terminated/);
    const failing = vi.fn().mockResolvedValue(new Response('nope', { status: 400 }));
    vi.stubGlobal('fetch', failing);
    await expect(callChat({ model: 'm', system: 's', content: 'c', maxTokens: 10 })).rejects.toThrow(/HTTP 400/);
    expect(failing).toHaveBeenCalledTimes(1);
  });
});

describe('requestAsset', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('names the safety filter instead of a format error when the answer is blocked', async () => {
    vi.stubEnv('OPENAI_BASE_URL', 'http://router.test');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const blocked = new Response(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'content_filter' }] })}\n\ndata: [DONE]\n\n`, { status: 200 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(blocked));
    const { requestAsset } = await import('@/lib/explainer/asset-generator');
    await expect(requestAsset('m', 'c')).rejects.toThrow(/safety filter blocked this scene/);
  });
});
