import { buildIsoWorld, ResolvedIso } from '@/lib/explainer/iso-world';
import { buildIsoPicture, generateIsoPicturePlan, IsoPicturePlan } from '@/lib/explainer/iso-picture';
import type { IsoPicture } from '@/motion-kit/world/IsoPicture';
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

/** Beats carry the timing, audio, and panel text both world engines share. */
function timedBeats(storyboard: Storyboard, planBeats: IsoPicturePlan['beats'], accent: string, ink: string) {
  let from = 0;
  return storyboard.scenes.map((scene, index) => {
    const start = from;
    from += scene.durationInFrames;
    return {
      ...planBeats[index],
      text: scene.voiceoverText,
      view: 'main',
      zoom: 1,
      from: start,
      duration: scene.durationInFrames,
      audio: scene.audioUrl ?? '',
      wordTimings: scene.wordTimings,
      sfx: scene.sfxCue,
      ...(scene.role === 'cta' && scene.kineticHeadline.trim()
        ? { cta: { text: scene.kineticHeadline.trim(), color: contrastRatio('#FFFFFF', accent) >= 4.5 ? '#FFFFFF' : ink } }
        : {}),
    };
  });
}

/** Writes the composition for a painted isometric world. The picture is plain data inside it. */
export function worldPictureVideoCode(storyboard: Storyboard, plan: IsoPicturePlan, picture: IsoPicture): string {
  const beats = timedBeats(storyboard, plan.beats, plan.palette.accent, plan.palette.ink);
  const data = { picture, script: { unit: plan.unit, palette: plan.palette, music: storyboard.bgmTrack, beats } };
  return `import React from 'react';
import { IsoPictureVideo } from '@/motion-kit';

const data = ${JSON.stringify(data)};

export const MainVideo: React.FC = () => <IsoPictureVideo picture={data.picture} script={data.script} />;

export default MainVideo;
`;
}

export async function buildWorldFiles(model: string, project: StudioProject): Promise<{ code: string; repairs: string[] }> {
  const story = project.storyboard.scenes.map((scene) => scene.voiceoverText);
  const result = await generateIsoPicturePlan(model, project.userPrompt, story);
  const beats = timedBeats(project.storyboard, result.plan.beats, result.plan.palette.accent, result.plan.palette.ink);
  const built = await buildIsoPicture(project.id, project.storyboard, result.plan, beats, model);
  const code = worldPictureVideoCode(project.storyboard, result.plan, built.picture);
  const validation = validateSceneCode(code, 'MainVideo.tsx');
  if (!validation.valid) throw new Error(`Kode dunia tidak valid: ${validation.errors.join('; ')}`);
  console.log(`[World] ${project.id}: ${result.attempts} attempts, ${result.usage.promptTokens} in, ${result.usage.completionTokens} out, ${Math.round(result.usage.seconds)}s plan, ${built.images} images in ${Math.round(built.seconds)}s, missing parts: ${built.missing.join(',') || 'none'}`);
  return { code, repairs: built.missing.map((id) => `Bagian "${id}" tidak ditemukan di gambar, adegannya memakai bidikan lebar`) };
}
