import { validateSceneCode } from '@/lib/pipeline/code-validator';

/**
 * File contract for an isometric canvas video. The job writes these modules into project
 * files; the browser preview and the export bundle import them the same way.
 *
 * - IsoObjects.ts: `export function drawName(iso: Iso, state: Record<string, number>, t: number)`, one per
 *                  object, standing on z = 0 with its footprint centred on the origin.
 * - IsoWorld.ts:   `export function drawWorld(iso: Iso, t: number, states: IsoStates)`, background,
 *                  ground, and every object at its place, reading each object's state by id.
 * - IsoScenes.ts:  `export const scenes: IsoSceneSpec[]`, world scenes as data and detail scenes
 *                  with their own draw functions.
 */
export const ISO_CANVAS_FILES = ['IsoObjects.ts', 'IsoWorld.ts', 'IsoScenes.ts'] as const;
export type IsoCanvasFileName = (typeof ISO_CANVAS_FILES)[number];
export type IsoCanvasFiles = Record<IsoCanvasFileName, string>;

/** Each module may import the kit and only the modules before it, so there are no cycles. */
export const ISO_CANVAS_IMPORTS: Record<IsoCanvasFileName, readonly string[]> = {
  'IsoObjects.ts': ['@/motion-kit'],
  'IsoWorld.ts': ['@/motion-kit', './IsoObjects'],
  'IsoScenes.ts': ['@/motion-kit', './IsoWorld', './IsoObjects'],
};

/** Static checks: compiles, deterministic, no forbidden globals, imports, or canvas members. */
export function validateIsoCanvasFile(name: IsoCanvasFileName, code: string) {
  return validateSceneCode(code, name, { allowedImports: ISO_CANVAS_IMPORTS[name], canvas: true });
}

export function validateIsoCanvasFiles(files: IsoCanvasFiles): string[] {
  return ISO_CANVAS_FILES.flatMap((name) => {
    if (typeof files[name] !== 'string' || !files[name].trim()) return [`${name} is missing.`];
    return validateIsoCanvasFile(name, files[name]).errors;
  });
}

/**
 * IsoTitle.tsx: `export const TITLE_TEXT: string[]` (every word the card shows) and
 * `export const TitleCard: React.FC<{ duration: number }>`, the opening title written for the
 * video. Optional: without it the video opens with the headline panel as before.
 */
export const ISO_TITLE_FILE = 'IsoTitle.tsx';
export const ISO_TITLE_IMPORTS = ['react', 'remotion', '@/motion-kit'] as const;

export function validateIsoTitle(code: string) {
  return validateSceneCode(code, ISO_TITLE_FILE, { allowedImports: ISO_TITLE_IMPORTS });
}

/**
 * IsoCaption.tsx: `export const CaptionCard: React.FC<CaptionProps>`, how captions look in this
 * video. Optional: the engine still groups, times, and places the words, and falls back to the
 * plain caption pill when the file is missing or throws.
 */
export const ISO_CAPTION_FILE = 'IsoCaption.tsx';

export function validateIsoCaption(code: string) {
  return validateSceneCode(code, ISO_CAPTION_FILE, { allowedImports: ISO_TITLE_IMPORTS });
}

/**
 * IsoPanel.tsx: `export const PanelCard: React.FC<PanelProps>`, how the top panel of each scene
 * looks. Optional: the engine still decides the headline, status, and stated numbers, and falls
 * back to the plain panel when the file is missing or throws.
 */
export const ISO_PANEL_FILE = 'IsoPanel.tsx';

export function validateIsoPanel(code: string) {
  return validateSceneCode(code, ISO_PANEL_FILE, { allowedImports: ISO_TITLE_IMPORTS });
}
