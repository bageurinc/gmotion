import { generateText } from 'ai';
import { z } from 'zod';
import { getDirectorModel, isApiKeyConfigured } from '@/lib/ai/llm-client';
import { DataVisualSchema, type SceneSpec, type Storyboard } from '@/types/studio';
import { COPY_ANTI_SLOP_RULES } from './anti-slop';
import { durationInstruction, wantsCallToAction } from './director-agent';
import { durationBudget, estimateStoryboardSeconds, MAX_DRAFT_SCENES, parseTargetDurationSeconds, WORDS_PER_SECOND } from './draft';

/** Draft revisions happen before payment, so each draft gets a fixed number. */
export const MAX_DRAFT_REVISIONS = 10;

const RevisedSceneSchema = z.object({
  id: z.string().max(80).nullish(),
  title: z.string().trim().min(1).max(80),
  voiceoverText: z.string().trim().min(1).max(800),
  kineticHeadline: z.string().trim().max(120).default(''),
  headlineFocus: z.string().max(60).nullish(),
  visualPrompt: z.string().trim().max(1200).default(''),
  role: z.enum(['narrative', 'cta']).catch('narrative'),
  dataVisual: z.unknown().optional(),
});

const RevisedDraftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(300).default(''),
  scenes: z.array(RevisedSceneSchema).min(1).max(MAX_DRAFT_SCENES),
});

const DRAFT_REVISION_PROMPT = `You revise the storyboard draft of a short motion graphic video narrated in Bahasa Indonesia.
Apply the user's instruction to the draft and return the whole revised draft. Change only what the instruction asks for; keep every other scene, sentence, and fact as it is.
- Keep the "id" of every scene you keep, even when you rewrite or move it. A new scene has "id": null. A removed scene is left out.
- Narration is natural, conversational Bahasa Indonesia, 1 to 3 sentences per scene. kineticHeadline is 3 to 6 words. visualPrompt is 1 to 2 plain Indonesian sentences describing what is on screen and what moves.
- Scene titles name the actual content. Never use generic titles such as Hook, Mechanism, Proof, or CTA.
- Use role "cta" only for a final call-to-action scene, and only when CTA allowed is true.
- A scene may keep or add "dataVisual" only if every number in it is spoken in that scene's narration.
- Between 1 and ${MAX_DRAFT_SCENES} scenes.
${COPY_ANTI_SLOP_RULES}
"summary" tells the user in one short Indonesian sentence what you changed.
Output only JSON: {"title": "...", "summary": "...", "scenes": [{"id": "scene-1-narrative" or null, "title": "...", "voiceoverText": "...", "kineticHeadline": "...", "headlineFocus": "...", "visualPrompt": "...", "role": "narrative", "dataVisual": {...} or omitted}]}`;

export type DraftRevisionResult = { storyboard: Storyboard; summary: string };

/**
 * Merges the model's scenes into the draft. Kept scenes keep their technical fields (camera,
 * sound, timelapse); new scenes start from safe defaults. Ids are normalized later by generation.
 */
export function applyRevisedDraft(storyboard: Storyboard, text: string, allowCta: boolean): DraftRevisionResult | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const parsed = RevisedDraftSchema.safeParse(raw);
  if (!parsed.success) return null;

  const existing = new Map(storyboard.scenes.map((scene) => [scene.id, scene]));
  const used = new Set<string>();
  const stamp = Date.now();
  const scenes = parsed.data.scenes.map((item, index): SceneSpec => {
    const kept = item.id && !used.has(item.id) ? existing.get(item.id) : undefined;
    if (kept) used.add(kept.id);
    const base: SceneSpec = kept ?? {
      id: `scene-new-${stamp}-${index}`,
      order: index + 1,
      role: 'narrative',
      title: '',
      voiceoverText: '',
      kineticHeadline: '',
      visualPrompt: '',
      cameraAction: 'slow-push',
      sfxCue: 'whoosh',
      durationInFrames: 120,
      wordTimings: [],
    };
    const dataVisual = item.dataVisual === undefined ? base.dataVisual : DataVisualSchema.safeParse(item.dataVisual).data;
    return {
      ...base,
      order: index + 1,
      role: item.role === 'cta' && allowCta ? 'cta' : 'narrative',
      title: item.title,
      voiceoverText: item.voiceoverText,
      kineticHeadline: item.kineticHeadline,
      headlineFocus: item.headlineFocus ?? undefined,
      visualPrompt: item.visualPrompt,
      dataVisual,
      // Narration changed, so earlier timings no longer apply.
      wordTimings: kept && kept.voiceoverText === item.voiceoverText ? base.wordTimings : [],
    };
  });
  return { storyboard: { ...storyboard, title: parsed.data.title, scenes }, summary: parsed.data.summary };
}

export async function reviseDraft(storyboard: Storyboard, instruction: string, userPrompt: string): Promise<DraftRevisionResult> {
  if (!isApiKeyConfigured()) throw new Error('AI belum tersedia. Ubah draf secara manual dulu.');
  const allowCta = wantsCallToAction(`${userPrompt} ${instruction}`);
  const target = parseTargetDurationSeconds(instruction);
  const draft = {
    title: storyboard.title,
    scenes: storyboard.scenes.map(({ id, role, title, voiceoverText, kineticHeadline, headlineFocus, visualPrompt, dataVisual }) => ({
      id, role, title, voiceoverText, kineticHeadline, headlineFocus, visualPrompt, ...(dataVisual ? { dataVisual } : {}),
    })),
  };
  const prompt = `Original video prompt: ${JSON.stringify(userPrompt)}
CTA allowed: ${allowCta}
Current length: about ${Math.round(estimateStoryboardSeconds(storyboard.scenes))} seconds, read at about ${WORDS_PER_SECOND} words per second.
Current draft:
${JSON.stringify(draft, null, 2)}

User instruction: ${JSON.stringify(instruction)}${target ? durationInstruction(durationBudget(target)) : ''}`;

  // One retry, because a rejected answer costs the user a revision with nothing to show.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await generateText({ model: getDirectorModel(), system: DRAFT_REVISION_PROMPT, prompt });
    const result = applyRevisedDraft(storyboard, response.text, allowCta);
    if (result) return result;
    console.warn(`[DraftRevision] Answer ${attempt + 1} was not a valid draft.`);
  }
  throw new Error('AI belum berhasil mengubah draf. Coba tulis instruksinya dengan cara lain.');
}
