import { callChat } from '@/lib/explainer/asset-generator';
import { checkDraft, type DraftReport } from './draft-runtime';
import { DRAFT_IMPORTS } from './draft-contract';
import { EXAMPLE_DRAFT_CODE, EXAMPLE_DRAFT_META } from './draft-example';

export const draftModel = () => process.env.ASSET_DRAFT_MODEL || process.env.DIRECTOR_MODEL || 'ag/gemini-3.8-flash-high';
const MAX_ATTEMPTS = 3;

const SYSTEM = `You draw reusable SVG assets for gmotion, an Indonesian explainer-video product. An asset is a React component that returns one <svg viewBox="0 0 760 480">. An admin reviews your draft before any video uses it, so be honest in limitations.

PROJECTION (shared with every library asset, so objects line up in one scene)
- Isometric, ground axes at ±30°. World point [x, y, z] → screen: x = 380 + (x - y)·cos30, y = 300 + (x + y)/2 - z.
- +x runs toward the bottom right, +y toward the bottom left, +z straight up. Visible faces: top, the +x face, and the +y face.
- Scale: the library car is 440 long (x -220..222), 200 wide, 180 tall, so 1 metre ≈ 120 units. Keep everything on the canvas: z up to about 280 at the origin. If the real object is too tall, scale it down and say so in limitations.
- Draw far parts first (smaller x + y, lower z), near parts last.

CODE RULES
- Imports: only ${DRAFT_IMPORTS.map((name) => `'${name}'`).join(' and ')}. One default export: the component.
- Kit exports: projectPoint([x,y,z]) → {x,y}; points(vertices) → SVG points string; Surface {vertices, color}; Block {at:[x,y,z], size:[w,d,h], color, top, side}; Pipe {route, width, color, dashed}; Bolt {at, color}; Cylinder {at, radius, height, color, top}; SideDisc {at, radius, color} (a disc on the +y face, for lamps or dials); shade(color, amount) lightens (+) or darkens (-).
- The component receives the variant as prop "variant" and every declared prop. Give every prop a default in the parameter list.
- Pure function of props: no hooks, state, timers, Math.random, Date, fetch, images, text, <foreignObject>, CSS animation, or external URLs. No words or numbers drawn in the SVG.
- Flat vector style: solid fills, outline #2F3B40 about 1px, light top faces, darker side faces. Readable at small size. Parts the narration will point at must be distinct shapes.

METADATA
- variants: real differences in construction, not colours (1–4). defaultVariant must be one of them.
- props: states as "enum" (for example a lamp showing red, yellow, or green), 0–1 "number" with "animatable": true for continuous motion, "color" for editable materials with a dotted material name such as "material.body". Every state must visibly change the drawing.
- anchors: world points of the parts a label or flow may point at, per variant. They must project inside the canvas.
- capabilities: kebab-case words for what the asset can show. limitations: what it cannot show and how illustrative it is.

OUTPUT: exactly two fenced blocks, first \`\`\`json with the metadata object, then \`\`\`tsx with the component. Nothing else.

EXAMPLE
\`\`\`json
${JSON.stringify(EXAMPLE_DRAFT_META, null, 2)}
\`\`\`
\`\`\`tsx
${EXAMPLE_DRAFT_CODE}\`\`\``;

export interface DraftResult {
  code: string;
  meta: unknown;
  report: DraftReport;
  model: string;
  attempts: number;
  /** Errors from attempts that were rejected before the returned one. */
  notes: string[];
}

export function parseDraftResponse(text: string): { meta: unknown; code: string } | null {
  const json = /```json\s*([\s\S]*?)```/.exec(text);
  const code = /```(?:tsx|jsx|typescript|ts)\s*([\s\S]*?)```/.exec(text);
  if (!json || !code) return null;
  try {
    return { meta: JSON.parse(json[1]), code: code[1].trim() + '\n' };
  } catch {
    return null;
  }
}

