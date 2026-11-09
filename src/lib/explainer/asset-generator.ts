import { recordUsage } from '@/lib/billing/usage';
import { AssetManifest, AssetManifestSchema, missingContractIds } from './asset-contract';
import { VISUAL_ANTI_SLOP_RULES } from '../pipeline/anti-slop';
import { validateSceneCode } from '../pipeline/code-validator';

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  seconds: number;
}

export interface GeneratedAsset {
  manifest: AssetManifest;
  code: string;
}

export interface AssetCritique {
  scores: {
    recognizability: number;
    illustrationRichness: number;
    viewConsistency: number;
    labelAccuracy: number;
    composition: number;
  };
  average: number;
  issues: string[];
}

type ChatContent = string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

export const ASSET_SYSTEM_PROMPT = `
You are a senior editorial vector illustrator and React engineer. You turn ANY topic into one reusable animated SVG asset for a premium vertical explainer video.

TOPIC HANDLING
- Physical subject: draw that subject.
- Process: draw one clear system where the process happens.
- Abstract concept or history: invent one concrete visual metaphor or diorama that holds the whole idea. Keep one dominant focal subject.
- Explanatory facts and labels must be accurate. All viewer-facing text in the manifest must be natural Bahasa Indonesia.

VISUAL STANDARD
Aim for polished semi-realistic textbook illustration:
- Layer every major form: base gradient, core shadow, reflected light, rim light, and specular highlights, then a variable-feeling outline in a darker shade of that form's own color.
- Use organic cubic Bezier paths. Avoid assembling the subject from plain circles and rectangles.
- Add believable secondary detail such as fibres, seams, panels, rivets, veins, droplets, grain, or texture lines.
- Use at least 60 meaningful shapes across the asset, and at least 25 in each view.
- Compose one large, connected subject that fills the canvas from about 40 to 960 on both axes. Do not scatter small objects across empty space.
- Every important object stays fully inside the canvas. Nothing meaningful may be cut off by the edge or placed outside it.
- The 1000 by 1000 canvas only bounds the subject. The video frame is much larger, and the area beyond the canvas stays visible. Ground, soil layers, road, floor, water, and any other environment surface must run from x=-1000 to x=2000, and anything below the surface must continue down to y=2000. They must never stop at the canvas edge or form a box, card, or diorama slice. Detail may stay near the subject, but the surface colors must continue.
- Every scene happens in a real place, so draw that place behind the subject and fill the whole frame, from x=-1000 to x=2000 and from y=-1000 to y=2000. A plain empty backdrop is a failure. Outdoors: sky with soft clouds, horizon, distant hills or buildings. Indoors: wall with wallpaper, panels, tiles, or brick, plus a window or shelf that fits the room. Other settings get their own: seabed water and light for the deep sea, stars for space, surrounding tissue inside a body. The setting must fit the topic and the moment in the narration.
- The headline sits over the area above y=100, so keep it a calm, low-contrast tone close to the palette background: open sky or plain wall, with no clouds, objects, or strong patterns there. Keep the setting quieter and lower in contrast than the subject, so the subject stays the clear focus.
- Each view must show a rich, finished picture on its own. A view that is mostly empty space, or only small icons, is a failure.
- Do not draw UI cards floating around the subject unless the subject is a screen.
- Keep the same silhouette, proportions, and light direction in all views. Later views reveal, cut open, or change state of the same subject.
- Build shape loops from data arrays when repeating texture.

${VISUAL_ANTI_SLOP_RULES}

SIZE BUDGET
Keep the whole answer under 14000 tokens. Do not think out loud. Spend the budget on the silhouette, lighting, and the most visible detail. Use small helpers and data arrays for repeated detail.

CODE CONTRACT
Output exactly two fenced blocks and nothing else: first \`\`\`json, then \`\`\`tsx.

The json block is the manifest:
{
  "topic": "...",
  "title": "SHORT HEADLINE",
  "subtitle": "short hook",
  "palette": { "backgroundFrom": "#...", "backgroundTo": "#...", "accent": "#...", "accentAlt": "#...", "text": "#..." },
  "heroFocus": { "x": 500, "y": 400, "scale": 2.2 },
  "views": [{ "id": "exterior", "label": "...", "description": "..." }, { "id": "cutaway", "label": "...", "description": "..." }],
  "parts": [{ "id": "partName", "label": "...", "views": ["cutaway"], "anchor": { "x": 300, "y": 420 }, "focus": { "x": 300, "y": 420, "scale": 1.9 } }],
  "flows": [{ "id": "mainFlow", "view": "cutaway", "d": "M 300 200 C ...", "color": "#..." }]
}

CHOREOGRAPHY MODE (when the request says FULL SVG CHOREOGRAPHY MODE):
- This overrides the multi-view/idle-only rules below: use exactly ONE persistent view.
- Add "choreography": [{"id":"actionName","description":"visible causal action","startWord":0,"endWord":4}]. Use only word indexes supplied in the request.
- The component props ALSO include actionProgress: Record<string, number>. Destructure it and drive real geometry from actionProgress.actionName ?? 0, in [0,1]. The stage handles timing and easing; time is only for secondary motion.
- No dissolving between before/after drawings. Draw each physical object once, animate its actual geometry/transform, retain the final state after each action. No automatic looping of the main action.
- The request adds SHARED WORLD and CAMERA rules. Follow them exactly: the same world must carry across every scene of the video, and the manifest gets a "camera" entry.
- Parts still identify the visible structures and react to highlight. Flows must describe a real route in the one view. Keep 3-10 parts, 1-6 flows.

Manifest rules (in choreography mode, the view count rule above replaces the view rules here):
- All coordinates use the 1000 by 1000 SVG viewBox.
- 2 to 4 views. The second view needs at least 2 parts and 1 flow.
- 3 to 10 parts. Every anchor must sit visually on that part. Every focus must frame that part.
- Flow paths must run through the visible structure they describe.
- title is at most 32 characters. subtitle is at most 64. Part labels are at most 28.

The tsx block must export this component:
import React from 'react';
export const Asset: React.FC<{ viewOpacity: Record<string, number>; highlight: Record<string, number>; time: number }> = ({ viewOpacity, highlight, time }) => { ... };
export default Asset;

Component rules:
- Return one <svg viewBox="0 0 1000 1000" width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>.
- Wrap each view in <g opacity={viewOpacity.viewId ?? 0}>. Use every manifest view id and part id literally in the code.
- Every part reacts to highlight.partId with a visible glow or brighter fill. Unhighlighted parts stay fully legible.
- Use Math.sin(time * ...) for subtle idle motion only. The object must remain stable.
- Prefix every gradient and filter id with "asset-".
- Do not draw text. The stage renders all text.
- Import only from 'react'. Do not use images, foreignObject, CSS animation, Math.random, Date.now, timers, fetch, window, or document.
`;

