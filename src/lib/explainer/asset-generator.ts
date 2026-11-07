import { AssetManifest, AssetManifestSchema, missingContractIds } from './asset-contract';
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
- Layer every major form: base gradient, core shadow, reflected light, rim light, specular highlights, then a dark variable-feeling outline.
- Use organic cubic Bezier paths. Avoid assembling the subject from plain circles and rectangles.
- Add believable secondary detail such as fibres, seams, panels, rivets, veins, droplets, grain, or texture lines.
- Use at least 60 meaningful shapes across the asset, and at least 25 in each view.
- Fill 70-85% of the square canvas with the subject. Keep the outer area transparent because the stage paints the background.
- Keep the same silhouette, proportions, and light direction in all views. Later views reveal, cut open, or change state of the same subject.
- Build shape loops from data arrays when repeating texture.

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

Manifest rules:
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
You are a strict art director reviewing a generated vertical explainer clip. The image is a contact sheet of 4 frames in order: close-up, wide shot, second view with a highlighted part, and zoom to another part.
Score each criterion from 1 to 10:
- recognizability: the subject and topic are immediately understood.
- illustrationRichness: premium layered illustration with light, depth, and detail. A flat icon, clip art, or basic shapes scores 4 or lower.
- viewConsistency: frames show the same subject with the same proportions.
- labelAccuracy: labels point at the correct visible parts and facts are right.
- composition: clear framing, nothing important is cut off, text remains readable.
Return only JSON: {"imageVisible":true,"scores":{"recognizability":0,"illustrationRichness":0,"viewConsistency":0,"labelAccuracy":0,"composition":0},"issues":["specific fix"]}.
Set imageVisible to false if you cannot see the frames.
List at most 8 issues, ordered by visual impact, and say exactly what to change.
`;

async function callChat(options: {
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
  const response = await fetch(`${baseUrl}/chat/completions`, {
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
  if (!response.ok || !response.body) {
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

async function requestAsset(model: string, content: ChatContent): Promise<{ text: string; usage: LlmUsage }> {
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
  sheetJpeg: Buffer
) {
  return requestAsset(model, [
    {
      type: 'text',
      text: `User request: "${topicPrompt}"\n\nThe attached contact sheet shows the rendered clip: close-up, wide shot, second view, zoom to another part.\n\nArt director issues:\n${critique.issues.map((issue) => `- ${issue}`).join('\n')}\n\n${assetContext(asset)}\n\nImprove the illustration substantially and fix every issue. Return the complete json and tsx blocks.`,
    },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${sheetJpeg.toString('base64')}` } },
  ]);
}

export async function critiqueAsset(
  model: string,
  topicPrompt: string,
  asset: GeneratedAsset,
  sheetJpeg: Buffer
): Promise<{ critique: AssetCritique; usage: LlmUsage }> {
  const { text, usage } = await callChat({
    model,
    system: CRITIC_SYSTEM_PROMPT,
    maxTokens: 3_000,
    timeoutMs: 5 * 60_000,
    content: [
      { type: 'text', text: `Topic request: "${topicPrompt}"\nVisible labels: ${asset.manifest.parts.map((part) => part.label).join(', ')}` },
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
