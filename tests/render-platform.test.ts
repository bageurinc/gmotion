import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/projects/[projectId]/render/route';
import { getProject, saveProject } from '../src/lib/storage/project-store';
import { renderProvider } from '../src/lib/render/render-service';
import type { StudioProject } from '../src/types/studio';

vi.mock('../src/lib/storage/project-store', () => ({ getProject: vi.fn(), saveProject: vi.fn() }));
vi.mock('../src/lib/render/render-service', () => ({ renderProvider: { renderProject: vi.fn() } }));
const params = { params: Promise.resolve({ projectId: 'test-platform' }) };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getProject).mockReturnValue({ id: 'test-platform', safeAreaPlatform: 'instagram' } as StudioProject);
  vi.mocked(renderProvider.renderProject).mockResolvedValue({ outputPath: '/tmp/test.mp4', outputUrl: '/video.mp4' });
});

it('renders and saves the same platform selected in the player', async () => {
  const response = await POST(new NextRequest('http://localhost/render', {
    method: 'POST', body: JSON.stringify({ safeAreaPlatform: 'shorts' }),
  }), params);
  expect(response.status).toBe(200);
  expect(renderProvider.renderProject).toHaveBeenCalledWith(expect.objectContaining({ safeAreaPlatform: 'shorts' }), expect.any(Function));
  expect(saveProject).toHaveBeenLastCalledWith(expect.objectContaining({ safeAreaPlatform: 'shorts', status: 'ready' }));
});

it('retains the saved platform for requests without a body', async () => {
  await POST(new NextRequest('http://localhost/render', { method: 'POST' }), params);
  expect(renderProvider.renderProject).toHaveBeenCalledWith(expect.objectContaining({ safeAreaPlatform: 'instagram' }), expect.any(Function));
});

it('rejects an unknown platform before starting an export', async () => {
  const response = await POST(new NextRequest('http://localhost/render', {
    method: 'POST', body: JSON.stringify({ safeAreaPlatform: 'unknown' }),
  }), params);
  expect(response.status).toBe(400);
  expect(renderProvider.renderProject).not.toHaveBeenCalled();
});
