import { generateIsoPlan } from '@/lib/explainer/iso-plan';
import { buildIsoWorld, ResolvedIso } from '@/lib/explainer/iso-world';
import { AspectRatioDimensions, Storyboard, StudioProject } from '@/types/studio';
import { contrastRatio } from './anti-slop';
import { validateSceneCode } from './code-validator';

const VIEW_CENTER = 0.55;

/** Writes the composition both the preview and the export run. The world is plain data inside it. */
export function worldMainVideoCode(storyboard: Storyboard, resolved: ResolvedIso): string {
  const { plan } = resolved;
  const { width, height } = AspectRatioDimensions[storyboard.aspectRatio];

  let from = 0;
  const beats = storyboard.scenes.map((scene, index) => {
    const start = from;
    from += scene.durationInFrames;
    return {
      ...plan.beats[index],
      text: scene.voiceoverText,
      view: 'main',
      zoom: 1,
      from: start,
      duration: scene.durationInFrames,
      audio: scene.audioUrl ?? '',
      wordTimings: scene.wordTimings,
      sfx: scene.sfxCue,
      ...(scene.role === 'cta' && scene.kineticHeadline.trim()
        ? { cta: { text: scene.kineticHeadline.trim(), color: contrastRatio('#FFFFFF', plan.palette.accent) >= 4.5 ? '#FFFFFF' : plan.palette.ink } }
        : {}),
    };
  });

  const data = {
    world: buildIsoWorld(resolved, beats, { width, height, centerY: VIEW_CENTER }),
    script: { unit: plan.unit, palette: plan.palette, music: storyboard.bgmTrack, beats },
  };

  return `import React from 'react';
import { IsoVideo } from '@/motion-kit';

const data = ${JSON.stringify(data)};

export const MainVideo: React.FC = () => <IsoVideo world={data.world} script={data.script} />;

export default MainVideo;
`;
}

export async function buildWorldFiles(model: string, project: StudioProject): Promise<{ code: string; repairs: string[] }> {
  const story = project.storyboard.scenes.map((scene) => scene.voiceoverText);
  const result = await generateIsoPlan(model, project.userPrompt, story);
  const code = worldMainVideoCode(project.storyboard, result.resolved);
  const validation = validateSceneCode(code, 'MainVideo.tsx');
  if (!validation.valid) throw new Error(`Kode dunia tidak valid: ${validation.errors.join('; ')}`);
  console.log(`[World] ${project.id}: ${result.attempts} attempts, ${result.usage.promptTokens} in, ${result.usage.completionTokens} out, ${Math.round(result.usage.seconds)}s`);
  return { code, repairs: result.resolved.warnings };
}
