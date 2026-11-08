import { z } from 'zod';
import type { AssetManifest } from '@/lib/explainer/asset-contract';
import type { StillStretch } from '@/lib/render/motion-check';

export const StylePresetSchema = z.enum(['story-2d', 'story-svg', 'ads-ui', 'world']);
export type StylePreset = z.infer<typeof StylePresetSchema>;

/** Which model draws the scenes. Absent on saved projects, which were all drawn by Gemini. */
export const DrawingModelSchema = z.enum(['gemini', 'deepseek-flash']);
export type DrawingModel = z.infer<typeof DrawingModelSchema>;

export const DRAWING_MODEL_LABELS: Record<DrawingModel, string> = {
  gemini: 'Gemini',
  'deepseek-flash': 'DeepSeek Flash',
};

/** 'story' and 'ads' were 3D presets for a while, and those saved videos must still open and export. */
export const StoredPresetSchema = z.enum(['story-2d', 'story-svg', 'ads-ui', 'world', 'story', 'ads']);
export type StoredPreset = z.infer<typeof StoredPresetSchema>;

/** Isometric videos are one 3D world, while Story 2D and Ads keep one scene file per scene. */
export const usesWorldEngine = (preset: StoredPreset) => preset === 'world' || preset === 'story' || preset === 'ads';

export const PRESET_LABELS: Record<StoredPreset, string> = {
  'story-2d': 'Story 2D Campuran',
  'story-svg': 'Story 2D Full SVG',
  'ads-ui': 'Ads',
  world: 'Isometrik',
  story: 'Isometrik',
  ads: 'Isometrik',
};

export const AspectRatioSchema = z.enum(['9:16', '4:5', '16:9']);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export const WordTimingSchema = z.object({
  word: z.string(),
  startMs: z.number(),
  endMs: z.number(),
});
export type WordTiming = z.infer<typeof WordTimingSchema>;

export const TimelapseKindSchema = z.enum(['day-night', 'clock', 'growth', 'crowd', 'weather']);
export type TimelapseKind = z.infer<typeof TimelapseKindSchema>;

export const TimelapseSpecSchema = z.object({
  kind: TimelapseKindSchema,
  fromLabel: z.string().optional(),
  toLabel: z.string().optional(),
  easing: z.enum(['linear', 'ease-in-out']).default('ease-in-out'),
});
export type TimelapseSpec = z.infer<typeof TimelapseSpecSchema>;

export const TextStyleSchema = z.enum(['tegas', 'teknis', 'editorial', 'ramah']);
export type TextStyleId = z.infer<typeof TextStyleSchema>;

/** Optional on-screen data. Values are strings so "1,5" stays exactly as the narration says it. */
export const DataVisualSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stat'), value: z.string().min(1), unit: z.string().optional(), label: z.string().min(1) }),
  z.object({
    kind: z.literal('compare'),
    unit: z.string().optional(),
    items: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).min(2).max(4),
  }),
  z.object({ kind: z.literal('steps'), items: z.array(z.string().min(1)).min(2).max(4) }),
]);
export type DataVisual = z.infer<typeof DataVisualSchema>;

export const SceneSpecSchema = z.object({
  id: z.string(), // e.g. "scene-1-hook"
  order: z.number(),
  role: z.enum(['hook', 'problem', 'mechanism', 'proof', 'cta', 'narrative']),
  title: z.string(),
  voiceoverText: z.string(),
  kineticHeadline: z.string(),
  visualPrompt: z.string(), // Detailed choreography & SVG instruction
  cameraAction: z.enum(['static', 'macro-zoom-in', 'slow-push', 'pan-parallax', 'tilt-3d', 'timelapse']),
  sfxCue: z.enum(['none', 'pop', 'whoosh', 'notification', 'cash-register', 'success']),
  timelapse: TimelapseSpecSchema.optional(),
  headlineFocus: z.string().optional(),
  dataVisual: DataVisualSchema.optional(),
  fixedDurationSec: z.number().min(1).max(30).optional(),
  // Populated by Stage 2 (Audio-First TTS Engine):
  audioUrl: z.string().optional(),
  durationInFrames: z.number().default(120),
  wordTimings: z.array(WordTimingSchema).default([]),
});
export type SceneSpec = z.infer<typeof SceneSpecSchema>;

export const ColorPaletteSchema = z.object({
  background: z.string(),
  surface: z.string(),
  primary: z.string(),
  secondary: z.string(),
  alert: z.string(),
  text: z.string(),
});
export type ColorPalette = z.infer<typeof ColorPaletteSchema>;

export const StoryboardSchema = z.object({
  title: z.string(),
  preset: StoredPresetSchema,
  aspectRatio: AspectRatioSchema,
  fps: z.number().default(30),
  voice: z.string().optional(),
  bgmTrack: z.enum(['dark-tech-pulse', 'upbeat-saas', 'warm-acoustic', 'cinematic-story', 'none']),
  textStyle: TextStyleSchema.optional(),
  palette: ColorPaletteSchema,
  scenes: z.array(SceneSpecSchema),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

export interface VirtualFile {
  path: string;
  code: string;
}

export type VirtualFileMap = Record<string, string>;

export interface ProjectChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  targetedSceneId?: string;
}

export const SocialPlatformSchema = z.enum(['generic', 'tiktok', 'instagram', 'shorts', 'facebook']);
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;

export type SceneStage = 'queued' | 'audio' | 'animation' | 'ready' | 'failed';

export interface SceneProgress {
  stage: SceneStage;
  error?: string;
  simplified?: boolean;
  score?: number;
  /** What the critic said about the saved version, kept so its findings can be checked later. */
  issues?: string[];
}

export interface StudioProject {
  safeAreaPlatform?: SocialPlatform;
  id: string;
  /** Absent on projects created before accounts existed. */
  ownerId?: string;
  createdAt: number;
  updatedAt: number;
  userPrompt: string;
  storyboard: Storyboard;
  files: VirtualFileMap; // e.g. "Scene1.tsx", "Scene2.tsx", "MainVideo.tsx"
  chatHistory: ProjectChatMessage[];
  status: 'draft' | 'idle' | 'generating' | 'rendering' | 'ready' | 'error';
  sceneProgress?: Record<string, SceneProgress>;
  checkingScenes?: boolean;
  sceneAssets?: Record<string, { manifest: AssetManifest; code: string }>;
  drawingModel?: DrawingModel;
  generationError?: string;
  /** Automatic world repairs, kept so the editor can report them. */
  worldRepairs?: string[];
  /** Long still stretches measured when generation finished. Absent when the check did not run. */
  stillStretches?: StillStretch[];
  exportVideoUrl?: string;
}

export const RevisionRequestSchema = z.object({
  userMessage: z.string().min(1),
  sceneId: z.string().optional(),
});
export type RevisionRequest = z.infer<typeof RevisionRequestSchema>;

export interface ProgressEventPayload {
  stage: 'storyboard' | 'audio' | 'motion-code' | 'validation' | 'complete' | 'error';
  progressPercent: number; // 0 - 100
  message: string;
  project?: StudioProject;
}

export const AspectRatioDimensions: Record<AspectRatio, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '4:5': { width: 1080, height: 1350 },
  '16:9': { width: 1920, height: 1080 },
};
