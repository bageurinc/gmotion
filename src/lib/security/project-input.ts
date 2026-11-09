import { z } from 'zod';
import { ArtStyleSchema, AspectRatioSchema, DrawingModelSchema, SocialPlatformSchema, StylePresetSchema } from '@/types/studio';

const PROJECT_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const VIRTUAL_FILE_NAME = /^(?:Scene\d{1,2}|MainVideo)\.tsx$/;
/** Published library assets a library video bundles. Written by the job only, never edited by users. */
const ASSET_FILE_NAME = /^(?:Asset\d{1,2}|Environment)\.tsx$/;
const MAX_FILE_LENGTH = 200_000;

export const isValidProjectId = (id: string) => PROJECT_ID.test(id);
export const isVirtualFileName = (name: string) => VIRTUAL_FILE_NAME.test(name) || ASSET_FILE_NAME.test(name);
export const isAssetFileName = (name: string) => ASSET_FILE_NAME.test(name);

export const CreateProjectSchema = z.object({
  requestId: z.string().uuid().optional(),
  prompt: z.string().trim().min(1).max(8000),
  preset: StylePresetSchema.default('ads-ui'),
  aspectRatio: AspectRatioSchema.default('9:16'),
  drawingModel: DrawingModelSchema.default('gemini'),
  artStyle: ArtStyleSchema.default('flat'),
});

export const ProjectUpdateSchema = z
  .object({
    files: z.record(z.string().regex(VIRTUAL_FILE_NAME), z.string().max(MAX_FILE_LENGTH)).optional(),
    safeAreaPlatform: SocialPlatformSchema.optional(),
  })
  .strict();

export const DraftRevisionInputSchema = z.union([
  z.object({ instruction: z.string().trim().min(3).max(1000) }),
  z.object({ undo: z.literal(true) }),
]);

export const RevisionInputSchema = z.object({
  userMessage: z.string().trim().min(1).max(2000),
  sceneId: z.string().max(80).optional(),
});
