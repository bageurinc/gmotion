import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { LocalRemotionRenderProvider } from '../src/lib/render/render-service';
import { StudioProject } from '../src/types/studio';

vi.mock('@remotion/bundler', () => ({ bundle: vi.fn() }));
vi.mock('@remotion/renderer', () => ({ renderMedia: vi.fn(), selectComposition: vi.fn() }));

const projectId = `test-render-${randomUUID()}`;
const projectDir = path.join(process.cwd(), 'storage', 'projects', projectId);
afterEach(() => { fs.rmSync(projectDir, { recursive: true, force: true }); vi.resetAllMocks(); });

it('packages narration at the URL used by the render, including revision queries and scene assets', async () => {
  const assetDir = path.join(projectDir, 'assets');
  fs.mkdirSync(assetDir, { recursive: true });
  const audio = fs.readFileSync(new URL('./fixtures/tts-indonesian.mp3', import.meta.url));
  fs.writeFileSync(path.join(assetDir, 'voice.mp3'), audio);
  const assetUrl = `/api/projects/${projectId}/assets/voice.mp3?v=abc123`;
  const project = {
    id: projectId,
    safeAreaPlatform: 'shorts',
    storyboard: { aspectRatio: '9:16', fps: 30, scenes: [{ durationInFrames: 90 }] },
    files: {
      'MainVideo.tsx': `export const MainVideo = () => <Audio src="${assetUrl}" />;`,
      'Scene1.tsx': `export const Scene1 = () => <Audio src="${assetUrl}" />;`,
    },
  } as unknown as StudioProject;
  vi.mocked(bundle).mockImplementation(async (...args) => {
    const options = args[0];
    const publicDir = (options as { publicDir: string }).publicDir;
    const root = fs.readFileSync(path.join(projectDir, 'build-src', 'Root.tsx'), 'utf8');
    expect(root).toContain('<SocialSafeFrame platform="shorts">');
    expect(root).not.toContain('showSocialUI');
    expect(fs.readFileSync(path.join(publicDir, 'voice.mp3'))).toEqual(audio);
    for (const file of ['MainVideo.tsx', 'Scene1.tsx']) {
      const source = fs.readFileSync(path.join(projectDir, 'build-src', file), 'utf8');
      expect(source).toContain('src="/public/voice.mp3?v=abc123"');
      expect(source).not.toContain('/api/projects/');
    }
    return '/tmp/mock-render-bundle';
  });
  vi.mocked(selectComposition).mockResolvedValue({} as never);
  vi.mocked(renderMedia).mockImplementation(async (options) => {
    for (const progress of [0, 0, 0.01, 0.01, 1]) options.onProgress?.({ progress } as never);
    return {} as never;
  });
  const onProgress = vi.fn();
  await new LocalRemotionRenderProvider().renderProject(project, onProgress);
  expect(renderMedia).toHaveBeenCalledOnce();
  expect(onProgress.mock.calls.map(([percent]) => percent)).toEqual([0, 1, 100]);
});
