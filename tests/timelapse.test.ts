import { describe, expect, it } from 'vitest';
import {
  SceneSpecSchema,
  StoryboardSchema,
} from '../src/types/studio';
import {
  generateProceduralStoryboard,
  parseStoryboardFromLLMResponse,
} from '../src/lib/pipeline/director-agent';
import { generateSceneAudio } from '../src/lib/pipeline/tts-engine';
import { generateProceduralStorySceneCode } from '../src/lib/pipeline/coder-agent';
import { validateSceneCode } from '../src/lib/pipeline/code-validator';
import { TIMELAPSE_FEW_SHOT_EXAMPLES } from '../src/motion-kit/timelapse/examples';

describe('Timelapse Animation Support', () => {
  it('validates SceneSpecSchema with cameraAction timelapse and timelapse spec', () => {
    const scene = {
      id: 'scene-timelapse',
      order: 1,
      role: 'mechanism',
      title: 'Sunrise to Sunset',
      voiceoverText: 'Perjalanan waktu dari fajar ke senja.',
      kineticHeadline: 'Perjalanan Waktu',
      visualPrompt: 'Timelapse siang ke malam',
      cameraAction: 'timelapse',
      sfxCue: 'whoosh',
      timelapse: {
        kind: 'day-night',
        fromLabel: '06:00',
        toLabel: '20:00',
        easing: 'ease-in-out',
      },
      fixedDurationSec: 5,
      durationInFrames: 150,
      wordTimings: [],
    };

    const parsed = SceneSpecSchema.safeParse(scene);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cameraAction).toBe('timelapse');
      expect(parsed.data.timelapse?.kind).toBe('day-night');
      expect(parsed.data.fixedDurationSec).toBe(5);
    }
  });

  it('detects timelapse prompt in procedural storyboard generator', () => {
    const prompt = 'Buat animasi timelapse dari siang ke malam di perkotaan modern';
    const storyboard = generateProceduralStoryboard(prompt, 'story-2d', '9:16');

    expect(StoryboardSchema.safeParse(storyboard).success).toBe(true);
    const timelapseScene = storyboard.scenes.find((s) => s.cameraAction === 'timelapse' || s.timelapse);
    expect(timelapseScene).toBeDefined();
    expect(timelapseScene?.cameraAction).toBe('timelapse');
    expect(timelapseScene?.timelapse?.kind).toBe('day-night');
    expect(timelapseScene?.timelapse?.fromLabel).toBe('06:00');
    expect(timelapseScene?.timelapse?.toLabel).toBe('20:00');
  });

  it('parses LLM JSON containing timelapse specs and cameraAction', () => {
    const rawJson = JSON.stringify({
      title: 'City Timelapse',
      scenes: [
        {
          id: 'scene-1',
          role: 'hook',
          title: 'Opening',
          voiceoverText: 'Intro text',
          kineticHeadline: 'TIMELAPSE BEGINS',
          cameraAction: 'timelapse',
          timelapse: {
            kind: 'clock',
            fromLabel: '08:00',
            toLabel: '18:00',
            easing: 'linear',
          },
          fixedDurationSec: 4,
        },
        {
          id: 'scene-2',
          role: 'narrative',
          title: 'Closing',
          voiceoverText: 'End text',
          kineticHeadline: 'THE END',
          cameraAction: 'slow-push',
        },
      ],
    });

    const parsed = parseStoryboardFromLLMResponse(rawJson, 'timelapse test', 'story-2d', '9:16');
    expect(parsed).not.toBeNull();
    const scene1 = parsed?.scenes[0];
    expect(scene1?.cameraAction).toBe('timelapse');
    expect(scene1?.timelapse?.kind).toBe('clock');
    expect(scene1?.timelapse?.fromLabel).toBe('08:00');
    expect(scene1?.timelapse?.toLabel).toBe('18:00');
    expect(scene1?.timelapse?.easing).toBe('linear');
    expect(scene1?.fixedDurationSec).toBe(4);
  });

  it('bypasses TTS when fixedDurationSec is provided and voiceoverText is empty', async () => {
    const scene = {
      id: 'scene-no-vo-timelapse',
      order: 1,
      role: 'mechanism',
      title: 'Pure Visual Timelapse',
      voiceoverText: '',
      kineticHeadline: '24 Jam Nonstop',
      visualPrompt: 'Timelapse siang ke malam tanpa narasi',
      cameraAction: 'timelapse',
      sfxCue: 'none',
      fixedDurationSec: 4.5,
      durationInFrames: 0,
      wordTimings: [],
    } as const;

    const result = await generateSceneAudio(scene as any, {
      fps: 30,
      projectId: 'test-timelapse-project',
    });

    expect(result.audioUrl).toBe('');
    expect(result.durationInFrames).toBe(Math.round(4.5 * 30));
    expect(result.wordTimings).toEqual([]);
  });

  it('generates procedural story scene code containing DayNightSky and TimelapseClock', () => {
    const scene = {
      id: 'scene-2-mechanism',
      order: 2,
      role: 'mechanism' as const,
      title: 'Timelapse Putaran Waktu',
      voiceoverText: 'Waktu melesat begitu cepat dari fajar ke senja.',
      kineticHeadline: 'Siklus Waktu Terus Berputar',
      visualPrompt: 'Visual prompt timelapse',
      cameraAction: 'timelapse' as const,
      timelapse: {
        kind: 'day-night' as const,
        fromLabel: '06:00',
        toLabel: '20:00',
        easing: 'ease-in-out' as const,
      },
      sfxCue: 'pop' as const,
      durationInFrames: 135,
      wordTimings: [],
    };

    const code = generateProceduralStorySceneCode(scene, 1);
    expect(code).toContain('DayNightSky');
    expect(code).toContain('TimelapseClock');
    expect(code).toContain('TimelapseProgress');
    expect(code).toContain('mode="timelapse"');

    const validation = validateSceneCode(code, 'Scene2.tsx');
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('validates scene code using custom timelapse imports', () => {
    const customCode = `
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  CameraRig,
  KineticHeadline,
  DayNightSky,
  TimelapseClock,
  TimelapseProgress,
  TimelapseShadow,
  useTimelapseProgress,
  StagedReveal,
  GrowAxis,
  StateMorph,
  Repeat,
  PathMover,
  TimeHUD,
} from '@/motion-kit';

export const Scene1: React.FC = () => {
  const progress = useTimelapseProgress({ easing: 'linear' });
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <DayNightSky progress={progress} />
      <CameraRig mode="timelapse">
        <TimelapseClock fromTime="06:00" toTime="18:00" />
        <TimelapseShadow progress={progress} />
        <TimelapseProgress progress={progress} />
        <StagedReveal
          count={5}
          progress={progress}
          renderItem={(i, p) => <div key={i} style={{ opacity: p }}>Item {i}</div>}
        />
        <GrowAxis axis="y" progress={progress}>
          <div>Growing Up</div>
        </GrowAxis>
        <TimeHUD mode="bar" label="Progres Konstruksi" fromLabel="Lantai 1" toLabel="Lantai 20" />
      </CameraRig>
    </div>
  );
};
export default Scene1;
`;
    const validation = validateSceneCode(customCode, 'Scene1.tsx');
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('generates building construction timelapse without DayNightSky or TimelapseClock', () => {
    const prompt = 'Buat timelapse pembuatan gedung pencakar langit 24 lantai';
    const storyboard = generateProceduralStoryboard(prompt, 'story-2d', '9:16');

    expect(StoryboardSchema.safeParse(storyboard).success).toBe(true);
    expect(storyboard.title).toContain('Gedung');

    const timelapseScene = storyboard.scenes.find((s) => s.cameraAction === 'timelapse' || s.timelapse);
    expect(timelapseScene).toBeDefined();
    expect(timelapseScene?.cameraAction).toBe('timelapse');
    expect(timelapseScene?.timelapse?.kind).toBe('growth');
    expect(timelapseScene?.timelapse?.fromLabel).toBe('Lantai 1');
    expect(timelapseScene?.timelapse?.toLabel).toBe('Lantai 24');

    const sceneCode = generateProceduralStorySceneCode(timelapseScene!, 1);
    expect(sceneCode).toContain('StagedReveal');
    expect(sceneCode).toContain('GrowAxis');
    expect(sceneCode).toContain('PathMover');
    expect(sceneCode).toContain('TimeHUD');
    expect(sceneCode).not.toContain('DayNightSky');
    expect(sceneCode).not.toContain('TimelapseClock');

    const validation = validateSceneCode(sceneCode, 'Scene2.tsx');
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('generates neutral timelapse scene for abstract process without clock or day-night sky', () => {
    const scene = {
      id: 'scene-neutral',
      order: 2,
      role: 'mechanism' as const,
      title: 'Evolusi Proses',
      voiceoverText: 'Transformasi tahap demi tahap terjadi secara bertahap.',
      kineticHeadline: 'Transformasi Bertahap',
      visualPrompt: 'Proses evolusi sistem secara bertingkat',
      cameraAction: 'timelapse' as const,
      timelapse: {
        kind: 'weather' as const,
        fromLabel: 'Tahap 1',
        toLabel: 'Tahap 8',
        easing: 'ease-in-out' as const,
      },
      sfxCue: 'pop' as const,
      durationInFrames: 120,
      wordTimings: [],
    };

    const sceneCode = generateProceduralStorySceneCode(scene, 1);
    expect(sceneCode).toContain('StagedReveal');
    expect(sceneCode).toContain('GrowAxis');
    expect(sceneCode).toContain('TimeHUD');
    expect(sceneCode).not.toContain('DayNightSky');
    expect(sceneCode).not.toContain('TimelapseClock');

    const validation = validateSceneCode(sceneCode, 'Scene2.tsx');
    expect(validation.valid).toBe(true);
  });

  it('validates each code block in TIMELAPSE_FEW_SHOT_EXAMPLES', () => {
    const codeBlocks = Array.from(TIMELAPSE_FEW_SHOT_EXAMPLES.matchAll(/```tsx\s*([\s\S]*?)```/g)).map((m) => m[1]);
    expect(codeBlocks.length).toBeGreaterThanOrEqual(2);

    codeBlocks.forEach((code, idx) => {
      const result = validateSceneCode(code, `Example${idx + 1}.tsx`);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