export const CRITIC_SYSTEM_PROMPT = `
You are a strict art director reviewing a generated vertical explainer scene. The image is a contact sheet of frames from one scene, in time order from left to right and top to bottom.
Score each criterion from 1 to 10:
- recognizability: the subject and topic are immediately understood.
- illustrationRichness: premium layered illustration with light, depth, and detail. A flat icon, clip art, or basic shapes scores 4 or lower. Dark images are fine when they suit the topic; penalize only murky images where the subject is hard to see.
- viewConsistency: frames show the same subject with the same proportions.
- labelAccuracy: labels point at the correct visible parts and facts are right.
- For choreography mode, penalize static objects, repeated idle loops, ghosted duplicate states, unreadable cause/effect, and actions inconsistent with the narrated words. Judge progression across frames, not just decorative detail.
- composition: one large clear subject fills the frame, there are no big empty areas or a nearly empty panel, nothing important is cut off, and text remains readable. Ground, water, or any environment surface that stops with a visible edge inside the frame instead of reaching the frame edges is a serious flaw: score composition 4 or lower and name it in issues. So is a plain backdrop with no setting: outdoor scenes need sky, clouds, or landscape, and indoor scenes need a wall surface. Score composition 4 or lower and name what to add.
- When the request says the scene has no part labels, never ask for labels or callouts, and score labelAccuracy on factual correctness alone.
- When the request says the first frame belongs to the previous scene, use it only as a reference and do not score it. Judge whether the second frame continues it: the same shared objects, in the same shape and place, in a matching pose. Lower viewConsistency for a visible jump and name it in issues.
Return only JSON: {"imageVisible":true,"scores":{"recognizability":0,"illustrationRichness":0,"viewConsistency":0,"labelAccuracy":0,"composition":0},"issues":["specific fix"]}.
Set imageVisible to false if you cannot see the frames.
List at most 8 issues, ordered by visual impact, and say exactly what to change.
`;

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_ROUTER_RETRIES = 6;
const ROUTER_RETRY_DELAY_MS = 100_000;

