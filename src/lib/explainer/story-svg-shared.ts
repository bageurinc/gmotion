import type { AspectRatio } from '@/types/studio';
import { canvasWidthFor } from './asset-contract';
import { HUMAN_RIG_API } from './human-rig';
import type { StorySvgDraft } from './story-svg-draft';

/** Pure helpers for the Full SVG object draft, safe to import from the browser. */

/** The frame a viewer sees around the canvas (wider for landscape videos), for the setting's preview card. */
export function worldViewBox(aspectRatio: AspectRatio, canvasWidth = canvasWidthFor(aspectRatio)): string {
  const [w, h] = aspectRatio.split(':').map(Number);
  const width = w >= h ? 1150 * (w / h) : 1150;
  const height = w >= h ? 1150 : 1150 * (h / w);
  const centerX = canvasWidth / 2;
  return `${centerX - width / 2} ${500 - height / 2} ${width} ${height}`;
}

/** The name the user reads for a drafted component. */
export function draftLabel(draft: StorySvgDraft, name: string): string {
  if (name === 'WorldBase') return draft.plan?.world.label ?? 'Latar';
  return draft.plan?.objects.find((object) => object.name === name)?.label
    ?? name.replace(/^StoryObject/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

/**
 * What a scene's model needs to use the draft: each component's header comment and signature.
 * The renderer inserts the full block, so the scene prompt does not carry every path.
 * Older drafts drawn in one call have no plan and return undefined, so they still send the block.
 */
export function draftApi(draft: StorySvgDraft): string | undefined {
  if (!draft.plan || !draft.pieces) return undefined;
  const header = (code: string) => code.match(/\/\*\*[\s\S]*?\*\//)?.[0] ?? '';
  // Up to the parameter list's closing parenthesis, since destructured props contain braces.
  const signature = (code: string) => {
    const start = code.search(/^function\s+\w+\s*\(/m);
    if (start < 0) return '';
    let depth = 0;
    for (let i = code.indexOf('(', start); i < code.length; i += 1) {
      if (code[i] === '(') depth += 1;
      if (code[i] === ')' && --depth === 0) return code.slice(start, i + 1);
    }
    return '';
  };
  const characters = draft.plan.objects.some((object) => object.kind === 'character');
  return [
    `// WorldBase (no props): ${draft.plan.world.description} Ground or floor line at y=${draft.plan.world.groundY}. It fills x=-1000..${(draft.canvasWidth ?? 1000) + 1000}, y=-1000..2000.`,
    ...(characters ? [HUMAN_RIG_API] : []),
    ...draft.plan.objects.map((object) => {
      const code = draft.pieces?.[object.name] ?? '';
      const kind = object.kind === 'character' ? `\n// Character on HumanRig, height ${object.height}.` : '';
      return `${header(code)}\n// Brief: ${object.description}${kind}\n${signature(code)} { /* drawn by the draft */ }`;
    }),
  ].join('\n\n');
}
