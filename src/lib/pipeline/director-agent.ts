import { generateText } from 'ai';
import {
  Storyboard,
  SceneSpec,
  StoredPreset,
  StylePreset,
  AspectRatio,
  BgmTrackSchema,
  DataVisualSchema,
  TextStyleSchema,
  TimelapseKind,
  usesWorldEngine,
} from '@/types/studio';
import { getDirectorModel, isApiKeyConfigured } from '@/lib/ai/llm-client';
import { COPY_ANTI_SLOP_RULES, normalizePalette, VISUAL_ANTI_SLOP_RULES } from './anti-slop';
import {
  checkDurationFit,
  durationBudget,
  MAX_DRAFT_SCENES,
  parseTargetDurationSeconds,
  WORDS_PER_SECOND,
  type DurationBudget,
} from './draft';

const BGM_MOODS: Record<Storyboard['bgmTrack'], string> = {
  'dark-tech-pulse': 'dark rhythmic bed for AI, cybersecurity, and industrial technology',
  'upbeat-saas': 'clean, steady groove for software demos and business workflows',
  'warm-acoustic': 'soft, warm mallet notes for food, crafts, and everyday stories',
  'cinematic-story': 'slow, dramatic chords for narrative with stakes or a turning point',
  'calm-focus': 'quiet, sparse accompaniment for dense or technical explanations',
  'playful-plucks': 'bouncy plucks for humor, children, and lighthearted stories',
  'documentary-tension': 'spaced minor-key plucks for investigations, risk, or suspense',
  'bright-drive': 'fast, bright plucks for energetic promos, launches, or sport',
  'soft-ambient': 'slow, sparse plucks for quiet reflection, meditation, or sensitive subjects',
  'lofi-study': 'laid-back groove with jazzy chords for study routines or relaxed tutorials',
  'curiosity-steps': 'spaced, questioning notes for a discovery, experiment, or surprising mechanism',
  'nature-dawn': 'gentle, open chords for wildlife, landscapes, or the environment',
  'historical-reflection': 'restrained minor chords for history and reflective retrospectives',
  'hopeful-finale': 'rising major progression for recovery, progress, or personal achievement',
  'minimal-luxury': 'sparse, polished rhythm for design, premium products, or interiors',
  'retro-arcade': 'quick, bright repeating notes for games, retro computing, or internet culture',
  none: 'silence when the user asks for it or when music would be inappropriate',
};

const DIRECTOR_SYSTEM_PROMPT = `
You are a Creative Video Director and subject-matter researcher for short-form motion graphics, educational content, storytelling, and advertisements. Match the user's purpose; do not turn ordinary content into a sales pitch.

Your task is to turn a simple prompt into a complete Motion Graphic Storyboard whose structure comes from the topic itself.

CRITICAL RULES:
1. STRUCTURE FOLLOWS THE TOPIC:
   - Choose between 3 and 12 scenes. Use as many as the subject needs to be truly understood.
   - For a process, how-to, or explanation: give every real stage its own scene, in the correct real-world order. Do not skip or merge important stages.
   - For a story or history: follow its real sequence of events.
   - For an advertisement or promotion: use the structure that sells best, and end with a CTA.
   - If the user lists scenes or stages, keep that exact list and order.
   - If the user states a target duration, fit the scene count and narration length to it.
   - Never use a fixed template such as hook, mechanism, proof, CTA.
   - Each scene title names its actual content using correct domain terms, such as "Survei & Uji Tanah" or "Pengecoran Pondasi". Generic titles such as Hook, Mechanism, Proof, Result, or Resolution are forbidden.
   - Each scene teaches something specific that the previous scene did not. State real terms, components, and steps. Do not invent statistics.
   - Scene 1 opens with something that makes people keep watching, while already belonging to the topic.
   - Use role "narrative" for every scene. Use role "cta" only for a final CTA scene, and only if the user explicitly requests one or asks for an advertisement or promotion.

2. LANGUAGE & VOICE:
   - Voiceover MUST be in natural Bahasa Indonesia, 1-3 sentences per scene.
   - Conversational, authoritative, yet approachable Indonesian.
   - Kinetic headline must be brief (3-6 punchy words).
   - visualPrompt MUST be in plain Bahasa Indonesia that a non-technical user can review and edit. In 1-2 sentences, describe the concrete objects on screen and what moves. Prefer explanatory visuals such as cross-sections, cutaways, zoom-ins, and step-by-step assembly over abstract shapes.

${VISUAL_ANTI_SLOP_RULES}
${COPY_ANTI_SLOP_RULES}

BACKGROUND MUSIC:
Choose one bgmTrack for the whole video. Honor the user's music preference and match the tone and pace of the narration. For dense narration favor sparse accompaniment. Use the closest fit from the full catalog:
${BgmTrackSchema.options.map((track) => `- ${track}: ${BGM_MOODS[track]}`).join('\n')}

3. FORMAT REQUIREMENT:
   Output ONLY valid JSON matching this schema:
   {
     "title": "Judul Video",
     "aspectRatio": "9:16",
     "fps": 30,
     "bgmTrack": "one track ID from BACKGROUND MUSIC above",
     "look": "dark or bright, whichever suits this topic",
     "textStyle": "one of tegas, teknis, editorial, ramah; see TEXT AND DATA",
     "palette": {
       "background": "<hex drawn from this subject>",
       "surface": "<hex>",
       "primary": "<hex>",
       "secondary": "<hex>",
       "alert": "<hex>",
       "text": "<hex readable on background>"
     },
     "scenes": [
       {
         "id": "scene-1-hook",
         "order": 1,
         "role": "hook",
         "title": "Scene 1: Hook Title",
         "voiceoverText": "Naskah narasi suara lengkap bahasa indonesia",
         "kineticHeadline": "TEKS HEADLINE BOLD",
         "headlineFocus": "the one word of kineticHeadline that carries the meaning",
         "visualPrompt": "Deskripsi visual yang mudah dipahami",
         "cameraAction": "macro-zoom-in (or slow-push, pan-parallax, tilt-3d, static, timelapse)",
         "sfxCue": "one of none, pop, whoosh, notification, cash-register, success; choose a sound that fits this scene's opening moment",
         "timelapse": { "kind": "day-night", "fromLabel": "06:00", "toLabel": "20:00" }
       }
     ]
   }

4. TIMELAPSE SUPPORT:
   - For scenes depicting the passage of time (e.g. sunrise to sunset, 24-hour cycle, plant growth, process progression), set cameraAction to "timelapse".
   - Optionally specify "timelapse": { "kind": "day-night" | "clock" | "growth" | "crowd" | "weather", "fromLabel": "06:00", "toLabel": "20:00" }.

5. TEXT AND DATA:
   - Choose one textStyle for the whole video. It sets the typeface and the matching designs for headlines and captions: "tegas" uses a strong scorecard for urgent or sporty topics; "teknis" uses a blue instrument label for engineering and science; "editorial" uses an archive paper card for history, culture, and calm storytelling; "ramah" uses a warm rounded label for everyday life, food, and light topics.
   - A scene MAY add "dataVisual" when it truly helps. It is optional, and most scenes should not have one. Leave it out rather than forcing it.
   - Use one of: { "kind": "stat", "value": "28", "unit": "persen", "label": "short label" } for one number; { "kind": "compare", "unit": "meter", "items": [{ "label": "...", "value": "12" }] } for 2 to 4 comparable numbers; { "kind": "steps", "items": ["...", "..."] } for 2 to 4 short stages in order.
   - Every number must be spoken in that scene's voiceoverText, written in digits, with the same unit. Never invent a number just to fill a card. A dataVisual with an unspoken number is thrown away.
`;