export async function callChat(options: {
  model: string;
  system: string;
  content: ChatContent;
  maxTokens: number;
  timeoutMs?: number;
}): Promise<{ text: string; finishReason: string; usage: LlmUsage }> {
  const baseUrl = (process.env.OPENAI_BASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!baseUrl || !apiKey) throw new Error('OPENAI_BASE_URL and OPENAI_API_KEY are required');

  const startedAt = Date.now();
  const send = () =>
    fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: options.model,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: options.maxTokens,
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: options.content },
        ],
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 20 * 60_000),
    });

  let response = await send();
  for (let attempt = 0; attempt < MAX_ROUTER_RETRIES && RETRYABLE_STATUS.has(response.status); attempt += 1) {
    await response.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, ROUTER_RETRY_DELAY_MS));
    response = await send();
  }
  if (!response.ok || !response.body) {
    recordUsage({ kind: 'chat', model: options.model, durationMs: Date.now() - startedAt, ok: false });
    throw new Error(`LLM request failed with HTTP ${response.status}`);
  }

  let text = '';
  let finishReason = '';
  let promptTokens = 0;
  let completionTokens = 0;
  let buffer = '';
  const decoder = new TextDecoder();
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const chunk = JSON.parse(payload);
        text += chunk.choices?.[0]?.delta?.content ?? '';
        finishReason = chunk.choices?.[0]?.finish_reason ?? finishReason;
        promptTokens = chunk.usage?.prompt_tokens ?? promptTokens;
        completionTokens = chunk.usage?.completion_tokens ?? completionTokens;
      } catch {
        // Routers can split or add keep-alive lines. Valid chunks still carry the text.
      }
    }
  }

  recordUsage({
    kind: 'chat',
    model: options.model,
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    durationMs: Date.now() - startedAt,
    ok: true,
  });
  return {
    text,
    finishReason,
    usage: { promptTokens, completionTokens, seconds: Math.round((Date.now() - startedAt) / 1000) },
  };
}

export function parseAssetResponse(text: string): GeneratedAsset {
  const json = text.match(/```json\s*([\s\S]*?)```/);
  const tsx = text.match(/```(?:tsx|typescript)\s*([\s\S]*?)```/);
  if (!json || !tsx) throw new Error('Response must contain json and tsx code blocks');

  const manifestResult = AssetManifestSchema.safeParse(JSON.parse(json[1]));
  if (!manifestResult.success) {
    throw new Error(`Invalid manifest: ${manifestResult.error.issues.map((issue) => issue.message).join('; ')}`);
  }

  const code = tsx[1].trim();
  const validation = validateSceneCode(code, 'Asset.tsx');
  const missing = missingContractIds(manifestResult.data, code);
  const errors = [...validation.errors];
  if (missing.length) errors.push(`Code does not use manifest ids: ${missing.join(', ')}`);
  if (!/export\s+default\s+Asset/.test(code)) errors.push('Code must end with export default Asset');
  if (errors.length) throw new Error(errors.join('\n'));

  return { manifest: manifestResult.data, code };
}

function assetContext(asset: GeneratedAsset): string {
  return `Current manifest:\n\`\`\`json\n${JSON.stringify(asset.manifest, null, 2)}\n\`\`\`\n\nCurrent code:\n\`\`\`tsx\n${asset.code}\n\`\`\``;
}

const COMPACT_RETRY_NOTE =
  'Your previous answer exceeded the size limit and was cut off. Keep the whole answer under 12000 tokens. Reuse helpers and compact data arrays for repeated detail.';