const failures = (report: DraftReport) => report.checks.filter((check) => !check.ok).map((check) => `${check.label}${check.detail ? `: ${check.detail}` : ''}`);

/**
 * Asks the model for a draft and feeds rejected checks back, up to three attempts. Returns
 * the last attempt even when checks still fail, so the admin can see and fix it.
 */
async function requestDraft(content: string, options: { attempts?: number; maxTokens?: number } = {}): Promise<DraftResult> {
  const model = draftModel();
  const notes: string[] = [];
  let feedback = '';
  let last: DraftResult | null = null;
  for (let attempt = 1; attempt <= (options.attempts ?? MAX_ATTEMPTS); attempt += 1) {
    const { text } = await callChat({ model, system: SYSTEM, content: content + feedback, maxTokens: options.maxTokens ?? 16_000 });
    const parsed = parseDraftResponse(text);
    if (!parsed) {
      notes.push(`Percobaan ${attempt}: jawaban model tidak berisi blok json dan tsx.`);
      feedback = '\n\nYour previous answer did not contain the two fenced blocks. Answer again in the required format.';
      continue;
    }
    const report = checkDraft(parsed.code, parsed.meta);
    last = { code: parsed.code, meta: parsed.meta, report, model, attempts: attempt, notes: [...notes] };
    // Code, metadata, and rendering must pass; visual checks are left to the admin to judge.
    const blocking = report.checks.filter((check) => !check.ok && ['code', 'meta', 'render', 'canvas', 'numbers', 'deterministic'].includes(check.id));
    if (!blocking.length) return last;
    notes.push(`Percobaan ${attempt} ditolak: ${failures(report).join(' | ').slice(0, 600)}`);
    feedback = `\n\nYour previous draft failed these checks. Fix them and return both blocks again in full:\n${failures(report).join('\n')}\n\nPrevious metadata:\n${JSON.stringify(parsed.meta).slice(0, 6000)}\n\nPrevious code:\n${parsed.code.slice(0, 20_000)}`;
  }
  if (last) return { ...last, notes };
  throw new Error(notes.join(' ') || 'The model returned no draft');
}

export function generateDraft(input: { subject: string; label: string; notes?: string }): Promise<DraftResult> {
  return requestDraft(`Draw a new library asset.\nSubject (Indonesian): "${input.subject}"\nLabel: "${input.label}"${input.notes ? `\nAdmin notes: ${input.notes}` : ''}\nThink about which parts a video explaining this subject would point at, and which states it needs.`);
}

export function reviseDraft(input: { subject: string; code: string; meta: unknown; instruction: string }): Promise<DraftResult> {
  return requestDraft(`Revise this library asset draft. Keep everything the instruction does not ask to change, including prop names and anchors unless they must change.\nSubject: "${input.subject}"\nAdmin instruction (Indonesian): "${input.instruction}"\n\nCurrent metadata:\n\`\`\`json\n${JSON.stringify(input.meta, null, 2)}\n\`\`\`\nCurrent code:\n\`\`\`tsx\n${input.code}\`\`\``);
}

/**
 * A simple supporting prop for one video (a pipe, a tap, a bench), drawn on the fly in the
 * library projection. Kept small so several can be drawn in parallel within a generation.
 */
export function generateProp(input: { subject: string; topic: string }): Promise<DraftResult> {
  return requestDraft(`Draw a simple supporting prop for one video, not a detailed library asset.
Subject (Indonesian): "${input.subject}"
Video topic: "${input.topic.slice(0, 300)}"
Constraints: exactly one variant named "default"; at most two "color" props and no enum, boolean, or number props; 1-3 anchors; under 90 lines of code; one clear readable shape at the library scale; no text.`, { attempts: 2, maxTokens: 8000 });
}

/** True when a draft is safe to render: code, metadata, and rendering checks passed. */
export const renderable = (report: DraftReport) =>
  report.checks.every((check) => check.ok || !['code', 'meta', 'render', 'canvas', 'numbers', 'deterministic'].includes(check.id));
