import type { SocialCaption } from '@/types/studio';

/** Shared by the caption route and the editor. */
export const MAX_CAPTION_GENERATIONS = 5;
const MAX_HASHTAGS = 5;

/** A download name people can recognize, such as "perjalanan-kopi-nusantara.mp4". */
export function videoFileName(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return `${slug || 'video-gmotion'}.mp4`;
}

/** Hashtags as one word each, without the #, duplicates, or anything that is not a letter or digit. */
export function cleanHashtags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const word = tag.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '');
    if (word.length < 2 || word.length > 30 || /^\d+$/.test(word) || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    result.push(word);
    if (result.length === MAX_HASHTAGS) break;
  }
  return result;
}

export function captionToText(caption: Pick<SocialCaption, 'text' | 'hashtags'>): string {
  return caption.hashtags.length ? `${caption.text}\n\n${caption.hashtags.map((tag) => `#${tag}`).join(' ')}` : caption.text;
}


export const YOUTUBE_TITLE_LIMIT = 100;
export const YOUTUBE_TAGS_LIMIT = 500;

/** YouTube cuts titles at 100 characters; a cut lands on a word boundary. */
export function clampYoutubeTitle(title: string): string {
  const clean = title.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= YOUTUBE_TITLE_LIMIT) return clean;
  const cut = clean.slice(0, YOUTUBE_TITLE_LIMIT + 1);
  const space = cut.lastIndexOf(' ');
  return (space > 40 ? cut.slice(0, space) : clean.slice(0, YOUTUBE_TITLE_LIMIT)).trim();
}

/**
 * YouTube tags are search phrases, so spaces are allowed. YouTube counts the comma list
 * and wraps multi-word tags in quotes, so the limit is checked on that form.
 */
export function cleanYoutubeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  let length = 0;
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const phrase = tag.replace(/^#+/, '').replace(/[<>,"]/g, '').replace(/\s+/g, ' ').trim();
    if (phrase.length < 2 || phrase.length > 60 || seen.has(phrase.toLowerCase())) continue;
    const cost = (result.length ? 1 : 0) + phrase.length + (phrase.includes(' ') ? 2 : 0);
    if (length + cost > YOUTUBE_TAGS_LIMIT) break;
    seen.add(phrase.toLowerCase());
    result.push(phrase);
    length += cost;
  }
  return result;
}

export const youtubeTagsText = (tags: string[]) => tags.join(', ');
