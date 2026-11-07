import { z } from 'zod';

export const StylePresetSchema = z.enum(['ads-ui', 'story-2d']);
export type StylePreset = z.infer<typeof StylePresetSchema>;

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
  preset: StylePresetSchema,
  aspectRatio: AspectRatioSchema,
  fps: z.number().default(30),
  bgmTrack: z.enum(['dark-tech-pulse', 'upbeat-saas', 'warm-acoustic', 'cinematic-story', 'none']),
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

export interface StudioProject {
  safeAreaPlatform?: SocialPlatform;
  id: string;
  createdAt: number;
  updatedAt: number;
  userPrompt: string;
  storyboard: Storyboard;
  files: VirtualFileMap; // e.g. "Scene1.tsx", "Scene2.tsx", "MainVideo.tsx"
  chatHistory: ProjectChatMessage[];
  status: 'draft' | 'idle' | 'generating' | 'rendering' | 'ready' | 'error';
  generationStartedAt?: number;
  generationError?: string;
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
