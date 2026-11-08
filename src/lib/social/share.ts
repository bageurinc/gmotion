import { generateText } from 'ai';
import { getDirectorModel, isApiKeyConfigured } from '@/lib/ai/llm-client';
import { COPY_ANTI_SLOP_RULES } from '@/lib/pipeline/anti-slop';
import { wantsCallToAction } from '@/lib/pipeline/director-agent';
import type { StudioProject } from '@/types/studio';
import { clampYoutubeTitle, cleanHashtags, cleanYoutubeTags } from './format';

export { MAX_CAPTION_GENERATIONS } from './format';

export interface CaptionDraft {
  text: string;
  hashtags: string[];
  youtubeTitle: string;
  youtubeTags: string[];
}

export function parseCaption(text: string, fallbackTitle = ''): CaptionDraft | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as { caption?: unknown; hashtags?: unknown; youtubeTitle?: unknown; youtubeTags?: unknown };
    const caption = typeof raw.caption === 'string' ? raw.caption.replace(/#\S+/g, '').trim() : '';
    if (!caption) return null;
    const title = typeof raw.youtubeTitle === 'string' && raw.youtubeTitle.trim() ? raw.youtubeTitle : fallbackTitle;
    return {
      text: caption.slice(0, 600),
      hashtags: cleanHashtags(raw.hashtags),
      youtubeTitle: clampYoutubeTitle(title.replace(/#\S+/g, '')),
      youtubeTags: cleanYoutubeTags(raw.youtubeTags),
    };
  } catch {
    return null;
  }
}

/** Without the model, the title and first sentence still make an honest caption. */
export function fallbackCaption(project: Pick<StudioProject, 'storyboard'>): CaptionDraft {
  const first = project.storyboard.scenes.find((scene) => scene.voiceoverText.trim())?.voiceoverText.trim() ?? '';
  return {
    text: [project.storyboard.title, first].filter(Boolean).join('\n\n'),
    hashtags: [],
    youtubeTitle: clampYoutubeTitle(project.storyboard.title),
    youtubeTags: [],
  };
}

const CAPTION_SYSTEM_PROMPT = `You write the post caption for a short vertical video, in natural Bahasa Indonesia.
- 2 to 4 short sentences. Open with a line that makes people want to watch, taken from the video's real content.
- Only use facts, numbers, and claims that appear in the narration. Do not add statistics, prices, promos, or testimonials.
- Add a call to action only if CTA allowed is true, and only with the offer stated in the narration.
- At most 2 emoji, and only if they suit the topic. No hashtags inside the caption.
- 3 to 5 hashtags that name the topic, without the # sign. No generic tags such as fyp, viral, or trending.
- "youtubeTitle": a YouTube Shorts title in Bahasa Indonesia, at most 70 characters, clear and specific to the content, without hashtags, clickbait, or ALL CAPS.
- "youtubeTags": 6 to 12 search phrases people would type to find this video, in Bahasa Indonesia, 1 to 4 words each, without the # sign.
${COPY_ANTI_SLOP_RULES}
Output only JSON: {"caption": "...", "hashtags": ["..."], "youtubeTitle": "...", "youtubeTags": ["..."]}`;

export async function writeCaption(project: Pick<StudioProject, 'storyboard' | 'userPrompt'>): Promise<CaptionDraft & { usedModel: boolean }> {
  if (!isApiKeyConfigured()) return { ...fallbackCaption(project), usedModel: false };
  try {
    const narration = project.storyboard.scenes.map((scene, i) => `${i + 1}. ${scene.voiceoverText}`).join('\n');
    const response = await generateText({
      model: getDirectorModel(),
      system: CAPTION_SYSTEM_PROMPT,
      prompt: `Video title: ${project.storyboard.title}
CTA allowed: ${wantsCallToAction(project.userPrompt)}
Narration:
${narration}`,
    });
    const parsed = parseCaption(response.text, project.storyboard.title);
    if (parsed) return { ...parsed, usedModel: true };
  } catch (error) {
    console.warn('[Social] Caption generation failed, using the title and first sentence:', error);
  }
  return { ...fallbackCaption(project), usedModel: false };
}
