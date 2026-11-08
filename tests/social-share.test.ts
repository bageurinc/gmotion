import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as captionRoute } from '@/app/api/projects/[projectId]/caption/route';
import { generateProceduralStoryboard } from '@/lib/pipeline/director-agent';
import { captionToText, clampYoutubeTitle, cleanHashtags, cleanYoutubeTags, MAX_CAPTION_GENERATIONS, videoFileName, YOUTUBE_TAGS_LIMIT } from '@/lib/social/format';
import { fallbackCaption, parseCaption } from '@/lib/social/share';
import { getProject, saveProject } from '@/lib/storage/project-store';
import type { StudioProject } from '@/types/studio';
import { TEST_USER } from './setup-auth';

describe('social share helpers', () => {
  it('names the file after the title', () => {
    expect(videoFileName('Perjalanan Kopi Nusantara')).toBe('perjalanan-kopi-nusantara.mp4');
    expect(videoFileName('Café & Roti: 3 Langkah!')).toBe('cafe-roti-3-langkah.mp4');
    expect(videoFileName('!!!')).toBe('video-gmotion.mp4');
    expect(videoFileName('a'.repeat(100)).length).toBeLessThanOrEqual(64);
  });

  it('keeps hashtags as single topic words', () => {
    expect(cleanHashtags(['#Kopi', 'kopi', 'Kopi Nusantara', '2026', 'x', 42, 'Petani-Kopi', 'a', 'b1', 'c2', 'd3', 'e4']))
      .toEqual(['Kopi', 'KopiNusantara', 'PetaniKopi', 'b1', 'c2']);
    expect(cleanHashtags('kopi')).toEqual([]);
  });

  it('reads the model answer and keeps hashtags out of the caption text', () => {
    expect(parseCaption('```json\n{"caption":"Dari kebun ke cangkir. #kopi","hashtags":["kopi","petani"],"youtubeTitle":"Proses Kopi #shorts","youtubeTags":["#proses kopi","kopi"]}\n```'))
      .toEqual({ text: 'Dari kebun ke cangkir.', hashtags: ['kopi', 'petani'], youtubeTitle: 'Proses Kopi', youtubeTags: ['proses kopi', 'kopi'] });
    expect(parseCaption('{"caption":"Halo."}', 'Judul Video')).toMatchObject({ youtubeTitle: 'Judul Video', youtubeTags: [] });
    expect(parseCaption('{"caption":"","hashtags":[]}')).toBeNull();
    expect(parseCaption('bukan json')).toBeNull();
  });

  it('keeps YouTube titles within 100 characters on a word boundary', () => {
    const long = 'Kopi '.repeat(30).trim();
    const title = clampYoutubeTitle(long);
    expect(title.length).toBeLessThanOrEqual(100);
    expect(title.endsWith('Kopi')).toBe(true);
    expect(clampYoutubeTitle('  Judul   <b>  ')).toBe('Judul b');
  });

  it('keeps YouTube tags as unique phrases within the 500 character limit', () => {
    expect(cleanYoutubeTags(['#Kopi', 'kopi', 'proses "kopi"', 'a', 'x,y', 5])).toEqual(['Kopi', 'proses kopi', 'xy']);
    const many = Array.from({ length: 40 }, (_, i) => `tag kopi nomor ${i}`);
    const tags = cleanYoutubeTags(many);
    const counted = tags.map((tag) => (tag.includes(' ') ? tag.length + 2 : tag.length)).reduce((a, b) => a + b, 0) + tags.length - 1;
    expect(counted).toBeLessThanOrEqual(YOUTUBE_TAGS_LIMIT);
    expect(tags.length).toBeLessThan(40);
  });

  it('formats the caption with hashtags for pasting', () => {
    expect(captionToText({ text: 'Halo.', hashtags: ['kopi', 'roti'] })).toBe('Halo.\n\n#kopi #roti');
    expect(captionToText({ text: 'Halo.', hashtags: [] })).toBe('Halo.');
  });

  it('falls back to the title and first sentence', () => {
    const storyboard = generateProceduralStoryboard('Kopi', 'story-2d', '9:16');
    expect(fallbackCaption({ storyboard }).text).toBe(`${storyboard.title}\n\n${storyboard.scenes[0].voiceoverText}`);
  });
});

describe('caption route', () => {
  const id = `proj_caption_${Date.now()}`;
  const context = { params: Promise.resolve({ projectId: id }) };
  const call = () => captionRoute(new NextRequest('http://localhost/api', { method: 'POST' }), context);
  const base = {
    id, ownerId: TEST_USER.id, createdAt: 1, updatedAt: 1, userPrompt: 'Kopi', chatHistory: [], files: {},
    storyboard: generateProceduralStoryboard('Kopi', 'story-2d', '9:16'),
  };

  afterAll(() => fs.rmSync(path.join(process.cwd(), 'storage', 'projects', id), { recursive: true, force: true }));

  it('waits for a finished video', async () => {
    saveProject({ ...base, status: 'draft' } as StudioProject);
    expect((await call()).status).toBe(409);
  });

  it('writes and stores a caption, up to the limit', async () => {
    saveProject({ ...base, status: 'ready' } as StudioProject);
    const res = await call();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.socialCaption.text).toContain(base.storyboard.title);
    expect(body.socialCaption.youtubeTitle).toBe(clampYoutubeTitle(base.storyboard.title));
    expect(body.generationsLeft).toBe(MAX_CAPTION_GENERATIONS - 1);
    expect(getProject(id)?.socialCaption?.generatedCount).toBe(1);
    for (let i = 1; i < MAX_CAPTION_GENERATIONS; i++) expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(429);
  });
});
