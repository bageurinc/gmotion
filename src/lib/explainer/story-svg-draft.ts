import { z } from 'zod';
import type { Storyboard } from '@/types/studio';
import { validateSceneCode } from '@/lib/pipeline/code-validator';
import { callChat } from './asset-generator';

const componentName = z.string().regex(/^[A-Z][A-Za-z0-9]*$/).refine(
  (name) => !['WorldBase', 'Asset', 'React'].includes(name),
  'Use the name of an object component.',
);
const draftSchema = z.object({
  sharedWorld: z.string().min(1).max(40_000),
  sceneObjects: z.array(z.array(componentName)),
});

export type StorySvgDraft = z.infer<typeof draftSchema>;

const DRAFT_SYSTEM = `You design reusable SVG art for an animated vertical explainer.
Return a JSON object with "sharedWorld" (a TSX string) and "sceneObjects" (an array of arrays of component names, one per scene in order).
The TSX must start with // SHARED-WORLD:START and end with // SHARED-WORLD:END. No imports or exports.
Define WorldBase for the fixed setting in 1000 by 1000 coordinates. Define a separate named function for each focal subject and recurring prop, for example Honeycomb or SoapBar.
Each object renders an SVG group around local origin (0,0). Draw a clear silhouette, accurate proportions and a few recognizable details, with consistent lighting and outline weights across the set.
Use pure SVG geometry. No text, raster, time, actionProgress, external references, or React APIs. Prefix SVG definition IDs with asset-world-. Use inline SVG attributes.
Components may take numeric or string props for articulated poses or state changes needed by the story. Give each prop a sensible default, and put the prop contract and approximate object dimensions in a short comment above the function.
Each sceneObjects entry lists only the exact function names visible in that scene, for example [["Honeycomb","Bee"],["Honeycomb","Bee"]]. Include the focal subject even if it appears in one scene. Use [] for CTA scenes. Leave incidental scene-specific effects to the animator.`;

export function parseStorySvgDraft(response: string, storyboard: Storyboard): StorySvgDraft {
  const json = response.trim().replace(/^\x60{3}(?:json)?\s*|\s*\x60{3}$/gi, '');
  const draft = draftSchema.parse(JSON.parse(json));
  const { sharedWorld, sceneObjects } = draft;
  if (!/^\/\/ SHARED-WORLD:START\r?\n/.test(sharedWorld) || !sharedWorld.trimEnd().endsWith('// SHARED-WORLD:END')
    || sharedWorld.indexOf('// SHARED-WORLD:END') !== sharedWorld.trimEnd().lastIndexOf('// SHARED-WORLD:END')
    || !/\b(?:function|const)\s+WorldBase\b/.test(sharedWorld)) {
    throw new Error('Draft must define WorldBase inside the shared SVG block.');
  }
  if (/^[ \t]*(?:import|export)\b/m.test(sharedWorld)) throw new Error('Draft must use inline definitions without imports or exports.');
  if (sceneObjects.length !== storyboard.scenes.length) throw new Error('Draft must cover every scene.');
  for (const [index, objects] of sceneObjects.entries()) {
    if (storyboard.scenes[index].role !== 'cta' && !objects.length) {
      throw new Error(`Draft scene ${index + 1} is missing its focal object.`);
    }
    for (const object of objects) {
      if (!new RegExp(`\\b(?:function|const)\\s+${object}\\b`).test(sharedWorld)) {
        throw new Error(`Draft is missing the ${object} component.`);
      }
    }
  }
  const check = validateSceneCode(sharedWorld, 'StorySvgDraft.tsx', { svgOnly: true, allowedImports: [] });
  if (!check.valid) throw new Error(check.errors.join('\n'));
  return draft;
}

export async function generateStorySvgDraft(
  model: string,
  storyboard: Storyboard,
  revision?: { draft: StorySvgDraft; instruction: string },
): Promise<StorySvgDraft> {
  const brief = JSON.stringify({
    title: storyboard.title,
    palette: storyboard.palette,
    scenes: storyboard.scenes.map(({ title, role, voiceoverText, visualPrompt }) => ({
      title, role, narration: voiceoverText, visual: visualPrompt,
    })),
  });
  const request = (content: string) => callChat({
    model, system: DRAFT_SYSTEM, content, maxTokens: 16_000, timeoutMs: 5 * 60_000,
  });
  const prompt = revision
    ? `${brief}\nRevise this existing object draft: ${JSON.stringify(revision.draft)}\nRequested corrections: ${JSON.stringify(revision.instruction)}\nPreserve object art and scene assignments outside the requested corrections.`
    : brief;
  const first = await request(prompt);
  try {
    return parseStorySvgDraft(first.text, storyboard);
  } catch (error) {
    const repair = await request(`${prompt}\nThe first response failed validation: ${String(error)}. Return a complete corrected draft.\nPrevious response:\n${first.text.slice(0, 45_000)}`);
    return parseStorySvgDraft(repair.text, storyboard);
  }
}