/**
 * Robust parser that can parse both JSON objects and structured Markdown responses
 * from LLMs (such as Gemini or DeepSeek that might format output as markdown headings).
 */
function parseStoryboardRaw(
  text: string,
  userPrompt: string,
  preset: StoredPreset,
  aspectRatio: AspectRatio
): Storyboard | null {
  // 1. Try finding a JSON object block
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj.scenes && Array.isArray(obj.scenes) && obj.scenes.length >= 2) {
        const scenes = obj.scenes.slice(0, MAX_DRAFT_SCENES);
        return {
          title: obj.title || userPrompt.slice(0, 40),
          preset,
          aspectRatio: (obj.aspectRatio as AspectRatio) || aspectRatio,
          fps: obj.fps || 30,
          bgmTrack: BgmTrackSchema.safeParse(obj.bgmTrack).data ?? (isAdsPreset(preset) ? 'upbeat-saas' : 'warm-acoustic'),
          textStyle: TextStyleSchema.safeParse(obj.textStyle).data,
          textStyleSuggested: TextStyleSchema.safeParse(obj.textStyle).data,
          palette: normalizePalette({
            background: String(obj.palette?.background ?? ''),
            surface: String(obj.palette?.surface ?? ''),
            primary: String(obj.palette?.primary ?? ''),
            secondary: String(obj.palette?.secondary ?? ''),
            alert: String(obj.palette?.alert ?? ''),
            text: String(obj.palette?.text ?? ''),
          }, obj.look === 'dark' ? 'dark' : 'bright'),
          scenes: scenes.map((s: Record<string, unknown>, idx: number) => {
            const role = typeof s.role === 'string' && ['hook', 'problem', 'mechanism', 'proof', 'cta', 'narrative'].includes(s.role)
              ? (s.role as SceneSpec['role'])
              : 'narrative';

            return {
              id: typeof s.id === 'string' ? s.id : `scene-${idx + 1}-${role}`,
              order: typeof s.order === 'number' ? s.order : idx + 1,
              role,
              title: typeof s.title === 'string' ? s.title : `Scene ${idx + 1}`,
              voiceoverText: typeof s.voiceoverText === 'string' ? s.voiceoverText : `Narasi adegan ${idx + 1}`,
              kineticHeadline: typeof s.kineticHeadline === 'string' ? s.kineticHeadline : `HEADLINE ${idx + 1}`,
              visualPrompt: typeof s.visualPrompt === 'string' ? s.visualPrompt : '',
              cameraAction: (typeof s.cameraAction === 'string' && ['macro-zoom-in', 'slow-push', 'pan-parallax', 'tilt-3d', 'static', 'timelapse'].includes(s.cameraAction)
                ? s.cameraAction
                : 'macro-zoom-in') as SceneSpec['cameraAction'],
              sfxCue: (typeof s.sfxCue === 'string' && ['none', 'pop', 'whoosh', 'notification', 'cash-register', 'success'].includes(s.sfxCue)
                ? s.sfxCue
                : 'pop') as SceneSpec['sfxCue'],
              timelapse: s.timelapse && typeof s.timelapse === 'object' ? {
                kind: ['day-night', 'clock', 'growth', 'crowd', 'weather'].includes(String((s.timelapse as Record<string, unknown>).kind))
                  ? ((s.timelapse as Record<string, unknown>).kind as TimelapseKind)
                  : 'day-night',
                fromLabel: typeof (s.timelapse as Record<string, unknown>).fromLabel === 'string'
                  ? String((s.timelapse as Record<string, unknown>).fromLabel)
                  : undefined,
                toLabel: typeof (s.timelapse as Record<string, unknown>).toLabel === 'string'
                  ? String((s.timelapse as Record<string, unknown>).toLabel)
                  : undefined,
                easing: (s.timelapse as Record<string, unknown>).easing === 'linear' ? 'linear' as const : 'ease-in-out' as const,
              } : undefined,
              headlineFocus: typeof s.headlineFocus === 'string' ? s.headlineFocus : undefined,
              dataVisual: DataVisualSchema.safeParse(s.dataVisual).data,
              fixedDurationSec: typeof s.fixedDurationSec === 'number' ? s.fixedDurationSec : undefined,
              durationInFrames: typeof s.durationInFrames === 'number' ? s.durationInFrames : 120,
              wordTimings: Array.isArray(s.wordTimings) ? s.wordTimings : [],
            };
          }),
        };
      }
    } catch {
      // Ignore JSON parse failure and proceed to markdown parsing
    }
  }

  // 2. Parse Markdown structured output (e.g. SCENE 1: HOOK ... KineticHeadline: ... Voiceover: ...)
  const sceneBlocks = text.split(/SCENE\s*\d+:/i).slice(1, MAX_DRAFT_SCENES + 1);
  if (sceneBlocks.length >= 2) {
    const roles: Array<SceneSpec['role']> = ['hook', 'mechanism', 'proof', 'cta'];
    const validCamActions: Array<SceneSpec['cameraAction']> = [
      'macro-zoom-in',
      'slow-push',
      'pan-parallax',
      'tilt-3d',
      'static',
      'timelapse',
    ];

    const scenes: SceneSpec[] = [];
    sceneBlocks.forEach((block, idx) => {
      const headlineMatch =
        block.match(/KineticHeadline:\s*["']([^"']+)["']/i) ||
        block.match(/KineticHeadline:\s*([^\n]+)/i);
      const voMatch =
        block.match(/Voiceover:\s*["']([^"']+)["']/i) ||
        block.match(/Voiceover:\s*([^\n]+)/i);
      const camMatch = block.match(/CameraRig:\s*`?([a-zA-Z0-9-]+)`?/i);

      const headline = headlineMatch
        ? headlineMatch[1].replace(/["']/g, '').trim()
        : `Scene ${idx + 1}`;
      const voiceover = voMatch
        ? voMatch[1].replace(/["']/g, '').trim()
        : `Narasi untuk adegan ${idx + 1}`;
      const camRaw = camMatch ? camMatch[1] : '';
      const cam: SceneSpec['cameraAction'] = validCamActions.includes(camRaw as SceneSpec['cameraAction'])
        ? (camRaw as SceneSpec['cameraAction'])
        : idx === 0
        ? 'macro-zoom-in'
        : 'slow-push';

      const isTimelapseBlock = cam === 'timelapse' || /timelapse|timelap|time-lapse/i.test(block);

      scenes.push({
        id: `scene-${idx + 1}-${roles[idx] || 'narrative'}`,
        order: idx + 1,
        role: roles[idx] || 'narrative',
        title: headline.slice(0, 32),
        voiceoverText: voiceover,
        kineticHeadline: headline,
        visualPrompt: block.trim().slice(0, 300),
        cameraAction: cam,
        timelapse: isTimelapseBlock ? {
          kind: 'day-night',
          fromLabel: '06:00',
          toLabel: '20:00',
          easing: 'ease-in-out',
        } : undefined,
        sfxCue: idx === 0 ? 'pop' : idx === 3 ? 'success' : 'whoosh',
        durationInFrames: 120,
        wordTimings: [],
      });
    });

    return {
      title: userPrompt.slice(0, 40),
      preset,
      aspectRatio,
      fps: 30,
      bgmTrack: isAdsPreset(preset) ? 'dark-tech-pulse' : 'warm-acoustic',
      palette: {
        background: '#1A1D20',
        surface: '#24282D',
        primary: '#F59E0B',
        secondary: '#10B981',
        alert: '#EF4444',
        text: '#F9FAFB',
      },
      scenes,
    };
  }

  return null;
}

export function wantsCallToAction(prompt: string): boolean {
  if (/(?:tanpa|jangan|tidak perlu|tidak usah|no|without|bukan).{0,30}\b(?:cta|call.to.action|promosi|iklan|promotion)\b/i.test(prompt)) return false;
  return /\b(?:cta|call.to.action|iklan|promosi|advertisement|advertising|ads|marketing|jualkan|jualan)\b/i.test(prompt);
}

const isAdsPreset = (preset: StoredPreset) => preset === 'ads' || preset === 'ads-ui';

function applyCtaPolicy(storyboard: Storyboard, prompt: string): Storyboard {
  if (wantsCallToAction(prompt)) return storyboard;
  return { ...storyboard, scenes: storyboard.scenes.map(scene => scene.role !== 'cta' ? scene : {
    ...scene, role: 'narrative', title: 'Penutup Cerita',
    kineticHeadline: 'PELAJARAN DARI PERJALANAN INI',
    voiceoverText: 'Setiap langkah kecil membawa perubahan. Perjalanan ini mengingatkan kita untuk terus belajar dan bertumbuh.',
    visualPrompt: 'Visual penutup yang merangkum perjalanan dan pesan moral. Tanpa CTA, tombol, tautan, penawaran, atau promosi.',
  }) };
}

export function parseStoryboardFromLLMResponse(text: string, userPrompt: string, preset: StoredPreset, aspectRatio: AspectRatio): Storyboard | null {
  const storyboard = parseStoryboardRaw(text, userPrompt, preset, aspectRatio);
  // The model does not choose the preset, so the user's choice applies before the CTA policy.
  return storyboard ? applyCtaPolicy({ ...storyboard, preset }, userPrompt) : null;
}

const WORLD_DIRECTOR_NOTE = `
This video happens inside ONE continuous 3D world while a camera travels across it. Every scene is one camera stop. A story that moves between places treats them as neighboring areas of that world.
Write 5 to 8 scenes. Each voiceoverText is one short spoken sentence of at most 14 words. Use role "narrative" for every scene.`;

/**
 * Story 2D narration. It used to copy the 3D world note (5 to 8 scenes, one sentence of at most
 * 14 words), which turned a one-line prompt into a string of bare technical terms; most users
 * type only a title, so the director has to research and explain.
 */
const STORY_CANVAS_DIRECTOR_NOTE = `
This video is drawn as flat 2D illustrations of what the topic is really about, in one to three settings at their real scale: a heart topic shows the heart, a volcano topic the volcano erupting, a battery topic the battery. Every scene shows one clear change that explains its line. Add people only when the user asks for them or a human action is the point (cooking, farming, a daily habit); many topics have none. Keep the same things and settings across scenes.
NARRATION (most users type only a title, so you are the researcher and the writer):
- Build a complete explanation that a curious viewer with no background can follow from start to end.
- For an explanation or process: (1) open with a question or a familiar everyday moment that belongs to the topic; (2) show the problem or why it matters; (3) give every real stage or mechanism its own scene, explained as cause and effect ("karena...", "sehingga...", "akibatnya..."), so the viewer understands why each step happens, not only its name; (4) close by tying it together in plain words.
- For a story, history, or a person: follow the real sequence of events, and let each scene say what happens and why it matters.
- Describe a thing in everyday words first, then give its technical term. Never put two unexplained technical terms in one sentence. One concrete comparison from daily life is welcome where it makes a mechanism click.
- Every line must describe something that can be drawn and visibly changes, because each scene's picture explains its line.
- Write 7 to 12 scenes. Each voiceoverText is 1 to 2 natural spoken sentences, about 15 to 30 words; all scenes together about 110 to 220 words (roughly 50 to 100 seconds). If the user gives a full script or story, keep its content and order and only split it into scenes.
- Use role "narrative" for every scene.`;

/** Prompts long enough to carry their own content (a script, a story) skip the research step. */
const RESEARCH_PROMPT_LIMIT = 600;

/**
 * Research notes for a short Story 2D prompt, written before the storyboard so the narration
 * explains causes instead of listing terms. Returns null when it fails; the draft goes on without.
 */
export async function researchTopicNotes(userPrompt: string): Promise<string | null> {
  try {
    const response = await generateText({
      model: getDirectorModel(),
      system: 'You are a careful subject researcher preparing notes for an Indonesian explainer video. You only state well-established facts.',
      prompt: `Topic or request: "${userPrompt}"

Write research notes that a scriptwriter will turn into narration. Plain text, short bullet points, in Bahasa Indonesia:
- What it is, in one everyday sentence.
- The problem it solves or why it matters to an ordinary person.
- The real stages, parts, or mechanism in order, each with its cause and its effect.
- The correct technical terms, each with a plain explanation.
- One or two everyday comparisons that fit.
- Common misconceptions to avoid.
If the request is a story or history, list its events in order and what each one means instead.
Only well-established facts. No statistics, prices, dates, or names unless they are in the request or are textbook facts you are sure of. At most 250 words.`,
    });
    const notes = response.text.trim();
    return notes ? notes.slice(0, 3_000) : null;
  } catch (error) {
    console.warn('[DirectorAgent] Research notes failed, writing the draft without them:', error);
    return null;
  }
}

export function durationInstruction(budget: DurationBudget): string {
  return `
TARGET DURATION: ${budget.targetSeconds} seconds. The narration is read at about ${WORDS_PER_SECOND} words per second, and every scene adds a short pause.
Write ${budget.minScenes} to ${budget.maxScenes} scenes, and keep the total words of all voiceoverText together between ${budget.minWords} and ${budget.maxWords}. Count the words before answering. This overrides any other scene count guidance.`;
}

function durationCorrection(budget: DurationBudget, words: number, estimatedSeconds: number): string {
  const direction = estimatedSeconds > budget.targetSeconds ? 'Shorten' : 'Lengthen';
  return `
Your previous draft had ${words} narration words, about ${Math.round(estimatedSeconds)} seconds, but the user asked for ${budget.targetSeconds} seconds.
${direction} it: rewrite the whole storyboard so all voiceoverText together has ${budget.minWords} to ${budget.maxWords} words in ${budget.minScenes} to ${budget.maxScenes} scenes. Keep the facts and order; ${direction === 'Shorten' ? 'merge or drop the least important scenes' : 'explain each stage more fully'}.`;
}

export async function generateStoryboard(
  userPrompt: string,
  preset: StylePreset = 'ads-ui',
  aspectRatio: AspectRatio = '9:16',
  options: { strict?: boolean; libraryNote?: string } = {}
): Promise<Storyboard> {
  if (isApiKeyConfigured()) {
    try {
      const targetSeconds = parseTargetDurationSeconds(userPrompt);
      const budget = targetSeconds ? durationBudget(targetSeconds) : null;
      const notes = preset === 'story-canvas' && userPrompt.length < RESEARCH_PROMPT_LIMIT ? await researchTopicNotes(userPrompt) : null;
      const basePrompt = `Buat storyboard video motion graphic untuk:
Prompt: "${userPrompt}"
Style Preset: "${preset}"
Aspect Ratio: "${aspectRatio}"
CTA allowed: ${wantsCallToAction(userPrompt)}. If false, finish with a narrative conclusion and do not include commercial copy or a CTA scene.
FPS: 30${preset === 'story-canvas' ? STORY_CANVAS_DIRECTOR_NOTE : usesWorldEngine(preset) ? WORLD_DIRECTOR_NOTE : ''}${preset === 'story-svg' ? '\nFULL SVG: Every scene uses animated vector objects only, no raster images or image generation. Describe concrete object actions and state changes synchronized to the narration, with consistent objects across scenes. Camera movement and idle motion alone are not the action. When scenes explain parts of one object, such as the frame, dampers, and foundation of one building, write each visualPrompt as the camera moving into that part of the same object, not as a new separate drawing, cutaway card, or blueprint. Camera directions go only in visualPrompt: voiceoverText is what the narrator says and never mentions the camera, shots, or scenes.' : ''}${budget ? durationInstruction(budget) : ''}${options.libraryNote ? `\n${options.libraryNote}` : ''}${notes ? `\n\nRESEARCH NOTES (build the narration from these; add no claims beyond them and common knowledge):\n${notes}` : ''}`;
      const ask = async (extra = '') => {
        const response = await generateText({ model: getDirectorModel(), system: DIRECTOR_SYSTEM_PROMPT, prompt: basePrompt + extra });
        return parseStoryboardFromLLMResponse(response.text, userPrompt, preset, aspectRatio);
      };

      let parsed = await ask();
      if (parsed && budget) {
        const fit = checkDurationFit(parsed.scenes, budget.targetSeconds);
        if (!fit.onTarget) {
          // One correction round only: it costs one more director call and roughly doubles draft time.
          const retried = await ask(durationCorrection(budget, fit.words, fit.estimatedSeconds)).catch(() => null);
          const retriedFit = retried ? checkDurationFit(retried.scenes, budget.targetSeconds) : null;
          console.info(`[DirectorAgent] Duration target ${budget.targetSeconds}s: first draft ${fit.estimatedSeconds.toFixed(1)}s, correction ${retriedFit ? `${retriedFit.estimatedSeconds.toFixed(1)}s` : 'failed'}.`);
          if (retried && retriedFit && Math.abs(retriedFit.estimatedSeconds - budget.targetSeconds) < Math.abs(fit.estimatedSeconds - budget.targetSeconds)) {
            parsed = retried;
          }
        }
      }

      if (parsed) return parsed;
      if (options.strict) throw new Error('AI belum berhasil menyusun draf. Coba lagi.');
      console.warn('[DirectorAgent] Could not parse LLM output, falling back to procedural storyboard generator.');
    } catch (error) {
      if (options.strict) throw error;
      console.warn('[DirectorAgent] LLM generation failed, falling back to procedural storyboard generator:', error);
    }
  }

  // The procedural templates are written around the classic presets.
  const fallback = generateProceduralStoryboard(userPrompt, preset === 'ads-ui' ? 'ads-ui' : 'story-2d', aspectRatio);
  return { ...fallback, preset };
}

/**
 * High-quality procedural fallback storyboard generator
 */
export function generateProceduralStoryboard(
  userPrompt: string,
  preset: StoredPreset,
  aspectRatio: AspectRatio
): Storyboard {
  return applyCtaPolicy({ ...generateProceduralStoryboardBase(userPrompt, preset, aspectRatio), preset }, userPrompt);
}

function generateProceduralStoryboardBase(
  userPrompt: string,
  preset: StoredPreset,
  aspectRatio: AspectRatio
): Storyboard {
  const isConstruction = /gedung|bangun|konstruksi|lantai|tower|arsitektur|building|skyscraper/i.test(userPrompt);
  const isPlant = /tanaman|pohon|bunga|tumbuh|benih|plant|tree|flower|nature|sprout/i.test(userPrompt);
  const isDayNight = /siang ke malam|fajar|senja|sunset|sunrise|langit|matahari|bintang/i.test(userPrompt);
  const isTimelapse = /timelapse|timelap|time-lapse/i.test(userPrompt) || isDayNight;

  if (isTimelapse && isConstruction) {
    return {
      title: 'Timelapse Pembangunan Gedung Bertingkat',
      preset: preset === 'ads-ui' ? 'ads-ui' : 'story-2d',
      aspectRatio,
      fps: 30,
      bgmTrack: 'dark-tech-pulse',
      palette: {
        background: '#0F172A',
        surface: '#1E293B',
        primary: '#38BDF8',
        secondary: '#0284C7',
        alert: '#EF4444',
        text: '#F8FAFC',
      },
      scenes: [
        {
          id: 'scene-1-hook',
          order: 1,
          role: 'hook',
          title: 'Fondasi Awal Proyek',
          voiceoverText: 'Setiap karya arsitektur megah berawal dari pondasi kokoh yang ditanam jauh ke dalam bumi.',
          kineticHeadline: 'Fondasi Kokoh Mahakarya Megah',
          visualPrompt: 'Area proyek konstruksi dengan crane dan pondasi beton yang kokoh siap dibangun.',
          cameraAction: 'slow-push',
          sfxCue: 'whoosh',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-2-mechanism',
          order: 2,
          role: 'mechanism',
          title: 'Konstruksi Bertingkat Cepat',
          voiceoverText: 'Lantai demi lantai berdiri dengan presisi tinggi, membentuk siluet masa depan kota.',
          kineticHeadline: 'Pembangunan Lantai Demi Lantai',
          visualPrompt: 'Timelapse konstruksi gedung bertingkat menggunakan StagedReveal lantai naik, crane bergerak dengan PathMover, dan TimeHUD bar.',
          cameraAction: 'timelapse',
          timelapse: {
            kind: 'growth',
            fromLabel: 'Lantai 1',
            toLabel: 'Lantai 24',
            easing: 'ease-in-out',
          },
          sfxCue: 'pop',
          durationInFrames: 140,
          wordTimings: [],
        },
        {
          id: 'scene-3-proof',
          order: 3,
          role: 'proof',
          title: 'Struktur Pencakar Langit',
          voiceoverText: 'Menghadirkan efisiensi ruang dan estetika modern yang tahan uji lintas generasi.',
          kineticHeadline: 'Pencakar Langit Berdiri Kokoh',
          visualPrompt: 'Gedung modern berdiri megah dengan pantulan cahaya kaca biru dan penerangan arsitektural.',
          cameraAction: 'slow-push',
          sfxCue: 'notification',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-4-cta',
          order: 4,
          role: 'cta',
          title: 'Masa Depan Konstruksi',
          voiceoverText: 'Wujudkan pembangunan berkelas dengan standar rekayasa konstruksi terbaik hari ini.',
          kineticHeadline: 'Membangun Masa Depan Bersama',
          visualPrompt: 'Tampilan penutup sinematik dengan skyline gedung yang telah rampung dan badge penyelesaian.',
          cameraAction: 'slow-push',
          sfxCue: 'success',
          durationInFrames: 120,
          wordTimings: [],
        },
      ],
    };
  }

  if (isTimelapse && isPlant) {
    return {
      title: 'Timelapse Pertumbuhan Tanaman',
      preset: preset === 'ads-ui' ? 'ads-ui' : 'story-2d',
      aspectRatio,
      fps: 30,
      bgmTrack: 'warm-acoustic',
      palette: {
        background: '#022C22',
        surface: '#064E3B',
        primary: '#10B981',
        secondary: '#34D399',
        alert: '#F59E0B',
        text: '#ECFDF5',
      },
      scenes: [
        {
          id: 'scene-1-hook',
          order: 1,
          role: 'hook',
          title: 'Awal Sebuah Kehidupan',
          voiceoverText: 'Dari sebutir benih kecil di dalam tanah yang subur, keajaiban alam dimulai.',
          kineticHeadline: 'Keajaiban Benih Kecil',
          visualPrompt: 'Benih tertanam di dalam tanah hangat, siap untuk bertunas.',
          cameraAction: 'slow-push',
          sfxCue: 'whoosh',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-2-mechanism',
          order: 2,
          role: 'mechanism',
          title: 'Pertumbuhan Menuju Cahaya',
          voiceoverText: 'Tunas bertumbuh menembus bumi, daun bermekaran menyerap kehangatan mentari.',
          kineticHeadline: 'Tumbuh Subur Menuju Cahaya',
          visualPrompt: 'Timelapse tanaman menggunakan GrowAxis batang tumbuh, daun bermekaran via StagedReveal, dan TimeHUD progres.',
          cameraAction: 'timelapse',
          timelapse: {
            kind: 'growth',
            fromLabel: 'Hari 1',
            toLabel: 'Hari 30',
            easing: 'ease-in-out',
          },
          sfxCue: 'pop',
          durationInFrames: 135,
          wordTimings: [],
        },
        {
          id: 'scene-3-proof',
          order: 3,
          role: 'proof',
          title: 'Bunga Bermekaran Sempurna',
          voiceoverText: 'Kuncup bunga membuka kelopaknya perlahan, memancarkan pesona keindahan alami.',
          kineticHeadline: 'Bunga Mekar Sempurna',
          visualPrompt: 'Bunga mekar penuh dengan kelopak berwarna cerah dan dedaunan rimbun.',
          cameraAction: 'macro-zoom-in',
          sfxCue: 'notification',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-4-cta',
          order: 4,
          role: 'cta',
          title: 'Harmoni Bersama Alam',
          voiceoverText: 'Rawat setiap pertumbuhan dengan sabar, karena proses terbaik butuh waktu.',
          kineticHeadline: 'Tumbuh Indah Bersama Waktu',
          visualPrompt: 'Pemandangan alam asri yang damai dengan tanaman hijau yang tumbuh subur.',
          cameraAction: 'slow-push',
          sfxCue: 'success',
          durationInFrames: 120,
          wordTimings: [],
        },
      ],
    };
  }

  if (isTimelapse) {
    return {
      title: 'Timelapse Perjalanan Dari Fajar Hingga Malam',
      preset: preset === 'ads-ui' ? 'ads-ui' : 'story-2d',
      aspectRatio,
      fps: 30,
      bgmTrack: preset === 'ads-ui' ? 'dark-tech-pulse' : 'cinematic-story',
      palette: {
        background: '#090D16',
        surface: '#1E293B',
        primary: '#F59E0B',
        secondary: '#38BDF8',
        alert: '#EF4444',
        text: '#F8FAFC',
      },
      scenes: [
        {
          id: 'scene-1-hook',
          order: 1,
          role: 'hook',
          title: 'Fajar Menyingsing',
          voiceoverText: 'Ketika sang fajar menyingsing, dunia mulai bergerak menyambut hari yang baru.',
          kineticHeadline: 'Fajar Menyingsing Penuh Harapan',
          visualPrompt: 'DayNightSky dengan semburat fajar jingga keemasan dan matahari mulai terbit di cakrawala.',
          cameraAction: 'slow-push',
          sfxCue: 'whoosh',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-2-mechanism',
          order: 2,
          role: 'mechanism',
          title: 'Timelapse Putaran Waktu',
          voiceoverText: 'Waktu bergulir begitu cepat, dari terik siang hingga senja keemasan menghiasi langit.',
          kineticHeadline: 'Siklus Waktu Terus Berputar',
          visualPrompt: 'Timelapse siang ke malam menggunakan DayNightSky dan TimelapseClock berputar dari 06:00 hingga 20:00.',
          cameraAction: 'timelapse',
          timelapse: {
            kind: 'day-night',
            fromLabel: '06:00',
            toLabel: '20:00',
            easing: 'ease-in-out',
          },
          sfxCue: 'pop',
          durationInFrames: 135,
          wordTimings: [],
        },
        {
          id: 'scene-3-proof',
          order: 3,
          role: 'proof',
          title: 'Malam Berbintang',
          voiceoverText: 'Dan malam pun tiba, membawa ribuan bintang berkilau dan kedamaian tanpa batas.',
          kineticHeadline: 'Malam Berbintang Penuh Makna',
          visualPrompt: 'Langit malam dengan bulan purnama, gugusan bintang bersinar dan siluet gedung megah.',
          cameraAction: 'slow-push',
          sfxCue: 'notification',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-4-cta',
          order: 4,
          role: 'cta',
          title: 'Renungan Waktu',
          voiceoverText: 'Setiap detik adalah cerita berharga dalam perjalanan hidup kita.',
          kineticHeadline: 'Hargai Setiap Detik Waktu',
          visualPrompt: 'Penutup estetik dengan siluet pemandangan dan refleksi inspiratif tentang waktu.',
          cameraAction: 'slow-push',
          sfxCue: 'success',
          durationInFrames: 120,
          wordTimings: [],
        },
      ],
    };
  }

  const isAds = preset === 'ads-ui';

  if (isAds) {
    return {
      title: 'WhatsApp AI Anti-Ghosting Fast Closing Ads',
      preset: 'ads-ui',
      aspectRatio,
      fps: 30,
      bgmTrack: 'dark-tech-pulse',
      palette: {
        background: '#090D16',
        surface: '#1E293B',
        primary: '#10B981', // WhatsApp emerald
        secondary: '#38BDF8', // Cyan glow
        alert: '#EF4444', // Red alert for ghosting
        text: '#F8FAFC',
      },
      scenes: [
        {
          id: 'scene-1-hook',
          order: 1,
          role: 'hook',
          title: 'Stop Ghosting Calon Pembeli',
          voiceoverText:
            'Capek iklan mahal-mahal tapi calon pembeli malah ghosting gara-gara telat dibalas?',
          kineticHeadline: 'Iklan Jalan Tapi Chat di-Ghosting?',
          visualPrompt:
            'Tampilkan PhoneMockup bergetar dengan WhatsAppChatSim. Muncul pesan calon pembeli lalu notifikasi merah bertuliskan GHOSTED 4 JAM TANPA BALASAN.',
          cameraAction: 'macro-zoom-in',
          sfxCue: 'pop',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-2-mechanism',
          order: 2,
          role: 'mechanism',
          title: 'Otomatisasi Respon AI 0.5 Detik',
          voiceoverText:
            'Gunakan WhatsApp AI Chatbot anti-ghosting. Balas ratusan chat serentak dalam 0,5 detik.',
          kineticHeadline: 'Balas Kilat 0.5 Detik Otomatis',
          visualPrompt:
            'Layar smartphone menampilkan percakapan interaktif WhatsApp. Saat pembeli bertanya, bot AI langsung membalas rekomendasi produk lengkap dan centang biru aktif.',
          cameraAction: 'tilt-3d',
          sfxCue: 'whoosh',
          durationInFrames: 135,
          wordTimings: [],
        },
        {
          id: 'scene-3-proof',
          order: 3,
          role: 'proof',
          title: 'Closing Rate Meroket',
          voiceoverText:
            'Hasilnya? Closing sales naik hingga 320% tanpa perlu lembur jaga WhatsApp!',
          kineticHeadline: 'Omzet Naik 320% Tanpa Lembur',
          visualPrompt:
            'MetricsDashboard futuristik: MetricCard menampilkan Closing Rate +320%, AnimatedCounter menghitung omzet hingga Rp 120.000.000, didukung TrendLineChart kurva hijau naik tajam.',
          cameraAction: 'slow-push',
          sfxCue: 'cash-register',
          durationInFrames: 120,
          wordTimings: [],
        },
        {
          id: 'scene-4-cta',
          order: 4,
          role: 'cta',
          title: 'Coba Gratis Sekarang',
          voiceoverText:
            'Yuk klik link di bawah sekarang juga dan klaim uji coba gratis 14 hari!',
          kineticHeadline: 'Coba Gratis Sekarang!',
          visualPrompt:
            'Tampilan penutup bold dengan PulseCTAButton berdenyut hijau neon, ikon panah klik mengarah ke bio dan badge jaminan garansi.',
          cameraAction: 'slow-push',
          sfxCue: 'success',
          durationInFrames: 120,
          wordTimings: [],
        },
      ],
    };
  }

  // 2D Illustrated Story Preset
  return {
    title: 'Perjalanan Biji Kopi Premium',
    preset: 'story-2d',
    aspectRatio,
    fps: 30,
    bgmTrack: 'warm-acoustic',
    palette: {
      background: '#1A1412',
      surface: '#2D221E',
      primary: '#D97706', // Warm amber coffee
      secondary: '#10B981', // Plantation green
      alert: '#F59E0B',
      text: '#FEF3C7',
    },
    scenes: [
      {
        id: 'scene-1-hook',
        order: 1,
        role: 'hook',
        title: 'Pucuk Daun Pagi Hari',
        voiceoverText:
          'Setiap cangkir kopi nikmat berawal dari kebun pegunungan yang diselimuti kabut pagi.',
        kineticHeadline: 'Aroma Alam Dari Kebun Pegunungan',
        visualPrompt:
          'ParallaxWorld memperlihatkan matahari terbit keemasan di balik perbukitan hijau dengan SvgParticles embun pagi yang melayang damai.',
        cameraAction: 'slow-push',
        sfxCue: 'whoosh',
        durationInFrames: 135,
        wordTimings: [],
      },
      {
        id: 'scene-2-mechanism',
        order: 2,
        role: 'mechanism',
        title: 'Petik Merah & Sangrai Sempurna',
        voiceoverText:
          'Hanya buah ceri merah terpilih yang dipetik manual lalu disangrai dengan presisi tinggi.',
        kineticHeadline: 'Dipetik Manual & Sangrai Presisi',
        visualPrompt:
          'Ilustrasi vektor biji kopi berputar di atas tungku pemanggang dengan uap aroma wangi dan percikan cahaya hangat.',
        cameraAction: 'macro-zoom-in',
        sfxCue: 'pop',
        durationInFrames: 130,
        wordTimings: [],
      },
      {
        id: 'scene-3-proof',
        order: 3,
        role: 'proof',
        title: 'Ekstraksi Cita Rasa Sempurna',
        voiceoverText:
          'Menghasilkan crema tebal dengan profil rasa manis karamel dan keasaman buah yang seimbang.',
        kineticHeadline: 'Karakter Rasa Khas Nusantara',
        visualPrompt:
          'Close-up cangkir kopi elegan dengan tetesan espresso kental dan uap mengepul yang mengalir membentuk siluet kepuasan.',
        cameraAction: 'slow-push',
        sfxCue: 'pop',
        durationInFrames: 130,
        wordTimings: [],
      },
      {
        id: 'scene-4-cta',
        order: 4,
        role: 'cta',
        title: 'Nikmati Hari Ini',
        voiceoverText:
          'Rasakan keajaiban cita rasa kopi nusantara asli langsung di rumah Anda hari ini.',
        kineticHeadline: 'Seduh Kopi Terbaikmu Hari Ini',
        visualPrompt:
          'Tampilan penutup estetik dengan logo kemasan kopi, PulseCTAButton bernuansa cokelat hangat dan tautan pesan sekarang.',
        cameraAction: 'slow-push',
        sfxCue: 'success',
        durationInFrames: 120,
        wordTimings: [],
      },
    ],
  };
}
