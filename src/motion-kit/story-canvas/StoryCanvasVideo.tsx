'use client';

import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { WorldOverlay, type WorldVideoProps } from '../world/WorldStage';
import { TitleBoundary } from '../iso-canvas/title-kit';
import type { CaptionProps } from '../world/caption-track';
import type { PanelProps } from '../world/panel-track';
import { StoryCanvasScene } from './StoryCanvasScene';
import { paintStoryScene, type StorySceneSpec, type StoryWorld } from './scenes';

/** The overlay panel ends near 30% of the height at most, so labels start below it. */
const LABEL_TOP = 0.31;

/**
 * A story canvas video: each scene paints its place, props, and people (or its own close-up)
 * on a canvas, under the same panel, captions, audio, and music overlay as isometric videos.
 */
export const StoryCanvasVideo: React.FC<{
  scenes: StorySceneSpec[];
  world: StoryWorld;
  script: WorldVideoProps['script'];
  title?: React.FC<{ duration: number }>;
  titleFrames?: number;
  caption?: React.FC<CaptionProps>;
  panel?: React.FC<PanelProps>;
}> = ({ scenes, world, script, title: Title, titleFrames = 0, caption, panel }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      {scenes.map((scene, index) => {
        const from = Math.round(scene.start * fps);
        const next = scenes[index + 1];
        const duration = Math.max(1, (next ? Math.round(next.start * fps) : from + Math.round(scene.duration * fps)) - from);
        return (
          <Sequence key={index} from={from} durationInFrames={duration} layout="none">
            <StoryCanvasScene draw={(s, t) => paintStoryScene(s, scene, t, world)} labelTop={LABEL_TOP} />
          </Sequence>
        );
      })}
      {Title && titleFrames > 0 && (
        <Sequence from={0} durationInFrames={titleFrames} layout="none">
          <TitleBoundary>
            <Title duration={titleFrames} />
          </TitleBoundary>
        </Sequence>
      )}
      <WorldOverlay script={script} hudFrom={Title ? titleFrames : 0} caption={caption} panel={panel} />
    </AbsoluteFill>
  );
};