export async function requestAsset(model: string, content: ChatContent): Promise<{ text: string; usage: LlmUsage }> {
  const first = await callChat({ model, system: ASSET_SYSTEM_PROMPT, content, maxTokens: 48_000 });
  if (first.finishReason !== 'length') return { text: first.text, usage: first.usage };

  const compactContent: ChatContent =
    typeof content === 'string'
      ? `${content}\n\n${COMPACT_RETRY_NOTE}`
      : [...content, { type: 'text', text: COMPACT_RETRY_NOTE }];
  const retry = await callChat({ model, system: ASSET_SYSTEM_PROMPT, content: compactContent, maxTokens: 48_000 });
  if (retry.finishReason === 'length') throw new Error('The asset response was cut off twice.');

  return {
    text: retry.text,
    usage: {
      promptTokens: first.usage.promptTokens + retry.usage.promptTokens,
      completionTokens: first.usage.completionTokens + retry.usage.completionTokens,
      seconds: first.usage.seconds + retry.usage.seconds,
    },
  };
}

export interface SceneAssetContext {
  videoTitle: string;
  outline: string;
  sceneNumber: number;
  sceneCount: number;
  sceneTitle: string;
  narration: string;
  visualPrompt: string;
  palette: Record<string, string>;
}

export function sceneAssetPrompt(context: SceneAssetContext): string {
  return `Create the asset for scene ${context.sceneNumber} of ${context.sceneCount} in the video "${context.videoTitle}".

Video outline:
${context.outline}

This scene: ${context.sceneTitle}
Narration: "${context.narration}"
Visual direction: "${context.visualPrompt}"
Video palette for backgrounds, accents, and highlighted parts: ${JSON.stringify(context.palette)}
Objects keep their believable real-world colors, and they must stand out clearly from the background color.

Draw what this exact stage needs to explain, with accurate structure and correct real-world detail. All scenes share one illustration style, light direction, and color world so the video feels like one film.`;
}

export function generateAsset(model: string, topicPrompt: string) {
  return requestAsset(model, `Create the asset for this user request:\n"${topicPrompt}"`);
}

export function repairAsset(model: string, topicPrompt: string, rawResponse: string, error: string) {
  return requestAsset(
    model,
    `User request: "${topicPrompt}"\n\nThe previous response failed with:\n${error}\n\nPrevious response:\n${rawResponse.slice(0, 70_000)}\n\nFix every failure and return the complete json and tsx blocks.`
  );
}

export function reviseAsset(
  model: string,
  topicPrompt: string,
  asset: GeneratedAsset,
  critique: AssetCritique,
  sheetJpeg: Buffer,
  sheetNote = ''
) {
  return requestAsset(model, [
    {
      type: 'text',
      text: `User request: "${topicPrompt}"\n\nThe attached contact sheet shows frames from the rendered scene in time order.${sheetNote && ` ${sheetNote}`}\n\nArt director issues:\n${critique.issues.map((issue) => `- ${issue}`).join('\n')}\n\n${assetContext(asset)}\n\nImprove the illustration substantially and fix every issue. Return the complete json and tsx blocks.`,
    },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${sheetJpeg.toString('base64')}` } },
  ]);
}

/** Choreography scenes show no part labels by design, so the critic must not expect any. */
export function critiqueRequest(topicPrompt: string, asset: GeneratedAsset, sheetNote = ''): string {
  const labels = asset.manifest.choreography
    ? 'This scene has no part labels by design.'
    : `Visible labels: ${asset.manifest.parts.map((part) => part.label).join(', ')}`;
  return [`Topic request: "${topicPrompt}"`, labels, sheetNote].filter(Boolean).join('\n');
}

export async function critiqueAsset(
  model: string,
  topicPrompt: string,
  asset: GeneratedAsset,
  sheetJpeg: Buffer,
  sheetNote = ''
): Promise<{ critique: AssetCritique; usage: LlmUsage }> {
  const { text, usage } = await callChat({
    model,
    system: CRITIC_SYSTEM_PROMPT,
    maxTokens: 3_000,
    timeoutMs: 5 * 60_000,
    content: [
      { type: 'text', text: critiqueRequest(topicPrompt, asset, sheetNote) },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${sheetJpeg.toString('base64')}` } },
    ],
  });
  return { critique: parseCritique(text), usage };
}

export function parseCritique(text: string): AssetCritique {
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) throw new Error('Critic did not return JSON');
  const { imageVisible, scores, issues } = JSON.parse(json[0]) as Pick<AssetCritique, 'scores' | 'issues'> & {
    imageVisible?: boolean;
  };
  if (imageVisible !== true) throw new Error('Critic could not see the rendered frames');
  const values = Object.values(scores);
  const average = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  return { scores, issues, average };
}
