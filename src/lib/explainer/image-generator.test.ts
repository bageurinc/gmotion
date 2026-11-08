import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import sharp from 'sharp';
import { blankCanvas, generateImage, imageChangePrompt, imageModel, matchesAspect, sceneImagePrompt } from './image-generator';
import { composeImageScene } from './scene-generator';

const storyboard = generateProceduralStoryboard('Topik uji', 'story-2d', '9:16');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const prepareFetch = (...responses: Response[]) => {
  vi.stubEnv('OPENAI_BASE_URL', 'http://router.test/v1');
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  const fetchMock = vi.fn();
  responses.forEach((response) => fetchMock.mockResolvedValueOnce(response));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const imageResponse = () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('png').toString('base64') }] }));

describe('imageModel', () => {
  it('defaults to the chosen model and follows IMAGE_MODEL', () => {
    expect(imageModel()).toBe('gemini/gemini-3.1-flash-lite-image');
    vi.stubEnv('IMAGE_MODEL', 'gemini/gemini-2.5-flash-image');
    expect(imageModel()).toBe('gemini/gemini-2.5-flash-image');
  });
});

describe('sceneImagePrompt', () => {
  it('ties every scene to the video palette and forbids text', () => {
    const prompt = sceneImagePrompt(storyboard, 0);
    expect(prompt).toContain(storyboard.palette.background);
    expect(prompt).toContain(storyboard.scenes[0].visualPrompt);
    expect(prompt).toContain('no text');
  });

  it('asks for a real place from edge to edge instead of empty bands', () => {
    const prompt = sceneImagePrompt(storyboard, 0);
    expect(prompt).toContain('from edge to edge');
    expect(prompt).toContain('Never end the picture with a flat strip');
    expect(prompt).not.toContain('empty background');
  });
});

describe('blankCanvas', () => {
  it('matches the video shape and background', async () => {
    const canvas = await blankCanvas('9:16', '#123456');
    const { width, height } = await sharp(canvas).metadata();
    expect(height).toBeGreaterThan(width as number);
    const { data } = await sharp(canvas).raw().toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 3)]).toEqual([0x12, 0x34, 0x56]);
  });
});

describe('matchesAspect', () => {
  it('rejects a landscape picture for a vertical video', async () => {
    const landscape = await sharp({ create: { width: 1408, height: 768, channels: 3, background: '#FFFFFF' } }).png().toBuffer();
    expect(await matchesAspect(landscape, '9:16')).toBe(false);
    expect(await matchesAspect(await blankCanvas('9:16', '#FFFFFF'), '9:16')).toBe(true);
  });
});

describe('imageChangePrompt', () => {
  it('locks the picture and names only the change', () => {
    const prompt = imageChangePrompt('the germs are gone');
    expect(prompt).toContain('Change only this: the germs are gone');
    expect(prompt).toContain('same camera angle');
  });
});

describe('composeImageScene', () => {
  it('passes the scene code validator', () => {
    const code = composeImageScene(storyboard, 0, ['/api/projects/p/assets/scene-1-image.png'], [{ from: 0, pose: 0, box: null, label: null }]);
    expect(validateSceneCode(code, 'Scene1.tsx')).toMatchObject({ valid: true });
    expect(code).toContain('/api/projects/p/assets/scene-1-image.png');
  });
});

describe('generateImage', () => {
  it('asks for a portrait image on vertical videos', async () => {
    const fetchMock = prepareFetch(imageResponse());
    expect((await generateImage('prompt', '9:16')).toString()).toBe('png');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).size).toBe('1024x1792');
  });

  it('sends a reference only when redrawing a picture', async () => {
    const fetchMock = prepareFetch(imageResponse(), imageResponse());
    await generateImage('prompt', '9:16');
    await generateImage('prompt', '9:16', Buffer.from('ref'));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).image).toBeUndefined();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).image).toBe(`data:image/png;base64,${Buffer.from('ref').toString('base64')}`);
  });

  it('retries a busy router', async () => {
    const fetchMock = prepareFetch(new Response('', { status: 503 }), imageResponse());
    await generateImage('prompt', '9:16');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a request the router rejects', async () => {
    const fetchMock = prepareFetch(new Response('', { status: 404 }));
    await expect(generateImage('prompt', '9:16')).rejects.toThrow('HTTP 404');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
