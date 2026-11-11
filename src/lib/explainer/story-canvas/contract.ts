import { validateSceneCode } from '@/lib/pipeline/code-validator';

/**
 * File contract for a story canvas video. The job writes these modules into project files;
 * the browser preview and the export bundle import them the same way.
 *
 * - StoryProps.ts:  `export function drawName(s: Story, state: Record<string, number>, t: number)`, one per
 *                   prop, standing on y = 0 with its base centred on x = 0.
 * - StoryPlaces.ts: `export function placeName(s: Story, t: number)`, one per place: background,
 *                   far layers, ground, and fixed furniture.
 * - StoryScenes.ts: `export const world: StoryWorld` (places, props, cast) and
 *                   `export const scenes: StorySceneSpec[]`, shots as data plus close-ups as code.
 */
export const STORY_CANVAS_FILES = ['StoryProps.ts', 'StoryPlaces.ts', 'StoryScenes.ts'] as const;
export type StoryCanvasFileName = (typeof STORY_CANVAS_FILES)[number];
export type StoryCanvasFiles = Record<StoryCanvasFileName, string>;

/** Each module may import the kit and only the modules before it, so there are no cycles. */
export const STORY_CANVAS_IMPORTS: Record<StoryCanvasFileName, readonly string[]> = {
  'StoryProps.ts': ['@/motion-kit'],
  'StoryPlaces.ts': ['@/motion-kit'],
  'StoryScenes.ts': ['@/motion-kit', './StoryProps', './StoryPlaces'],
};

/** Static checks: compiles, deterministic, no forbidden globals, imports, or canvas members. */
export function validateStoryCanvasFile(name: StoryCanvasFileName, code: string) {
  return validateSceneCode(code, name, { allowedImports: STORY_CANVAS_IMPORTS[name], canvas: true });
}

export function validateStoryCanvasFiles(files: StoryCanvasFiles): string[] {
  return STORY_CANVAS_FILES.flatMap((name) => {
    if (typeof files[name] !== 'string' || !files[name].trim()) return [`${name} is missing.`];
    return validateStoryCanvasFile(name, files[name]).errors;
  });
}

/** Optional designs written by the model, with the same contracts as the isometric ones. */
export const STORY_TITLE_FILE = 'StoryTitle.tsx';
export const STORY_CAPTION_FILE = 'StoryCaption.tsx';
export const STORY_PANEL_FILE = 'StoryPanel.tsx';
