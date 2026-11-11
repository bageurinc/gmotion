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
