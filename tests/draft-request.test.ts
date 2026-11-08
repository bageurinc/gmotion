import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { POST } from '@/app/api/projects/route';
import {
  generateStoryboard,
  generateProceduralStoryboard,
} from '@/lib/pipeline/director-agent';
import { getCurrentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { getProject } from '@/lib/storage/project-store';
import type { Storyboard } from '@/types/studio';
import { TEST_USER } from './setup-auth';

vi.mock('@/lib/pipeline/director-agent', async (original) => ({
  ...(await original<typeof import('@/lib/pipeline/director-agent')>()),
  generateStoryboard: vi.fn(),
}));

const generate = vi.mocked(generateStoryboard);
const ids = new Set<string>();
const input = () => ({
  requestId: crypto.randomUUID(),
  prompt: 'Cara menyeduh kopi V60',
  preset: 'story-svg',
  aspectRatio: '9:16',
  drawingModel: 'gemini',
});
const request = (body: unknown) =>
  new NextRequest('http://localhost/api/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  });
const track = async (response: Response) => {
  const data = await response.json();
  if (data.project) ids.add(data.project.id);
  return data;
};

describe('resumable draft requests', () => {
  beforeEach(async () => {
    generate.mockReset();
    generate.mockImplementation(
      async (prompt, preset = 'ads-ui', ratio = '9:16') =>
        generateProceduralStoryboard(prompt, preset, ratio),
    );
    await getDb().run('UPDATE users SET credits = 100 WHERE id = ?', [
      TEST_USER.id,
    ]);
  });

  afterEach(async () => {
    for (const id of ids)
      fs.rmSync(path.join(process.cwd(), 'storage/projects', id), {
        recursive: true,
        force: true,
      });
    ids.clear();
    await getDb().run('UPDATE users SET credits = 100 WHERE id = ?', [
      TEST_USER.id,
    ]);
  });

  it('returns the saved draft after a reload without calling the model again', async () => {
    const body = input();
    const first = await track(await POST(request(body)));
    const second = await track(await POST(request(body)));
    expect(second.project.id).toBe(first.project.id);
    expect(getProject(first.project.id)?.status).toBe('draft');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('joins an in-flight request instead of drafting twice', async () => {
    const body = input();
    let finish!: (value: Storyboard) => void;
    generate.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const first = POST(request(body));
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    const second = POST(request(body));
    finish(generateProceduralStoryboard(body.prompt, 'story-svg', '9:16'));
    const [a, b] = await Promise.all([first.then(track), second.then(track)]);
    expect(a.project.id).toBe(b.project.id);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('stores pixel art on the storyboard only for Story 2D Campuran', async () => {
    const pixel = await track(await POST(request({ ...input(), preset: 'story-2d', artStyle: 'pixel' })));
    expect(getProject(pixel.project.id)?.storyboard.artStyle).toBe('pixel');
    const ignored = await track(await POST(request({ ...input(), artStyle: 'pixel' })));
    expect(getProject(ignored.project.id)?.storyboard.artStyle).toBeUndefined();
  });

  it('rejects a different art style reusing a completed request', async () => {
    const body = { ...input(), preset: 'story-2d' };
    await track(await POST(request(body)));
    expect((await POST(request({ ...body, artStyle: 'pixel' }))).status).toBe(409);
  });

  it('rejects different input reusing a completed request', async () => {
    const body = input();
    await track(await POST(request(body)));
    expect(
      (await POST(request({ ...body, prompt: 'Ide berbeda' }))).status,
    ).toBe(409);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('rejects conflicting input while the original draft is still running', async () => {
    const body = input();
    let finish!: (value: Storyboard) => void;
    generate.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = POST(request(body));
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    expect((await POST(request({ ...body, aspectRatio: '16:9' }))).status).toBe(
      409,
    );
    finish(generateProceduralStoryboard(body.prompt, 'story-svg', '9:16'));
    await track(await pending);
  });

  it('allows retrying the same request after a generation error', async () => {
    const body = input();
    generate.mockRejectedValueOnce(new Error('Model tidak tersedia'));
    expect((await POST(request(body))).status).toBe(500);
    const retried = await track(await POST(request(body)));
    expect(retried.project.status).toBe('draft');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('scopes the request ID to its owner', async () => {
    const body = input();
    const first = await track(await POST(request(body)));
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      ...TEST_USER,
      id: 'other-user',
    });
    const second = await track(await POST(request(body)));
    expect(second.project.id).not.toBe(first.project.id);
    expect(second.project.ownerId).toBe('other-user');
  });

  it('can reopen an existing draft after the remaining credit is spent', async () => {
    const body = input();
    const first = await track(await POST(request(body)));
    await getDb().run('UPDATE users SET credits = 0 WHERE id = ?', [
      TEST_USER.id,
    ]);
    const repeated = await POST(request(body));
    expect(repeated.status).toBe(200);
    expect((await track(repeated)).project.id).toBe(first.project.id);
    expect((await POST(request(input()))).status).toBe(402);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed request IDs before invoking the model', async () => {
    expect(
      (await POST(request({ ...input(), requestId: '../invalid' }))).status,
    ).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });
});
