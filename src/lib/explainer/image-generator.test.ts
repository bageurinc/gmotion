import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import sharp from 'sharp';
import { blankCanvas, generateImage, imageChangePrompt, imageModel, matchesAspect, pixelate, sceneImagePrompt } from './image-generator';
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

describe('pixel art style', () => {
  it('swaps only the style lines of the prompt', () => {
    const pixel = sceneImagePrompt({ ...storyboard, artStyle: 'pixel' }, 0);
    expect(pixel).toContain('pixel art');
    expect(pixel).not.toContain('Flat editorial vector');
    expect(pixel).toContain('no text');
    expect(sceneImagePrompt(storyboard, 0)).toContain('Flat editorial vector');
  });

  it('snaps a smooth picture onto a square grid with few colors at full size', async () => {
    const width = 768;
    const height = 1376;
    const gradient = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = (y * width + x) * 3;
        gradient[at] = Math.round((x / width) * 255);
        gradient[at + 1] = Math.round((y / height) * 255);
        gradient[at + 2] = 128;
      }
    }
    const smooth = await sharp(gradient, { raw: { width, height, channels: 3 } }).png().toBuffer();
    const out = await pixelate(smooth, '9:16');
    const { data, info } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([width, height]);
    const colors = new Set<string>();
    for (let at = 0; at < data.length; at += 3) colors.add(`${data[at]},${data[at + 1]},${data[at + 2]}`);
    expect(colors.size).toBeLessThanOrEqual(32);
    // 768 / 180 is about 4.3, so neighbouring screen pixels inside one grid cell share a color.
    const row = data.subarray(0, width * 3);
    let runs = 1;
    for (let x = 1; x < width; x += 1) if (row[x * 3] !== row[(x - 1) * 3]) runs += 1;
    expect(runs).toBeLessThanOrEqual(180);
  });

  it('marks the stage pixelated and still passes the validator', () => {
    const code = composeImageScene({ ...storyboard, artStyle: 'pixel' }, 0, ['/a.png'], [{ from: 0, pose: 0, box: null, label: null }]);
    expect(code).toContain(' pixelated>');
    expect(validateSceneCode(code, 'Scene1.tsx')).toMatchObject({ valid: true });
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
